const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const {
  BOT_TOKEN,
  BOT_USERNAME,
  MAIN_CHANNEL_ID,
  MAIN_CHANNEL_LINK,
  PRIVATE_CHANNEL_LINK
} = require("./config");

const { readDB, writeDB } = require("./db");
const { joinChannelKeyboard } = require("./keyboard");

const app = express();
app.use(express.json());

const bot = new TelegramBot(BOT_TOKEN);

// 🔹 Webhook endpoint
app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// 🔹 Health check route
app.get("/", (req, res) => {
  res.send("Bot is running");
});

const PORT = process.env.PORT || 3000;

// 🔥 IMPORTANT: Replace this with your PUBLIC Railway domain
const WEBHOOK_URL = `https://marathon-production-983a.up.railway.app/webhook`;

app.listen(PORT, async () => {
  console.log("Server running on", PORT);

  try {
    // Always clear old webhook first
    await bot.deleteWebHook({ drop_pending_updates: true });

    await bot.setWebHook(WEBHOOK_URL);

    console.log("✅ Webhook set successfully");
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
  }
});

/* -------------------- CHECK MEMBERSHIP -------------------- */
async function isMember(userId) {
  try {
    const member = await bot.getChatMember(MAIN_CHANNEL_ID, userId);
    return ["member", "administrator", "creator"].includes(member.status);
  } catch {
    return false;
  }
}

/* -------------------- /START -------------------- */
bot.onText(/\/start(?:\s+(\d+))?/, async (msg, match) => {
  const userId = msg.from.id.toString();
  const referrerId = match[1];

  const users = readDB();

  if (!users[userId]) {
    users[userId] = {
      referrals: 0,
      referrer: referrerId || null,
      rewarded: false
    };
    writeDB(users);
  }

  const joined = await isMember(userId);

  if (!joined) {
    return bot.sendMessage(
      userId,
      "Botdan foydalanish uchun, avval kanalga qo‘shilishingiz kerak 👇",
      joinChannelKeyboard(MAIN_CHANNEL_LINK)
    );
  }

  proceedAfterJoin(userId);
});

/* -------------------- CONFIRM BUTTON -------------------- */
bot.on("callback_query", async (query) => {
  if (query.data !== "check_join") return;

  const userId = query.from.id.toString();
  const joined = await isMember(userId);

  if (!joined) {
    return bot.answerCallbackQuery(query.id, {
      text: "❌ Avval kanalga qo‘shiling",
      show_alert: true
    });
  }

  await bot.answerCallbackQuery(query.id, { text: "✅ Tasdiqlandi!" });
  proceedAfterJoin(userId);
});

/* -------------------- MAIN LOGIC -------------------- */
function proceedAfterJoin(userId) {
  const users = readDB();
  const user = users[userId];

  if (user.processed) return;
  user.processed = true;

  const referrerId = user.referrer;

  if (referrerId && referrerId !== userId && users[referrerId]) {
    users[referrerId].referrals += 1;
    const count = users[referrerId].referrals;

    bot.sendMessage(
      referrerId,
      `🎉 Yana bir odam referal havolangiz orqali kanalga qo‘shildi!
👥 Natija: ${count}/4`
    );

    if (count >= 4 && !users[referrerId].rewarded) {
      users[referrerId].rewarded = true;

      bot.sendMessage(
        referrerId,
        `🎁 Tabriklaymiz! Siz 4 ta odamni taklif qildingiz.
🔐 Yopiq kanal havolasi:
${PRIVATE_CHANNEL_LINK}`
      );
    }
  }

  writeDB(users);

  const referralLink = `https://t.me/${BOT_USERNAME}?start=${userId}`;
  const myCount = users[userId].referrals;

  bot.sendMessage(
    userId,
    `Assalamu alaykum 👋

Bu bot orqali siz 7.5 sohibi Jasurbek Abdullayevdan
ishonchli IELTS CDI testlar va tekin jonli darslarni olishingiz mumkin.

👥 Siz hozircha ${myCount}/4 odam taklif qildingiz.

🔗 Sizning shaxsiy taklif havolangiz:
${referralLink}`
  );
}

module.exports = bot;