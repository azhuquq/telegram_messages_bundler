import type { TelegramInlineQuery, InlineQueryResult } from '../types/telegram';
import type { MessageBundle } from '../types/bundle';
import { TelegramAPI, escapeHtml } from '../telegram';
import { getSenderName } from './messages';

export async function handleInlineQuery(
  api: TelegramAPI,
  query: TelegramInlineQuery,
  kv: KVNamespace,
  botUsername: string
): Promise<void> {
  const bundleId = query.query.trim();
  
  if (!bundleId) {
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
    });
    return;
  }

  // Look up the bundle
  const bundle = await kv.get<MessageBundle>(`bundle:${bundleId}`, 'json');
  
  if (!bundle) {
    await api.answerInlineQuery(query.id, [{
      type: 'article',
      id: 'not_found',
      title: 'Bundle not found',
      description: `No bundle found with ID: ${bundleId}`,
      input_message_content: {
        message_text: `❌ Bundle not found: ${bundleId}`,
      },
    }], {
      cache_time: 0,
      is_personal: true,
    });
    return;
  }

  // Get unique senders
  const senders = new Set<string>();
  for (const msg of bundle.messages) {
    senders.add(getSenderName(msg));
  }
  const senderList = Array.from(senders).slice(0, 3).join(', ');
  const moreSenders = senders.size > 3 ? ` +${senders.size - 3} more` : '';

  const results: InlineQueryResult[] = [{
    type: 'article',
    id: `bundle_${bundleId}`,
    title: `📦 Send combined forward (${bundle.messages.length} messages)`,
    description: `From: ${senderList}${moreSenders}`,
    input_message_content: {
      message_text: 
        `📦 <b>Combined Forward Messages</b>\n\n` +
        `📝 ${bundle.messages.length} messages\n` +
        `👤 From: ${escapeHtml(senderList)}${moreSenders}\n` +
        `📅 ${new Date(bundle.created_at).toLocaleDateString()}\n\n` +
        `Shared by ${escapeHtml(bundle.creator_name)}`,
      parse_mode: 'HTML',
    },
    reply_markup: {
      inline_keyboard: [[
        { text: '👁 View Messages', url: `https://t.me/${botUsername}/view?startapp=${bundleId}` }
      ]]
    },
  }];

  await api.answerInlineQuery(query.id, results, {
    cache_time: 300,
    is_personal: false,
  });
}
