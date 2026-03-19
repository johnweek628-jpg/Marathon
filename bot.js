const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const {
  BOT_TOKEN,
  BOT_USERNAME,
  MAIN_CHANNEL_ID,
  MAIN_CHANNEL_LINK,
  PRIVATE_CHANNEL_ID // ⚠️ NEW (link emas, ID)
} = require("./config");

const { readDB, writeDB } = require("./db");
const { joinChannelKeyboard } = require("./keyboard");

const app = express();
app.use(express.json());

const bot = new TelegramBot(BOT_TOKEN, {
  polling: true
});

/* -------------------- SERVER -------------------- */

app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

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

/* -------------------- VERIFY FUNCTION (NEW) -------------------- */

async function verifyUser(userId) {

  const users = readDB();
  const user = users[userId];

  if (!user) return;

  const referralIds = user.referralIds || [];

  let validCount = 0;

  for (let refId of referralIds) {
    const joined = await isMember(refId);
    if (joined) validCount++;
  }

  if (validCount >= 3) {

    const invite = await bot.createChatInviteLink(PRIVATE_CHANNEL_ID, {
      member_limit: 1
    });

    bot.sendMessage(
      userId,
`✅ Verification successful!

🎉 Here is your private access link:
${invite.invite_link}

⚠️ This link is valid for one user only.`
    );

  } else {

    bot.sendMessage(
      userId,
`❌ Verification failed.

You need 3 ACTIVE referrals.
Currently valid: ${validCount}

Make sure your invited users stay in the channel.`
    );

    // reset reward
    user.rewarded = false;
    writeDB(users);
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
      referralIds: [], // 🔥 NEW
      referrer: referrerId || null,
      rewarded: false,
      processed: false,
      joinedBefore: false
    };
    writeDB(users);
  }

  const joined = await isMember(userId);

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

    const users = readDB();
    if (users[userId]) {
      users[userId].joinedBefore = false;
      writeDB(users);
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

  if (!user.processed && !user.joinedBefore) {

    user.processed = true;

    const referrerId = user.referrer;

    if (referrerId && referrerId !== userId && users[referrerId]) {

      // 🔥 DUPLICATE PROTECTION
      if (!users[referrerId].referralIds.includes(userId)) {

        users[referrerId].referrals += 1;
        users[referrerId].referralIds.push(userId);

        const count = users[referrerId].referrals;

        bot.sendMessage(
          referrerId,
`🎉 Yana bir odam sizning havolangiz orqali qo‘shildi!
👥 Natija: ${count}/3`
        );

        // 🔥 START VERIFICATION INSTEAD OF DIRECT REWARD
        if (count >= 3 && !users[referrerId].rewarded) {

          users[referrerId].rewarded = true;

          bot.sendMessage(
            referrerId,
`⏳ We are verifying your referrals...
This may take a few minutes.`
          );

          setTimeout(() => {
            verifyUser(referrerId);
          }, 10 * 60 * 1000); // 10 min
        }
      }
    }

    writeDB(users);
  }

  const referralLink = `https://t.me/${BOT_USERNAME}?start=${userId}`;
  const myCount = users[userId].referrals;

  const shareText = encodeURIComponent(
`🔥 IELTS speakingdan 7.5 sohibi sizni 3 kunlik SPEAKING marafoniga taklif qilyapti!

🚀 Qo‘shilib oling !`
  );

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