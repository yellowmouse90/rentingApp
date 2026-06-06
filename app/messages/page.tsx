import { requirePageUser } from "@/lib/auth/page"
import { ChatPage } from "@/components/chat/chat-page"

interface MessagesPageProps {
  searchParams: Promise<{
    conversation?: string
  }>
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  await requirePageUser("/messages")
  const params = await searchParams

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="mx-auto h-full max-w-6xl px-4 sm:px-6">
        <ChatPage initialConversationId={params.conversation} />
      </div>
    </div>
  )
}

