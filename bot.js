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

/* ❗️ ONLY POLLING (WEBHOOKNI BUTUNLAY OLIB TASHLADIK) */
const bot = new TelegramBot(BOT_TOKEN, {
  polling: true
});

/* -------------------- SERVER -------------------- */

app.get("/", (req, res) => {
  res.send("Bot is running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
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
      processed: false
    };
    writeDB(users);
  }

  const joined = await isMember(userId);

  if (!joined) {
    return bot.sendMessage(
      userId,
      "Botdan foydalanish uchun, avval kanalga qo‘shiling 👇",
      joinChannelKeyboard(MAIN_CHANNEL_LINK)
    );
  }

  proceedAfterJoin(userId);
});

/* -------------------- CALLBACK -------------------- */

bot.on("callback_query", async (query) => {

  const userId = query.from.id.toString();

  if (query.data === "check_join") {

    const joined = await isMember(userId);

    if (!joined) {
      return bot.answerCallbackQuery(query.id, {
        text: "❌ Avval kanalga qo‘shiling",
        show_alert: true
      });
    }

    await bot.answerCallbackQuery(query.id, { text: "✅ Tasdiqlandi!" });
    return proceedAfterJoin(userId);
  }

  if (query.data === "pay_5000") {

    await bot.answerCallbackQuery(query.id);

    return bot.sendMessage(
      userId,
`💰 Agar 5000 so'm bilan marathonga qo‘shilmoqchi bo‘lsangiz:

💳 Karta: 9860100127333845

📩 To‘lovdan keyin screenshotni:
👉 @jasurbeksielts ga yuboring

🔐 Sizga private link beriladi.`
    );
  }
});

/* -------------------- MAIN LOGIC -------------------- */

function proceedAfterJoin(userId) {

  const users = readDB();
  const user = users[userId];

  if (!user) return;

  if (!user.processed) {

    user.processed = true;

    const referrerId = user.referrer;

    if (referrerId && referrerId !== userId && users[referrerId]) {

      users[referrerId].referrals += 1;

      const count = users[referrerId].referrals;

      bot.sendMessage(
        referrerId,
`🎉 Yangi referral qo‘shildi!
👥 Natija: ${count}/3`
      );

      if (count >= 3 && !users[referrerId].rewarded) {

        users[referrerId].rewarded = true;

        bot.sendMessage(
          referrerId,
`🎁 Tabriklaymiz!

🔐 Yopiq kanal havolasi:
${PRIVATE_CHANNEL_LINK}`
        );
      }
    }

    writeDB(users);
  }

  const referralLink = `https://t.me/${BOT_USERNAME}?start=${userId}`;
  const myCount = users[userId].referrals;

  const shareText = encodeURIComponent(
`🔥 IELTS speaking marafoniga taklif!

🚀 Qo‘shilib oling!`
  );

  bot.sendMessage(
    userId,
`🎤 SPEAKING MARATHON

👥 3 ta odam taklif qiling:
${referralLink}

📊 Siz: ${myCount}/3`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📤 Ulashish",
              url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${shareText}`
            }
          ],
          [
            {
              text: "💰 5000 so'm bilan kirish",
              callback_data: "pay_5000"
            }
          ]
        ]
      }
    }
  );
}

module.exports = bot;