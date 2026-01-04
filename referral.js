const { readDB, writeDB } = require('./db');

function addUser(userId, referrerId = null) {
  const users = readDB();

  if (!users[userId]) {
    users[userId] = {
      referrals: 0,
      referrer: referrerId,
      rewarded: false
    };

    if (referrerId && users[referrerId]) {
      users[referrerId].referrals += 1;
    }

    writeDB(users);
  }
}

module.exports = { addUser };
