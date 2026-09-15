/**
 * Sign and verify JWTs for Healio auth sessions.
 * Payload always includes: id, role ('patient' | 'doctor' | 'admin'), email
 */

import jwt from 'jsonwebtoken';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set in backend/.env');
  }
  return secret;
}

export function signToken(payload) {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, getSecret(), { expiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, getSecret());
}
