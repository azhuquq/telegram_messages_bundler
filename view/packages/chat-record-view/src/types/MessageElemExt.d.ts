// Telegram-only message element types
export type MessageElemExt = {
  type: 'text'
  text: string
} | {
  type: 'image'
  file: string | null
  url: string
} | {
  type: 'video-loop'
  url: string
} | {
  type: 'tgs'
  url: string
}
