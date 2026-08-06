# Chat Feature Setup Checklist

## Pre-Setup Verification

- [ ] Supabase project is active and accessible
- [ ] Database credentials in `.env.local` are correct
- [ ] Current schema structure is known (interactions_domain exists or will be created)
- [ ] User has appropriate permissions in Supabase

## Database Setup

### Schema Creation

- [ ] Copy SQL from `db/migrations/001_create_interactions_schema.sql`
- [ ] Open Supabase SQL Editor
- [ ] Create new query
- [ ] Paste SQL and execute
- [ ] Verify no errors in execution

### Verification

Run these queries in Supabase SQL Editor to verify:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'interactions_domain' 
ORDER BY table_name;
-- Should return: conversations, messages

-- Check conversations structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'interactions_domain' 
AND table_name = 'conversations' 
ORDER BY ordinal_position;

-- Check messages structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'interactions_domain' 
AND table_name = 'messages' 
ORDER BY ordinal_position;

-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'interactions_domain';
-- Should show: (interactions_domain, conversations, t), (interactions_domain, messages, t)
```

- [ ] Tables created successfully
- [ ] All columns present with correct types
- [ ] RLS enabled on both tables
- [ ] Indexes created

## Code Setup

### Dependencies

- [ ] `@supabase/supabase-js` is installed (check package.json)
- [ ] `@supabase/ssr` is installed (for SSR support)
- [ ] `next` version is 16+ (turbopack compatible)
- [ ] `tailwindcss` is configured for styling

### File Structure Verification

- [ ] `lib/auth/context.tsx` exists
- [ ] `lib/chat/realtime.ts` exists
- [ ] `lib/types/chat.ts` exists
- [ ] All API routes in `app/api/chat/` exist
- [ ] All components in `components/chat/` exist
- [ ] `app/messages/page.tsx` updated
- [ ] `app/layout.tsx` has AuthProvider

### Configuration

- [ ] `.env.local` has:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Supabase Realtime is enabled in project settings
- [ ] Authentication providers configured (Google, etc.)

## Runtime Verification

### Start Development Server

```bash
npm run dev
```

- [ ] Server starts without errors
- [ ] No TypeScript compilation errors
- [ ] Console has no warnings about missing modules

### User Authentication

- [ ] Can navigate to `/auth/login`
- [ ] Can login with test account
- [ ] Auth context shows user object after login
- [ ] Can navigate to `/messages` while logged in

### Chat Functionality

- [ ] Create a test rental order/booking
- [ ] Navigate to booking detail page
- [ ] "Invia messaggio" button appears
- [ ] Click button and redirected to messages page
- [ ] Conversation created in database (check Supabase)
- [ ] Can type and send a message
- [ ] Message appears immediately in UI
- [ ] Message stored in database
- [ ] Message appears as read (✓✓ indicator)
- [ ] Can open existing conversation
- [ ] Previous messages load correctly

### Real-time Features

- [ ] Open same conversation in two browser windows
- [ ] Send message from window 1
- [ ] Message appears in window 2 immediately
- [ ] Conversation list updates in real-time
- [ ] No need to refresh page for updates

### Mobile Responsive

- [ ] View messages page on mobile
- [ ] Conversation list appears properly
- [ ] Can scroll through conversations
- [ ] Back button appears when viewing chat
- [ ] Message input works on mobile
- [ ] Messages send correctly
- [ ] Long messages wrap properly

### Error Scenarios

- [ ] Network error: Turn off internet, try to send message
  - Should show error message
  - Should allow retry
- [ ] Missing conversation: Try accessing non-existent conversation
  - Should show error or empty state
- [ ] Unauthorized access: Try to access conversation you're not part of
  - Should show error or empty state

## Data Verification

### Check Database

Run these queries to verify data is being stored:

```sql
-- Count conversations
SELECT COUNT(*) FROM interactions_domain.conversations;

-- Count messages
SELECT COUNT(*) FROM interactions_domain.messages;

