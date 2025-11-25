import type { TelegramMessage, InlineKeyboardMarkup, ReplyKeyboardMarkup, ReplyKeyboardRemove } from '../types/telegram'
import type { UserSession, MessageBundle } from '../types/bundle'
import { TelegramAPI, escapeHtml } from '../telegram'
import { extractStoredMessage, getSenderName } from './messages'
import { generateKey, exportKey, encrypt, createShareId, parseShareId } from '../crypto'

// Persistent keyboard with /done and /cancel buttons
const commandKeyboard: ReplyKeyboardMarkup = {
  keyboard: [
    [{ text: '/cancel' }, { text: '/done' }]
  ],
  resize_keyboard: true,
  is_persistent: true,
}

// Remove keyboard after bundle is created
const removeKeyboard: ReplyKeyboardRemove = {
  remove_keyboard: true,
}

function generateBundleId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function handleStartCommand(
  api: TelegramAPI,
  msg: TelegramMessage,
  kv: KVNamespace,
  botUsername: string
): Promise<void> {
  const chatId = msg.chat.id
  const userId = msg.from!.id

  // Check for deep link parameter (e.g., /start preview_<shareId>)
  // Note: With E2E encryption, deep link preview only shows metadata
  const text = msg.text || ''
  const parts = text.split(' ')
  if (parts.length > 1) {
    const param = parts[1]
    if (param.startsWith('preview_')) {
      const shareId = param.substring(8)
      // Parse shareId to get bundleId
      const parsed = parseShareId(shareId)
      const bundleId = parsed ? parsed.bundleId : shareId

      const storedData = await kv.get<{ encrypted: string; meta: { messageCount: number; createdAt: number } }>(`bundle:${bundleId}`, 'json')
      if (storedData) {
        await api.sendMessage(chatId,
          `🔐 <b>Encrypted Bundle</b>\n\n` +
          `📝 Messages: ${storedData.meta.messageCount}\n` +
          `📅 Created: ${new Date(storedData.meta.createdAt).toLocaleDateString()}\n\n` +
          `🔒 End-to-end encrypted\n` +
          `Click the button below to view the full content.`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                { text: '👁 View Bundle', url: `https://t.me/${botUsername}/view?startapp=${shareId}` }
              ]]
            }
          }
        )
        return
      }
    }
  }

  // Initialize or reset user session
  const session: UserSession = {
    user_id: userId,
    messages: [],
    started_at: Date.now(),
  }
  await kv.put(`session:${userId}`, JSON.stringify(session), { expirationTtl: 3600 }) // 1 hour TTL

  await api.sendMessage(chatId,
    `👋 <b>Welcome to Messages Bundler!</b>\n\n` +
    `Forward messages you want to bundle, then tap <b>/done</b> when finished.\n\n` +
    `<b>Commands:</b>\n` +
    `/done - Finish and create bundle\n` +
    `/cancel - Cancel current bundle\n` +
    `/help - Show help`,
    { parse_mode: 'HTML', reply_markup: commandKeyboard }
  )
}

