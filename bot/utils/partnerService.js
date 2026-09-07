const Partner = require('../Models/Partner');
const PartnerApplication = require('../Models/PartnerApplication');
const Subscription = require('../Models/Subscription');

const PARTNER_INITIAL_DAYS = 30;
const PARTNER_EXTENSION_DAYS = 90;
const PARTNER_PRO_DAYS = PARTNER_INITIAL_DAYS;
const PARTNER_DISCOUNT_PERCENTAGE = 25;
const PARTNER_PRODUCT = 'pro_premium';
const PARTNER_METADATA_IMAGE_URL = 'https://i.ibb.co/gbjV4ntT/file-00000000c718824386095711776b17d2.png';
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

// Partner Pro is granted to the selected Discord server only.
async function grantPartnerEntitlement(guildId, now, expiresAt) {
  return Subscription.findOneAndUpdate(
    { guildId: String(guildId) },
    { $set: {
      plan: 'pro', status: 'active', provider: 'manual',
      currentPeriodStart: now, currentPeriodEnd: expiresAt,
      renewalState: 'not_applicable', gracePeriodEnd: null,
      'metadata.paymentVerified': true, 'metadata.source': 'partner', 'metadata.partnerPro': true,
    }, $setOnInsert: { guildId: String(guildId) } },
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
  const expiresAt = addDays(now, PARTNER_INITIAL_DAYS);
  const entitlement = await grantPartnerEntitlement(application.guildId, now, expiresAt);
  const partner = await Partner.findOneAndUpdate(
    { guildId: application.guildId },
    { $setOnInsert: { userId: application.applicantUserId, guildId: application.guildId, applicationId: application._id, startedAt: now, approvedBy: String(adminId), approvedAt: now, discountPercentage: PARTNER_DISCOUNT_PERCENTAGE },
      $set: { status: 'ACTIVE', endedAt: null, endedReason: null, discountActive: true, expiresAt, approvedBy: String(adminId), approvedAt: now,
        'metadata.imageUrl': PARTNER_METADATA_IMAGE_URL, 'metadata.imageAlt': 'ProMcBot Partners',
        'partnerPro.plan': PARTNER_PRODUCT, 'partnerPro.durationDays': PARTNER_INITIAL_DAYS, 'partnerPro.grantedAt': now, 'partnerPro.expiresAt': expiresAt, 'partnerPro.entitlementId': String(entitlement._id) } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return { partner, application, entitlement, idempotent: false };
}

async function renewPartner(partnerId, actorId, now = new Date()) {
  const partner = await Partner.findOne({ _id: partnerId, status: 'ACTIVE' });
  if (!partner) throw Object.assign(new Error('active_partner_not_found'), { status: 404 });
  const expiresAt = addDays(partner.startedAt || now, PARTNER_EXTENSION_DAYS);
  if (partner.partnerPro?.expiresAt && new Date(partner.partnerPro.expiresAt) >= expiresAt) throw Object.assign(new Error('partner_already_extended'), { status: 409 });
  await grantPartnerEntitlement(partner.guildId, now, expiresAt);
  partner.expiresAt = expiresAt;
  partner.partnerPro.expiresAt = expiresAt;
  partner.partnerPro.durationDays = PARTNER_EXTENSION_DAYS;
  partner.partnerPro.lastRenewedAt = now;
  partner.discountActive = true;
  partner.approvedBy = String(actorId);
  partner.metadata = { ...(partner.metadata?.toObject?.() || partner.metadata || {}), imageUrl: PARTNER_METADATA_IMAGE_URL, imageAlt: 'ProMcBot Partners' };
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
module.exports = { PARTNER_INITIAL_DAYS, PARTNER_EXTENSION_DAYS, PARTNER_PRO_DAYS, PARTNER_DISCOUNT_PERCENTAGE, PARTNER_PRODUCT, PARTNER_METADATA_IMAGE_URL, normalizeApplicationInput, validateApplication, approveApplication, renewPartner, endPartner, getActivePartnerDiscount, grantPartnerEntitlement };
