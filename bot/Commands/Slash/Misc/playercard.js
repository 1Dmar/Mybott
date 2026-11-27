'use strict';

const { ApplicationCommandType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { generatePlayerCard, rendererAvailable } = require('../../../utils/playerCardGenerator');
const Server = require('../../../Models/Server');
const PlayerAccount = require('../../../Models/PlayerAccount');
const MinecraftIdentity = require('../../../Models/MinecraftIdentity');
const PlayerServerLink = require('../../../Models/PlayerServerLink');
const PlayerCardSettings = require('../../../Models/PlayerCardSettings');
const TelemetryEvent = require('../../../Models/TelemetryEvent');
const PluginInstance = require('../../../Models/PluginInstance');

const PLUGIN_FRESHNESS_MS = 15 * 60 * 1000;

function uuidVariants(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return [];
  const compact = raw.replace(/-/g, '');
  const dashed = compact.length === 32
    ? `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`
    : raw;
  return [...new Set([raw, compact, dashed])];
}

function buildBadges({ interaction, stats, account, identity, targetMember = null }) {
  const badges = [];
  const memberPermissions = targetMember?.permissions;
  const isAdmin = Boolean(
    targetMember?.id && interaction.guild?.ownerId === targetMember.id ||
    memberPermissions?.has?.(PermissionFlagsBits.Administrator),
  );
  const joins = Number(stats?.joins || 0);
  const playtime = Number(stats?.sessionSeconds || 0);
  const activeDays = Number(stats?.activeDays || 0);

  // Staff is a property of the account shown on the card, never of the command invoker.
  if (isAdmin) badges.push({ key: 'staff', label: 'Staff', icon: 'shield', color: '#FFB347' });
  if (playtime >= 10 * 60 * 60 || joins >= 20) badges.push({ key: 'dedicated', label: 'Dedicated', icon: 'time', color: '#FF8A65' });
  if (activeDays >= 7 || joins >= 10) badges.push({ key: 'regular', label: 'Regular', icon: 'globe', color: '#55D6FF' });
  if (playtime >= 50 * 60 * 60 || joins >= 50) badges.push({ key: 'veteran', label: 'Veteran', icon: 'star', color: '#FFD700' });
  if (badges.length === 0 && (joins <= 2 || !identity?.lastSeenAt)) badges.push({ key: 'new', label: 'New', icon: 'star', color: '#8BE28B' });

  return badges.slice(0, 3);
}

module.exports = {
  name: 'playercard',
  description: 'Show a measured Minecraft player card for this server',
  userPermissions: PermissionFlagsBits.SendMessages,
  category: 'Minecraft',
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: 'template',
      description: 'Temporarily override your saved card template',
      type: 3,
      required: false,
      choices: [
        { name: 'Saved settings', value: 'saved' },
        { name: 'Minecraft', value: 'minecraft' },
        { name: 'Dark Mode', value: 'darkmode' },
        { name: 'Glass', value: 'glass' },
        { name: 'Minimal', value: 'minimal' },
      ],
    },
    {
      name: 'ign',
      description: 'Public Minecraft name lookup for your own card',
      type: 3,
      required: false,
    },
    {
      name: 'user',
      description: 'Show another member card if they allow it',
      type: 6,
      required: false,
    },
  ],
  run: async (_client, interaction) => {
    if (!rendererAvailable) {
      return interaction.reply({ content: 'ميزة بطاقة اللاعب غير متاحة حاليًا لأن مكوّن الصور لم يُبنَ في بيئة التشغيل.', ephemeral: true });
    }
    if (!interaction.guild?.id) return interaction.reply({ content: '❌ بطاقة اللاعب تعمل داخل سيرفر Discord فقط.', ephemeral: true });

    const requestedTemplate = interaction.options.getString('template') || 'saved';
    const legacyIgn = interaction.options.getString('ign')?.trim() || null;
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const isOwnCard = String(targetUser.id) === String(interaction.user.id);
    if (legacyIgn && !isOwnCard) return interaction.reply({ content: '❌ لا يمكن استخدام IGN مع بطاقة عضو آخر.', ephemeral: true });
    await interaction.deferReply();

    try {
      const [serverConfig, plugin] = await Promise.all([
        Server.findOne({ serverId: interaction.guild.id }).lean(),
        PluginInstance.findOne({ serverId: interaction.guild.id, revokedAt: null }).sort({ lastSeenAt: -1 }).lean(),
      ]);
      const pluginOnline = Boolean(plugin && (plugin.status === 'online' || (plugin.lastSeenAt && new Date(plugin.lastSeenAt).getTime() >= Date.now() - PLUGIN_FRESHNESS_MS)));
      let ign = legacyIgn;
      let template = requestedTemplate === 'saved' ? 'minecraft' : requestedTemplate;
      let cardLabel = interaction.guild.name || interaction.guild.id;
      let profileContext = { scopeLabel: cardLabel, cardState: plugin ? (pluginOnline ? 'never_joined' : 'server_offline') : 'server_not_configured', badges: [], isOnline: false };

      if (legacyIgn) {
        const legacyUsername = String(legacyIgn).trim();
        const legacyEvents = await TelemetryEvent.find({
          serverId: interaction.guild.id,
          type: { $in: ['player_join', 'player_leave'] },
          'data.username': new RegExp(`^${legacyUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        }).sort({ occurredAt: -1 }).limit(5000).lean();
        if (legacyEvents.length) {
          const joins = legacyEvents.filter(event => event.type === 'player_join');
          const leaves = legacyEvents.filter(event => event.type === 'player_leave');
          const legacyStats = {
            joins: joins.length,
            leaves: leaves.length,
            sessionSeconds: leaves.reduce((sum, event) => sum + (Number.isFinite(Number(event.data?.sessionSeconds)) ? Math.max(0, Number(event.data.sessionSeconds)) : 0), 0),
            activeDays: new Set(legacyEvents.map(event => new Date(event.occurredAt).toISOString().slice(0, 10))).size,
          };
          profileContext = {
            ...profileContext,
            firstSeenAt: legacyEvents[legacyEvents.length - 1]?.occurredAt || null,
            lastSeenAt: legacyEvents[0]?.occurredAt || null,
            stats: legacyStats,
            badges: buildBadges({ interaction, stats: legacyStats, identity: { lastSeenAt: legacyEvents[0]?.occurredAt } }),
            cardState: 'measured',
            isOnline: Boolean(pluginOnline && legacyEvents[0]?.type === 'player_join'),
          };
        }
      } else {
        const account = await PlayerAccount.findOne({ discordUserId: String(targetUser.id) }).lean();
        if (!account) return interaction.editReply({ content: '❌ لا يوجد حساب لاعب مرتبط بك بعد. استخدم `/player` لإنشاء كود الربط ثم نفّذه داخل Minecraft.' });
        const [card, identities] = await Promise.all([
          PlayerCardSettings.findOne({ accountId: account._id }).lean(),
          MinecraftIdentity.find({ accountId: account._id, active: true }).sort({ lastSeenAt: -1 }).lean(),
        ]);
        if (!identities.length) return interaction.editReply({ content: '❌ لا توجد هوية Minecraft موثقة لهذا الحساب بعد.' });
        if (!isOwnCard && (account.publicEnabled === false || card?.publicEnabled === false)) return interaction.editReply({ content: '❌ هذا المستخدم عطّل مشاركة بطاقة اللاعب.' });

        const identity = identities.find(item => String(item._id) === String(account.primaryIdentityId)) || identities[0];
        ign = identity.username;
        template = requestedTemplate === 'saved' ? (card?.template || 'minecraft') : requestedTemplate;
        const targetMember = isOwnCard
          ? interaction.member
          : await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        const link = await PlayerServerLink.findOne({ accountId: account._id, identityId: identity._id, serverId: interaction.guild.id }).sort({ lastSeenAt: -1 }).lean();
        const uuidMatches = uuidVariants(identity.uuid);
        const username = String(identity.username || '').trim();
        const events = await TelemetryEvent.find({
          serverId: interaction.guild.id,
          type: { $in: ['player_join', 'player_leave'] },
          $or: [
            { 'data.uuid': { $in: uuidMatches } },
            ...(username ? [{ 'data.username': new RegExp(`^${username.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, 'i') }] : []),
          ],
        }).sort({ occurredAt: -1 }).limit(5000).lean();
        const joins = events.filter(event => event.type === 'player_join');
        const leaves = events.filter(event => event.type === 'player_leave');
        const stats = {
          joins: joins.length,
          leaves: leaves.length,
          sessionSeconds: leaves.reduce((sum, event) => sum + (Number.isFinite(Number(event.data?.sessionSeconds)) ? Math.max(0, Number(event.data.sessionSeconds)) : 0), 0),
          activeDays: new Set(events.map(event => new Date(event.occurredAt).toISOString().slice(0, 10))).size,
        };
        // A verified PlayerServerLink is already proof that the player reached
        // this server (the link command can only be consumed in-game). Do not
        // treat a quiet/offline server or expired raw telemetry as "never joined".
        const hasVerifiedServerPresence = Boolean(link?.firstSeenAt);
        const hasMeasuredActivity = Boolean(events.length || hasVerifiedServerPresence);
        const latestPlayerEvent = events[0] || null;
        const fallbackFirstSeenAt = link?.firstSeenAt || identity.createdAt || null;
        const fallbackLastSeenAt = link?.lastSeenAt || identity.lastSeenAt || fallbackFirstSeenAt;
        const measuredStats = events.length ? stats : {
          joins: 1,
          leaves: 0,
          sessionSeconds: 0,
          activeDays: fallbackFirstSeenAt ? 1 : 0,
        };
        profileContext = {
          accountType: identity.accountType,
          firstSeenAt: hasMeasuredActivity ? fallbackFirstSeenAt : null,
          lastSeenAt: hasMeasuredActivity ? fallbackLastSeenAt : null,
          stats: hasMeasuredActivity ? measuredStats : null,
          badges: hasMeasuredActivity ? buildBadges({ interaction, stats: measuredStats, account, identity, targetMember }) : [{ key: 'new', label: 'New', icon: 'star', color: '#8BE28B' }],
          scopeLabel: cardLabel,
          // Historical presence wins over current server availability. The
          // renderer then shows OFFLINE while keeping the useful player data.
          cardState: hasMeasuredActivity ? 'measured' : !plugin ? 'server_not_configured' : !pluginOnline ? 'server_offline' : 'never_joined',
          isOnline: Boolean(pluginOnline && latestPlayerEvent?.type === 'player_join'),
        };
      }

      const rendererServerConfig = serverConfig ? { wallpaper: serverConfig.wallpaper, serverName: serverConfig.serverName } : null;
      const imageBuffer = await generatePlayerCard(ign || targetUser.username, template, rendererServerConfig, profileContext);
      if (!imageBuffer) return interaction.editReply({ content: `❌ تعذر إنشاء بطاقة **${ign || targetUser.username}**.` });
      const attachment = new AttachmentBuilder(imageBuffer, { name: `${ign || targetUser.username}-player-card.png` });
      await interaction.editReply({ content: `**${ign || targetUser.username}'s Player Card** · ${cardLabel}`, files: [attachment] });
    } catch (error) {
      console.error('Player card error:', error);
      await interaction.editReply({ content: '❌ تعذر إنشاء البطاقة حاليًا. حاول مرة أخرى بعد قليل.' });
    }
  },
};
