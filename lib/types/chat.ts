// Extended types for chat functionality
import { Conversation, Message, Profile } from "@/lib/types"

export const MAX_MESSAGE_LENGTH = 4000
export const MESSAGE_RATE_LIMIT_MAX = 20
export const MESSAGE_RATE_LIMIT_WINDOW_MS = 60_000

export interface ConversationWithUnread extends Conversation {
  unread_count: number
  other_participant_details?: Profile
}

export interface ChatMessage extends Message {
  sender_profile?: Profile
  read_at?: string | null
}

export interface ConversationThread {
  conversation: Conversation
  messages: ChatMessage[]
  other_user: Profile
}
