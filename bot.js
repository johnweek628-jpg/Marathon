const TelegramBot = require('node-telegram-bot-api');
const { BOT_TOKEN, PRIVATE_CHANNEL_LINK, BOT_USERNAME } = require('./config');
const { readDB, writeDB } = require('./db');

if (!BOT_USERNAME) {
  throw new Error('BOT_USERNAME is not defined in config or environment variables');
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.onText(/\/start(?:\s+(\d+))?/, (msg, match) => {
  const userId = msg.from.id.toString();
  const referrerId = match[1];

  let users;
  try {
    users = readDB();
  } catch {
    users = {};
  }

  const isNewUser = !users[userId];

  if (isNewUser) {
    users[userId] = {
      referrals: 0,
      referrer: null,
      rewarded: false
    };

    // Valid referral
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
  }

  const referralLink = `https://t.me/${BOT_USERNAME}?start=${userId}`;

  // New user → full intro
  if (isNewUser) {
    bot.sendMessage(
      userId,
      `Assalamu alaykum, mana hozir sizning shaxsiy taklif qilish havolangizni beramiz.
Bu orqali 4 ta tanishingizni kanalga taklif qiling.
Har bir taklif qilingan obunachingiz sanab boriladi.
4 ta odam taklif qilganingizdan so‘ng, sizga maxsus yopiq kanalga link beriladi.`
    );
  }

  // Everyone → referral link + status
  const userRefCount = users[userId]?.referrals ?? 0;

  bot.sendMessage(
    userId,
    `Shu kanalda 7.5 sohibi Jasurbek Abdullayevdan ishonchli IELTS CDI testlar va tekin jonli darslarni ko‘rishingiz mumkin.

👥 Siz hozircha ${userRefCount}/4 odam taklif qildingiz.

🔗 Sizning shaxsiy taklif havolangiz:
${referralLink}`
  );
});

module.exports = bot;
