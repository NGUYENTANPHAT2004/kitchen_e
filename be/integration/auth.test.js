const User = require('../models/User');

describe('User schema regressions', () => {
  test('persists addresses and default address metadata', () => {
    expect(User.schema.path('addresses')).toBeDefined();
    expect(User.schema.path('defaultAddress')).toBeDefined();
    expect(User.schema.path('defaultAddress').options.ref).toBeUndefined();
  });

  test('enables timestamps used by user statistics and sorting', () => {
    expect(User.schema.path('createdAt')).toBeDefined();
    expect(User.schema.path('updatedAt')).toBeDefined();
  });

  test('declares fields written by auth and profile middleware', () => {
    expect(User.schema.path('lastActivity')).toBeDefined();
    expect(User.schema.path('avatarPath')).toBeDefined();
    expect(User.schema.path('isLocked')).toBeDefined();
    expect(User.schema.path('lockUntil')).toBeDefined();
  });
});
