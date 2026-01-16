const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // จะถูก Hash
  role: { type: String, default: 'admin' }
});

module.exports = mongoose.model('Admin', AdminSchema);