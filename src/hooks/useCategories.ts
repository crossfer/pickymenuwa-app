import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Category } from '@/types/database'

export function useCategories(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ['categories', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('sort_order', { ascending: true })

      if (error) throw error
      return data as Category[]
    },
    enabled: !!restaurantId,
  })
}

export function useCreateCategory(restaurantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: { name: string; sort_order?: number }) => {
      const { data, error } = await supabase
        .from('categories')
        .insert({ ...values, restaurant_id: restaurantId })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories', restaurantId] })
    },
  })
}

export function useUpdateCategory(restaurantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Category> & { id: string }) => {
      const { data, error } = await supabase
        .from('categories')
        .update(values)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories', restaurantId] })
    },
  })
}

export function useDeleteCategory(restaurantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories', restaurantId] })
    },
  })
}

/**
 * Persist a new sort order after drag-to-reorder.
 * Receives an ordered array of category IDs and updates each row's sort_order.
 */
export function useReorderCategories(restaurantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase
            .from('categories')
            .update({ sort_order: index })
            .eq('id', id)
        )
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories', restaurantId] })
    },
  })
}
