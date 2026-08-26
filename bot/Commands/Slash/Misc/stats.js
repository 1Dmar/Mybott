const {
    CommandInteraction,
    ApplicationCommandType,
    PermissionFlagsBits,
    AttachmentBuilder,
    ApplicationCommandOptionType,
} = require("discord.js");
let createCanvas;
try {
    ({ createCanvas } = require('canvas'));
} catch (error) {
    console.warn('⚠️ Stats chart renderer unavailable:', error.message);
}
const PlayerHistory = require('../../../Models/PlayerHistory');
const Server = require('../../../Models/Server');

module.exports = {
    name: "stats",
    description: "عرض إحصائيات السيرفر واللاعبين",
    userPermissions: PermissionFlagsBits.SendMessages,
    botPermissions: PermissionFlagsBits.SendMessages,
    category: "Misc",
    type1: "slash",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: "type",
            description: "نوع الإحصائيات المراد عرضها",
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                { name: "Server Players (48h)", value: "server" }
            ]
        }
    ],

    run: async (client, interaction) => {
        if (typeof createCanvas !== 'function') {
            return interaction.reply({
                content: 'الرسم البياني غير متاح حاليًا لأن مكوّن الصور لم يُبنَ في بيئة التشغيل. يمكنك مراجعة الإحصائيات بعد تفعيل renderer.',
                ephemeral: true,
            });
        }

        const type = interaction.options.getString("type");
        const guildId = interaction.guild.id;

        await interaction.deferReply();

        if (type === "server") {
            try {
                // جلب بيانات السيرفر
                const serverData = await Server.findOne({ serverId: guildId });
                if (!serverData) {
                    return interaction.editReply({ content: client.t(guildId, "NO_SERVER_DATA") });
                }

                // جلب تاريخ اللاعبين لآخر 48 ساعة
                const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
                const history = await PlayerHistory.find({
                    serverId: guildId,
                    timestamp: { $gte: fortyEightHoursAgo }
                }).sort({ timestamp: 1 });

                if (history.length < 2) {
                    return interaction.editReply({ content: client.t(guildId, "STATS_NO_DATA") || "No data collected yet. Please wait for the bot to gather some statistics." });
                }

                // إنشاء الـ Canvas
                const width = 800;
                const height = 400;
                const canvas = createCanvas(width, height);
                const ctx = canvas.getContext('2d');

                // خلفية بسيطة (تصميم عادي كما طلب المستخدم)
                ctx.fillStyle = '#1a1c23';
                ctx.fillRect(0, 0, width, height);

                // رسم الشبكة
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.lineWidth = 1;
                for (let i = 0; i <= 10; i++) {
                    const y = 50 + (i * 30);
                    ctx.beginPath();
                    ctx.moveTo(50, y);
                    ctx.lineTo(750, y);
                    ctx.stroke();
                }

                // تجهيز البيانات للرسم
                const maxPlayers = Math.max(...history.map(h => h.onlinePlayers), 10);
                const points = history.map((h, i) => ({
                    x: 50 + (i * (700 / (history.length - 1))),
                    y: 350 - (h.onlinePlayers / maxPlayers * 300)
                }));

                // رسم الخط البياني
                ctx.strokeStyle = '#5865F2';
                ctx.lineWidth = 3;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.stroke();

                // رسم التعبئة تحت الخط
                const gradient = ctx.createLinearGradient(0, 50, 0, 350);
                gradient.addColorStop(0, 'rgba(88, 101, 242, 0.3)');
                gradient.addColorStop(1, 'rgba(88, 101, 242, 0)');
                ctx.fillStyle = gradient;
                ctx.lineTo(points[points.length - 1].x, 350);
                ctx.lineTo(points[0].x, 350);
                ctx.closePath();
                ctx.fill();

                // العناوين والنصوص
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 24px Arial';
                const title = client.t(guildId, "STATS_TITLE", { server: serverData.serverName || 'Server' });
                ctx.fillText(title, 50, 35);

                ctx.font = '14px Arial';
                ctx.fillStyle = '#b9bbbe';
                const subtitle = client.t(guildId, "STATS_SUBTITLE") || 'Last 48 Hours Online Players';
                ctx.fillText(subtitle, 50, 60);

                // إرسال النتيجة
                const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'stats.png' });
                await interaction.editReply({ files: [attachment] });

            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: "حدث خطأ أثناء إنشاء الإحصائيات." });
            }
        }
    },
};
