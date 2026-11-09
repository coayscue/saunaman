const { createHash, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const verifier = require('../admin-password-verifier.json');

const deriveKey = promisify(scrypt);
const salt = Buffer.from(verifier.salt, 'hex');
const expectedKey = Buffer.from(verifier.hash, 'hex');
const digest = value => createHash('sha256').update(value).digest();

function requiresAdminPassword(env = process.env) {
  return Boolean(env.ADMIN_PASSWORD) || env.NODE_ENV === 'production';
}

async function verifyAdminPassword(password, env = process.env) {
  if (!requiresAdminPassword(env)) return true;
  if (typeof password !== 'string' || password.length === 0) return false;

  if (env.ADMIN_PASSWORD) {
    return timingSafeEqual(digest(password), digest(env.ADMIN_PASSWORD));
  }

  // The fallback credential is a 32-byte random value encoded as base64url.
  if (!/^[A-Za-z0-9_-]{43}$/.test(password)) return false;
  return timingSafeEqual(await deriveKey(password, salt, expectedKey.length), expectedKey);
}

module.exports = { requiresAdminPassword, verifyAdminPassword };
