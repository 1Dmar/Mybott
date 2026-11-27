'use strict';

const { ApplicationCommandType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { generatePlayerCard, rendererAvailable } = require('../../../utils/playerCardGenerator');
const Player = require('../../../Models/Player');
const Server = require('../../../Models/Server');
const PlayerAccount = require('../../../Models/PlayerAccount');
const MinecraftIdentity = require('../../../Models/MinecraftIdentity');
const PlayerServerLink = require('../../../Models/PlayerServerLink');
const PlayerCardSettings = require('../../../Models/PlayerCardSettings');
const TelemetryEvent = require('../../../Models/TelemetryEvent');

function buildBadges({ interaction, stats, account, identity }) {
  const badges = [];
  const memberPermissions = interaction.member?.permissions;
  const isAdmin = Boolean(
    interaction.guild?.ownerId === interaction.user?.id ||
    memberPermissions?.has?.(PermissionFlagsBits.Administrator),
  );
  const joins = Number(stats?.joins || 0);
  const playtime = Number(stats?.sessionSeconds || 0);
  const activeDays = Number(stats?.activeDays || 0);

  if (isAdmin) badges.push({ key: 'staff', label: 'Server Staff', icon: 'shield', color: '#FFB347' });
  if (playtime >= 100 * 60 * 60 || joins >= 50) badges.push({ key: 'pro', label: 'Pro Player', icon: 'star', color: '#FFD700' });
  if (activeDays >= 7 || joins >= 10) badges.push({ key: 'regular', label: 'Regular', icon: 'globe', color: '#55D6FF' });
  if (badges.length === 0 && (joins <= 2 || !identity?.lastSeenAt)) badges.push({ key: 'new', label: 'New Player', icon: 'star', color: '#8BE28B' });

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
      const serverConfig = await Server.findOne({ serverId: interaction.guild.id }).lean();
      let ign = legacyIgn;
      let template = requestedTemplate === 'saved' ? 'minecraft' : requestedTemplate;
      let cardLabel = interaction.guild.name || interaction.guild.id;
      let profileContext = { scopeLabel: cardLabel, cardState: serverConfig?.apiToken ? 'server_offline' : 'server_not_configured', badges: [] };

      if (legacyIgn) {
        await Player.findOneAndUpdate({ ign: legacyIgn.toLowerCase() }, { ign: legacyIgn.toLowerCase(), cardTemplate: template, updatedAt: new Date() }, { upsert: true });
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
        const link = await PlayerServerLink.findOne({ accountId: account._id, identityId: identity._id, serverId: interaction.guild.id }).sort({ lastSeenAt: -1 }).lean();
        const events = link ? await TelemetryEvent.find({ serverId: interaction.guild.id, 'data.uuid': identity.uuid, type: { $in: ['player_join', 'player_leave'] } }).sort({ occurredAt: -1 }).limit(5000).lean() : [];
        const joins = events.filter(event => event.type === 'player_join');
        const leaves = events.filter(event => event.type === 'player_leave');
        const stats = {
          joins: joins.length,
          leaves: leaves.length,
          sessionSeconds: leaves.reduce((sum, event) => sum + (Number.isFinite(Number(event.data?.sessionSeconds)) ? Math.max(0, Number(event.data.sessionSeconds)) : 0), 0),
          activeDays: new Set(events.map(event => new Date(event.occurredAt).toISOString().slice(0, 10))).size,
        };
        const hasMeasuredActivity = Boolean(link && events.length);
        profileContext = {
          accountType: identity.accountType,
          firstSeenAt: hasMeasuredActivity ? identity.createdAt : null,
          lastSeenAt: hasMeasuredActivity ? identity.lastSeenAt : null,
          stats: hasMeasuredActivity ? stats : null,
          badges: hasMeasuredActivity ? buildBadges({ interaction, stats, account, identity }) : [{ key: 'new', label: 'New Player', icon: 'star', color: '#8BE28B' }],
          scopeLabel: cardLabel,
          cardState: !serverConfig?.apiToken ? 'server_not_configured' : !link || !events.length ? 'never_joined' : 'measured',
        };
      }

      const imageBuffer = await generatePlayerCard(ign || targetUser.username, template, serverConfig, profileContext);
      if (!imageBuffer) return interaction.editReply({ content: `❌ تعذر إنشاء بطاقة **${ign || targetUser.username}**.` });
      const attachment = new AttachmentBuilder(imageBuffer, { name: `${ign || targetUser.username}-player-card.png` });
      await interaction.editReply({ content: `**${ign || targetUser.username}'s Player Card** · ${cardLabel}`, files: [attachment] });
    } catch (error) {
      console.error('Player card error:', error);
      await interaction.editReply({ content: '❌ تعذر إنشاء البطاقة حاليًا. حاول مرة أخرى بعد قليل.' });
    }
  },
};