export async function handleDoneCommand(
  api: TelegramAPI,
  msg: TelegramMessage,
  kv: KVNamespace,
  botUsername: string,
  baseUrl: string
): Promise<void> {
  const chatId = msg.chat.id
  const userId = msg.from!.id
  const userName = [msg.from!.first_name, msg.from?.last_name].filter(Boolean).join(' ')

  const sessionData = await kv.get(`session:${userId}`)
  if (!sessionData) {
    await api.sendMessage(chatId,
      `❌ No active session. Send /start to begin.`,
      { parse_mode: 'HTML' }
    )
    return
  }

  const session: UserSession = JSON.parse(sessionData)
  if (session.messages.length === 0) {
    await api.sendMessage(chatId,
      `❌ No messages in bundle. Forward some messages first!`,
      { parse_mode: 'HTML' }
    )
    return
  }

  // Create bundle with encryption
  const bundleId = generateBundleId()
  const bundle: MessageBundle = {
    id: bundleId,
    creator_id: userId,
    creator_name: userName,
    created_at: Date.now(),
    messages: session.messages,
  }

  // Generate encryption key and encrypt the bundle
  const key = await generateKey()
  const keyBase64 = await exportKey(key)
  const encryptedData = await encrypt(JSON.stringify(bundle), key)

  // Store only encrypted data and metadata (no messages in plaintext)
  const storedData = {
    encrypted: encryptedData,
    // Store only non-sensitive metadata for inline query display and management
    meta: {
      messageCount: bundle.messages.length,
      createdAt: bundle.created_at,
      creatorId: userId, // For bundle deletion/management
    }
  }
  await kv.put(`bundle:${bundleId}`, JSON.stringify(storedData))

  // Create share ID with embedded key
  const shareId = createShareId(bundleId, keyBase64)

  // Reset session for next bundle (auto-restart)
  const newSession: UserSession = {
    user_id: userId,
    messages: [],
    started_at: Date.now(),
  }
  await kv.put(`session:${userId}`, JSON.stringify(newSession), { expirationTtl: 3600 })

  // Create summary of senders
  const senders = new Map<string, number>()
  for (const m of bundle.messages) {
    const name = getSenderName(m)
    senders.set(name, (senders.get(name) || 0) + 1)
  }
  const senderSummary = Array.from(senders.entries())
    .map(([name, count]) => `• ${escapeHtml(name)}: ${count} message${count > 1 ? 's' : ''}`)
    .join('\n')

  const replyMarkup: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: 'Preview', url: `https://t.me/${botUsername}/view?startapp=${shareId}` },
      ],
      [
        {
          text: 'Send to chat',
          switch_inline_query_chosen_chat: {
            query: shareId,
            allow_user_chats: true,
            allow_bot_chats: true,
            allow_group_chats: true,
            allow_channel_chats: true,
          }
        }
      ]
    ]
  }

  await api.sendMessage(chatId,
    `✅ <b>Bundle created!</b>\n\n` +
    `📝 Messages: ${bundle.messages.length}\n\n` +
    `<b>From:</b>\n${senderSummary}\n\n` +
    `Use the buttons below to preview or share.\n\n` +
    `<i>💡 You can now forward more messages for a new bundle.</i>`,
    {
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    }
  )
}

export async function handleCancelCommand(
  api: TelegramAPI,
  msg: TelegramMessage,
  kv: KVNamespace
): Promise<void> {
  const chatId = msg.chat.id
  const userId = msg.from!.id

  // Reset session for next bundle (auto-restart)
  const newSession: UserSession = {
    user_id: userId,
    messages: [],
    started_at: Date.now(),
  }
  await kv.put(`session:${userId}`, JSON.stringify(newSession), { expirationTtl: 3600 })

  await api.sendMessage(chatId,
    `🗑 Bundle cancelled.\n\n<i>💡 You can now forward messages for a new bundle.</i>`,
    { parse_mode: 'HTML' }
  )
}

export async function handleHelpCommand(
  api: TelegramAPI,
  msg: TelegramMessage,
  botUsername: string
): Promise<void> {
  const chatId = msg.chat.id

  await api.sendMessage(chatId,
    `📖 <b>Messages Bundler Help</b>\n\n` +
    `This bot allows you to bundle multiple forwarded messages into a single shareable link.\n\n` +
    `<b>How to use:</b>\n` +
    `1. Send /start to begin\n` +
    `2. Forward messages you want to bundle\n` +
    `3. Send /done to create the bundle\n` +
    `4. Use "Preview" to view or "Send to chat" to share\n\n` +
    `<b>Inline mode:</b>\n` +
    `Type <code>@${botUsername} &lt;bundle_id&gt;</code> in any chat to share a bundle.\n\n` +
    `<b>Commands:</b>\n` +
    `/start - Start a new bundle\n` +
    `/done - Finish and create bundle\n` +
    `/cancel - Cancel current bundle\n` +
    `/help - Show this help`,
    { parse_mode: 'HTML' }
  )
}

export async function handleForwardedMessage(
  api: TelegramAPI,
  msg: TelegramMessage,
  kv: KVNamespace
): Promise<void> {
  const chatId = msg.chat.id
  const userId = msg.from!.id

  let sessionData = await kv.get(`session:${userId}`)
  let isNewSession = false

  // Auto-create session if not exists
  if (!sessionData) {
    const newSession: UserSession = {
      user_id: userId,
      messages: [],
      started_at: Date.now(),
    }
    sessionData = JSON.stringify(newSession)
    isNewSession = true
  }

  const session: UserSession = JSON.parse(sessionData)
  const storedMsg = extractStoredMessage(msg)
  session.messages.push(storedMsg)

  await kv.put(`session:${userId}`, JSON.stringify(session), { expirationTtl: 3600 })

  // Show keyboard when first message is added
  if (isNewSession) {
    await api.sendMessage(chatId,
      `Message added. Keep forwarding or tap <b>/done</b> to create bundle.`,
      { parse_mode: 'HTML', reply_markup: commandKeyboard }
    )
  }
}
