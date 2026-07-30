const { Schema, model } = require('mongoose');

module.exports = model(
  'minecraft-config',
  new Schema({
    guildId:      { type: String, required: true, unique: true },
    apiUrl:       { type: String, required: true },
    bearerToken:  { type: String, required: true },
    premiumKey:   { type: String, default: null },
    createdAt:    { type: Date, default: Date.now },
    updatedAt:    { type: Date, default: Date.now },
  })
);
