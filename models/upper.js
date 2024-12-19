const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  name: String,        // Image name or title
  data: String,        // Base64 encoded image data
});

const upper = mongoose.model('Upper', imageSchema);

module.exports = upper;
