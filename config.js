require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  BOT_USERNAME: process.env.BOT_USERNAME,
  MAIN_CHANNEL_ID: process.env.MAIN_CHANNEL_ID, // e.g. -1001234567890
  MAIN_CHANNEL_LINK: process.env.MAIN_CHANNEL_LINK, // https://t.me/your_channel
};
