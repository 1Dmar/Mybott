const { Schema, model } = require("mongoose");

module.exports = model(
  "membership-server",
  new Schema({
    Id: {
      type: String,
      required: true,
      unique: true,
    },
    ismembership: {
      type: Boolean,
      default: false,
    },
      membership: {
      redeemedBy: {
        type: Array,
        default: null,
      },

      redeemedAt: {
        type: Number,
        default: null,
      },

      expiresAt: {
        type: Number,
        default: null,
      },

      plan: {
        type: String,
        default: null,
      },
    },
  })
);
