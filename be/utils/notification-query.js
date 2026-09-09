function unexpiredNotifications(now = new Date()) {
  return {
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: now } },
    ],
  };
}

module.exports = { unexpiredNotifications };
