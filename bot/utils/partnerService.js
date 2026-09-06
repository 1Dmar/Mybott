const Partner = require('../Models/Partner');
const PartnerApplication = require('../Models/PartnerApplication');
const Subscription = require('../Models/Subscription');

const PARTNER_PRO_DAYS = 90;
const PARTNER_DISCOUNT_PERCENTAGE = 25;
const PARTNER_PRODUCT = 'pro_premium';
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

// A partner is represented by the existing Subscription entitlement authority. The
// user id is used as the entitlement owner because partner benefits are user-scoped.
async function grantPartnerEntitlement(userId, now, expiresAt) {
  return Subscription.findOneAndUpdate(
    { guildId: String(userId) },
    { $set: {
      plan: 'pro', status: 'active', provider: 'manual',
      currentPeriodStart: now, currentPeriodEnd: expiresAt,
      renewalState: 'not_applicable', gracePeriodEnd: null,
      'metadata.paymentVerified': true, 'metadata.source': 'partner', 'metadata.partnerPro': true,
    }, $setOnInsert: { guildId: String(userId) } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
}
async function approveApplication(applicationId, adminId, now = new Date()) {
  const existingApplication = await PartnerApplication.findById(applicationId).lean();
  if (!existingApplication) throw Object.assign(new Error('application_not_found'), { status: 404 });
  if (existingApplication.status === 'APPROVED') {
    const existing = await Partner.findOne({ applicationId: existingApplication._id }).lean();
    if (existing) return { partner: existing, idempotent: true, application: existingApplication };
  }
  if (!['PENDING', 'UNDER_REVIEW'].includes(existingApplication.status)) throw Object.assign(new Error('application_not_approvable'), { status: 409 });
  const application = await PartnerApplication.findOneAndUpdate(
    { _id: applicationId, status: { $in: ['PENDING', 'UNDER_REVIEW'] } },
    { $set: { status: 'APPROVED', reviewedAt: now, reviewedBy: String(adminId), rejectionReason: null } },
    { new: true },
  ).lean();
  if (!application) {
    const approved = await PartnerApplication.findById(applicationId).lean();
    const partner = approved?.status === 'APPROVED' ? await Partner.findOne({ applicationId }).lean() : null;
    if (partner) return { partner, idempotent: true, application: approved };
    throw Object.assign(new Error('application_not_approvable'), { status: 409 });
  }
  const expiresAt = addDays(now, PARTNER_PRO_DAYS);
  const entitlement = await grantPartnerEntitlement(application.applicantUserId, now, expiresAt);
  const partner = await Partner.findOneAndUpdate(
    { userId: application.applicantUserId },
    { $setOnInsert: { userId: application.applicantUserId, applicationId: application._id, startedAt: now, approvedBy: String(adminId), approvedAt: now, discountPercentage: PARTNER_DISCOUNT_PERCENTAGE },
      $set: { status: 'ACTIVE', endedAt: null, endedReason: null, discountActive: true, expiresAt, approvedBy: String(adminId), approvedAt: now,
        'partnerPro.plan': PARTNER_PRODUCT, 'partnerPro.durationDays': PARTNER_PRO_DAYS, 'partnerPro.grantedAt': now, 'partnerPro.expiresAt': expiresAt, 'partnerPro.entitlementId': String(entitlement._id) } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return { partner, application, entitlement, idempotent: false };
}
async function renewPartner(partnerId, actorId, now = new Date()) {
  const partner = await Partner.findOne({ _id: partnerId, status: 'ACTIVE' });
  if (!partner) throw Object.assign(new Error('active_partner_not_found'), { status: 404 });
  const base = partner.partnerPro?.expiresAt && new Date(partner.partnerPro.expiresAt) > now ? partner.partnerPro.expiresAt : now;
  const expiresAt = addDays(base, PARTNER_PRO_DAYS);
  await grantPartnerEntitlement(partner.userId, now, expiresAt);
  partner.expiresAt = expiresAt; partner.partnerPro.expiresAt = expiresAt; partner.partnerPro.lastRenewedAt = now; partner.discountActive = true; partner.approvedBy = String(actorId);
  await partner.save();
  return partner.toObject();
}
async function getActivePartnerDiscount(userId, product = PARTNER_PRODUCT, now = new Date()) {
  if (product !== PARTNER_PRODUCT) return null;
  const partner = await Partner.findOne({ userId: String(userId), status: 'ACTIVE', discountActive: true, expiresAt: { $gt: now } }).lean();
  return partner ? { percentage: PARTNER_DISCOUNT_PERCENTAGE, product: PARTNER_PRODUCT, partnerId: partner._id } : null;
}
async function endPartner(partnerId, reason = '', now = new Date()) {
  const partner = await Partner.findByIdAndUpdate(partnerId, { $set: { status: 'ENDED', discountActive: false, endedAt: now, endedReason: String(reason).slice(0, 2000) } }, { new: true });
  if (!partner) throw Object.assign(new Error('partner_not_found'), { status: 404 });
  return partner;
}
module.exports = { PARTNER_PRO_DAYS, PARTNER_DISCOUNT_PERCENTAGE, PARTNER_PRODUCT, normalizeApplicationInput, validateApplication, approveApplication, renewPartner, endPartner, getActivePartnerDiscount, grantPartnerEntitlement };
