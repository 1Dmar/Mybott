const { Schema } = require("mongoose");
const { defineModel } = require("../utils/dbManager");

const messageSchema = new Schema({
    ticket: {
        type: String,
        required: true,
        index: true,
    },
    authorId: {
        type: String,
        required: true,
    },
    content: {
        type: String,
        required: true,
        trim: true,
    },
    timestamp: {
        type: Date,
        default: () => new Date(),
    },
    direction: {
        type: String,
        enum: ["user", "mod"],
        required: true,
    },
});

// Store ticket messages in the secondary DB if available to save space on main DB
module.exports = defineModel("ticket-message9", messageSchema, true);
