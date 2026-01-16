require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const webpush = require('web-push');
const FormData = require('form-data');
const path = require('path');
const bcrypt = require('bcryptjs'); // ⚠️ อย่าลืม npm install bcryptjs

// Import Models
const Event = require('./models/Event');
const Subscription = require('./models/Subscription');
const Admin = require('./models/Admin');       // ✅ เพิ่ม
const InviteCode = require('./models/InviteCode'); // ✅ เพิ่ม

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. CONFIGURATIONS ---
mongoose.connect(process.env.DB_CONNECTION)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error(err));

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const upload = multer({ storage: multer.memoryStorage() });

// --- Helper: Upload to ImgBB ---
const uploadToImgBB = async (buffer) => {
    const formData = new FormData();
    formData.append('image', buffer.toString('base64'));
    const response = await axios.post(`https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`, formData, {
        headers: formData.getHeaders()
    });
    return response.data.data.url;
};

// --- 2. MIDDLEWARES ---
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(403).send('Token required');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).send('Invalid Token');
  }
};

// --- 3. AUTH ROUTES (ระบบใหม่) ---

// 3.1 Login (Database Check)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  // ค้นหา Admin
  const admin = await Admin.findOne({ username });
  if (!admin) return res.status(400).json({ error: 'User not found' });

  // ตรวจสอบรหัสผ่าน
  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) return res.status(400).json({ error: 'Wrong password' });

  // ออก Token
  const token = jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET || 'secret_key', { expiresIn: '1d' });
  res.json({ token, username: admin.username });
});

// 3.2 Check Invite Code
app.get('/api/auth/check-invite/:code', async (req, res) => {
  const { code } = req.params;
  const invite = await InviteCode.findOne({ code, isUsed: false, expiresAt: { $gt: new Date() } });
  if (!invite) return res.json({ valid: false });
  res.json({ valid: true });
});

// 3.3 Register (ต้องมี Invite Code)
app.post('/api/auth/register', async (req, res) => {
  const { username, password, inviteCode } = req.body;

  // ตรวจสอบ Code
  const invite = await InviteCode.findOne({ code: inviteCode, isUsed: false, expiresAt: { $gt: new Date() } });
  if (!invite) return res.status(400).json({ error: 'Invite code invalid or expired' });

  // สร้าง Admin
  const hashedPassword = await bcrypt.hash(password, 10);
  const newAdmin = new Admin({ username, password: hashedPassword });
  await newAdmin.save();

  // ตัด Code ทิ้ง
  invite.isUsed = true;
  await invite.save();

  res.json({ message: 'Registered successfully' });
});

// 3.4 Generate Invite (Admin Only)
app.post('/api/auth/generate-invite', verifyToken, async (req, res) => {
  const code = Math.random().toString(36).substring(2, 10); // สุ่มรหัสสั้นๆ
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // หมดอายุใน 24 ชม.

  await InviteCode.create({
    code,
    expiresAt,
    createdBy: req.user.id
  });

  res.json({ code, expiresAt });
});

// --- 4. EVENT & SUB ROUTES (เหมือนเดิมแต่ปรับ VerifyToken) ---

app.post('/api/notifications/subscribe', async (req, res) => {
  try {
    await Subscription.findOneAndUpdate({ endpoint: req.body.endpoint }, req.body, { upsert: true });
    res.status(201).json({});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/events', async (req, res) => {
  const { role } = req.query;
  // ถ้าไม่ใช่ Admin ให้เห็นเฉพาะ Approved
  const filter = role === 'admin' ? {} : { status: 'approved' };
  try {
    const events = await Event.find(filter).sort({ start: 1 });
    res.json(events);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/events', upload.array('images', 10), async (req, res) => {
    // เช็ค Token แบบ Optional (ถ้ามี Token = Admin approved เลย, ถ้าไม่มี = User pending)
    const token = req.headers['authorization']?.split(' ')[1];
    let isAdmin = false;
    if(token) {
        try { jwt.verify(token, process.env.JWT_SECRET || 'secret_key'); isAdmin = true; } catch(e){}
    }

    try {
        const imageUrls = [];
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file => uploadToImgBB(file.buffer));
            imageUrls.push(...await Promise.all(uploadPromises));
        }

        const newEvent = new Event({
            title: req.body.title,
            start: req.body.start,
            end: req.body.end,
            color: req.body.color,
            description: req.body.description,
            linkUrl: req.body.linkUrl,
            imageUrls,
            status: isAdmin ? 'approved' : 'pending',
            createdBy: isAdmin ? 'admin' : 'user'
        });

        await newEvent.save();

        // Send Push
        if (isAdmin) {
             const payload = JSON.stringify({
                title: `🔥 ใหม่! ${req.body.title}`,
                body: req.body.description || 'คลิกเพื่อดูรายละเอียด',
                icon: imageUrls[0] || ''
             });
             const subs = await Subscription.find();
             subs.forEach(sub => webpush.sendNotification(sub, payload).catch(e => console.log(e)));
        }

        res.status(201).json(newEvent);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/events/:id', verifyToken, upload.array('images', 10), async (req, res) => {
  try {
    let updateData = { ...req.body };
    if (req.files?.length > 0) {
      const newUrls = await Promise.all(req.files.map(f => uploadToImgBB(f.buffer)));
      updateData.$push = { imageUrls: { $each: newUrls } };
    }
    const updated = await Event.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/events/:id/approve', verifyToken, async (req, res) => {
    await Event.findByIdAndUpdate(req.params.id, { status: 'approved' });
    res.json({ success: true });
});

app.delete('/api/events/:id', verifyToken, async (req, res) => {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// Serve Frontend
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));