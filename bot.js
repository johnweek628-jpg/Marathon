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

const bot = new TelegramBot(BOT_TOKEN, {
  polling: true
});

// 🔹 Webhook endpoint
app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// 🔹 Health route
app.get("/", (req, res) => {
  res.send("Bot is running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log("Server running on", PORT);
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
      rewarded: false,
      processed: false,
      joinedBefore: false // 🔥 NEW
    };
    writeDB(users);
  }

  const joined = await isMember(userId);

  // 🔥 agar user oldindan kanalda bo‘lgan bo‘lsa
  if (joined) {
    users[userId].joinedBefore = true;
    writeDB(users);
  }

  if (!joined) {
    return bot.sendMessage(
      userId,
      "Botdan foydalanish uchun, avval kanalga qo‘shilishingiz kerak 👇",
      joinChannelKeyboard(MAIN_CHANNEL_LINK)
    );
  }

  proceedAfterJoin(userId);
});

/* -------------------- BUTTON HANDLERS -------------------- */
bot.on("callback_query", async (query) => {
  const userId = query.from.id.toString();

  // 🔹 Kanalni tekshirish
  if (query.data === "check_join") {
    const joined = await isMember(userId);

    if (!joined) {
      return bot.answerCallbackQuery(query.id, {
        text: "❌ Avval kanalga qo‘shiling",
        show_alert: true
      });
    }

    // 🔥 tasdiqlash bosilganda ham oldindan member flag qo‘yamiz
    const users = readDB();
    if (users[userId]) {
      users[userId].joinedBefore = false; // faqat yangi qo‘shilgan bo‘lsa ishlaydi
      writeDB(users);
    }

    await bot.answerCallbackQuery(query.id, { text: "✅ Tasdiqlandi!" });
    return proceedAfterJoin(userId);
  }

  // 🔹 5000 so‘m tugmasi
  if (query.data === "pay_5000") {
    await bot.answerCallbackQuery(query.id);

    return bot.sendMessage(
      userId,
      `💰 Agar 5000 so'm bilan marathonga qo‘shilmoqchi bo‘lsangiz:

💳 Karta: 9860100127333845

📩 To‘lov qilgandan keyin screenshotni:
👉 @jasurbeksielts ga yuboring

🔐 Sizga bir martalik link beriladi.`
    );
  }
});

/* -------------------- MAIN LOGIC -------------------- */
function proceedAfterJoin(userId) {
  const users = readDB();
  const user = users[userId];

  // 🔥 ANTI-CHEAT FIX
  if (!user.processed && !user.joinedBefore) {
    user.processed = true;

    const referrerId = user.referrer;

    if (referrerId && referrerId !== userId && users[referrerId]) {
      users[referrerId].referrals += 1;
      const count = users[referrerId].referrals;

      bot.sendMessage(
        referrerId,
        `🎉 Yana bir odam sizning havolangiz orqali qo‘shildi!
👥 Natija: ${count}/3`
      );

      if (count >= 3 && !users[referrerId].rewarded) {
        users[referrerId].rewarded = true;

        bot.sendMessage(
          referrerId,
          `🎁 Tabriklaymiz! Siz 3 ta odamni taklif qildingiz.
🔐 Yopiq kanal havolasi:
${PRIVATE_CHANNEL_LINK}`
        );
      }
    }

    writeDB(users);
  }

  const referralLink = `https://t.me/${BOT_USERNAME}?start=${userId}`;
  const myCount = users[userId].referrals;
  const shareText = encodeURIComponent("🎤 3 kunlik speaking marathonga qo‘shiling!");

  bot.sendMessage(
    userId,
`🎤 3 KUNLIK SPEAKING MARATHON

🔥 Qoidalar:

1. 3 kun davomida speaking topshiriqlar
2. Har kuni practice
3. Kirish uchun:

👥 3 ta odam taklif qiling:
${referralLink}

📊 Siz: ${myCount}/3`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📤 Do‘stlarga ulashish",
              url: `https://t.me/share/url?url=${referralLink}&text=${shareText}`
            }
          ],
          [
            {
              text: "💰 5000 so'm bilan qo‘shilaman",
              callback_data: "pay_5000"
            }
          ]
        ]
      }
    }
  );
}

module.exports = bot;