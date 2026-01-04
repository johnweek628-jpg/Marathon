const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'users.json');

function ensureDB() {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
  }
}

function readDB() {
  ensureDB();
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeDB(data) {
  ensureDB();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = { readDB, writeDB };
