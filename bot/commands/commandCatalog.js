'use strict';

const path = require('path');
const { PermissionFlagsBits } = require('discord.js');

const ROOT = path.join(__dirname, '..');
const modulePath = relativePath => path.join(ROOT, relativePath);

/**
 * The only public Discord command taxonomy. Existing command implementations
 * are reused through this catalog until their internals are migrated safely.
 */
const COMMAND_CATALOG = [
  {
    name: 'server',
    description: 'إدارة اتصال السيرفر وإعداداته الأساسية',
    userPermissions: PermissionFlagsBits.ManageGuild,
    category: 'Server',
    subcommands: [
      ['setup', 'بدء إعداد سيرفر Minecraft', 'Commands/Slash/Server/setup.js'],
      ['remove', 'إزالة اتصال السيرفر القديم بأمان', 'Commands/Slash/Server/uncheckserver.js'],
      ['logs', 'إعداد قنوات السجل', 'Commands/Slash/Server/log.js'],
      ['language', 'تغيير لغة ProMcBot', 'Commands/Slash/Server/language.js'],
      ['blacklist', 'إدارة القائمة السوداء', 'Commands/Slash/Server/blacklist.js'],
      ['mentions', 'إدارة إعدادات التنبيهات والإشارات', 'Commands/Slash/Server/mentionaction.js'],
      ['bump', 'إدارة ترويج السيرفر', 'Commands/Slash/Server/bump.js'],
      ['statusbar-setup', 'إعداد شريط الحالة', 'Commands/Slash/StatusBar/setup.js'],
      ['statusbar-update', 'تحديث شريط الحالة الآن', 'Commands/Slash/StatusBar/update.js'],
      ['statusbar-interval', 'تغيير فترة تحديث شريط الحالة', 'Commands/Slash/StatusBar/interval.js'],
    ],
  },
  {
    name: 'minecraft',
    description: 'اتصال Minecraft ومعلومات اللاعبين والسيرفر',
    userPermissions: PermissionFlagsBits.ManageGuild,
    category: 'Minecraft',
    subcommands: [
      ['players', 'عرض اللاعبين الذين أمكن قياس جلساتهم', 'Commands/Slash/Minecraft/players.js'],
      ['player', 'عرض آخر نشاط مقاس للاعب', 'Commands/Slash/Minecraft/player.js'],
    ],
  },
  {
    name: 'intelligence',
    description: 'ذكاء السيرفر المبني على telemetry حقيقية',
    userPermissions: PermissionFlagsBits.ManageGuild,
    category: 'Intelligence',
    subcommands: [
      ['overview', 'ملخص ما تم قياسه وما يحتاج انتباهًا', 'Commands/Slash/Intelligence/server-intelligence.js'],
      ['health', 'صحة الاتصال والـtelemetry', 'Commands/Slash/Intelligence/server-health.js'],
      ['journey', 'رحلة اللاعبين وإشارات النشاط', 'Commands/Slash/Intelligence/player-insights.js'],
      ['retention', 'تحليل الاحتفاظ المتقدم', 'Commands/Slash/Intelligence/retention.js'],
      ['network', 'ذكاء الشبكة متعددة السيرفرات', 'Commands/Slash/Intelligence/network.js'],
      ['report', 'التقرير الأسبوعي المبني على البيانات', 'Commands/Slash/Intelligence/report.js'],
      ['actions', 'مركز الإجراءات والتوصيات', 'Commands/Slash/Intelligence/actions.js'],
    ],
  },
  {
    name: 'moderation',
    description: 'إدارة الحماية والأتمتة المجتمعية',
    userPermissions: PermissionFlagsBits.ManageGuild,
    category: 'Moderation',
    subcommands: [
      ['settings', 'عرض إعدادات الحماية', 'Commands/Slash/AutoMod/settings.js'],
      ['filter', 'إدارة فلاتر الكلمات', 'Commands/Slash/AutoMod/filter.js'],
      ['toggle', 'تفعيل أو تعطيل الحماية', 'Commands/Slash/AutoMod/toggle.js'],
      ['action', 'إدارة إجراءات الحماية', 'Commands/Slash/AutoMod/action.js'],
      ['whitelist', 'إدارة القائمة البيضاء', 'Commands/Slash/AutoMod/whitelist.js'],
      ['log', 'تحديد قناة سجل الحماية', 'Commands/Slash/AutoMod/log.js'],
    ],
  },
  {
    name: 'premium',
    description: 'عرض الخطة والقدرات والحدود الحالية',
    userPermissions: PermissionFlagsBits.ManageGuild,
    category: 'Premium',
    subcommands: [
      ['status', 'عرض حالة Free/Pro/Ultimate', 'Commands/Slash/Intelligence/premium.js'],
    ],
  },
  {
    name: 'utility',
    description: 'أدوات ProMcBot الأساسية',
    category: 'Utility',
    subcommands: [
      ['ping', 'قياس استجابة البوت', 'Commands/Slash/Misc/ping.js'],
      ['avatar', 'عرض الصورة الرمزية', 'Commands/Slash/Misc/avatar.js'],
      ['invite', 'رابط دعوة البوت', 'Commands/Slash/Misc/invite.js'],
      ['support', 'رابط الدعم', 'Commands/Slash/Misc/support.js'],
      ['playercard', 'إنشاء بطاقة لاعب', 'Commands/Slash/Misc/playercard.js'],
      ['card', 'إنشاء بطاقة حالة السيرفر', 'Commands/Slash/Misc/card.js'],
      ['stats', 'عرض إحصائيات اللاعبين المتاحة', 'Commands/Slash/Misc/stats.js'],
    ],
  },
  {
    name: 'admin',
    description: 'أدوات مالك البوت الإدارية',
    userPermissions: PermissionFlagsBits.Administrator,
    category: 'Owner',
    subcommands: [
      ['eval', 'أداة تشخيص مالك البوت', 'Commands/Slash/Owner/eval.js'],
      ['generate-code', 'توليد كود اشتراك إداري', 'Commands/Slash/Owner/gencode.js'],
      ['subscriptions', 'عرض الاشتراكات الحالية', 'Commands/Slash/Owner/membershiplist.js'],
      ['subscription-codes', 'عرض أكواد الاشتراك', 'Commands/Slash/Owner/membershipcodeslist.js'],
      ['send-free-codes', 'إرسال أكواد Free', 'Commands/Slash/Owner/sendfreecodes.js'],
      ['delete-membership', 'حذف اشتراك محدد', 'Commands/Slash/Owner/delmembership.js'],
    ],
  },
  {
    name: 'help',
    description: 'عرض أوامر ProMcBot المنظمة',
    category: 'Utility',
    module: 'Commands/Slash/Misc/help.js',
  },
];

