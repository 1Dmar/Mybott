const { ApplicationCommandType, PermissionFlagsBits } = require("discord.js");
const util = require('util');
const { inspect } = require('util');

module.exports = {
  name: "eval",
  description: "Evaluate JavaScript code and explore objects",
  userPermissions: PermissionFlagsBits.Administrator,
  category: "Owner",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: "code",
      description: "JavaScript code to evaluate",
      type: 3, // String
      required: true
    },
    {
      name: "depth",
      description: "Inspection depth (default: 1)",
      type: 4, // Integer
      required: false
    },
    {
      name: "hidden",
      description: "Hide output from others (default: true)",
      type: 5, // Boolean
      required: false
    }
  ],
  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   */
  run: async (client, interaction) => {
    // Only allow bot owner
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.reply({
        content: "❌ This command is restricted to the bot owner!",
        ephemeral: true
      });
    }

    const code = interaction.options.getString("code");
    const depth = interaction.options.getInteger("depth") || 1;
    const ephemeral = interaction.options.getBoolean("hidden") !== false;

    // Create safe evaluation context
    const context = {
      client,
      interaction,
      message: interaction, // Alias for interaction
      util,
      require: (name) => {
        if (!/^[\w@./-]+$/.test(name)) throw new Error("Invalid module name");
        return require(name);
      },
      process,
      console,
      setTimeout,
      setInterval,
      setImmediate
    };

    try {
      // Object exploration mode
      if (code.includes('.') && !code.includes('(') && !code.includes(';')) {
        const objectPath = code.split('.');
        let current = context[objectPath[0]];
        
        if (current === undefined) {
          return interaction.reply({
            content: `❌ Base object \`${objectPath[0]}\` is undefined`,
            ephemeral: true
          });
        }

        for (let i = 1; i < objectPath.length; i++) {
          current = current[objectPath[i]];
          if (current === undefined) break;
        }

        const result = inspect(current, {
          depth,
          showHidden: false,
          colors: false,
          maxArrayLength: 10
        });

        return interaction.reply({
          content: `📊 **Object Exploration**\n\`\`\`js\n${result || "undefined"}\n\`\`\``,
          ephemeral
        });
      }

      // Regular evaluation mode
      const evalStart = Date.now();
      const asyncFunc = new Function(...Object.keys(context), `
        "use strict";
        return (async () => { 
          ${code.includes('\n') ? code : `return ${code}`}
        })();
      `);
      
      let evaled = await asyncFunc(...Object.values(context));
      const evalTime = Date.now() - evalStart;

      // Format non-string results
      if (typeof evaled !== "string") {
        evaled = inspect(evaled, {
          depth,
          showHidden: false,
          colors: false,
          maxArrayLength: 10
        });
      }

      // Truncate long outputs
      let truncated = false;
      if (evaled.length > 1900) {
        truncated = true;
        evaled = evaled.substring(0, 1900) + "...";
      }

      const footer = `⏱️ ${evalTime}ms${truncated ? " | ✂️ Truncated" : ""}`;
      
      interaction.reply({
        content: `✅ **Evaluation Successful** ${footer}\n\`\`\`js\n${evaled || "undefined"}\n\`\`\``,
        ephemeral
      });
    } catch (err) {
      // Handle specific common errors
      let errorMessage = err.toString();
      if (err instanceof ReferenceError) {
        errorMessage = `ReferenceError: ${err.message}\n\nAvailable variables: ${Object.keys(context).join(", ")}`;
      }
      
      // Clean up Discord token leaks
      errorMessage = errorMessage.replace(client.token, "[REDACTED]");
      
      interaction.reply({
        content: `❌ **Evaluation Error**\n\`\`\`js\n${errorMessage}\n\`\`\``,
        ephemeral: true
      });
    }
  },
};