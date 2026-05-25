const mongoose = require("mongoose");
const { startMigration, optimizeServerData } = require("./migrationManager");

/**
 * Database Manager for Multi-URI MongoDB Support
 * Designed to maximize free tier usage across multiple clusters.
 */

const connections = {
    main: mongoose.connection,
    secondary: null
};

const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
};

async function initDB() {
    const mainURI = process.env.MONGO_URL;
    const secondaryURI = process.env.MONGO_URL_SECONDARY || mainURI;

    try {
        // Connect default mongoose instance so models created with mongoose.model work correctly
        await mongoose.connect(mainURI, options);
        connections.main = mongoose.connection;
        console.log("✅ Main MongoDB Connected (Primary Storage)");

        // Create Secondary Connection (if different)
        if (process.env.MONGO_URL_SECONDARY && process.env.MONGO_URL_SECONDARY !== mainURI) {
            connections.secondary = await mongoose.createConnection(secondaryURI, options).asPromise();
            console.log("✅ Secondary MongoDB Connected (High Volume Storage)");
        } else {
            connections.secondary = connections.main;
            console.log("ℹ️ Using Main MongoDB for all data (Secondary URI not provided)");
        }
    } catch (error) {
        console.error("❌ Database Connection Error:", error.message);
        process.exit(1);
    }
}

/**
 * Helper to define a model on the correct connection
 * @param {string} name - Model Name
 * @param {mongoose.Schema} schema - Mongoose Schema
 * @param {boolean} isHighVolume - Whether to store in secondary DB
 */
function defineModel(name, schema, isHighVolume = false) {
    const connection = isHighVolume ? (connections.secondary || mongoose) : (connections.main || mongoose);
    return connection.model(name, schema);
}

module.exports = {
    initDB,
    defineModel,
    getConnections: () => connections,
    runMaintenance: async (activeGuildIds = null) => {
        if (connections.main) {
            await startMigration(connections);
            await optimizeServerData(connections);
            if (activeGuildIds) {
                await cleanupGhostServers(connections, activeGuildIds);
            }
        }
    }
};
