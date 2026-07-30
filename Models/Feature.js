const mongoose = require('mongoose');

const featureSchema = new mongoose.Schema({
    name: String,
    imageUrl: String,
    bannerUrl: String,
    description: String,
    tags: [String],
    createdAt: { type: Date, default: Date.now }
});

const Feature = mongoose.model('Features', featureSchema);

module.exports = Feature;
