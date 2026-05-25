import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const MASTER_KEY = process.env.DBA_MASTER_KEY || 'dev-master-key-change-in-prod-32ch';

function getKey(): Buffer {
  // Derive 32-byte key from master key
  return crypto.createHash('sha256').update(MASTER_KEY).digest();
}

export function encrypt(plainText: string): { encrypted: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const iv = crypto.randomBytes(12);
  const key = getKey();

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  // Format: iv:authTag:encrypted
  return {
    encrypted: `${iv.toString('hex')}:${authTag}:${encrypted}`,
    salt,
  };
}

export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encryptedHex] = encryptedData.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) throw new Error('Invalid encrypted data format');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = getKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
