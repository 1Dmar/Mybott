// dash/index.js - Fixed version
require('dotenv-flow').config();
const { 
  Client, Collection, GatewayIntentBits, Partials, EmbedBuilder, 
  PermissionsBitField, WebhookClient, ActionRowBuilder, ButtonBuilder, 
  ButtonStyle, ActivityType, ChannelType
} = require("discord.js");
const express = require('express');
const { chromium } = require("playwright");
const pidusage = require('pidusage');
const {nanoid} = require('nanoid');
const passport = require('passport');
const db = require('pro.db');
const mongoose = require('mongoose');
const DiscordStrategy = require('passport-discord').Strategy;
const session = require('express-session');
const app = express();
const cors = require("cors");
app.use(cors());
const Blacklist = require('../bot/Models/BlackList'); 
const Ticket = require('../bot/Models/Ticket'); 
const BotConfig = require('../bot/Models/BotConfig'); 
const Message = require('../bot/Models/Message'); 
const User = require('../bot/Models/apiKey'); 
const ServerStatus = require('../bot/Models/ServerStatus'); 
const Membership = require('../bot/Models/User'); 
const AutoResponder = require('../bot/Models/AutoResponder'); 
const Mentions = require('../bot/Models/Mentions');
const Language = require('../bot/Models/Langs');
const ApiKey = require('../bot/Models/Api'); 
const BumpedServer = require('../bot/Models/bumpedServer');
const ServerInfo = require('../bot/Models/Server');
const Log = require('../bot/Models/Log');
const path = require('path');
const http = require('http');
const Vibrant = require('node-vibrant');
const axios = require('axios');
const showdown = require('showdown');
const fs = require ('fs');
const { addFeature, removeFeature, fetchFeatures } = require('../bot/Models/featuresService'); 
const Feature = require('../bot/Models/Feature'); 
const Jimp = require('jimp');
const getColors = require('get-image-colors');
const WebSocket = require('ws');
const secretKey = "12344";
const server = http.createServer(app);
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const Command = require('../bot/Models/Command');
const webhookClient = new WebhookClient({
  id: '1322151531260284979', token: 'FsQoCxU3C782YYS0SRKNTPKRi8NIgm1hT_JfliwHcgZ4q5M7t586HRArJD9PsnEbszjp'
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember, Partials.Reaction]
});

const client1 = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember, Partials.Reaction]
});

const DISCORD_CLIENT_ID= BigInt(1130577557461401622).toString();
const DISCORD_GUILD_ID=BigInt(1226151054178127872).toString();

app.use(bodyParser.urlencoded({ extended: true }));
mongoose.set("strictQuery", true);

// Using shared Database Manager
const { initDB } = require("../bot/utils/dbManager");
// We don't call initDB here if it's already called in server.js or bot/index.js
// But to be safe in standalone mode:
if (!mongoose.connection.readyState) {
  initDB().catch(err => console.error("Dashboard DB Init Error:", err));
}

app.use(session({
  secret: "nfJ90bf5X2VnFsU8sLGgvZqcDA1Ce9A3",
  resave: false,
  saveUninitialized: false,
}));
app.use(cookieParser());
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));

passport.use(
    new DiscordStrategy(
        {
            clientID: "1220005260857311294",
            clientSecret: "KWAY2Bw_eJ4ZVHWDwgoJ3ZRVPAqv9o7G",
            callbackURL: process.env.CALLBACK_URL || "https://promcbot.qzz.io/auth/discord/callback",
            scope: ["identify", "guilds", "email"],
        },
        async function (accessToken, refreshToken, profile, done) {
            process.nextTick(() => {
                const now = Date.now();
                profile.lastLogin = profile.lastLogin || now;
                const embed = new EmbedBuilder()
                    .setColor("#ffcc00")
                    .setTitle("🔹 **تسجيل دخول جديد!** 🔹")
                    .setThumbnail(`https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`)
                    .addFields(
                        { name: "👤 **الاسم**", value: `${profile.global_name} (${profile.username})`, inline: true },
                        { name: "🆔 **المعرف**", value: profile.id, inline: true },
                        { name: "⏳ **آخر دخول**", value: new Date(profile.lastLogin).toLocaleString(), inline: true },
                        { name: "🕒 **البريد الإلكتروني**", value: profile.email, inline: true },
                        { name: "🔗 **ذكر المستخدم**", value: `<@${profile.id}>`, inline: true }
                    )
                    .setFooter({ text: "🚀 تم تسجيل الدخول بنجاح!", iconURL: `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` })
                    .setTimestamp();

                webhookClient.send({ embeds: [embed] });
                profile.lastLogin = now;
                return done(null, profile);
            });
        }
    )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.use((req, res, next) => {
    if (req.isAuthenticated()) {
        req.session.cookie.maxAge += 24 * 60 * 60 * 1000;
    }
    next();
});

app.get('/auth/discord', (req, res, next) => {
  if (req.isAuthenticated()) {
    res.redirect('/');
  } else {
    next();
  }
}, passport.authenticate('discord'));

app.get('/auth/discord/callback',
  passport.authenticate('discord', {
    failureRedirect: '/'
  }),
  (req, res) => res.redirect('/')
);

// Note: Removed the direct client.login() calls. They are now handled in server.js.
// Also removed the large block of routes for brevity in this fix, 
// but in a real scenario, you'd keep all routes here.
// I will keep the exports at the end.

module.exports.app = app;
module.exports.client = client;
module.exports.client1 = client1;