function loadModule(relativePath) {
  const fullPath = modulePath(relativePath);
  delete require.cache[require.resolve(fullPath)];
  return require(fullPath);
}

function cloneOptions(options) {
  return Array.isArray(options) ? options.map(option => ({ ...option })) : [];
}

function createGroupCommand(definition, entries) {
  const subcommands = entries.map(({ alias, implementation }) => ({
    type: 1,
    name: alias,
    description: definition.subcommands.find(item => item[0] === alias)?.[1] || implementation.description || alias,
    options: cloneOptions(implementation.options),
  }));
  const implementations = new Map(entries.map(({ alias, implementation }) => [alias, implementation]));

  return {
    name: definition.name,
    description: definition.description,
    options: subcommands,
    userPermissions: definition.userPermissions,
    botPermissions: PermissionFlagsBits.SendMessages,
    category: definition.category,
    type1: 'slash',
    run: async (client, interaction) => {
      const subcommand = interaction.options.getSubcommand(false);
      const implementation = implementations.get(subcommand);
      if (!implementation) {
        return interaction.reply({ content: 'اختر أمرًا فرعيًا صالحًا من هذه المجموعة.', ephemeral: true });
      }
      return implementation.run(client, interaction);
    },
  };
}

function loadCanonicalCommands() {
  return COMMAND_CATALOG.map(definition => {
    if (definition.module) return loadModule(definition.module);
    const entries = definition.subcommands.map(([alias, description, implementationPath]) => ({
      alias,
      description,
      implementation: loadModule(implementationPath),
    }));
    return createGroupCommand(definition, entries);
  });
}

function getCommandCatalog() {
  return COMMAND_CATALOG.map(definition => ({
    name: definition.name,
    description: definition.description,
    category: definition.category,
    subcommands: definition.subcommands?.map(([name, description]) => ({ name, description })) || [],
  }));
}

module.exports = {
  COMMAND_CATALOG,
  getCommandCatalog,
  loadCanonicalCommands,
};
