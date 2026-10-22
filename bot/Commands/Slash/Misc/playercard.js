const { ApplicationCommandType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { generatePlayerCard, rendererAvailable } = require('../../../utils/playerCardGenerator');
const Player = require('../../../Models/Player');
const Server = require('../../../Models/Server');
const PlayerAccount = require('../../../Models/PlayerAccount');
const MinecraftIdentity = require('../../../Models/MinecraftIdentity');
const PlayerServerLink = require('../../../Models/PlayerServerLink');
const PlayerCardSettings = require('../../../Models/PlayerCardSettings');

module.exports = {
  name: 'playercard',
  description: 'Show your verified Minecraft player card',
  userPermissions: PermissionFlagsBits.SendMessages,
  category: 'Misc',
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: 'scope',
      description: 'Choose which measured view the card uses',
      type: 3,
      required: false,
      choices: [
        { name: 'Global account', value: 'global' },
        { name: 'This server', value: 'server' },
      ],
    },
    {
      name: 'template',
      description: 'Temporarily override the saved card template',
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
      description: 'Legacy unverified lookup; does not use account statistics',
      type: 3,
      required: false,
    },
  ],
  run: async (client, interaction) => {
    if (!rendererAvailable) {
      return interaction.reply({ content: 'ميزة بطاقة اللاعب غير متاحة حاليًا لأن مكوّن الصور لم يُبنَ في بيئة التشغيل.', ephemeral: true });
    }

    const scope = interaction.options.getString('scope') || 'global';
    const requestedTemplate = interaction.options.getString('template') || 'saved';
    const legacyIgn = interaction.options.getString('ign')?.trim() || null;
    await interaction.deferReply();

    try {
      let ign;
      let template;
      let serverConfig = null;
      let cardLabel = 'Verified global account';

      if (legacyIgn) {
        // Legacy lookup is intentionally isolated: it cannot read private account data.
        ign = legacyIgn;
        template = requestedTemplate === 'saved' ? 'darkmode' : requestedTemplate;
        cardLabel = 'Unverified public lookup';
        serverConfig = await Server.findOne({ serverId: interaction.guild.id });
      } else {
        const account = await PlayerAccount.findOne({ discordUserId: String(interaction.user.id) }).lean();
        if (!account) return interaction.editReply({ content: '❌ لا يوجد حساب لاعب مرتبط بك بعد. افتح `/player` وأنشئ كود الربط ثم نفّذ الأمر داخل Minecraft.' });
        const [card, identities] = await Promise.all([
          PlayerCardSettings.findOne({ accountId: account._id }).lean(),
          MinecraftIdentity.find({ accountId: account._id, active: true }).sort({ lastSeenAt: -1 }).lean(),
        ]);
        if (!identities.length) return interaction.editReply({ content: '❌ لا توجد هوية Minecraft موثقة في حسابك بعد. استخدم صفحة `/player` لإكمال الربط.' });
        let identity = identities.find(item => String(item._id) === String(account.primaryIdentityId)) || identities[0];
        if (scope === 'server') {
          const link = await PlayerServerLink.findOne({ accountId: account._id, identityId: identity._id, serverId: interaction.guild.id }).lean();
          if (!link) return interaction.editReply({ content: '❌ لا توجد هوية مقاسة لك في هذا السيرفر. استخدم البطاقة العالمية أو اربط هذا السيرفر من `/player`.' });
          cardLabel = `Verified · ${interaction.guild.name || interaction.guild.id}`;
          serverConfig = await Server.findOne({ serverId: interaction.guild.id });
        }
        ign = identity.username;
        template = requestedTemplate === 'saved' ? (card?.template || 'minecraft') : requestedTemplate;
      }

      const imageBuffer = await generatePlayerCard(ign, template, serverConfig);
      if (!imageBuffer) return interaction.editReply({ content: `❌ Could not generate a card for **${ign}**.` });
      const attachment = new AttachmentBuilder(imageBuffer, { name: `${ign}-player-card.png` });

      if (legacyIgn) {
        await Player.findOneAndUpdate({ ign: ign.toLowerCase() }, { ign: ign.toLowerCase(), cardTemplate: template, updatedAt: new Date() }, { upsert: true });
      }
      await interaction.editReply({ content: `**${ign}'s Player Card** · ${cardLabel}`, files: [attachment] });
    } catch (error) {
      console.error('Player card error:', error);
      await interaction.editReply({ content: '❌ تعذر إنشاء البطاقة حاليًا. لم يتم كشف أي بيانات حساب خاصة.' });
    }
  },
};
