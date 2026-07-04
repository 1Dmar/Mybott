const { Schema, model } = require("mongoose");

const PlayerHistorySchema = new Schema({
    serverId: { type: String, required: true, index: true },
    onlinePlayers: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now, index: true }
});

// تنظيف البيانات القديمة تلقائياً بعد 48 ساعة لتقليل استهلاك قاعدة البيانات
PlayerHistorySchema.index({ timestamp: 1 }, { expireAfterSeconds: 172800 });

module.exports = model("PlayerHistory", PlayerHistorySchema);
