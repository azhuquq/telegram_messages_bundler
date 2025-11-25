import type { TelegramInlineQuery, InlineQueryResult } from '../types/telegram'
import { TelegramAPI } from '../telegram'
import { parseShareId } from '../crypto'

// Encrypted bundle storage format
interface EncryptedBundle {
  encrypted: string
  meta: {
    messageCount: number
    createdAt: number
    creatorId: number
  }
}

export async function handleInlineQuery(
  api: TelegramAPI,
  query: TelegramInlineQuery,
  kv: KVNamespace,
  botUsername: string
): Promise<void> {
  const shareId = query.query.trim()

  if (!shareId) {
    // No query - show help
    await api.answerInlineQuery(query.id, [{
      type: 'article',
      id: 'help',
      title: 'Enter a Bundle ID',
      description: 'Type the bundle ID to share it',
      input_message_content: {
        message_text: 'Enter a bundle ID to share forwarded messages.',
      },
    }], {
      cache_time: 0,
      is_personal: true,
    })
    return
  }

  // Parse shareId to extract bundleId
  const parsed = parseShareId(shareId)
  const bundleId = parsed ? parsed.bundleId : shareId

  // Look up the bundle (encrypted)
  const storedData = await kv.get<EncryptedBundle>(`bundle:${bundleId}`, 'json')

  if (!storedData) {
    await api.answerInlineQuery(query.id, [{
      type: 'article',
      id: 'not_found',
      title: 'Bundle not found',
      description: `No bundle found`,
      input_message_content: {
        message_text: `❌ Bundle not found`,
      },
    }], {
      cache_time: 0,
      is_personal: true,
    })
    return
  }

  // Use only metadata (messages are encrypted)
  const { meta } = storedData

  const results: InlineQueryResult[] = [{
    type: 'article',
    id: `bundle_${bundleId}`,
    title: `Send combined forward (${meta.messageCount} messages)`,
    description: `${new Date(meta.createdAt).toLocaleDateString()}`,
    input_message_content: {
      message_text:
        `📦 <b>Combined Forward Messages</b>\n\n` +
        `📝 ${meta.messageCount} messages\n\n` +
        `📅 ${new Date(meta.createdAt).toLocaleDateString()}`,
      parse_mode: 'HTML',
    },
    reply_markup: {
      inline_keyboard: [[
        { text: 'View Messages', url: `https://t.me/${botUsername}/view?startapp=${shareId}` }
      ]]
    },
  }]

  await api.answerInlineQuery(query.id, results, {
    cache_time: 300,
    is_personal: false,
  })
}
