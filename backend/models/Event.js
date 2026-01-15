const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  color: { type: String, default: '#3788d8' },
  description: String,
  linkUrl: String,
  imageUrls: [String],
  // เพิ่ม field สถานะ: pending (รอ), approved (อนุมัติ)
  status: { type: String, default: 'approved', enum: ['pending', 'approved'] }, 
  createdBy: { type: String, default: 'admin' } // admin หรือ user
});

module.exports = mongoose.model('Event', EventSchema);