const { Schema, model } = require("mongoose");

module.exports = model(
  "ticket-users9",
  new Schema({
    ticketId: {

      type: String,

      required: true,

      unique: true,

      index: true,

    },

    userId: {

      type: String,

      required: true,

      index: true,

    },

    channelId: {

      type: String,

      required: true,

      unique: true,

      index: true,

    },

    status: {
        type: String,

      enum: ["open", "closed"],

      default: "open",

    },

    createdAt: {

      type: Date,

      default: () => new Date(),

    },

    closedAt: {

      type: Date,

    },
  })
);


