import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const MASTER_KEY = process.env.DBA_MASTER_KEY;
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32;

if (!MASTER_KEY || MASTER_KEY.length < 16) {
  console.error('[SECURITY] DBA_MASTER_KEY must be set (min 16 chars)! Cannot start without encryption key.');
  process.exit(1);
}

function deriveKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(MASTER_KEY!, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

export function encrypt(plainText: string): { encrypted: string; salt: string } {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  // Format: iv:authTag:encrypted
  return {
    encrypted: `${iv.toString('hex')}:${authTag}:${encrypted}`,
    salt: salt.toString('hex'),
  };
}

export function decrypt(encryptedData: string, saltHex: string): string {
  const [ivHex, authTagHex, encryptedHex] = encryptedData.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) throw new Error('Invalid encrypted data format');

  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = deriveKey(salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
