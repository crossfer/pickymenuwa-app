import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Conversation, Message } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConversationWithCount = Conversation & {
  message_count: number
}

// ─── Conversations list ───────────────────────────────────────────────────────

/**
 * Returns all conversations for the given restaurant, newest-first,
 * with a denormalised `message_count` field.
 *
 * Supabase embeds the count of related messages as:
 *   row.messages = [{ count: N }]
 * We map that into a flat `message_count: number` before returning.
 */
export function useConversations(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ['conversations', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [] as ConversationWithCount[]

      const { data, error } = await supabase
        .from('conversations')
        .select('*, messages(count)')
        .eq('restaurant_id', restaurantId)
        .order('last_message_at', { ascending: false, nullsFirst: false })

      if (error) throw error

      return (data ?? []).map((row) => {
        // supabase embeds the count as an array of { count: number }
        const countArr = row.messages as unknown as { count: number }[]
        return {
          ...row,
          messages: undefined,          // drop the embedded array
          message_count: countArr[0]?.count ?? 0,
        } as ConversationWithCount
      })
    },
    enabled: !!restaurantId,
    staleTime: 1000 * 60, // 1 minute — conversations don't change frequently
  })
}

// ─── Messages for a single conversation ──────────────────────────────────────

/**
 * Returns all messages for the given conversation in chronological order.
 * Disabled (returns []) when conversationId is null.
 */
export function useConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [] as Message[]

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as Message[]
    },
    enabled: !!conversationId,
    staleTime: 1000 * 30, // 30 s
  })
}
