const mongoose = require('mongoose');
const SubscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, unique: true },
  keys: { p256dh: String, auth: String }
});
module.exports = mongoose.model('Subscription', SubscriptionSchema);