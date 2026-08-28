const { Client } = require("discord.js");
const { readdirSync } = require("fs");
const path = require('path');
const Command = require('../Models/Command');
const { isConnected } = require('../utils/dbManager');
const { legacyPrefixEnabled } = require('../utils/legacyCommandPolicy');

/**
 *
 * @param {Client} client
 */
module.exports = async (client) => {
  if (!legacyPrefixEnabled()) {
    console.log('ℹ️ Legacy prefix commands are disabled; canonical slash commands remain active.');
    return;
  }
  try {
    // إنشاء مصفوفة لتخزين الأوامر
    const loadedCommands = [];

   const commandsPath = path.join(__dirname, "..", "Commands", "Message"); 
      readdirSync(commandsPath).forEach((dir) => {
      const commands = readdirSync(`${commandsPath}/${dir}`).filter((f) =>
        f.endsWith(".js")
      );

      for (const cmd of commands) {
        const command = require(`../Commands/Message/${dir}/${cmd}`);
        if (command.name && command.type1) {
          client.mcommands.set(command.name, command);
          // إضافة الأمر إلى المصفوفة
          loadedCommands.push(command);
         } else {
          console.log(`${cmd} is missing required properties (name/type)`);
        }
      }
    });

    console.log(`> ${client.mcommands.size} Message Commands Loaded !!`);

    // تحديث الأوامر في قاعدة البيانات باستخدام المصفوفة (تجاهل إذا لم تتصل DB)
    if (isConnected()) {
      for (const command of loadedCommands) {
        try {
          await Command.findOneAndUpdate(
            { name: command.name, type: command.type1 },
            { description: command.description || '', settings: command.settings || {}, enabled: true },
            { upsert: true }
          );
        } catch (e) {
          console.warn('⚠️ Failed to upsert command to DB:', command.name, e.message);
        }
      }
    } else {
      console.log('ℹ️ DB not connected — skipping command DB synchronization.');
    }
  } catch (error) {
    console.log(error);
  }
};
