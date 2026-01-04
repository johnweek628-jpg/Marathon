function joinChannelKeyboard(channelLink) {
  if (!channelLink) {
    throw new Error("MAIN_CHANNEL_LINK is missing");
  }

  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "📢 Kanalga qo‘shilish",
            url: channelLink
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

module.exports = { joinChannelKeyboard };
