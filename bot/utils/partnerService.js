const Partner = require('../Models/Partner');
const PartnerApplication = require('../Models/PartnerApplication');

const PARTNER_PRO_DAYS = 90;
const PARTNER_DISCOUNT_PERCENTAGE = 25;
const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date, days) { return new Date(new Date(date).getTime() + days * DAY_MS); }
function normalizeApplicationInput(body = {}, user = {}) {
  const value = key => String(body[key] ?? '').trim();
  return {
    discordUserId: value('discordUserId') || String(user.id || ''),
    discordUsername: value('discordUsername') || String(user.username || user.global_name || ''),
    communityName: value('communityName'), websiteOrInvite: value('websiteOrInvite'),
    communitySize: Number(body.communitySize), description: value('description'),
    whyPartner: value('whyPartner'), offer: value('offer'), additionalInformation: value('additionalInformation'),
  };
}
function validateApplication(info, userId) {
  if (!/^\d{5,25}$/.test(info.discordUserId) || info.discordUserId !== String(userId)) return 'discord_user_id_must_match_authenticated_user';
  if (!info.discordUsername || !info.communityName || !info.websiteOrInvite || !info.description || !info.whyPartner || !info.offer) return 'required_fields_missing';
  if (!Number.isInteger(info.communitySize) || info.communitySize < 1) return 'invalid_community_size';
  return null;
}
async function approveApplication(applicationId, adminId, now = new Date()) {
  const application = await PartnerApplication.findOneAndUpdate({ _id: applicationId, status: { $in: ['PENDING', 'UNDER_REVIEW'] } }, { $set: { status: 'APPROVED', reviewedAt: now, reviewedBy: adminId } }, { new: true });
  if (!application) throw Object.assign(new Error('application_not_approvable'), { status: 409 });
  const expiresAt = addDays(now, PARTNER_PRO_DAYS);
  const partner = await Partner.findOneAndUpdate({ userId: application.applicantUserId }, {
    $setOnInsert: { userId: application.applicantUserId, applicationId: application._id, startedAt: now, approvedBy: adminId, discountPercentage: PARTNER_DISCOUNT_PERCENTAGE },
    $set: { status: 'ACTIVE', discountActive: true, expiresAt, 'partnerPro.plan': 'pro_premium', 'partnerPro.durationDays': PARTNER_PRO_DAYS, 'partnerPro.grantedAt': now, 'partnerPro.expiresAt': expiresAt },
  }, { upsert: true, new: true, setDefaultsOnInsert: true });
  return partner;
}
async function renewPartner(partnerId, adminId, now = new Date()) {
  const partner = await Partner.findOne({ _id: partnerId, status: 'ACTIVE' });
  if (!partner) throw Object.assign(new Error('active_partner_not_found'), { status: 404 });
  const base = partner.partnerPro?.expiresAt && new Date(partner.partnerPro.expiresAt) > now ? partner.partnerPro.expiresAt : now;
  const expiresAt = addDays(base, PARTNER_PRO_DAYS);
  partner.expiresAt = expiresAt; partner.partnerPro.expiresAt = expiresAt; partner.partnerPro.lastRenewedAt = now; partner.approvedBy = adminId;
  await partner.save();
  return partner;
}
async function getActivePartnerDiscount(userId, now = new Date()) {
  const partner = await Partner.findOne({ userId: String(userId), status: 'ACTIVE', discountActive: true, expiresAt: { $gt: now } }).lean();
  return partner ? { percentage: PARTNER_DISCOUNT_PERCENTAGE, product: 'pro_premium', partnerId: partner._id } : null;
}
async function endPartner(partnerId, now = new Date()) {
  const partner = await Partner.findByIdAndUpdate(partnerId, { $set: { status: 'ENDED', discountActive: false, endedAt: now } }, { new: true });
  if (!partner) throw Object.assign(new Error('partner_not_found'), { status: 404 });
  return partner;
}
module.exports = { PARTNER_PRO_DAYS, PARTNER_DISCOUNT_PERCENTAGE, normalizeApplicationInput, validateApplication, approveApplication, renewPartner, endPartner, getActivePartnerDiscount };
