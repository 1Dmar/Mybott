const express = require('express');
const { verifyPremiumKey } = require('../utils/premiumCode');
const ServerInfo = require('../Models/Server');

const router = express.Router();

// ══════════════════════════════════════════════════════════════
//  Public Route: مسار ترحيبي لا يتطلب توثيق
// ══════════════════════════════════════════════════════════════
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'ProMcBot API is active. Documentation: https://promcbot.dev/docs',
        endpoints: {
            status: 'GET /bot/status',
            player: 'GET /bot/player/:ign',
            command: 'POST /bot/command'
        }
    });
});

// ══════════════════════════════════════════════════════════════
//  Middleware: يشترط الـ headers التالية على كل endpoint:
//    Authorization: Bearer <token-from-config>
//    X-Premium-Key: <encrypted-premium-key>
// ══════════════════════════════════════════════════════════════
router.use(async (req, res, next) => {
    // 1. Check Authorization header
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Missing or invalid Authorization header. Expected: Authorization: Bearer <token>'
        });
    }
    const bearerToken = authHeader.slice(7); // Remove "Bearer " prefix

    // 2. Check X-Premium-Key header
    const premiumKey = req.headers['x-premium-key'];
    if (!premiumKey) {
        return res.status(401).json({
            success: false,
            error: 'Missing X-Premium-Key header. This endpoint requires a valid premium code.'
        });
    }

    // 3. Verify the premium key signature + expiry
    const verification = verifyPremiumKey(premiumKey);
    if (!verification || !verification.valid) {
        return res.status(403).json({
            success: false,
            error: 'Invalid or expired premium key. Please re-claim a new code with /claim.'
        });
    }

    // 4. Validate that the premium key is actually saved in DB for the server matching the API port
    try {
        const serverConfig = await ServerInfo.findOne({ premiumKey: premiumKey });
        if (!serverConfig) {
            return res.status(403).json({
                success: false,
                error: 'Premium key not registered to any server. Use /claim to register it first.'
            });
        }

        // 5. Validate the Bearer token matches the server's apiToken
        const expectedToken = serverConfig.apiToken
            ? (serverConfig.apiToken.startsWith('Bearer ') ? serverConfig.apiToken.slice(7) : serverConfig.apiToken)
            : null;

        if (!expectedToken || bearerToken !== expectedToken) {
            return res.status(403).json({
                success: false,
                error: 'Authorization token does not match the server config.'
            });
        }

        // Attach useful info to request
        req.premiumInfo = verification;
        req.serverConfig = serverConfig;
        next();
    } catch (err) {
        console.error('Error in premium middleware:', err);
        return res.status(500).json({ success: false, error: 'Internal server error during verification.' });
    }
});

// ══════════════════════════════════════════════════════════════
//  GET /bot/player/:ign — جلب معلومات لاعب
// ══════════════════════════════════════════════════════════════
router.get('/player/:ign', (req, res) => {
    const ign = req.params.ign;
    res.json({
        success: true,
        player: ign,
        message: 'Player data fetched successfully.',
        serverPort: req.premiumInfo.port,
        expiresAt: req.premiumInfo.expiresAt
    });
});

// ══════════════════════════════════════════════════════════════
//  POST /bot/command — إرسال أمر للسيرفر
// ══════════════════════════════════════════════════════════════
router.post('/command', (req, res) => {
    const { command } = req.body;
    if (!command) {
        return res.status(400).json({ success: false, error: 'command field is required in the request body.' });
    }
    res.json({
        success: true,
        command,
        message: 'Command executed successfully.',
        serverPort: req.premiumInfo.port,
        expiresAt: req.premiumInfo.expiresAt
    });
});

// ══════════════════════════════════════════════════════════════
//  GET /bot/status — حالة السيرفر
// ══════════════════════════════════════════════════════════════
router.get('/status', (req, res) => {
    res.json({
        success: true,
        message: 'Server endpoint is active and premium key is valid.',
        serverPort: req.premiumInfo.port,
        expiresAt: req.premiumInfo.expiresAt,
        serverName: req.serverConfig.serverName || 'Unknown'
    });
});

module.exports = router;

