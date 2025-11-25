import type { TelegramMessage, InlineKeyboardMarkup } from '../types/telegram';
import type { UserSession, MessageBundle } from '../types/bundle';
import { TelegramAPI, escapeHtml } from '../telegram';
import { extractStoredMessage, getMessagePreviewText, getSenderName } from './messages';

function generateBundleId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function handleStartCommand(
  api: TelegramAPI,
  msg: TelegramMessage,
  kv: KVNamespace,
  botUsername: string
): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from!.id;

  // Check for deep link parameter (e.g., /start preview_<bundleId>)
  const text = msg.text || '';
  const parts = text.split(' ');
  if (parts.length > 1) {
    const param = parts[1];
    if (param.startsWith('preview_')) {
      const bundleId = param.substring(8);
      const bundle = await kv.get<MessageBundle>(`bundle:${bundleId}`, 'json');
      if (bundle) {
        await api.sendMessage(chatId, 
          `📦 <b>Bundle Preview</b>\n\n` +
          `Created by: ${escapeHtml(bundle.creator_name)}\n` +
          `Messages: ${bundle.messages.length}\n` +
          `Created: ${new Date(bundle.created_at).toLocaleString()}\n\n` +
          `Click the button below to view the full content.`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                { text: '👁 View Bundle', url: `https://t.me/${botUsername}/view?startapp=${bundleId}` }
              ]]
            }
          }
        );
        return;
      }
    }
  }

  // Initialize or reset user session
  const session: UserSession = {
    user_id: userId,
    messages: [],
    started_at: Date.now(),
  };
  await kv.put(`session:${userId}`, JSON.stringify(session), { expirationTtl: 3600 }); // 1 hour TTL

  await api.sendMessage(chatId,
    `👋 <b>Welcome to Messages Bundler!</b>\n\n` +
    `Forward messages you want to bundle, then send /done when finished.\n\n` +
    `<b>Commands:</b>\n` +
    `/start - Start a new bundle\n` +
    `/done - Finish and create bundle\n` +
    `/cancel - Cancel current bundle\n` +
    `/help - Show help`,
    { parse_mode: 'HTML' }
  );
}

export async function handleDoneCommand(
  api: TelegramAPI,
  msg: TelegramMessage,
  kv: KVNamespace,
  botUsername: string,
  baseUrl: string
): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from!.id;
  const userName = [msg.from!.first_name, msg.from?.last_name].filter(Boolean).join(' ');

  const sessionData = await kv.get(`session:${userId}`);
  if (!sessionData) {
    await api.sendMessage(chatId,
      `❌ No active session. Send /start to begin.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  const session: UserSession = JSON.parse(sessionData);
  if (session.messages.length === 0) {
    await api.sendMessage(chatId,
      `❌ No messages in bundle. Forward some messages first!`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Create bundle
  const bundleId = generateBundleId();
  const bundle: MessageBundle = {
    id: bundleId,
    creator_id: userId,
    creator_name: userName,
    created_at: Date.now(),
    messages: session.messages,
  };

  // Store bundle (30 days TTL)
  await kv.put(`bundle:${bundleId}`, JSON.stringify(bundle), { expirationTtl: 30 * 24 * 3600 });
  
  // Clear session
  await kv.delete(`session:${userId}`);

  // Create summary of senders
  const senders = new Map<string, number>();
  for (const m of bundle.messages) {
    const name = getSenderName(m);
    senders.set(name, (senders.get(name) || 0) + 1);
  }
  const senderSummary = Array.from(senders.entries())
    .map(([name, count]) => `• ${escapeHtml(name)}: ${count} message${count > 1 ? 's' : ''}`)
    .join('\n');

  const replyMarkup: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: '👁 Preview', url: `https://t.me/${botUsername}/view?startapp=${bundleId}` },
      ],
      [
        { 
          text: '📤 Send to chat', 
          switch_inline_query_chosen_chat: {
            query: bundleId,
            allow_user_chats: true,
            allow_bot_chats: true,
            allow_group_chats: true,
            allow_channel_chats: true,
          }
        }
      ]
    ]
  };

  await api.sendMessage(chatId,
    `✅ <b>Bundle created!</b>\n\n` +
    `📦 Bundle ID: <code>${bundleId}</code>\n` +
    `📝 Messages: ${bundle.messages.length}\n\n` +
    `<b>From:</b>\n${senderSummary}\n\n` +
    `Use the buttons below to preview or share.`,
    {
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    }
  );
}

export async function handleCancelCommand(
  api: TelegramAPI,
  msg: TelegramMessage,
  kv: KVNamespace
): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from!.id;

  await kv.delete(`session:${userId}`);
  await api.sendMessage(chatId,
    `🗑 Bundle cancelled. Send /start to begin a new one.`,
    { parse_mode: 'HTML' }
  );
}

export async function handleHelpCommand(
  api: TelegramAPI,
  msg: TelegramMessage,
  botUsername: string
): Promise<void> {
  const chatId = msg.chat.id;

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
  );
}

export async function handleForwardedMessage(
  api: TelegramAPI,
  msg: TelegramMessage,
  kv: KVNamespace
): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from!.id;

  const sessionData = await kv.get(`session:${userId}`);
  if (!sessionData) {
    await api.sendMessage(chatId,
      `❓ No active session. Send /start first to begin bundling messages.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  const session: UserSession = JSON.parse(sessionData);
  const storedMsg = extractStoredMessage(msg);
  session.messages.push(storedMsg);
  
  await kv.put(`session:${userId}`, JSON.stringify(session), { expirationTtl: 3600 });

  const preview = getMessagePreviewText(storedMsg);
  const sender = getSenderName(storedMsg);
  
  await api.sendMessage(chatId,
    `✅ Message ${session.messages.length} added\n` +
    `From: ${escapeHtml(sender)}\n` +
    `${escapeHtml(preview)}`,
    { parse_mode: 'HTML' }
  );
}
