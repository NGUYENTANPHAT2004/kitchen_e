const crypto = require('crypto');
const ApiError = require('../utils/apiError');

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
  }
  return value;
};

const hashPayload = (payload) => crypto
  .createHash('sha256')
  .update(JSON.stringify(stableValue(payload || {})))
  .digest('hex');

const safeEqual = (received, expected) => {
  if (!received || !expected) return false;
  const left = Buffer.from(String(received).toLowerCase());
  const right = Buffer.from(String(expected).toLowerCase());
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const sortObject = (obj) => Object.keys(obj).sort().reduce((sorted, key) => {
  sorted[key] = obj[key];
  return sorted;
}, {});

const buildVnPaySignature = (params, secret) => {
  const signedParams = { ...params };
  delete signedParams.vnp_SecureHash;
  delete signedParams.vnp_SecureHashType;
  const sortedParams = sortObject(signedParams);
  const signData = Object.keys(sortedParams)
    .map((key) => `${key}=${sortedParams[key]}`)
    .join('&');
  return crypto.createHmac('sha512', secret)
    .update(Buffer.from(signData, 'utf8'))
    .digest('hex');
};

const verifyVnPay = (payload) => {
  const secret = process.env.VNPAY_HASH_SECRET;
  return Boolean(secret && payload.vnp_SecureHash &&
    safeEqual(payload.vnp_SecureHash, buildVnPaySignature(payload, secret)));
};

const buildMomoSignature = (payload, accessKey, secretKey) => {
  const fields = [
    ['accessKey', accessKey],
    ['amount', payload.amount],
    ['extraData', payload.extraData],
    ['message', payload.message],
    ['orderId', payload.orderId],
    ['orderInfo', payload.orderInfo],
    ['orderType', payload.orderType],
    ['partnerCode', payload.partnerCode],
    ['payType', payload.payType],
    ['requestId', payload.requestId],
    ['responseTime', payload.responseTime],
    ['resultCode', payload.resultCode],
    ['transId', payload.transId]
  ];
  const rawSignature = fields
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');
};

const verifyMomo = (payload) => {
  const accessKey = process.env.MOMO_ACCESS_KEY;
  const secretKey = process.env.MOMO_SECRET_KEY;
  return Boolean(accessKey && secretKey && payload.signature &&
    safeEqual(payload.signature, buildMomoSignature(payload, accessKey, secretKey)));
};

const verifyZaloPay = (payload) => {
  const key2 = process.env.ZALOPAY_KEY2;
  if (!key2 || !payload.data || !payload.mac) return false;
  const expected = crypto.createHmac('sha256', key2).update(payload.data).digest('hex');
  return safeEqual(payload.mac, expected);
};

const normalizeWebhook = (payload) => {
  if (payload.vnp_TxnRef) {
    return {
      gateway: 'vnpay',
      paymentId: payload.vnp_TxnRef,
      eventId: payload.vnp_TransactionNo ||
        `${payload.vnp_TxnRef}:${payload.vnp_PayDate || payload.vnp_ResponseCode}`,
      status: payload.vnp_ResponseCode === '00' &&
        (!payload.vnp_TransactionStatus || payload.vnp_TransactionStatus === '00')
        ? 'completed'
        : 'failed',
      transactionId: payload.vnp_TransactionNo,
      message: `VNPay response: ${payload.vnp_ResponseCode}`,
      verify: () => verifyVnPay(payload)
    };
  }

  if (payload.partnerCode && payload.orderId) {
    return {
      gateway: 'momo',
      paymentId: payload.orderId,
      eventId: String(payload.requestId || payload.transId || payload.orderId),
      status: Number(payload.resultCode) === 0 ? 'completed' : 'failed',
      transactionId: payload.transId ? String(payload.transId) : undefined,
      message: payload.message || 'MoMo payment failed',
      verify: () => verifyMomo(payload)
    };
  }

  if (payload.data && payload.mac) {
    let data;
    try {
      data = JSON.parse(payload.data);
    } catch (_error) {
      throw new ApiError('Invalid ZaloPay callback data.', 400);
    }
    if (!data.app_trans_id) {
      throw new ApiError('Invalid ZaloPay payment reference.', 400);
    }
    return {
      gateway: 'zalopay',
      paymentId: data.app_trans_id,
      eventId: String(data.zp_trans_id || data.app_trans_id),
      status: 'completed',
      transactionId: data.zp_trans_id ? String(data.zp_trans_id) : undefined,
      message: 'ZaloPay callback rejected',
      verify: () => verifyZaloPay(payload)
    };
  }

  throw new ApiError('Unknown payment gateway.', 400);
};

module.exports = {
  hashPayload,
  safeEqual,
  sortObject,
  buildVnPaySignature,
  buildMomoSignature,
  verifyVnPay,
  verifyMomo,
  verifyZaloPay,
  normalizeWebhook
};
