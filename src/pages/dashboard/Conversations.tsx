import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Loader2, Phone } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatRelativeDate, formatDateTime } from '@/lib/utils'
import { useRestaurantId } from '@/hooks/useAuth'
import { useConversations, useConversationMessages } from '@/hooks/useConversations'
import type { ConversationWithCount } from '@/hooks/useConversations'

// ─── Conversation list row ─────────────────────────────────────────────────────

interface ConversationRowProps {
  conv: ConversationWithCount
  isSelected: boolean
  onClick: () => void
}

function ConversationRow({ conv, isSelected, onClick }: ConversationRowProps) {
  const lastAt = conv.last_message_at ?? conv.started_at
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b transition-colors',
        'hover:bg-accent',
        isSelected && 'bg-accent',
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        {/* WhatsApp number — formatted with +1 prefix for readability */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium truncate">
            +{conv.whatsapp_number}
          </span>
        </div>
        <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
          {formatRelativeDate(lastAt)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Started {formatRelativeDate(conv.started_at)}
        </span>
        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
          {conv.message_count} msg{conv.message_count !== 1 ? 's' : ''}
        </Badge>
      </div>
    </button>
  )
}

// ─── Chat bubble ──────────────────────────────────────────────────────────────

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

function ChatBubble({ role, content, createdAt }: ChatBubbleProps) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex flex-col gap-0.5 max-w-[75%]', isUser ? 'self-start' : 'self-end')}>
      <div
        className={cn(
          'rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words',
          isUser
            ? 'rounded-tl-sm bg-muted text-foreground'
            : 'rounded-tr-sm bg-primary text-primary-foreground',
        )}
      >
        {content}
      </div>
      <span
        className={cn(
          'text-xs text-muted-foreground px-1',
          isUser ? 'self-start' : 'self-end',
        )}
      >
        {formatDateTime(createdAt)}
      </span>
    </div>
  )
}

// ─── Chat panel ───────────────────────────────────────────────────────────────

interface ChatPanelProps {
  conversationId: string | null
  whatsappNumber: string | null
}

function ChatPanel({ conversationId, whatsappNumber }: ChatPanelProps) {
  const { data: messages = [], isLoading } = useConversationMessages(conversationId)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom whenever messages load or change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!conversationId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground select-none">
        <MessageSquare className="h-10 w-10 opacity-30" />
        <p className="text-sm">Select a conversation to view the exchange</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center gap-2 border-b px-4 py-3 shrink-0">
        <Phone className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">+{whatsappNumber}</span>
      </div>

      {/* Message area */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No messages yet
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              createdAt={msg.created_at}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Conversations() {
  const restaurantId = useRestaurantId()

  const { data: conversations = [], isLoading } = useConversations(restaurantId)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Auto-select the first conversation when the list first loads
  useEffect(() => {
    if (conversations.length > 0 && selectedId === null) {
      setSelectedId(conversations[0].id)
    }
  }, [conversations, selectedId])

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null

  return (
    // Fill the entire main column without adding extra scrollbars
    <div className="flex flex-col h-full">
      <Header
        title="Conversations"
        description="WhatsApp exchanges between diners and your AI assistant."
      />

      {/* Split-pane body */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: conversation list ── */}
        <aside className="flex w-72 shrink-0 flex-col border-r overflow-hidden">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-30" />
              <p className="text-sm">No conversations yet.</p>
              <p className="text-xs">Exchanges from WhatsApp will appear here once diners start chatting.</p>
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto">
              {conversations.map((conv) => (
                <li key={conv.id}>
                  <ConversationRow
                    conv={conv}
                    isSelected={conv.id === selectedId}
                    onClick={() => setSelectedId(conv.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* ── Right: chat view ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <ChatPanel
            conversationId={selectedId}
            whatsappNumber={selectedConv?.whatsapp_number ?? null}
          />
        </div>
      </div>
    </div>
  )
}
