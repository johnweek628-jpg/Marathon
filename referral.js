const { readDB, writeDB } = require('./db');

function addUser(userId, referrerId = null) {
  const users = readDB();

  // 🚫 User already exists → do nothing
  if (users[userId]) {
    return { created: false };
  }

  // ✅ Create new user
  users[userId] = {
    referrals: 0,
    referrer: null,
    rewarded: false
  };

  // 🎯 Valid referral (no self-ref, referrer must exist)
  if (
    referrerId &&
    referrerId !== userId &&
    users[referrerId]
  ) {
    users[userId].referrer = referrerId;
    users[referrerId].referrals += 1;
  }

  writeDB(users);

  return { created: true };
}

module.exports = { addUser };
