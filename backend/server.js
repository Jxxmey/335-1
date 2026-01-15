require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer'); // Import Multer
const axios = require('axios');
const jwt = require('jsonwebtoken');
const webpush = require('web-push');
const FormData = require('form-data');

const Event = require('./models/Event');
const Subscription = require('./models/Subscription');

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. CONFIGURATIONS ---

// Connect DB
mongoose.connect(process.env.DB_CONNECTION)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error(err));

// Config Push Notification
webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Config Upload (ประกาศไว้ข้างบนสุด เพื่อให้เรียกใช้ได้ทุกที่)
const upload = multer({ storage: multer.memoryStorage() });

// --- 2. MIDDLEWARES ---

// Middleware ตรวจสอบ Token (สำหรับ Admin เท่านั้น)
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(403).send('Token required');
  try {
    jwt.verify(token, process.env.ADMIN_PASSWORD);
    next();
  } catch (err) {
    res.status(401).send('Invalid Token');
  }
};

// Middleware ตรวจสอบ Token แบบยืดหยุ่น (มีก็ได้ ไม่มีก็ได้)
// ใช้เช็คว่าคนโพสต์เป็น Admin หรือ User ธรรมดา
const verifyTokenOptional = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.ADMIN_PASSWORD);
      req.user = decoded; // ถ้ามี token และถูกต้อง ให้ถือว่าเป็น Admin
    } catch (e) {}
  }
  next();
};

// --- 3. ROUTES ---

// Login
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, process.env.ADMIN_PASSWORD, { expiresIn: '1d' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Wrong password' });
});

// Subscribe Notification
app.post('/api/notifications/subscribe', async (req, res) => {
  try {
    const sub = req.body;
    await Subscription.findOneAndUpdate({ endpoint: sub.endpoint }, sub, { upsert: true });
    res.status(201).json({});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Events: แยก User กับ Admin
app.get('/api/events', async (req, res) => {
  const { role } = req.query;
  let filter = {};
  
  // ถ้าไม่ใช่ admin ให้ดึงเฉพาะที่ 'approved'
  // (หรือถ้าไม่มี status เลยก็ให้ถือว่า approved เพื่อรองรับข้อมูลเก่า)
  if (role !== 'admin') {
    filter = {
        $or: [
            { status: 'approved' },
            { status: { $exists: false } } 
        ]
    };
  }
  
  try {
    const events = await Event.find(filter).sort({ start: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Event: สร้างโปรโมชั่น (รวมทั้ง Admin และ User ใน Route เดียว)
app.post('/api/events', verifyTokenOptional, upload.array('images', 10), async (req, res) => {
  try {
    const imageUrls = [];
    
    // Upload รูปไป ImgBB
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => {
        const formData = new FormData();
        formData.append('image', file.buffer.toString('base64'));
        return axios.post(`https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`, formData, {
            headers: formData.getHeaders()
        }).then(r => r.data.data.url);
      });
      const urls = await Promise.all(uploadPromises);
      imageUrls.push(...urls);
    }

    // เช็คสถานะ: ถ้ามี req.user (Admin) -> approved, ถ้าไม่มี (User) -> pending
    const status = req.user ? 'approved' : 'pending';

    const newEvent = new Event({
      title: req.body.title,
      start: req.body.start,
      end: req.body.end,
      color: req.body.color,
      description: req.body.description,
      linkUrl: req.body.linkUrl,
      imageUrls,
      status: status,
      createdBy: req.user ? 'admin' : 'user'
    });

    await newEvent.save();

    // ส่งแจ้งเตือน Push Notification (เฉพาะถ้าสถานะเป็น Approved เท่านั้น)
    if (status === 'approved') {
        const payload = JSON.stringify({
          title: `🔥 ใหม่! ${req.body.title}`,
          body: req.body.description || 'คลิกเพื่อดูรายละเอียด',
          icon: imageUrls[0] || '',
          url: '/'
        });
    
        const subs = await Subscription.find();
        subs.forEach(sub => {
          webpush.sendNotification(sub, payload).catch(err => {
            if(err.statusCode === 410) Subscription.deleteOne({_id: sub._id}).exec();
          });
        });
    }

    res.status(201).json(newEvent);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Process failed: ' + err.message });
  }
});

// 📌 UPDATE Event (เพิ่มส่วนนี้ให้แล้วครับ: สำหรับแก้ไขข้อมูล)
app.put('/api/events/:id', verifyToken, upload.array('images', 10), async (req, res) => {
  try {
    const { title, start, end, color, description, linkUrl } = req.body;
    
    // สร้าง Object ข้อมูลที่จะแก้ไข
    let updateData = {
      title, start, end, color, description, linkUrl
    };

    // ถ้ามีการอัปโหลดรูปเพิ่ม
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => {
        const formData = new FormData();
        formData.append('image', file.buffer.toString('base64'));
        return axios.post(`https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`, formData, {
            headers: formData.getHeaders()
        }).then(r => r.data.data.url);
      });
      const newUrls = await Promise.all(uploadPromises);
      
      // ใช้ $push เพื่อเพิ่มรูปใหม่เข้าไปต่อท้ายรูปเดิม
      updateData.$push = { imageUrls: { $each: newUrls } };
    }

    // ทำการ Update ใน Database
    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true } // option นี้เพื่อให้ mongoose คืนค่าข้อมูลใหม่กลับไป
    );

    res.json(updatedEvent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve Event (สำหรับ Admin)
app.put('/api/events/:id/approve', verifyToken, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
    
    // Optional: ส่งแจ้งเตือนเมื่ออนุมัติแล้วก็ได้ (เพิ่ม code webpush ตรงนี้ถ้าต้องการ)

    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Event
app.delete('/api/events/:id', verifyToken, async (req, res) => {
  try {
      await Event.findByIdAndDelete(req.params.id);
      res.json({ message: 'Deleted' });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// บอกให้รู้ว่าไฟล์ Frontend อยู่ที่ไหน (โฟลเดอร์ dist ที่ได้จากการ Build)
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// ถ้าเข้าลิงก์ไหนที่ไม่ใช่ /api ให้ส่งหน้า index.html ของ React ไปแสดง
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

// ----------------------------------------

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));