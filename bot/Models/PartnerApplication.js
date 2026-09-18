const mongoose = require('mongoose');

const partnerApplicationSchema = new mongoose.Schema({
  applicantUserId: { type: String, required: true, index: true },
  information: {
    discordUserId: { type: String, required: true, trim: true, maxlength: 32 },
    discordUsername: { type: String, required: true, trim: true, maxlength: 120 },
    communityName: { type: String, required: true, trim: true, maxlength: 160 },
    websiteOrInvite: { type: String, required: true, trim: true, maxlength: 500 },
    communitySize: { type: Number, required: true, min: 1, max: 1000000000 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    whyPartner: { type: String, required: true, trim: true, maxlength: 3000 },
    offer: { type: String, required: true, trim: true, maxlength: 3000 },
    additionalInformation: { type: String, default: '', trim: true, maxlength: 3000 },
  },
  status: { type: String, enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
  submittedAt: { type: Date, default: Date.now, index: true },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: String, default: null },
  rejectionReason: { type: String, default: null, maxlength: 2000 },
  adminNotes: { type: String, default: '', maxlength: 3000 },
}, { timestamps: true });
partnerApplicationSchema.index({ applicantUserId: 1, status: 1 });
partnerApplicationSchema.index({ applicantUserId: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['PENDING', 'UNDER_REVIEW', 'APPROVED'] } } });
module.exports = mongoose.models.PartnerApplication || mongoose.model('PartnerApplication', partnerApplicationSchema);
