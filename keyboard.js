function joinChannelKeyboard(channelLink) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📢 Kanalga qo‘shilish", url: channelLink }
        ],
        [
          { text: "✅ Tasdiqlash", callback_data: "check_join" }
        ]
      ]
    }
  };
}

module.exports = { joinChannelKeyboard };
