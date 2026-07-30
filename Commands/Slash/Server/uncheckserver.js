const {
  ApplicationCommandType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const Server = require("../../../Models/Server");

module.exports = {
  name: "remove_server",
  description: `Remove the Minecraft server information`,
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Server",
    type1: "slash",
  type: ApplicationCommandType.ChatInput,

  run: async (client, interaction) => {
    const guild = interaction.guild;

    const NOT_FOUND = client.t(guild.id, 'NOT_FOUND');
    const serverId = guild.id;

    const serverRecord = await Server.findOne({ serverId });

    if (!serverRecord) {
      return interaction.reply({ content: `${NOT_FOUND}`, ephemeral: true });
    }

    const CANCEL_LABEL = client.t(guild.id, 'CANCEL');
    const CONTINUE_LABEL = client.t(guild.id, 'CONTINUE');

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('cancel')
                .setLabel(CANCEL_LABEL)
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('continue')
                .setLabel(CONTINUE_LABEL)
                .setStyle(ButtonStyle.Success)
        );

    const SURE_MESSAGE = client.t(guild.id, 'SURE_MESSAGE');
    const confirmMessage = await interaction.reply({
        content: `${SURE_MESSAGE}`,
        components: [row],
        ephemeral: true
    });

    const filter = i => i.user.id === interaction.user.id;

    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

    const CANCEL_MESSAGE = client.t(guild.id, 'CANCEL_MESSAGE');
    const CONTINUE_MESSAGE = client.t(guild.id, 'CONTINUE_MESSAGE');

    collector.on('collect', async i => {
        if (i.customId === 'cancel') {
            await i.update({ content: `${CANCEL_MESSAGE}`, components: [], ephemeral: true });
        } else if (i.customId === 'continue') {
            await Server.deleteOne({ serverId });
            await i.update({ content: `${CONTINUE_MESSAGE}`, components: [], ephemeral: true });
        }
    });

    const TIME_END_MESSAGE = client.t(guild.id, 'TIME_END_MESSAGE');
    collector.on('end', collected => {
        if (collected.size === 0) {
            interaction.editReply({ content: `${TIME_END_MESSAGE}`, components: [], ephemeral: true });
        }
    });

  },
};
