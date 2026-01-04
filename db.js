const TelegramBot = require('node-telegram-bot-api');
const { BOT_TOKEN, BOT_USERNAME, MAIN_CHANNEL_ID, PRIVATE_CHANNEL_LINK } = require('./config');
const { readDB, writeDB } = require('./db');
const { joinChannelKeyboard } = require('./keyboard');

if (!BOT_TOKEN || !BOT_USERNAME || !MAIN_CHANNEL_ID) {
  throw new Error('Missing required environment variables');
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

/* ─────────────── START COMMAND ─────────────── */

bot.onText(/\/start(?:\s+(\d+))?/, async (msg, match) => {
  const userId = msg.from.id.toString();
  const referrerId = match[1];

  // 1️⃣ Ask user to join channel first
  return bot.sendMessage(
    userId,
    "Botdan foydalanish uchun, avval kanalga qo‘shilishingiz kerak 👇",
    joinChannelKeyboard(`https://t.me/${MAIN_CHANNEL_ID.replace('@', '')}`)
  );
});

/* ─────────────── CALLBACK HANDLER ─────────────── */

bot.on('callback_query', async (query) => {
  const userId = query.from.id.toString();

  if (query.data !== 'check_join') return;

  try {
    const member = await bot.getChatMember(MAIN_CHANNEL_ID, userId);
    const isMember = ['member', 'administrator', 'creator'].includes(member.status);

    if (!isMember) {
      return bot.answerCallbackQuery(query.id, {
        text: "❌ Avval kanalga qo‘shiling!",
        show_alert: true
      });
    }

    // ✅ User IS a member → continue
    bot.answerCallbackQuery(query.id);

    let users = readDB();
    const isNewUser = !users[userId];

    if (isNewUser) {
      users[userId] = {
        referrals: 0,
        referrer: null,
        rewarded: false
      };

      // Referral logic
      const referrerId = query.message.text.match(/start=(\d+)/)?.[1];

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
    const refCount = users[userId]?.referrals ?? 0;

    // 🎯 Final message
    bot.sendMessage(
      userId,
      `Assalamu alaykum 👋

Bu bot orqali siz 7.5 sohibi Jasurbek Abdullayevdan
ishonchli IELTS CDI testlar va tekin jonli darslarni olishingiz mumkin.

👥 Siz hozircha ${refCount}/4 odam taklif qildingiz.

🔗 Sizning shaxsiy taklif havolangiz:
${referralLink}`
    );

  } catch (err) {
    console.error(err);
    bot.answerCallbackQuery(query.id, {
      text: "Xatolik yuz berdi. Keyinroq urinib ko‘ring.",
      show_alert: true
    });
  }
});

module.exports = bot;
