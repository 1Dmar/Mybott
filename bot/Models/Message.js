const { Schema, model } = require("mongoose");

module.exports = model(
  "ticket-message9",
  new Schema({
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
  })
);
