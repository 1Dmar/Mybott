const mongoose = require('mongoose');
const sectionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 80 },
  items: { type: [String], required: true, validate: value => value.length <= 12 },
}, { _id: false });
const changelogEntrySchema = new mongoose.Schema({
  version: { type: String, required: true, trim: true, maxlength: 32 },
  date: { type: String, required: true, trim: true, maxlength: 80 },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  description: { type: String, required: true, trim: true, maxlength: 500 },
  categories: { type: [String], required: true, enum: ['NEW', 'IMPROVED', 'FIXED', 'SECURITY'], validate: value => value.length >= 1 && value.length <= 4 },
  sections: { type: [sectionSchema], required: true, validate: value => value.length >= 1 && value.length <= 6 },
  createdBy: { type: String, required: true, index: true },
}, { timestamps: true });
changelogEntrySchema.index({ createdAt: -1 });
module.exports = mongoose.models.ProMcBotChangelogEntry || mongoose.model('ProMcBotChangelogEntry', changelogEntrySchema);
