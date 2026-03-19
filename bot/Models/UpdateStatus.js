const { Schema, model } = require("mongoose");

module.exports = model(
  "serveroptions-updatestatus",
  new Schema({
    guildId: {
      type: String,
      required: true,
      unique: true,
    },
    categoryId: {
      type: String,
      required: true,
    },
    statusChannelId: {
      type: String,
      required: true,
    },
    playerCountChannelId: {
      type: String,
      required: false, // Change this to optional
    },
    isUpdating: {
      type: Boolean,
      default: false,
    },
  })
);
