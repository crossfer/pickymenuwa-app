import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { createChat } from '@n8n/chat'
import '@n8n/chat/style.css'
import { supabase } from '@/lib/supabase'

type RestaurantRow = {
  id: string
  name: string
  slug: string
  webchat_webhook_url: string | null
}

function getOrCreateSessionId(): string {
  const key = 'webchat_session_id'
  const existing = sessionStorage.getItem(key)
  if (existing) return existing
  const id = crypto.randomUUID()
  sessionStorage.setItem(key, id)
  return id
}

const CHAT_THEME_CSS = `
  :root {
    --chat--color--primary: #C39600;
    --chat--color--secondary: #C39600;
    --chat--color-typing: #ffffff;
    --chat--header--background: #3D3D3D;
    --chat--header--color: #ffffff;
    --chat--body--background: #2f2f2f;
    --chat--message--bot--background: #2f2f2f;
    --chat--message--bot--color: #FFFFFF;
    --chat--message--user--background: #C39600;
    --chat--message--user--color: #ffffff;
    --chat--toggle--background: #C39600;
    --chat--border-radius: 16px;
    --chat--window--width: 380px;
    --chat--window--height: 620px;
  }

  /* Message text formatting */
  .chat-message,
  .chat-message-markdown {
    white-space: pre-wrap;
    line-height: 1.6;
    word-break: break-word;
    overflow-wrap: break-word;
  }

  /* Markdown paragraph spacing */
  .chat-message-markdown p {
    margin: 0 0 0.5em;
    white-space: pre-wrap;
  }
  .chat-message-markdown p:last-child {
    margin-bottom: 0;
  }

  /* List formatting */
  .chat-message-markdown ul,
  .chat-message-markdown ol {
    margin: 0.25em 0 0.5em;
    padding-left: 1.4em;
  }
  .chat-message-markdown li {
    margin-bottom: 0.2em;
    line-height: 1.5;
  }

  /* Bold / emphasis */
  .chat-message-markdown strong {
    font-weight: 600;
  }
`

export function ChatWidget() {
  const { slug } = useParams<{ slug: string }>()
  const [restaurant, setRestaurant] = useState<RestaurantRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const chatInstanceRef = useRef<ReturnType<typeof createChat> | null>(null)

  useEffect(() => {
    if (!slug) {
      setNotFound(true)
      setLoading(false)
      return
    }

    supabase
      .from('restaurants')
      .select('id, name, slug, webchat_webhook_url')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true)
        } else {
          setRestaurant(data as RestaurantRow)
        }
        setLoading(false)
      })
  }, [slug])

  useEffect(() => {
    if (!restaurant?.webchat_webhook_url) return

    const sessionId = getOrCreateSessionId()

    chatInstanceRef.current = createChat({
      webhookUrl: restaurant.webchat_webhook_url,
      mode: 'window',
      showWelcomeScreen: false,
      loadPreviousSession: false,
      sessionId,
      metadata: { session_id: sessionId },
      initialMessages: [
      `Welcome to ${restaurant.name}! 🍷`,
      '🇺🇸 Something to drink?\n🇪🇸 ¿Algo de tomar?\n🇮🇹 Qualcosa da bere?\n🇫🇷 Quelque chose à boire?\n🇩🇪 Etwas zu trinken?\n🇨🇳 来点饮料吗?'],
      i18n: {
        en: {
          title: 'Chef ',
          subtitle: '🇺🇸 EN · 🇪🇸 ES · 🇮🇹 IT · 🇫🇷 FR · 🇩🇪 DE · 🇨🇳 中文',
          footer: '',
          getStarted: 'New Conversation',
          inputPlaceholder: 'Ask me about the menu…',
          closeButtonTooltip: 'Close',
        },
      },
    })

    return () => {
      chatInstanceRef.current?.unmount()
      chatInstanceRef.current = null
    }
  }, [restaurant])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#1a1a1a' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: '#C39600', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (notFound || !restaurant) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3" style={{ background: '#1a1a1a' }}>
        <p style={{ color: '#C39600', fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 500 }}>
          Restaurant not found
        </p>
        <p style={{ color: '#888', fontSize: '14px' }}>Check the URL and try again.</p>
      </div>
    )
  }
  return (
    <>
      <style>{CHAT_THEME_CSS}</style>
      <div
        className="flex h-screen flex-col items-center justify-center"
        style={{ background: '#1a1a1a', userSelect: 'none' }}
      >
        <p style={{ color: '#C39600', fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 500, marginBottom: '16px' }}>
          Welcome to
        </p>
        <h1 style={{ color: '#ffffff', fontSize: '36px', fontWeight: 700, marginBottom: '20px', textAlign: 'center', maxWidth: '340px', lineHeight: 1.2 }}>
          {restaurant.name}
        </h1>
        <div style={{ width: '60px', height: '2px', background: '#C39600', marginBottom: '20px' }} />
        <div style={{ color: '#888', fontSize: '13px', textAlign: 'center', lineHeight: '2' }}>
          <div>🇺🇸 Tap the bubble</div>
          <div>🇪🇸 Toca la burbuja</div>
          <div>🇮🇹 Tocca la bolla</div>
          <div>🇫🇷 Appuyez sur la bulle</div>
          <div>🇩🇪 Tippe auf die Blase</div>
          <div>🇨🇳 点击气泡</div>
        </div>
      </div>
    </>
  )
}
 
