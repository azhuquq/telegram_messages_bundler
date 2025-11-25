import type { TelegramMessage } from './telegram';

export interface StoredMessage {
  message_id: number;
  date: number;
  forward_date?: number;
  forward_from?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  forward_from_chat?: {
    id: number;
    type: string;
    title?: string;
    username?: string;
  };
  forward_sender_name?: string;
  from?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  text?: string;
  caption?: string;
  entities?: TelegramMessage['entities'];
  caption_entities?: TelegramMessage['caption_entities'];
  photo?: {
    file_id: string;
    width: number;
    height: number;
  }[];
  sticker?: {
    file_id: string;
    emoji?: string;
    set_name?: string;
    is_animated: boolean;
    is_video: boolean;
  };
  document?: {
    file_id: string;
    file_name?: string;
    mime_type?: string;
  };
  video?: {
    file_id: string;
    file_name?: string;
    duration: number;
  };
  audio?: {
    file_id: string;
    title?: string;
    performer?: string;
    duration: number;
  };
  voice?: {
    file_id: string;
    duration: number;
  };
  animation?: {
    file_id: string;
    file_name?: string;
  };
}

export interface MessageBundle {
  id: string;
  creator_id: number;
  creator_name: string;
  created_at: number;
  messages: StoredMessage[];
  title?: string;
}

export interface UserSession {
  user_id: number;
  messages: StoredMessage[];
  started_at: number;
}
