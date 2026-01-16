const mongoose = require('mongoose');

const InviteCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  isUsed: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
});

// จุดที่ต้องเช็คคือบรรทัดนี้ ต้องเป็น 'InviteCode' ไม่ใช่ 'Admin'
module.exports = mongoose.model('InviteCode', InviteCodeSchema);