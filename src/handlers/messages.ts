import type { TelegramMessage } from '../types/telegram'
import type { StoredMessage, UserSession } from '../types/bundle'

export function extractStoredMessage(msg: TelegramMessage): StoredMessage {
  const stored: StoredMessage = {
    message_id: msg.message_id,
    date: msg.date,
  }

  // Forward info
  if (msg.forward_date) stored.forward_date = msg.forward_date
  if (msg.forward_from) {
    stored.forward_from = {
      id: msg.forward_from.id,
      first_name: msg.forward_from.first_name,
      last_name: msg.forward_from.last_name,
      username: msg.forward_from.username,
    }
  }
  if (msg.forward_from_chat) {
    stored.forward_from_chat = {
      id: msg.forward_from_chat.id,
      type: msg.forward_from_chat.type,
      title: msg.forward_from_chat.title,
      username: msg.forward_from_chat.username,
    }
  }
  if (msg.forward_sender_name) stored.forward_sender_name = msg.forward_sender_name

  // Sender info (for non-forwarded messages)
  if (msg.from && !msg.forward_from && !msg.forward_from_chat && !msg.forward_sender_name) {
    stored.from = {
      id: msg.from.id,
      first_name: msg.from.first_name,
      last_name: msg.from.last_name,
      username: msg.from.username,
    }
  }

  // Text content
  if (msg.text) stored.text = msg.text
  if (msg.caption) stored.caption = msg.caption
  if (msg.entities) stored.entities = msg.entities
  if (msg.caption_entities) stored.caption_entities = msg.caption_entities

  // Media
  if (msg.photo && msg.photo.length > 0) {
    // Get the largest photo
    const largestPhoto = msg.photo.reduce((prev, current) =>
      (prev.width * prev.height) > (current.width * current.height) ? prev : current
    )
    stored.photo = [{
      file_id: largestPhoto.file_id,
      width: largestPhoto.width,
      height: largestPhoto.height,
    }]
  }

  if (msg.sticker) {
    stored.sticker = {
      file_id: msg.sticker.file_id,
      emoji: msg.sticker.emoji,
      set_name: msg.sticker.set_name,
      is_animated: msg.sticker.is_animated,
      is_video: msg.sticker.is_video,
    }
  }

  if (msg.document) {
    stored.document = {
      file_id: msg.document.file_id,
      file_name: msg.document.file_name,
      mime_type: msg.document.mime_type,
    }
  }

  if (msg.video) {
    stored.video = {
      file_id: msg.video.file_id,
      file_name: msg.video.file_name,
      duration: msg.video.duration,
    }
  }

  if (msg.audio) {
    stored.audio = {
      file_id: msg.audio.file_id,
      title: msg.audio.title,
      performer: msg.audio.performer,
      duration: msg.audio.duration,
    }
  }

  if (msg.voice) {
    stored.voice = {
      file_id: msg.voice.file_id,
      duration: msg.voice.duration,
    }
  }

  if (msg.animation) {
    stored.animation = {
      file_id: msg.animation.file_id,
      file_name: msg.animation.file_name,
    }
  }

  return stored
}

export function getMessagePreviewText(msg: StoredMessage): string {
  if (msg.text) return msg.text.slice(0, 50) + (msg.text.length > 50 ? '...' : '')
  if (msg.caption) return msg.caption.slice(0, 50) + (msg.caption.length > 50 ? '...' : '')
  if (msg.photo) return '[Photo]'
  if (msg.sticker) return `[Sticker ${msg.sticker.emoji || ''}]`
  if (msg.document) return `[File: ${msg.document.file_name || 'document'}]`
  if (msg.video) return '[Video]'
  if (msg.audio) return `[Audio: ${msg.audio.title || 'audio'}]`
  if (msg.voice) return '[Voice message]'
  if (msg.animation) return '[GIF]'
  return '[Message]'
}

export function getSenderName(msg: StoredMessage): string {
  if (msg.forward_from) {
    return [msg.forward_from.first_name, msg.forward_from.last_name].filter(Boolean).join(' ')
  }
  if (msg.forward_from_chat) {
    return msg.forward_from_chat.title || 'Unknown Chat'
  }
  if (msg.forward_sender_name) {
    return msg.forward_sender_name
  }
  if (msg.from) {
    return [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ')
  }
  return 'Unknown'
}
