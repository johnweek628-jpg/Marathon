const express = require('express');
const app = express();

// Health check for Railway / browser
app.get('/', (req, res) => {
  res.status(200).send('🤖 Bot is running smoothly');
});

module.exports = app;
