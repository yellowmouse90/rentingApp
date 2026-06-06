# Chat Feature Documentation

## Overview

The chat feature enables real-time communication between users involved in a rental transaction. Each rental order creates a dedicated conversation between the renter and the owner.

## Architecture

### Database Schema

The chat feature uses the `interactions_domain` schema with two main tables:

#### `conversations`
- **Purpose**: Represents a chat thread between two users about a specific rental order
- **Key Fields**:
  - `id`: Unique identifier for the conversation
  - `rental_order_id`: Links conversation to a specific rental order
  - `participant_one`: First user (typically renter)
  - `participant_two`: Second user (typically owner)
  - `last_message_at`: Timestamp of the most recent message
  - `created_at`: When the conversation was created

**Important**: Only one conversation exists per rental order (enforced by UNIQUE constraint).

#### `messages`
- **Purpose**: Individual messages within a conversation
- **Key Fields**:
  - `id`: Unique message identifier
  - `conversation_id`: Links to parent conversation
  - `sender_id`: User who sent the message
  - `content`: Message text
  - `is_read`: Read status
  - `created_at`: When message was sent

### API Routes

#### `GET /api/chat/conversations`
- **Description**: Fetch all conversations for a user
- **Query Parameters**: `user_id` (required)
- **Response**: Array of conversations with latest message

#### `GET /api/chat/messages`
- **Description**: Fetch all messages for a specific conversation
- **Query Parameters**: `conversation_id` (required)
- **Response**: Array of messages in chronological order

#### `POST /api/chat/messages`
- **Description**: Send a new message
- **Body Parameters**:
  - `conversationId`: Target conversation
  - `content`: Message text
  - `senderId`: Sending user
- **Response**: Created message object

#### `POST /api/chat/messages/read`
- **Description**: Mark messages as read
- **Body Parameters**:
  - `conversationId`: Target conversation
  - `messageIds`: Array of message IDs to mark as read

#### `POST /api/chat/start-conversation`
- **Description**: Create or retrieve a conversation for a rental order
- **Body Parameters**:
  - `rentalOrderId`: The rental order ID
  - `participantOneId`: First participant user ID
  - `participantTwoId`: Second participant user ID
- **Response**: Conversation object (new or existing)

### Components

#### `ChatPage`
Main container component that manages:
- Conversation list display
- Chat thread selection
- Real-time message updates

Usage:
```tsx
<ChatPage initialConversationId={conversationId} />
```

#### `ConversationList`
Displays all conversations for the current user with:
- Participant name
- Last message preview
- Unread count
- Timestamp

#### `ChatThread`
Shows full message thread with:
- Message list
- Message input form
- Auto-scrolling to latest message
- Read receipts

#### `MessageInput`
Textarea-based input with:
- Auto-expand functionality
- Keyboard shortcuts (Ctrl+Enter to send)
- Loading state

#### `InitiateChat`
Button component to start/open a chat from booking details:
```tsx
<InitiateChat
  rentalOrderId={orderId}
  currentUserId={userId}
  otherUserId={otherUserId}
  otherUserName={displayName}
/>
```

## Setup Instructions

### 1. Create Database Schema

Run the migration in Supabase:

```bash
# Option 1: Use Supabase SQL editor
# Copy and paste the contents of: db/migrations/001_create_interactions_schema.sql

# Option 2: Use Supabase CLI
supabase migration new create_interactions_schema
# Then copy the SQL content to the new migration file
```

### 2. Verify Schema

In Supabase console, verify:
```sql
-- Check tables exist
SELECT * FROM information_schema.tables 
WHERE table_schema = 'interactions_domain';

-- Should show: conversations, messages
```

### 3. Test the Feature

1. Navigate to a booking detail page
2. Click "Invia messaggio" button
3. You should be redirected to `/messages` with the conversation open
4. Send a message to test

## Features

### Current Implementation
- ✅ One-to-one conversations per rental order
- ✅ Real-time message sending
- ✅ Message read status
- ✅ Automatic conversation creation
- ✅ Responsive design (mobile-friendly)
- ✅ Auto-scroll to latest message
- ✅ Keyboard shortcuts (Ctrl+Enter to send)

### Future Enhancements
- [ ] Real-time updates with WebSockets
- [ ] Message search functionality
- [ ] Message reactions/emojis
- [ ] File sharing (receipts, photos)
- [ ] Typing indicators
- [ ] Message persistence (local storage)
- [ ] Push notifications
- [ ] Message archiving
- [ ] Conversation pinning
- [ ] Admin moderation tools

## Authentication

The chat feature uses:
- **Server-side Auth**: API routes check `requireApiUser()`
- **Client-side Auth**: Components use `useAuth()` context hook
- **Row-Level Security**: Supabase RLS policies enforce user access

All user can only:
- See conversations they're part of
- Send messages to conversations they're part of
- View messages they have access to

## Error Handling

The components include error states for:
- Failed message sending
- Failed conversation fetching
- Network errors
- Missing required fields

Error messages are displayed to the user for debugging.

## Performance

### Optimization Strategies
- Polling every 2 seconds for new messages (currently)
- Database indexes on conversation and message queries
- Message pagination (future improvement)
- Lazy loading of conversations

### Suggested Improvements
- Implement WebSocket for real-time updates
- Add message pagination (load older messages on scroll)
- Cache conversations in local storage
- Implement message compression

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader friendly
- High contrast colors for readability

## Browser Compatibility

Tested on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### Messages not appearing
1. Check user is authenticated: `useAuth()` should return a user
2. Verify conversation_id is correct
3. Check API responses in browser DevTools Network tab
4. Verify Supabase credentials are correct

### Conversation not creating
1. Verify rental_order_id exists
2. Ensure both participant IDs are valid
3. Check API logs: `POST /api/chat/start-conversation`

### Styling issues
1. Ensure Tailwind CSS is properly configured
2. Check for CSS class conflicts
3. Verify dark mode settings

## File Structure

```
components/
├── chat/
│   ├── chat-page.tsx           # Main page component
│   ├── chat-thread.tsx         # Individual chat thread
│   ├── conversation-list.tsx   # List of conversations
│   ├── initiate-chat.tsx       # Button to start chat
│   ├── message-input.tsx       # Message input component
│   └── message-list.tsx        # Display messages

app/
├── api/chat/
│   ├── conversations/          # Fetch user conversations
│   ├── messages/               # Get/send messages
│   ├── messages/read/          # Mark as read
│   └── start-conversation/     # Create/get conversation

lib/
├── auth/
│   └── context.tsx             # Auth provider
├── types/
│   └── chat.ts                 # Chat-related types

db/
└── migrations/
    └── 001_create_interactions_schema.sql
```

## Configuration

### Environment Variables

No additional environment variables needed. The chat feature uses:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

(Already configured for your project)

## Support

For issues or questions:
1. Check this documentation
2. Review browser console errors
3. Check Supabase logs
4. Verify database schema is correct
