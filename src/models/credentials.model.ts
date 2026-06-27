import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getDb } from '../db/index.js';
import type { Credentials } from './types.js';

const KEYLEN = 64;

/** Hash a password as `salt:hash` (both hex) using scrypt. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEYLEN);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

/** Constant-time verification of a password against a stored `salt:hash`. */
export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const derived = scryptSync(password, Buffer.from(saltHex, 'hex'), KEYLEN);
  const expected = Buffer.from(hashHex, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** Data access for the single-row admin credentials table. */
export const CredentialsModel = {
  get(): Credentials | undefined {
    return getDb().prepare('SELECT * FROM credentials WHERE id = 1').get() as
      Credentials | undefined;
  },

  /** Insert the initial credentials row if none exists. */
  seedIfMissing(username: string, password: string): void {
    if (this.get()) return;
    getDb()
      .prepare('INSERT INTO credentials (id, username, password_hash) VALUES (1, ?, ?)')
      .run(username, hashPassword(password));
  },

  update(username: string, password: string): void {
    getDb()
      .prepare(
        `UPDATE credentials SET username = ?, password_hash = ?, updated_at = datetime('now') WHERE id = 1`,
      )
      .run(username, hashPassword(password));
  },

  /** Returns true when username + password match the stored credentials. */
  verify(username: string, password: string): boolean {
    const creds = this.get();
    if (!creds) return false;
    // Compare username in constant time too, then password.
    const userBuf = Buffer.from(username);
    const storedUserBuf = Buffer.from(creds.username);
    const userOk =
      userBuf.length === storedUserBuf.length && timingSafeEqual(userBuf, storedUserBuf);
    const passOk = verifyPassword(password, creds.password_hash);
    return userOk && passOk;
  },
};
