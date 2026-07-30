const mongoose = require('mongoose');

const featureSchema = new mongoose.Schema({
    name: String,
    imageUrl: String,
    bannerUrl: String,
    description: String,
    tags: [String],
    createdAt: { type: Date, default: Date.now }
});

const Feature = mongoose.model('Feature', featureSchema);

const addFeature = async (name, imageUrl, bannerUrl, description, tags) => {
    const newFeature = new Feature({
        name,
        imageUrl,
        bannerUrl,
        description,
        tags,
        createdAt: new Date()
    });
    await newFeature.save();
};

const removeFeature = async (id) => {
    await Feature.findByIdAndDelete(id);
};

const fetchFeatures = async () => {
    return await Feature.find();
};

module.exports = {
    addFeature,
    removeFeature,
    fetchFeatures,
    Feature // إضافة `Feature` للتصدير
};
