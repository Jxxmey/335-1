require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const webpush = require('web-push');
const FormData = require('form-data');
const cloudinary = require('cloudinary').v2;
const path = require('path'); // ✅ เพิ่มบรรทัดนี้ครับ สำคัญมาก!

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

// Config Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Config Push Notification
webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Config Upload
const upload = multer({ storage: multer.memoryStorage() });

// --- Helper: Upload to Cloudinary ---
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "promohub" },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    stream.end(buffer);
  });
};

// --- 2. MIDDLEWARES ---
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

const verifyTokenOptional = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.ADMIN_PASSWORD);
      req.user = decoded;
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

// GET Events
app.get('/api/events', async (req, res) => {
  const { role } = req.query;
  let filter = {};
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

// POST Event (Create)
app.post('/api/events', verifyTokenOptional, upload.array('images', 10), async (req, res) => {
  try {
    const imageUrls = [];
    const imagePublicIds = [];
    
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
      const results = await Promise.all(uploadPromises);
      
      results.forEach(result => {
          imageUrls.push(result.secure_url);
          imagePublicIds.push(result.public_id);
      });
    }

    const status = req.user ? 'approved' : 'pending';

    const newEvent = new Event({
      title: req.body.title,
      start: req.body.start,
      end: req.body.end,
      color: req.body.color,
      description: req.body.description,
      linkUrl: req.body.linkUrl,
      imageUrls,
      imagePublicIds,
      status: status,
      createdBy: req.user ? 'admin' : 'user'
    });

    await newEvent.save();

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

// PUT Event (Update)
app.put('/api/events/:id', verifyToken, upload.array('images', 10), async (req, res) => {
  try {
    const { title, start, end, color, description, linkUrl } = req.body;
    let updateData = { title, start, end, color, description, linkUrl };

    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
      const results = await Promise.all(uploadPromises);
      
      const newUrls = results.map(r => r.secure_url);
      const newIds = results.map(r => r.public_id);
      
      updateData.$push = { 
          imageUrls: { $each: newUrls },
          imagePublicIds: { $each: newIds }
      };
    }

    const updatedEvent = await Event.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(updatedEvent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve Event
app.put('/api/events/:id/approve', verifyToken, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Event
app.delete('/api/events/:id', verifyToken, async (req, res) => {
  try {
      const event = await Event.findById(req.params.id);
      if (!event) return res.status(404).json({ error: 'Event not found' });

      if (event.imagePublicIds && event.imagePublicIds.length > 0) {
          const deletePromises = event.imagePublicIds.map(id => cloudinary.uploader.destroy(id));
          await Promise.all(deletePromises);
          console.log('🗑️ Deleted images from Cloudinary');
      }

      await Event.findByIdAndDelete(req.params.id);
      res.json({ message: 'Deleted event and images' });

  } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------
// ✅ ให้ Backend เสิร์ฟไฟล์ Frontend (ส่วนสำคัญ)
// ----------------------------------------
// ต้องวางไว้ล่างสุด ก่อน app.listen
app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.get('*', (req, res) => {
  // อย่าลืมเช็คว่า path ไม่ชนกับ /api
  if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
  }
});
// ----------------------------------------

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));