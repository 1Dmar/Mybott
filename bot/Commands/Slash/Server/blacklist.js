const {
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");
const Blacklist = require("../../../Models/BlackList");

function parseDuration(duration) {
    const value = String(duration || '').trim().toLowerCase();
    if (value === 'inf') return null;
    const match = value.match(/^(\d+)\s*(mo|ms|s|m|h|d|w)$/);
    if (!match) throw new Error('Invalid duration. Use e.g. 30m, 2h, 5d, 2w, 1mo, or inf.');
    const amount = Number(match[1]);
    const multipliers = { ms: 1, s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000, w: 7 * 24 * 60 * 60 * 1000, mo: 30 * 24 * 60 * 60 * 1000 };
    return amount * multipliers[match[2]];
}

module.exports = {
  name: "blacklist",
  description: `Blacklist a guild`,
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Server",
  type1: "slash",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: 'guild_id',
      type: 3, // STRING
      description: 'The ID of the guild to blacklist',
      required: true,
    },
    {
      name: 'duration',
      type: 3, // STRING
      description: 'The duration of the blacklist (e.g., 1d, 5mo, inf)',
      required: true,
    },
    {
      name: 'reason',
      type: 3, // STRING
      description: 'The reason for blacklisting the guild',
      required: true,
    },
  ],
  run: async (client, interaction) => {
    if (interaction.user.id !== "804999528129363998" && interaction.user.id !== "1071690719418396752") {
      return interaction.reply({ content: 'لا تملك صلاحية استخدام هذا الأمر.', ephemeral: true });
    }
    const guildIds = interaction.options.getString('guild_id').trim();
    const duration = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason');
   
    let durationMs;
    try { durationMs = parseDuration(duration); } catch (error) {
      return interaction.reply({ content: error.message, ephemeral: true });
    }
    const isPermanent = durationMs === null;
    const expiresAt = isPermanent ? null : Date.now() + durationMs;

      const existingBlacklist = await Blacklist.findOne({ guildIds: guildIds });
      if (existingBlacklist) {
        // إذا كان السيرفر في القائمة السوداء، قم بإلغاء البلاك ليست
        await Blacklist.deleteOne({ guildIds: guildIds });

        const embed = new EmbedBuilder()
          .setColor(0x00FF00) // Green color
          .setTitle('Blacklist Removal Notification')
          .setDescription(`Guild ${guildIds} has been removed from the blacklist.`)
          .setTimestamp();
        
        return await interaction.reply({
          embeds: [embed],
          ephemeral: false,
        });
      }
      
    await Blacklist.create({ guildIds, isBlacklisted: 'true', reason, duration: durationMs, expiresAt, isPermanent });

    const embed = new EmbedBuilder()
      .setColor(0xFF0000) // Red color
      .setTitle('Blacklist Notification')
      .setDescription(`Guild ${guildIds} has been blacklisted.`)
      .addFields(
        { name: 'Duration', value: isPermanent ? 'دائم' : duration, inline: true },
        { name: 'Reason', value: reason, inline: true }
      )
      .setTimestamp();
      
    await interaction.reply({
      embeds: [embed],
      ephemeral: false,
    });
  },
  parseDuration,
};
