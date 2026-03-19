const { Client } = require("discord.js");
const { readdirSync } = require("fs");
const path = require('path');

module.exports = async (client) => {
  const eventsPath = path.join(__dirname, "..", "events");
  
  try {
    readdirSync(eventsPath)
      .filter((f) => f.endsWith(".js"))
      .forEach((eventFile) => {
        try {
          delete require.cache[require.resolve(`../events/${eventFile}`)];
          const event = require(`../events/${eventFile}`);
          
          if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
          } else {
            client.on(event.name, (...args) => event.execute(...args));
          }
          
          console.log(`✅ Loaded event: ${event.name}`);
          client.events++;
        } catch (eventError) {
          console.error(`❌ Error loading event ${eventFile}:`, eventError);
        }
      });

    console.log(`> ${client.events} Events Loaded Successfully!`);
  } catch (error) {
    console.error('Error loading events:', error);
  }
};