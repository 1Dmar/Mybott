const mongoose = require("mongoose");

/**
 * Smart Migration Manager
 * Automatically moves heavy data (Tickets, Logs) from Primary to Secondary DB.
 */

async function startMigration(connections) {
    if (!connections.secondary || connections.main === connections.secondary) {
        console.log("ℹ️ Migration skipped: Secondary DB not configured or same as main.");
        return;
    }

    const mainDB = connections.main;
    const secondaryDB = connections.secondary;

    // List of models to migrate (Collection Name, Mongoose Schema)
    // We need to access the raw collection to move data
    const tasks = [
        { name: "ticket-message9", description: "Ticket Messages" },
        { name: "serveroptions-logs", description: "Server Logs" }
    ];

    console.log("🚀 Starting Smart Data Migration...");

    for (const task of tasks) {
        try {
            const sourceCol = mainDB.collection(task.name);
            const targetCol = secondaryDB.collection(task.name);

            // Check if there is data in the source that should be in target
            const count = await sourceCol.countDocuments();
            if (count > 0) {
                console.log(`📦 Found ${count} records in ${task.description} on Main DB. Moving to Secondary...`);
                
                // Get all data
                const data = await sourceCol.find({}).toArray();
                
                // Insert into secondary
                if (data.length > 0) {
                    await targetCol.insertMany(data);
                    // Delete from primary after successful copy
                    await sourceCol.deleteMany({});
                    console.log(`✅ Successfully moved ${data.length} records of ${task.description}.`);
                }
            } else {
                console.log(`Check: ${task.description} is already clean in Main DB.`);
            }
        } catch (error) {
            console.error(`❌ Error migrating ${task.description}:`, error.message);
        }
    }
    console.log("🏁 Migration Process Finished.");
}

/**
 * Optimization for Server Data
 * Removes unnecessary or redundant fields from server configurations to save space.
 */
async function optimizeServerData(connections) {
    const mainDB = connections.main;
    try {
        const serverCol = mainDB.collection("servers");
        const result = await serverCol.updateMany(
            {}, 
            { $unset: { "tempData": "", "oldConfig": "", "debugLogs": "" } }
        );
        
        if (result.modifiedCount > 0) {
            console.log(`🧹 Optimized ${result.modifiedCount} server documents by removing redundant fields.`);
        }
    } catch (error) {}
}

/**
 * Cleanup Ghost Servers
 * Removes database entries for servers where the bot is no longer a member.
 */
async function cleanupGhostServers(connections, activeGuildIds) {
    if (!activeGuildIds || activeGuildIds.length === 0) return;
    
    const mainDB = connections.main;
    const collectionsToClean = ["servers", "guildsettings", "langs"]; // Add other collection names if needed
    
    console.log("🔍 Checking for ghost servers (servers where bot was kicked)...");
    
    for (const colName of collectionsToClean) {
        try {
            const col = mainDB.collection(colName);
            // Delete documents where serverId/guildId is NOT in the activeGuildIds list
            // We use both common field names
            const result = await col.deleteMany({
                $and: [
                    { serverId: { $exists: true, $nin: activeGuildIds } },
                    { guildId: { $exists: true, $nin: activeGuildIds } }
                ]
            });
            
            // Also handle collections that only use one of the names
            await col.deleteMany({ serverId: { $exists: true, $nin: activeGuildIds }, guildId: { $exists: false } });
            await col.deleteMany({ guildId: { $exists: true, $nin: activeGuildIds }, serverId: { $exists: false } });

            if (result.deletedCount > 0) {
                console.log(`🗑️ Cleaned up ${result.deletedCount} ghost entries from ${colName}.`);
            }
        } catch (error) {
            // console.error(`Error cleaning ${colName}:`, error.message);
        }
    }
}

module.exports = { startMigration, optimizeServerData, cleanupGhostServers };