-- View recent messages
SELECT id, sender_id, content, created_at 
FROM interactions_domain.messages 
ORDER BY created_at DESC 
LIMIT 10;

-- View conversations with last message time
SELECT c.id, c.rental_order_id, 
       c.participant_one, c.participant_two, 
       c.last_message_at, 
       COUNT(m.id) as message_count
FROM interactions_domain.conversations c
LEFT JOIN interactions_domain.messages m ON c.id = m.conversation_id
GROUP BY c.id
ORDER BY c.last_message_at DESC;
```

- [ ] Conversations table has entries
- [ ] Messages table has entries
- [ ] Message timestamps are correct
- [ ] Read status is tracked

## Performance Check

- [ ] Messages load quickly (< 1 second)
- [ ] Conversation list loads quickly
- [ ] No excessive database queries (check Supabase logs)
- [ ] Realtime updates are instant
- [ ] No memory leaks on browser (DevTools)

## Security Verification

### Row-Level Security

Test RLS is working:

1. Open browser 1: Login as user A
2. Open browser 2: Login as user B
3. Create conversation between them
4. In user A browser, verify:
   - Can see conversation
   - Can see messages
   - Can send messages
5. Try to access conversation of different users:
   - Open browser console
   - Try: `fetch('/api/chat/conversations?user_id=different-user-id')`
   - Should get error or empty results

- [ ] Users can only see their conversations
- [ ] Users can only see messages from conversations they're part of
- [ ] RLS policies are enforced
- [ ] API key cannot access other users' data

## Documentation Review

- [ ] Read `CHAT_FEATURE.md` for architecture
- [ ] Read `CHAT_IMPLEMENTATION.md` for overview
- [ ] Understand API endpoints
- [ ] Understand component structure
- [ ] Know where to find types

## Final Testing

### Complete User Journey

1. [ ] User A: Login
2. [ ] User A: Navigate to `/bookings`
3. [ ] User A: Click on booking with User B
4. [ ] User A: See "Invia messaggio" button
5. [ ] User A: Click button
6. [ ] User A: Redirected to `/messages` with conversation
7. [ ] User A: Send message "Ciao"
8. [ ] User B: Login in separate window
9. [ ] User B: Navigate to `/messages`
10. [ ] User B: See conversation with User A
11. [ ] User B: See message "Ciao" from User A
12. [ ] User B: Send reply "Ciao a te!"
13. [ ] User A: See reply immediately
14. [ ] Both: Close and reopen browser
15. [ ] Both: Navigate to `/messages` again
16. [ ] Both: See full message history

- [ ] Complete user journey works
- [ ] Messages persist across sessions
- [ ] Real-time updates work
- [ ] Both users see same conversation

## Deployment Checklist

- [ ] All tests passed
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Database schema backed up
- [ ] Environment variables in production
- [ ] Supabase Realtime enabled in production
- [ ] Error logging configured
- [ ] Rate limiting considered (for messages)
- [ ] Backup/recovery plan in place

## Post-Deployment

- [ ] Monitor Supabase logs for errors
- [ ] Check message delivery in production
- [ ] Monitor performance metrics
- [ ] Collect user feedback
- [ ] Plan for improvements (notifications, etc.)

---

## Support References

**Documentation**:
- Main: `CHAT_FEATURE.md`
- Implementation: `CHAT_IMPLEMENTATION.md`
- Schema: `db/migrations/001_create_interactions_schema.sql`

**Components**:
- Chat Page: `components/chat/chat-page.tsx`
- Message Thread: `components/chat/chat-thread.tsx`

**API Routes**:
- Conversations: `app/api/chat/conversations/route.ts`
- Messages: `app/api/chat/messages/route.ts`

**Types**:
- Chat Types: `lib/types/chat.ts`
- Main Types: `lib/types.ts`

---

**Estimated Setup Time**: 15-30 minutes
**Difficulty Level**: Medium
**Status**: Ready for Setup
