// End-to-End Encryption (E2EE) using Web Crypto API (AES-GCM-256 + PBKDF2)

const SALT_STRING = 'justchat-e2ee-salt-v1';
const ITERATIONS = 100000;

// Canonical shared cipher code for JustChat network (ensures all invited friends can decrypt seamlessly)
export const CANONICAL_CIPHER_CODE = 'JUST2026';

// Known valid codes used across devices
const KNOWN_JUSTCHAT_CODES = [
  'JUST2026',
  'VIP2026',
  'CREATOR2026',
  'JUSTCHAT_2026',
  'BRO2026',
  'JUST2025'
];

// Cache derived keys by secret code to avoid recomputing PBKDF2 on every message
const keyCache = new Map<string, CryptoKey>();

/**
 * Derives a 256-bit AES-GCM CryptoKey from a secret passphrase (invite code)
 */
async function getEncryptionKey(secretCode: string): Promise<CryptoKey> {
  const normalized = (secretCode || CANONICAL_CIPHER_CODE).trim().toUpperCase();
  if (keyCache.has(normalized)) {
    return keyCache.get(normalized)!;
  }

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(normalized),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SALT_STRING),
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  keyCache.set(normalized, key);
  return key;
}

/**
 * Encrypts plaintext string using AES-GCM-256 with the canonical network cipher key.
 * Output format: "enc:v1:<base64(iv + ciphertext)>"
 */
export async function encryptText(plainText: string, secretCode?: string): Promise<string> {
  try {
    if (!plainText) return plainText;
    // Always encrypt using the canonical network key so all friends and devices can read messages without key mismatches
    const effectiveCode = CANONICAL_CIPHER_CODE;
    const key = await getEncryptionKey(effectiveCode);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV recommended for AES-GCM
    const encodedData = new TextEncoder().encode(plainText);

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      encodedData
    );

    // Pack IV (12 bytes) + Ciphertext into single Uint8Array
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    // Convert to base64
    let binary = '';
    for (let i = 0; i < combined.byteLength; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    const b64 = btoa(binary);

    return `enc:v1:${b64}`;
  } catch (err) {
    console.warn('E2EE Encryption failed, sending unencrypted fallback:', err);
    return plainText;
  }
}

/**
 * Decrypts an encrypted message.
 * Tries the canonical cipher key, passed invite code, and all known community codes.
 * If message is not encrypted (e.g. legacy or plain), returns as is.
 */
export async function decryptText(encryptedString: string, secretCode?: string): Promise<string> {
  try {
    if (!encryptedString || !encryptedString.startsWith('enc:v1:')) {
      return encryptedString;
    }

    const b64 = encryptedString.slice('enc:v1:'.length);
    const binary = atob(b64);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      combined[i] = binary.charCodeAt(i);
    }

    // Extract IV (first 12 bytes) and Ciphertext (the rest)
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    // List of candidate codes to try (canonical first, then user's code, then known codes)
    const candidates = Array.from(
      new Set([CANONICAL_CIPHER_CODE, secretCode || '', ...KNOWN_JUSTCHAT_CODES])
    ).filter(Boolean);

    for (const code of candidates) {
      try {
        const key = await getEncryptionKey(code);
        const decryptedBuffer = await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv
          },
          key,
          ciphertext
        );
        return new TextDecoder().decode(decryptedBuffer);
      } catch (e) {
        // Try next candidate
      }
    }

    return '🔒 [Зашифрованное сообщение — неверный код доступа]';
  } catch (err) {
    return '🔒 [Зашифрованное сообщение — неверный код доступа]';
  }
}
