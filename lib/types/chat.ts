// Extended types for chat functionality
import { Conversation, Message, Profile } from "./types"

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
