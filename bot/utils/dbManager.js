const mongoose = require("mongoose");
const dns = require('dns');
const dnsPromises = dns.promises;
const { startMigration, optimizeServerData, cleanupGhostServers } = require("./migrationManager");

/**
 * Database Manager for Multi-URI MongoDB Support
 * Designed to maximize free tier usage across multiple clusters.
 */

const connections = {
    main: null,
    secondary: null
};

mongoose.set("strictQuery", true);
mongoose.set('bufferCommands', true);

mongoose.connection.on('connected', () => {
    console.log('🗄️ MongoDB default connection established.');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB default connection error:', err);
});

const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    family: 4, // Force IPv4 to fix querySrv ECONNREFUSED on Node 18+
    serverSelectionTimeoutMS: 10000,
};

let initDBPromise = null;

async function repairSubscriptionProviderEventIndex() {
    try {
        const Subscription = require('../Models/Subscription');
        // Explicit null values still collide on a unique index in MongoDB,
        // even when the index is sparse. Omit them before rebuilding it.
        await Subscription.collection.updateMany({ lastProviderEventId: null }, { $unset: { lastProviderEventId: 1 } });
        await Subscription.collection.dropIndex('lastProviderEventId_1').catch(() => null);
        await Subscription.collection.createIndex({ lastProviderEventId: 1 }, { unique: true, sparse: true, name: 'lastProviderEventId_1' });
    } catch (error) {
        console.error('⚠️ Subscription provider-event index repair skipped:', error.message);
    }
}

async function initDB() {
    if (initDBPromise) return initDBPromise;

    initDBPromise = (async () => {
        if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
            console.log("✅ MongoDB already connected or connecting. Skipping duplicate initialization.");
            return;
        }

        const mainURI = (process.env.MONGO_URL || process.env.MONGO_URI)?.trim();
        const secondaryURI = process.env.MONGO_URL_SECONDARY?.trim() || mainURI;

        if (!mainURI) {
            throw new Error('MONGO_URL or MONGO_URI environment variable is not set. Database initialization aborted.');
        }

        try {
            // Connect default mongoose instance so models created with mongoose.model work correctly
            if (mongoose.connection.readyState === 0) {
                await mongoose.connect(mainURI, options);
                connections.main = mongoose.connection;
                console.log("✅ Main MongoDB Connected (Primary Storage)");
            } else if (mongoose.connection.client && mongoose.connection.client.s.url !== mainURI) {
                console.warn('⚠️ Mongoose already has an active connection with a different URI. Skipping duplicate connect.');
                connections.main = mongoose.connection;
            } else {
                connections.main = mongoose.connection;
                console.log('✅ Mongoose already connected or connecting to the same URI.');
            }

        await repairSubscriptionProviderEventIndex();

        // Create Secondary Connection (if different)
        if (process.env.MONGO_URL_SECONDARY && process.env.MONGO_URL_SECONDARY !== mainURI) {
            connections.secondary = mongoose.createConnection(secondaryURI, options);
            await new Promise((resolve, reject) => {
                connections.secondary.once('open', () => resolve());
                connections.secondary.once('error', reject);
            });
            console.log("✅ Secondary MongoDB Connected (High Volume Storage)");
        } else {
            connections.secondary = connections.main;
            console.log("ℹ️ Using Main MongoDB for all data (Secondary URI not provided)");
        }
    } catch (error) {
        console.error("❌ Database Connection Error:", error);
        // Do not exit the process; let caller decide. Throw so startup can continue without DB.
        throw error;
    }
    })();
    
    return initDBPromise;
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
    isConnected: () => !!(connections.main && connections.main.readyState === 1),
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
