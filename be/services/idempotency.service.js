const crypto = require('crypto');
const IdempotencyKey = require('../models/IdempotencyKey');
const ApiError = require('../utils/apiError');

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.keys(value).sort().reduce((result, key) => {
      if (key !== 'idempotencyKey') result[key] = stableValue(value[key]);
      return result;
    }, {});
  }
  return value;
};

const hashPayload = (payload) => crypto
  .createHash('sha256')
  .update(JSON.stringify(stableValue(payload || {})))
  .digest('hex');

const readExisting = async ({ scope, key, ownerId, requestHash }) => {
  const existing = await IdempotencyKey.findOne({ scope, key, ownerId });
  if (!existing) return null;

  if (existing.requestHash !== requestHash) {
    throw new ApiError('This idempotency key was already used with a different request.', 409);
  }

  if (existing.status === 'completed') {
    return {
      enabled: true,
      replay: true,
      record: existing,
      statusCode: existing.statusCode,
      responseBody: existing.responseBody
    };
  }

  if (existing.expiresAt > new Date()) {
    throw new ApiError('A request with this idempotency key is still processing.', 409);
  }

  await IdempotencyKey.deleteOne({ _id: existing._id, status: 'processing' });
  return null;
};

const begin = async ({ scope, key, ownerId, payload, ttlMs = 15 * 60 * 1000 }) => {
  if (!key) return { enabled: false, replay: false, record: null };
  if (typeof key !== 'string' || key.length > 200) {
    throw new ApiError('Idempotency-Key must be a string of at most 200 characters.', 400);
  }

  const normalizedKey = key.trim();
  if (!normalizedKey) {
    throw new ApiError('Idempotency-Key cannot be empty.', 400);
  }

  const normalizedOwnerId = ownerId.toString();
  const requestHash = hashPayload(payload);
  const lookup = { scope, key: normalizedKey, ownerId: normalizedOwnerId, requestHash };
  const existing = await readExisting(lookup);
  if (existing) return existing;

  try {
    const record = await IdempotencyKey.create({
      scope,
      key: normalizedKey,
      ownerId: normalizedOwnerId,
      requestHash,
      status: 'processing',
      expiresAt: new Date(Date.now() + ttlMs)
    });
    return { enabled: true, replay: false, record };
  } catch (error) {
    if (error.code !== 11000) throw error;
    const raced = await readExisting(lookup);
    if (raced) return raced;
    throw new ApiError('A request with this idempotency key is already processing.', 409);
  }
};

const complete = async ({ record, statusCode, responseBody }) => {
  if (!record) return;
  const storedResponseBody = JSON.parse(JSON.stringify(responseBody));
  await IdempotencyKey.updateOne(
    { _id: record._id, status: 'processing' },
    {
      $set: {
        status: 'completed',
        statusCode,
        responseBody: storedResponseBody,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    }
  );
};

const abandon = async (record) => {
  if (!record) return;
  await IdempotencyKey.deleteOne({ _id: record._id, status: 'processing' });
};

module.exports = {
  stableValue,
  hashPayload,
  begin,
  complete,
  abandon
};
