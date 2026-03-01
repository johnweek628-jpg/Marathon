const TelegramBot = require('node-telegram-bot-api');
const {
  BOT_TOKEN,
  BOT_USERNAME,
  MAIN_CHANNEL_ID,
  MAIN_CHANNEL_LINK,
  PRIVATE_CHANNEL_LINK
} = require('./config');

const { readDB, writeDB } = require('./db');
const { joinChannelKeyboard } = require('./keyboard');

const TelegramBot = require('node-telegram-bot-api');
const { BOT_TOKEN } = require('./config');

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

bot.deleteWebHook({ drop_pending_updates: true })
  .then(() => bot.startPolling({ interval: 1000 }))
  .catch((err) => console.error("Webhook delete/poll start error:", err));

/* -------------------- CHECK MEMBERSHIP -------------------- */
async function isMember(userId) {
  try {
    const member = await bot.getChatMember(MAIN_CHANNEL_ID, userId);
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch {
    return false;
  }
}

/* -------------------- /START -------------------- */
bot.onText(/\/start(?:\s+(\d+))?/, async (msg, match) => {
  const userId = msg.from.id.toString();
  const referrerId = match[1];

  const users = readDB();

  // 🔒 Save referrer temporarily if user is new
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
bot.on('callback_query', async (query) => {
  if (query.data !== 'check_join') return;

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

  // 🚫 Already processed
  if (user.processed) return;

  user.processed = true;

  const referrerId = user.referrer;

  if (
    referrerId &&
    referrerId !== userId &&
    users[referrerId]
  ) {
    users[referrerId].referrals += 1;

    const count = users[referrerId].referrals;

    // 🔔 REFERRAL UPDATE MESSAGE (EVERY TIME)
    bot.sendMessage(
      referrerId,
      `🎉 Yana bir odam referal havolangiz orqali kanalga qo‘shildi!
👥 Natija: ${count}/4`
    );

    // 🎁 REWARD
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
