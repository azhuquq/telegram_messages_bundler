import type DateGroup from '../types/DateGroup'
import type SenderGroup from '../types/SenderGroup'
import formatDate from './formatDate'
import type { TelegramMessage } from '../types/telegram'

export default function processHistory(history: TelegramMessage[]) {
  const data: DateGroup[] = []
  let currentDateGroup: DateGroup | undefined
  let currentSenderGroup: SenderGroup | undefined

  for (let i = 0; i < history.length; i++) {
    const current = history[i]
    const time = current.forward_date || current.date
    const msgDate = new Date(time * 1000)

    // 按日期分组
    if (!currentDateGroup || formatDate('yyyy/M/d', msgDate) !== currentDateGroup.date) {
      if (currentSenderGroup) currentDateGroup!.messages.push(currentSenderGroup)
      if (currentDateGroup) data.push(currentDateGroup)
      currentSenderGroup = undefined
      currentDateGroup = {
        date: formatDate('yyyy/M/d', msgDate),
        messages: [],
      }
    }

    // 提取发送者信息
    let senderId: number | string = 0
    let username = ''

    if (current.forward_from) {
      senderId = current.forward_from.id
      username = current.forward_from.first_name + (current.forward_from.last_name ? ' ' + current.forward_from.last_name : '')
    }
    else if (current.forward_sender_name) {
      senderId = username = current.forward_sender_name
    }
    else if (current.forward_from_chat) {
      senderId = current.forward_from_chat.id
      username = current.forward_from_chat.title || ''
    }
    else if (current.from) {
      senderId = current.from.id
      username = current.from.first_name + (current.from.last_name ? ' ' + current.from.last_name : '')
    }

    if (!currentSenderGroup || senderId !== currentSenderGroup.senderId) {
      if (currentSenderGroup) {
        currentDateGroup!.messages.push(currentSenderGroup)
      }
      // Use avatar API for numeric user IDs (not hidden users or channels)
      const avatar = typeof senderId === 'number' && senderId > 0 ? `/api/avatar/${senderId}` : ''
      currentSenderGroup = {
        id: i,
        senderId,
        username,
        messages: [],
        avatar,
      }
    }
    currentSenderGroup.messages.push(current)
  }
  // 收工啦
  if (currentSenderGroup)
    currentDateGroup!.messages.push(currentSenderGroup)
  if (currentDateGroup)
    data.push(currentDateGroup)
  return data
}
