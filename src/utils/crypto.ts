// End-to-End Encryption (E2EE) using Web Crypto API (AES-GCM-256 + PBKDF2)

const SALT_STRING = 'justchat-e2ee-salt-v1';
const ITERATIONS = 100000;

// Cache derived keys by secret code to avoid recomputing PBKDF2 on every message
const keyCache = new Map<string, CryptoKey>();

/**
 * Derives a 256-bit AES-GCM CryptoKey from a secret passphrase (invite code)
 */
async function getEncryptionKey(secretCode: string): Promise<CryptoKey> {
  const normalized = secretCode.trim().toUpperCase();
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
 * Encrypts plaintext string using AES-GCM-256.
 * Output format: "enc:v1:<base64(iv + ciphertext)>"
 */
export async function encryptText(plainText: string, secretCode: string): Promise<string> {
  try {
    if (!plainText || !secretCode) return plainText;
    const key = await getEncryptionKey(secretCode);
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
 * If message is not encrypted (e.g. legacy or plain), returns as is.
 */
export async function decryptText(encryptedString: string, secretCode: string): Promise<string> {
  try {
    if (!encryptedString || !secretCode || !encryptedString.startsWith('enc:v1:')) {
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

    const key = await getEncryptionKey(secretCode);
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    // If decryption fails (wrong invite code or corrupted payload)
    return '🔒 [Зашифрованное сообщение — неверный код доступа]';
  }
}
