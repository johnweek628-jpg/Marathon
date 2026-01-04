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

if (!BOT_TOKEN || !MAIN_CHANNEL_ID || !MAIN_CHANNEL_LINK) {
  throw new Error('Missing required environment variables');
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

/* ─────────────── HELPERS ─────────────── */

async function isMember(userId) {
  try {
    const member = await bot.getChatMember(MAIN_CHANNEL_ID, userId);
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch {
    return false;
  }
}

/* ─────────────── START COMMAND ─────────────── */

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

  handleUserAfterJoin(userId, referrerId);
});

/* ─────────────── CALLBACK: CHECK JOIN ─────────────── */

bot.on('callback_query', async (query) => {
  if (query.data !== 'check_join') return;

  const userId = query.from.id.toString();
  const joined = await isMember(userId);

  if (!joined) {
    return bot.answerCallbackQuery(query.id, {
      text: "❌ Avval kanalga qo‘shiling!",
      show_alert: true
    });
  }

  await bot.answerCallbackQuery(query.id, { text: "✅ Tasdiqlandi!" });

  handleUserAfterJoin(userId, null);
});

/* ─────────────── MAIN LOGIC ─────────────── */

function handleUserAfterJoin(userId, referrerId) {
  const users = readDB();

  if (!users[userId]) {
    users[userId] = {
      referrals: 0,
      referrer: null,
