import { defineComponent, ref, onMounted } from 'vue'
import './styles/global.sass'
import styles from './App.module.sass'
import { TelegramMessage, ChatRecordView } from '@tg-messages-bundler/chat-record-view'
import pako from 'pako'

// Parse shareId: bundleId_keyBase64
function parseShareId(shareId: string) {
  const idx = shareId.indexOf('_')
  if (idx === -1) return null
  return {
    bundleId: shareId.substring(0, idx),
    keyBase64: shareId.substring(idx + 1)
  }
}

// Base64url decode
function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) base64 += '='
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

// Import decryption key
async function importKey(keyBase64: string): Promise<CryptoKey> {
  const raw = base64UrlToArrayBuffer(keyBase64)
  return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
}

// Decrypt and decompress
async function decrypt(encryptedData: string, key: CryptoKey): Promise<string> {
  const combined = new Uint8Array(base64UrlToArrayBuffer(encryptedData))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return pako.inflate(new Uint8Array(decrypted), { to: 'string' })
}

export default defineComponent({
  setup() {
    const isLoading = ref(true)
    const errorMsg = ref<string | null>(null)
    const messages = ref<TelegramMessage[]>([])

    onMounted(async () => {
      try {
        // Get shareId from URL params or Telegram WebApp
        const params = new URLSearchParams(window.location.search)
        const tgWebApp = (window as any).Telegram?.WebApp
        const shareId = tgWebApp?.initDataUnsafe?.start_param || params.get('startapp') || params.get('tgWebAppStartParam')

        if (!shareId) {
          errorMsg.value = 'Invalid link'
          isLoading.value = false
          return
        }

        const parsed = parseShareId(shareId)
        if (!parsed) {
          errorMsg.value = 'Invalid link format'
          isLoading.value = false
          return
        }

        const { bundleId, keyBase64 } = parsed

        // Fetch encrypted data
        const response = await fetch(`/api/bundle/${bundleId}`)
        if (!response.ok) {
          errorMsg.value = 'Bundle does not exist or has expired'
          isLoading.value = false
          return
        }

        const storedData = await response.json()

        // Decrypt client-side
        const key = await importKey(keyBase64)
        const decrypted = await decrypt(storedData.encrypted, key)
        const bundle = JSON.parse(decrypted)

        messages.value = bundle.messages
        isLoading.value = false

        // Expand Telegram WebApp
        tgWebApp?.ready()
        tgWebApp?.expand()
      } catch (err) {
        console.error('Decryption error:', err)
        errorMsg.value = 'Decryption failed, the link may be corrupted'
        isLoading.value = false
      }
    })

    return () => {
      if (isLoading.value)
        return <div class={styles.tip}>Decrypting...</div>
      if (errorMsg.value)
        return <div class={styles.tip}>{errorMsg.value}</div>
      return <div class={styles.container}>
        <ChatRecordView messages={messages.value} />
      </div>
    }
  },
})
