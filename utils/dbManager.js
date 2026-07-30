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
mongoose.set('bufferCommands', false);

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

async function initDB() {
    if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
        console.log("✅ MongoDB already connected or connecting. Skipping duplicate initialization.");
        return;
    }

    const mainURI = process.env.MONGO_URL?.trim();
    const secondaryURI = process.env.MONGO_URL_SECONDARY?.trim() || mainURI;
    let connectionURI = mainURI;

    if (!mainURI) {
        throw new Error('MONGO_URL environment variable is not set. Database initialization aborted.');
    }

    try {
            // If the provided URI uses the SRV scheme, verify SRV resolves first.
            if (mainURI && mainURI.startsWith('mongodb+srv://')) {
                // Allow overriding DNS servers via env or default to Google's public DNS
                try {
                    const servers = (process.env.DNS_SERVERS || '8.8.8.8,8.8.4.4').split(',').map(s => s.trim()).filter(Boolean);
                    dns.setServers(servers);
                    console.log('🔧 Using DNS servers:', dns.getServers());
                } catch (e) {
                    console.warn('⚠️ Could not set DNS servers:', e?.message || e);
                }

                let host;
                try {
                    host = new URL(mainURI).hostname;
                } catch (e) {
                    host = mainURI.replace('mongodb+srv://', '').split('/')[0];
                }
                try {
                    console.log(`🔎 Performing SRV lookup for ${host}...`);
                    const records = await dnsPromises.resolveSrv(`_mongodb._tcp.${host}`);
                    console.log('✅ SRV DNS lookup succeeded:', records.map(r => r.name).join(', '));

                    // Build seed list automatically from SRV records if no explicit seedlist provided
                    if (!process.env.MONGO_URL_SEEDLIST) {
                        try {
                            const url = new URL(mainURI);
                            const auth = url.username ? `${encodeURIComponent(url.username)}:${encodeURIComponent(url.password)}@` : '';
                            const dbName = (url.pathname || '/').replace('/', '') || '';
                            const params = url.search || '';
                            const hosts = records.map(r => `${r.name.replace(/\.$/, '')}:${r.port || 27017}`).join(',');
                            connectionURI = `mongodb://${auth}${hosts}/${dbName}${params}`;
                            console.log('🔁 Auto-generated non-SRV seed list connection URI will be used as fallback.');
                        } catch (parseErr) {
                            console.warn('⚠️ Failed to auto-generate seed list from SRV records:', parseErr?.message || parseErr);
                        }
                    }
                } catch (srvErr) {
                    console.warn('⚠️ SRV DNS lookup failed:', srvErr && (srvErr.code || srvErr.message));
                    if (process.env.MONGO_URL_SEEDLIST) {
                        connectionURI = process.env.MONGO_URL_SEEDLIST.trim();
                        console.log('➡️ Falling back to non-SRV seed list from MONGO_URL_SEEDLIST.');
                    } else {
                        throw new Error('SRV lookup failed and no MONGO_URL_SEEDLIST fallback was provided.');
                    }
                }
            }

        // Connect default mongoose instance so models created with mongoose.model work correctly
        await mongoose.connect(connectionURI, options);
        connections.main = mongoose.connection;
        console.log("✅ Main MongoDB Connected (Primary Storage)");

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
