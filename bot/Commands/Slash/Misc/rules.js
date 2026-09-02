const {
  ApplicationCommandType,
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

function buildRulesMessages(date = new Date()) {
  const lastUpdated = formatUpdatedDate(date);
  const footer = `━━━━━━━━━━━━━━━━━━━━\n🗓️ **Last updated:** ${lastUpdated} UTC`;

  const communityRules = [
    '## 📖 Please take a moment to review our guidelines',
    '',
    '**1. Bot Invitation**',
    'Do not invite or use ProMcBot in servers, communities, or activities that violate Discord’s Terms of Service, Community Guidelines, or applicable law.',
    '',
    '**2. Authorized Use**',
    'Use the bot, Dashboard, Discord OAuth, Minecraft Plugin, automation, telemetry, and server data only with proper authorization. Never access or change another user’s account, server, resource, or data without permission.',
    '',
    '**3. No Abuse or Exploitation**',
    'Do not exploit bugs, permissions, rate limits, Premium, billing, follow/like, telemetry, or automation for unauthorized access or benefits. Report security issues privately through support.',
    '',
    '**4. No Spam or Harmful Activity**',
    'Do not use ProMcBot for spam, harassment, threats, hate speech, raids, scams, phishing, malware, abusive scraping, or activity that disrupts Discord, Minecraft, ProMcBot, or other users.',
    '',
    '**5. Privacy and Sensitive Information**',
    'Never share passwords, OAuth tokens, plugin credentials, webhook URLs, API keys, private logs, or personal information in support channels. Protect your server credentials.',
    '',
    '**6. Support Channel**',
    `Use the **/discord** command or the official [support channels](<${SUPPORT_URL}>) for help, bug reports, and security reports. Do not spam, impersonate staff, or disclose private security reports publicly.`,
    '',
    '**7. Respect Others**',
    'Treat staff and community members with courtesy and respect. Harassment, threats, discrimination, impersonation, and targeted abuse are not allowed.',
    '',
    '🔗 **Important links**',
    `• [Discord ToS](<https://discord.com/terms>)\n• [Discord Guidelines](<https://discord.com/guidelines>)\n• [ProMcBot Terms](<${TERMS_URL}>)\n• [Privacy Policy](<${PRIVACY_URL}>)`,
    '',
    '⚠️ **For help, use the /discord command to join our official support channels.**',
    footer,
  ].join('\n');

  const legalRules = [
    '## ⚠️ Legal Warning: Intellectual Property Rights',
    '',
    'ProMcBot’s source code, branding, commands, support materials, Dashboard experience, and proprietary designs may be protected by applicable intellectual property laws and licenses.',
    '',
    'Do not copy, reverse engineer, extract, redistribute, resell, impersonate, or present ProMcBot’s code, commands, support system, branding, or designs as your own, except where expressly permitted by an applicable license or by law.',
    '',
    'This warning does not limit rights that cannot legally be waived. If you believe your work or rights are affected, contact the ProMcBot team through the official support channels before taking action.',
    '',
    `📄 **Read more:** [ProMcBot Terms of Service](<${TERMS_URL}>)`,
    '',
    'Violations may lead to removal of content, restriction or termination of access, and other remedies available under applicable law.',
    '',
    `🛡️ **Security reports:** Please use the **/discord** command or the official [support channels](<${SUPPORT_URL}>) and do not publish private vulnerability details before they have been reviewed.`,
    footer,
  ].join('\n');

  return [communityRules, legalRules];
}

module.exports = {
  name: 'rules',
  description: 'Post the current ProMcBot support rules in this channel.',
  userPermissions: PermissionFlagsBits.ManageGuild,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Utility',
  type1: 'slash',
  type: ApplicationCommandType.ChatInput,
  deferReply: true,

  run: async (client, interaction) => {
    const channel = interaction.channel;
    if (!channel?.isTextBased?.() || typeof channel.send !== 'function') {
      return interaction.editReply({ content: 'This command can only be used in a text channel.' });
    }

    const botMember = interaction.guild?.members?.me;
    const permissions = botMember && channel.permissionsFor(botMember);
    if (permissions && !permissions.has(PermissionFlagsBits.SendMessages)) {
      return interaction.editReply({ content: 'I need the Send Messages permission in this channel.' });
    }

    try {
      const [communityRules, legalRules] = buildRulesMessages(new Date());
      await channel.send({ content: communityRules, allowedMentions: { parse: [] } });
      await channel.send({ content: legalRules, allowedMentions: { parse: [] } });
      return interaction.editReply({ content: 'The two current rules messages were posted. The displayed date is the execution date of this command.' });
    } catch (error) {
      console.error('[rules command] failed to post rules:', error.message);
      return interaction.editReply({ content: 'I could not post the rules in this channel. Check my channel permissions and try again.' });
    }
  },

  buildRulesMessages,
};
