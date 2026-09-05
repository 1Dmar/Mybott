'use strict';

const { Schema, model } = require('mongoose');

const reviewSchema = new Schema({
  authorId: { type: String, required: true, trim: true, index: true },
  displayName: { type: String, required: true, trim: true, maxlength: 80 },
  title: { type: String, trim: true, maxlength: 120, default: '' },
  body: { type: String, required: true, trim: true, minlength: 12, maxlength: 1200 },
  rating: { type: Number, required: true, min: 1, max: 5 },
  source: { type: String, enum: ['promcbot', 'reviews_io'], default: 'promcbot', index: true },
  providerReviewId: { type: String, trim: true, default: null, sparse: true },
  sourceUrl: { type: String, trim: true, maxlength: 1000, default: null },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  verified: { type: Boolean, default: false },
  consentToPublish: { type: Boolean, required: true, default: false },
  moderationNote: { type: String, trim: true, maxlength: 500, default: '' },
  approvedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

reviewSchema.index({ status: 1, approvedAt: -1, createdAt: -1 });
reviewSchema.index({ authorId: 1, createdAt: -1 });

module.exports = model('Review', reviewSchema);
