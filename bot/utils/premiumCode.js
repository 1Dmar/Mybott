const crypto = require('crypto');

const SECRET = "ProMcSecure-SuperSecretKey-2026-XyZ";

function generatePremiumKey(port, daysValid) {
    // 1. حساب وقت الانتهاء
    const expiresAt = Date.now() + (daysValid * 24 * 60 * 60 * 1000);
    
    // 2. تجهيز البيانات (Payload)
    const payload = `${expiresAt}:${port}`;
    const b64Payload = Buffer.from(payload).toString('base64url');
    
    // 3. التشفير (Signature)
    const hmac = crypto.createHmac('sha256', SECRET);
    hmac.update(payload);
    const signature = hmac.digest('base64url');
    
    // 4. الكود النهائي الذي تعطيه للاعب!
    return `${b64Payload}.${signature}`;
}

function verifyPremiumKey(key, expectedPort) {
    if (!key || typeof key !== 'string') return false;
    const parts = key.split('.');
    if (parts.length !== 2) return false;
    
    const [b64Payload, signature] = parts;
    const payload = Buffer.from(b64Payload, 'base64url').toString('utf8');
    
    // Generate expected signature
    const expectedHmac = crypto.createHmac('sha256', SECRET);
    expectedHmac.update(payload);
    const expectedSignature = expectedHmac.digest('base64url');
    
    if (signature !== expectedSignature) return false;
    
    const payloadParts = payload.split(':');
    if (payloadParts.length !== 2) return false;
    
    const expiresAt = parseInt(payloadParts[0], 10);
    const port = parseInt(payloadParts[1], 10);
    
    if (Date.now() > expiresAt) return false;
    if (expectedPort && parseInt(expectedPort, 10) !== port) return false;
    
    return { valid: true, expiresAt, port };
}

module.exports = { generatePremiumKey, verifyPremiumKey };
