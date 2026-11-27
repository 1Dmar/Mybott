const { AttachmentBuilder, PermissionFlagsBits } = require("discord.js");
const { generatePlayerCard } = require('../../../utils/playerCardGenerator');
const TelemetryEvent = require('../../../Models/TelemetryEvent');

module.exports = {
  name: "playercard",
  description: "Show a player card with their Minecraft profile",
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Misc",
  cooldown: 5,
  type1: "message",
  membership: false,

  run: async (client, message, args, prefix) => {
    if (args.length === 0) {
      return message.reply({
        content: `❌ **Usage:** \`${prefix}playercard <IGN> [template]\`\n> **Templates:** \`darkmode\` or \`glass\``
      });
    }

    const ign = args[0].trim();
    const template = args[1]?.toLowerCase() === 'glass' ? 'glass' : 'darkmode';

    const loadingMsg = await message.reply({
      content: "⏳ Generating player card..."
    });

    try {
      const events = await TelemetryEvent.find({
        serverId: message.guild.id,
        type: { $in: ['player_join', 'player_leave'] },
        'data.username': new RegExp(`^${ign.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      }).sort({ occurredAt: -1 }).limit(5000).lean();
      const joins = events.filter(event => event.type === 'player_join');
      const leaves = events.filter(event => event.type === 'player_leave');
      const stats = {
        joins: joins.length,
        leaves: leaves.length,
        sessionSeconds: leaves.reduce((sum, event) => sum + Math.max(0, Number(event.data?.sessionSeconds) || 0), 0),
        activeDays: new Set(events.map(event => new Date(event.occurredAt).toISOString().slice(0, 10))).size,
      };
      const profileContext = events.length ? {
        cardState: 'measured',
        firstSeenAt: events[events.length - 1].occurredAt,
        lastSeenAt: events[0].occurredAt,
        stats,
        isOnline: events[0].type === 'player_join',
      } : undefined;
      const imageBuffer = await generatePlayerCard(ign, template, null, profileContext);
      
      if (!imageBuffer) {
        return loadingMsg.edit({
          content: `❌ Could not generate card for player: **${ign}**`
        });
      }

      const attachment = new AttachmentBuilder(imageBuffer, { name: `${ign}-card.png` });

      await loadingMsg.edit({
        content: `**${ign}'s Player Card** (Template: ${template})`,
        files: [attachment]
      });
    } catch (error) {
      console.error('Player card error:', error);
      await loadingMsg.edit({
        content: `❌ Error generating player card: ${error.message}`
      });
    }
  }
};
