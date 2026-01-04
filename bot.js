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

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

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

  const joined = await isMember(userId);

  if (!joined) {
    return bot.sendMessage(
      userId,
      "Botdan foydalanish uchun, avval kanalga qo‘shilishingiz kerak 👇",
      joinChannelKeyboard(MAIN_CHANNEL_LINK)
    );
  }

  proceedAfterJoin(userId, referrerId);
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

  bot.answerCallbackQuery(query.id);
  proceedAfterJoin(userId);
});

/* -------------------- MAIN LOGIC -------------------- */
function proceedAfterJoin(userId, referrerId = null) {
  const users = readDB();
  const isNewUser = !users[userId];

  if (isNewUser) {
    users[userId] = {
      referrals: 0,
      referrer: null,
      rewarded: false
    };

    if (
      referrerId &&
      referrerId !== userId &&
      users[referrerId]
    ) {
      users[userId].referrer = referrerId;
      users[referrerId].referrals += 1;

      bot.sendMessage(
        referrerId,
        `🎉 Tabriklaymiz! Yangi obunachi qo‘shildi.
👥 Jami taklif qilinganlar: ${users[referrerId].referrals}/4`
      );

      if (users[referrerId].referrals >= 4 && !users[referrerId].rewarded) {
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

    bot.sendMessage(
      userId,
      `Assalamu alaykum, mana hozir sizning shaxsiy taklif qilish havolangizni beramiz.
Bu orqali 4 ta tanishingizni kanalga taklif qiling.
Har bir taklif qilingan obunachingiz sanab boriladi.
4 ta odam taklif qilganingizdan so‘ng, sizga maxsus yopiq kanalga link beriladi.`
    );
  }

  const referralLink = `https://t.me/${BOT_USERNAME}?start=${userId}`;
  const count = users[userId]?.referrals ?? 0;

  bot.sendMessage(
    userId,
    `Shu kanalda 7.5 sohibi Jasurbek Abdullayevdan ishonchli IELTS CDI testlar va tekin jonli darslarni ko‘rishingiz mumkin.

👥 Siz hozircha ${count}/4 odam taklif qildingiz.

🔗 Sizning shaxsiy taklif havolangiz:
${referralLink}`
  );
}

module.exports = bot;
