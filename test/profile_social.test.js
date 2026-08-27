'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ProfileFollow = require('../bot/Models/ProfileFollow');
const ProfileLike = require('../bot/Models/ProfileLike');

test('profile social models enforce one follow and one like per viewer-target pair', () => {
  const followIndexes = ProfileFollow.schema.indexes();
  const likeIndexes = ProfileLike.schema.indexes();
  assert.ok(followIndexes.some(([fields, options]) => fields.followerId === 1 && fields.profileUserId === 1 && options.unique === true));
  assert.ok(likeIndexes.some(([fields, options]) => fields.likerId === 1 && fields.profileUserId === 1 && options.unique === true));
});
