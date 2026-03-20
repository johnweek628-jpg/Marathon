const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const {
  BOT_TOKEN,
  BOT_USERNAME,
  MAIN_CHANNEL_ID,
  MAIN_CHANNEL_LINK,
  PRIVATE_CHANNEL_ID
} = require("./config");

const { readDB, writeDB } = require("./db");
const { joinChannelKeyboard } = require("./keyboard");

const app = express();
app.use(express.json());

/* ✅ ONLY POLLING (NO WEBHOOK CLASH) */
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

/* -------------------- VERIFY FUNCTION -------------------- */

async function verifyUser(userId) {
  try {
    const users = readDB();
    const user = users[userId];

    if (!user) return;

    const referralIds = user.referralIds || [];

    let validCount = 0;

    for (const refId of referralIds) {
      const joined = await isMember(refId);
      if (joined) validCount++;
    }

    if (validCount >= 3) {
      const invite = await bot.createChatInviteLink(PRIVATE_CHANNEL_ID, {
        member_limit: 1
      });

      await bot.sendMessage(
        userId,
`✅ Verification successful!

🎉 Here is your private access link:
${invite.invite_link}

⚠️ This link is valid for one user only.`
      );
    } else {
      user.rewarded = false;
      writeDB(users);

      await bot.sendMessage(
        userId,
`❌ Verification failed.

You need 3 ACTIVE referrals.
Currently valid: ${validCount}

Make sure your invited users stay in the channel.`
      );
    }

  } catch (err) {
    console.error("verifyUser error:", err);

    await bot.sendMessage(
      userId,
      "❌ Verificationda xatolik yuz berdi. Keyinroq urinib ko‘ring."
    );
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
      referralIds: [],
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

  if (query.data === "verify_refs") {
    await bot.answerCallbackQuery(query.id, {
      text: "⏳ Tekshirilmoqda..."
    });

    return verifyUser(userId);
  }

  if (query.data === "pay_5000") {
    await bot.answerCallbackQuery(query.id);

    return bot.sendMessage(
      userId,
`💰 Agar 5000 so'm bilan qo‘shilmoqchi bo‘lsangiz:

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

      if (!users[referrerId].referralIds.includes(userId)) {

        users[referrerId].referrals += 1;
        users[referrerId].referralIds.push(userId);

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
`✅ Siz 3 ta referral yig‘dingiz!

👉 Endi "Verify" tugmasini bosing.`
          );
        }
      }
    }

    writeDB(users);
  }

  const referralLink = `https://t.me/${BOT_USERNAME}?start=${userId}`;
  const myCount = users[userId].referrals;

  const shareText = encodeURIComponent(
`🔥 IELTS speaking marafoniga taklif!

🚀 Hoziroq qo‘shiling!`
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
              text: "✅ Verify",
              callback_data: "verify_refs"
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