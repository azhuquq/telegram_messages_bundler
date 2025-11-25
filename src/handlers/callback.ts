import type { TelegramCallbackQuery } from '../types/telegram';
import type { MessageBundle } from '../types/bundle';
import { TelegramAPI } from '../telegram';

export async function handleCallbackQuery(
  api: TelegramAPI,
  callback: TelegramCallbackQuery,
  kv: KVNamespace
): Promise<void> {
  const data = callback.data;
  
  if (!data) {
    await api.answerCallbackQuery(callback.id);
    return;
  }

  // Handle different callback types
  if (data.startsWith('preview:')) {
    const bundleId = data.substring(8);
    const bundle = await kv.get<MessageBundle>(`bundle:${bundleId}`, 'json');
    
    if (bundle) {
      await api.answerCallbackQuery(callback.id, {
        text: `Bundle contains ${bundle.messages.length} messages`,
      });
    } else {
      await api.answerCallbackQuery(callback.id, {
        text: 'Bundle not found or expired',
        show_alert: true,
      });
    }
    return;
  }

  await api.answerCallbackQuery(callback.id);
}
