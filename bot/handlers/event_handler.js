const { Client } = require("discord.js");
const { readdirSync } = require("fs");
const path = require('path');

module.exports = async (client) => {
  const eventsPath = path.join(__dirname, "..", "events");
  
  try {
    const eventFiles = readdirSync(eventsPath).filter((f) => f.endsWith(".js"));
    
    for (const eventFile of eventFiles) {
      try {
        delete require.cache[require.resolve(`../events/${eventFile}`)];
        const event = require(`../events/${eventFile}`);
        
        // Handle files that use client.on directly by checking if they export a function
        if (typeof event === 'function') {
          event(client);
          console.log(`✅ Loaded functional event file: ${eventFile}`);
          continue;
        }

        // FIX: Skip files that don't export a proper event object
        if (!event || typeof event !== 'object') {
          console.log(`⚠️ Skipping ${eventFile} - unknown export type`);
          continue;
        }
        
        // FIX: Handle events that don't have a name property
        if (!event.name) {
          console.log(`⚠️ Skipping ${eventFile} - missing event name`);
          continue;
        }
        
        // FIX: Handle events that don't have an execute function
        if (!event.execute || typeof event.execute !== 'function') {
          console.log(`⚠️ Skipping ${eventFile} - missing execute function`);
          continue;
        }
        
        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args, client));
        } else {
          client.on(event.name, (...args) => event.execute(...args, client));
        }
        
        console.log(`✅ Loaded event: ${event.name}`);
        if (typeof client.events === 'number') {
          client.events++;
        }
      } catch (eventError) {
        console.error(`❌ Error loading event ${eventFile}:`, eventError.message);
      }
    }

    console.log(`> ${client.events} Events Loaded Successfully!`);
  } catch (error) {
    console.error('Error loading events:', error);
  }
};
