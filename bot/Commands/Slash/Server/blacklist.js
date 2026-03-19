const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  Client,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");
const ms = require('ms');
const Blacklist = require("../../../Models/BlackList");

function parseDuration(duration) {
    if (duration === 'inf') {
        return null;
    }
    const match = duration.match(/(\d+)([smhd])/);
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
        case 's':
            return value * 1000;
        case 'm':
            return value * 1000 * 60;
        case 'h':
            return value * 1000 * 60 * 60;
        case 'd':
            return value * 1000 * 60 * 60 * 24;
        default:
            throw new Error('Invalid duration unit');
    }
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
    if (interaction.user.id !== "804999528129363998" && interaction.user.id !== "1071690719418396752") return;
    const guildIds = interaction.options.getString('guild_id');
    const duration = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason');
   
    const isPermanent = duration === 'inf';
    const expiresAt = isPermanent ? null : Date.now() + parseDuration(duration);

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
      
    await Blacklist.create({ guildIds, isBlacklisted: 'true', reason, duration: isPermanent ? null : ms(duration), expiresAt, isPermanent });

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
};
