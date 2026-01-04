const TelegramBot = require('node-telegram-bot-api');
const { BOT_TOKEN, PRIVATE_CHANNEL_LINK } = require('./config');
const { addUser } = require('./referral');
const { readDB, writeDB } = require('./db');

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.onText(/\/start(?:\s+(\d+))?/, (msg, match) => {
  const userId = msg.from.id.toString();
  const referrerId = match[1];

  addUser(userId, referrerId);

  const referralLink = `https://t.me/${bot.username}?start=${userId}`;

  bot.sendMessage(
    userId,
    `Assalamu alaykum, mana hozir sizning shaxsiy taklif qilish havolangizni beramiz. 
Bu orqali 4 ta tanishingizni kanalga taklif qiling. 
Har bir taklif qilingan obunachingiz sanab boriladi. 
4 ta odam taklif qilganingizdan so'ng, sizga maxsus yopiq kanalga link beriladi.`
  );

  bot.sendMessage(
    userId,
    `Shu kanalda 7.5 sohibi Jasurbek Abdullayevdan ishonchli IELTS CDI testlar va tekin jonli darslarni ko'rishingiz mumkin.
Buning uchun esa botga start berishingiz kerak bo'ladi.

🔗 Sizning shaxsiy taklif havolangiz:
${referralLink}`
  );
});

bot.on('new_chat_members', (msg) => {
  const users = readDB();
  const newUser = msg.new_chat_members[0];

  if (users[newUser.id] && users[newUser.id].referrer) {
    const referrerId = users[newUser.id].referrer;
    users[referrerId].referrals += 1;

    bot.sendMessage(
      referrerId,
      `🎉 Tabriklaymiz! Yangi obunachi qo'shildi.
👥 Jami taklif qilinganlar: ${users[referrerId].referrals}/4`
    );

    if (users[referrerId].referrals >= 4 && !users[referrerId].rewarded) {
      users[referrerId].rewarded = true;
      bot.sendMessage(
        referrerId,
        `🎁 Tabriklaymiz! Siz 4 ta odam taklif qildingiz.
🔐 Yopiq kanal havolasi:
${PRIVATE_CHANNEL_LINK}`
      );
    }

    writeDB(users);
  }
});

module.exports = bot;
