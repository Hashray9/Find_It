const mongoose = require('mongoose');

const lowerSchema = new mongoose.Schema({
  name: String,        // Image name or title
  data: String,        // Base64 encoded image data
});

const lower = mongoose.model('Lower', lowerSchema);

module.exports = lower;