const {
  ApplicationCommandType,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const PRIVACY_URL = 'https://promcbot.dev/privacy-policy';
const TERMS_URL = 'https://promcbot.dev/terms-of-service';
const SUPPORT_URL = 'https://discord.gg/6FjFYStz5a';

function formatUpdatedDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function buildRulesEmbeds(date = new Date()) {
  const lastUpdated = formatUpdatedDate(date);
  const footer = { text: `ProMcBot Support Rules • Last updated: ${lastUpdated} UTC` };

  const communityRules = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Please take a moment to review our guidelines 📖')
    .setDescription([
      '**1. Bot Invitation**\nDo not invite or use ProMcBot in servers, communities, or activities that violate Discord’s Terms of Service, Community Guidelines, or applicable law.',
      '**2. Authorized Use**\nUse the bot, Dashboard, Discord OAuth connection, Minecraft Plugin, automation, telemetry, and server data only with proper authorization. Do not access, modify, monitor, or control another user’s account, server, resource, or data without permission.',
      '**3. No Abuse or Exploitation**\nDo not exploit bugs, vulnerabilities, permissions, rate limits, Premium features, billing systems, follow/like features, telemetry, or automation to obtain unauthorized access, benefits, data, or service capacity. Report security issues privately through the official support channels.',
      '**4. No Spam or Harmful Activity**\nDo not use ProMcBot for spam, harassment, threats, hate speech, raids, scams, credential theft, malware, phishing, abusive scraping, malicious automation, or activity that disrupts Discord, Minecraft servers, ProMcBot, or other users.',
      '**5. Privacy and Sensitive Information**\nNever share passwords, OAuth tokens, plugin credentials, webhook URLs, API keys, private logs, personal information, or other sensitive data in support channels. Protect all credentials issued to you or your server.',
      '**6. Support Channel**\nUse only the official support channels for help, bug reports, and security reports. Do not spam, impersonate staff, abuse the support system, or publicly disclose private security reports before they have been reviewed.',
      '**7. Respect Others**\nTreat staff and community members with courtesy and respect. Harassment, threats, discrimination, impersonation, and targeted abuse are not allowed.',
      `🔗 We follow Discord’s [Terms of Service](https://discord.com/terms) and [Community Guidelines](https://discord.com/guidelines).\n📄 Read ProMcBot’s [Terms of Service](${TERMS_URL}) and [Privacy Policy](${PRIVACY_URL}).`,
      `⚠️ For help, please head to the official [support channels](${SUPPORT_URL}).`,
    ].join('\n\n'))
    .setFooter(footer);

  const legalRules = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('⚠️ Legal Warning: Intellectual Property Rights')
    .setDescription([
      'ProMcBot’s source code, branding, commands, support materials, Dashboard experience, and proprietary designs may be protected by applicable intellectual property laws and licenses.',
      'Do not copy, reverse engineer, extract, redistribute, resell, impersonate, or present ProMcBot’s code, commands, support system, branding, or designs as your own, except where expressly permitted by an applicable license or by law.',
      'This warning does not limit rights that cannot legally be waived. If you believe your work or rights are affected, contact the ProMcBot team through the official support channels before taking action.',
      `📄 See the [ProMcBot Terms of Service](${TERMS_URL}) for the service terms and acceptable-use requirements.`,
      `Violations may lead to removal of content, restriction or termination of access, and other remedies available under applicable law.`,
    ].join('\n\n'))
    .setFooter(footer);

  return [communityRules, legalRules];
}

module.exports = {
  name: 'rules',
  description: 'Post the current ProMcBot support rules in this channel.',
  userPermissions: PermissionFlagsBits.ManageGuild,
  botPermissions: PermissionFlagsBits.SendMessages | PermissionFlagsBits.EmbedLinks,
  category: 'Misc',
  type1: 'slash',
  type: ApplicationCommandType.ChatInput,

  run: async (client, interaction) => {
    const channel = interaction.channel;
    if (!channel?.isTextBased?.() || typeof channel.send !== 'function') {
      return interaction.reply({ content: 'This command can only be used in a text channel.', ephemeral: true });
    }

    const botMember = interaction.guild?.members?.me;
    const permissions = botMember && channel.permissionsFor(botMember);
    if (permissions && !permissions.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
      return interaction.reply({ content: 'I need Send Messages and Embed Links permissions in this channel.', ephemeral: true });
    }

    try {
      const [communityRules, legalRules] = buildRulesEmbeds(new Date());
      await channel.send({ embeds: [communityRules], allowedMentions: { parse: [] } });
      await channel.send({ embeds: [legalRules], allowedMentions: { parse: [] } });
      return interaction.reply({ content: 'The two current rules messages were posted. The displayed date is the execution date of this command.', ephemeral: true });
    } catch (error) {
      console.error('[rules command] failed to post rules:', error.message);
      return interaction.reply({ content: 'I could not post the rules in this channel. Check my channel permissions and try again.', ephemeral: true });
    }
  },

  buildRulesEmbeds,
};
