const TelegramBot = require('node-telegram-bot-api');
const {
  BOT_TOKEN,
  BOT_USERNAME,
  MAIN_CHANNEL_ID,
  PRIVATE_CHANNEL_LINK
} = require('./config');
const { readDB, writeDB } = require('./db');

if (!BOT_USERNAME) {
  throw new Error('BOT_USERNAME is not defined in environment variables');
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

/* -------------------- KEYBOARD -------------------- */
function joinKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "📢 Kanalga qo‘shilish",
            url: "https://t.me/jasurbek_javohir_ielts_cefr"
          }
        ],
        [
          {
            text: "✅ Tasdiqlash",
            callback_data: "check_join"
          }
        ]
      ]
    }
  };
}

/* -------------------- START HANDLER -------------------- */
async function handleStart(msg, match) {
  const userId = msg.from.id.toString();
  const referrerId = match?.[1];

  let users = readDB();
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
  const refCount = users[userId]?.referrals ?? 0;

  bot.sendMessage(
    userId,
    `Shu kanalda 7.5 sohibi Jasurbek Abdullayevdan ishonchli IELTS CDI testlar va tekin jonli darslarni ko‘rishingiz mumkin.

👥 Siz hozircha ${refCount}/4 odam taklif qildingiz.

🔗 Sizning shaxsiy taklif havolangiz:
${referralLink}`
  );
}

/* -------------------- /START -------------------- */
bot.onText(/\/start(?:\s+(\d+))?/, async (msg, match) => {
  const userId = msg.from.id;

  try {
    const member = await bot.getChatMember(MAIN_CHANNEL_ID, userId);

    if (["member", "administrator", "creator"].includes(member.status)) {
      return handleStart(msg, match);
    }
  } catch (e) {
    // ignore
  }

  bot.sendMessage(
    userId,
    "❗️Botdan foydalanish uchun, avval kanalga qo‘shilishingiz kerak",
    joinKeyboard()
  );
});

/* -------------------- CONFIRM BUTTON -------------------- */
bot.on('callback_query', async (query) => {
  const userId = query.from.id;

  if (query.data !== "check_join") return;

  try {
    const member = await bot.getChatMember(MAIN_CHANNEL_ID, userId);

    if (["member", "administrator", "creator"].includes(member.status)) {
      await bot.answerCallbackQuery(query.id, {
        text: "✅ Tasdiqlandi!",
        show_alert: false
      });

      return handleStart(
        { from: { id: userId } },
        null
      );
    }
  } catch (e) {}

  bot.answerCallbackQuery(query.id, {
    text: "❌ Avval kanalga qo‘shiling",
    show_alert: true
  });
});

module.exports = bot;
