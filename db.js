const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'users.json');

function readDB() {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = { readDB, writeDB };
