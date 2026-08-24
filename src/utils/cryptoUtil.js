const crypto = require('crypto');

// Secret Key algorithm and key derivation
const ALGORITHM = 'aes-256-gcm';
const SECRET = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'hutech_default_encryption_secret_key_2026';
// Derive 32-byte key from secret using SHA-256
const KEY = crypto.createHash('sha256').update(String(SECRET)).digest();

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: enc:<iv_hex>:<ciphertext_hex>:<authTag_hex>
 */
function encrypt(text) {
  if (!text || typeof text !== 'string') return text;
  // If already encrypted, return as is
  if (text.startsWith('enc:')) return text;

  try {
    const iv = crypto.randomBytes(12); // 12 bytes IV for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag().toString('hex');
    const ivHex = iv.toString('hex');

    return `enc:${ivHex}:${encrypted}:${tag}`;
  } catch (err) {
    console.error('Encryption error:', err);
    return text;
  }
}

/**
 * Decrypts an encrypted string (enc:<iv_hex>:<ciphertext_hex>:<authTag_hex>).
 * If the input is not encrypted (legacy plain text), returns it directly.
 */
function decrypt(encryptedText) {
  if (!encryptedText || typeof encryptedText !== 'string') return encryptedText;
  if (!encryptedText.startsWith('enc:')) return encryptedText; // Legacy plaintext fallback

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 4) return encryptedText;

    const [, ivHex, ciphertextHex, tagHex] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('Decryption error:', err.message);
    return encryptedText;
  }
}

module.exports = { encrypt, decrypt };
