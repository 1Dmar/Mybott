const { Schema, model } = require("mongoose");

module.exports = model(
  "serverstatus-dashboard",
  new Schema({
    name: String,

  status: String,

  lastChecked: Date,
  })
);