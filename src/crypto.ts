/**
 * End-to-end encryption utilities using Web Crypto API
 * 
 * The encryption key is generated client-side and embedded in the share URL.
 * The server never stores or sees the decryption key, proving that even
 * the developer cannot read the messages stored in KV.
 * 
 * Format: bundleId_base64urlKey
 * - bundleId: Random ID used as KV key
 * - base64urlKey: 256-bit AES-GCM key encoded in base64url
 * 
 * Data is compressed with pako (zlib) before encryption to reduce storage size.
 */

import pako from 'pako'

// Generate a random encryption key (256-bit for AES-GCM)
export async function generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true, // extractable
        ['encrypt', 'decrypt']
    ) as CryptoKey
}

// Export key to base64url string (for embedding in URL)
export async function exportKey(key: CryptoKey): Promise<string> {
    const raw = await crypto.subtle.exportKey('raw', key) as ArrayBuffer
    return arrayBufferToBase64Url(raw)
}

// Import key from base64url string
export async function importKey(keyStr: string): Promise<CryptoKey> {
    const raw = base64UrlToArrayBuffer(keyStr)
    return await crypto.subtle.importKey(
        'raw',
        raw,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    )
}

// Encrypt data using AES-GCM with compression
export async function encrypt(data: string, key: CryptoKey): Promise<string> {
    // Compress data first
    const compressed = pako.deflate(data)

    const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV for GCM

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        compressed
    )

    // Prepend IV to ciphertext
    const combined = new Uint8Array(iv.length + encrypted.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(encrypted), iv.length)

    return arrayBufferToBase64Url(combined.buffer)
}

// Decrypt data using AES-GCM with decompression
export async function decrypt(encryptedData: string, key: CryptoKey): Promise<string> {
    const combined = new Uint8Array(base64UrlToArrayBuffer(encryptedData))

    // Extract IV (first 12 bytes) and ciphertext
    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
    )

    // Decompress data
    const decompressed = pako.inflate(new Uint8Array(decrypted), { to: 'string' })
    return decompressed
}

// Base64url encoding (URL-safe, no padding)
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
}

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
    // Add padding if needed
    let base64 = base64url
        .replace(/-/g, '+')
        .replace(/_/g, '/')

    while (base64.length % 4) {
        base64 += '='
    }

    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
}

// Combined ID format: bundleId_keyBase64url
export function createShareId(bundleId: string, keyBase64: string): string {
    return `${bundleId}_${keyBase64}`
}

export function parseShareId(shareId: string): { bundleId: string; keyBase64: string } | null {
    const underscoreIndex = shareId.indexOf('_')
    if (underscoreIndex === -1) {
        return null // Legacy unencrypted format
    }
    return {
        bundleId: shareId.substring(0, underscoreIndex),
        keyBase64: shareId.substring(underscoreIndex + 1),
    }
}
