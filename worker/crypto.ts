/**
 * KV Data Encryption
 *
 * Encrypts scene data using the user's Spotify ID as the key.
 * - Key derivation: SHA-256(userId) → 32 bytes for AES-256
 * - Algorithm: AES-256-GCM (authenticated encryption)
 * - Format: base64(12-byte IV + ciphertext + 16-byte auth tag)
 */

import { gcm } from '@noble/ciphers/aes.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'

const IV_LENGTH = 12 // 96 bits, standard for AES-GCM
const KEY_HASH_LENGTH = 32 // Characters for KV key (from hex)

/**
 * Generate an opaque KV key from user ID.
 * Uses SHA-256 hash truncated to 32 hex chars.
 */
export function hashUserIdForKey(userId: string): string {
  const hash = sha256(new TextEncoder().encode(userId))
  return bytesToHex(hash).slice(0, KEY_HASH_LENGTH)
}

/**
 * Derive AES-256 key from user ID.
 * SHA-256 output is exactly 32 bytes = 256 bits.
 */
function deriveKey(userId: string): Uint8Array {
  return sha256(new TextEncoder().encode(userId))
}

/**
 * Encrypt plaintext string using user ID as key.
 * Returns base64-encoded string: IV + ciphertext + auth tag.
 */
export function encrypt(plaintext: string, userId: string): string {
  const key = deriveKey(userId)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const data = new TextEncoder().encode(plaintext)

  const cipher = gcm(key, iv)
  const ciphertext = cipher.encrypt(data)

  // Combine IV + ciphertext for storage
  const combined = new Uint8Array(iv.length + ciphertext.length)
  combined.set(iv)
  combined.set(ciphertext, iv.length)

  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypt base64-encoded ciphertext using user ID as key.
 * Expects format: base64(IV + ciphertext + auth tag).
 */
export function decrypt(encrypted: string, userId: string): string {
  const key = deriveKey(userId)

  // Decode base64 to bytes
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0))

  // Extract IV and ciphertext
  const iv = combined.slice(0, IV_LENGTH)
  const ciphertext = combined.slice(IV_LENGTH)

  const cipher = gcm(key, iv)
  const plaintext = cipher.decrypt(ciphertext)

  return new TextDecoder().decode(plaintext)
}

/**
 * Check if a stored value is encrypted (base64) or legacy plaintext JSON.
 * Legacy data starts with '{', encrypted data is base64.
 */
export function isEncrypted(value: string): boolean {
  return !value.startsWith('{')
}
