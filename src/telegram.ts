import type {
  TelegramUpdate,
  TelegramMessage,
  InlineKeyboardMarkup,
  InlineQueryResult,
} from './types/telegram'

export class TelegramAPI {
  private readonly baseUrl: string

  constructor(private readonly token: string) {
    this.baseUrl = `https://api.telegram.org/bot${token}`
  }

  private async request<T>(method: string, body?: object): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })

    const result = await response.json() as { ok: boolean; result: T; description?: string }
    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`)
    }
    return result.result
  }

  async setWebhook(url: string): Promise<boolean> {
    return this.request('setWebhook', { url })
  }

  async deleteWebhook(): Promise<boolean> {
    return this.request('deleteWebhook')
  }

  async getWebhookInfo(): Promise<object> {
    return this.request('getWebhookInfo')
  }

  async sendMessage(
    chat_id: number | string,
    text: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'
      reply_markup?: InlineKeyboardMarkup
      disable_web_page_preview?: boolean
    }
  ): Promise<TelegramMessage> {
    return this.request('sendMessage', {
      chat_id,
      text,
      ...options,
    })
  }

  async editMessageText(
    chat_id: number | string,
    message_id: number,
    text: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'
      reply_markup?: InlineKeyboardMarkup
    }
  ): Promise<TelegramMessage> {
    return this.request('editMessageText', {
      chat_id,
      message_id,
      text,
      ...options,
    })
  }

  async deleteMessage(chat_id: number | string, message_id: number): Promise<boolean> {
    return this.request('deleteMessage', { chat_id, message_id })
  }

  async answerCallbackQuery(
    callback_query_id: string,
    options?: {
      text?: string
      show_alert?: boolean
      url?: string
    }
  ): Promise<boolean> {
    return this.request('answerCallbackQuery', {
      callback_query_id,
      ...options,
    })
  }

  async answerInlineQuery(
    inline_query_id: string,
    results: InlineQueryResult[],
    options?: {
      cache_time?: number
      is_personal?: boolean
      next_offset?: string
      switch_pm_text?: string
      switch_pm_parameter?: string
    }
  ): Promise<boolean> {
    return this.request('answerInlineQuery', {
      inline_query_id,
      results,
      ...options,
    })
  }

  async getFile(file_id: string): Promise<{ file_id: string; file_unique_id: string; file_size?: number; file_path?: string }> {
    return this.request('getFile', { file_id })
  }

  getFileUrl(file_path: string): string {
    return `https://api.telegram.org/file/bot${this.token}/${file_path}`
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
