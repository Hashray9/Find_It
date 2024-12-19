const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
  shopName: { type: String, required: true },
});

const Shop = mongoose.model('Shop', shopSchema);
module.exports = Shop;
