import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { uploadMenuImage, deleteMenuImage } from '@/lib/storage'
import type { MenuItem, MenuItemWithSchedules, ItemSchedule, ItemPairing } from '@/types/database'

// ─── Menu Items ───────────────────────────────────────────────────────────────

export function useMenuItems(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ['menu_items', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from('menu_items')
        .select(`
          *,
          item_schedules (*)
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as MenuItemWithSchedules[]
    },
    enabled: !!restaurantId,
  })
}

export function useMenuItem(itemId: string | undefined) {
  return useQuery({
    queryKey: ['menu_item', itemId],
    queryFn: async () => {
      if (!itemId) return null
      const { data, error } = await supabase
        .from('menu_items')
        .select(`
          *,
          item_schedules (*)
        `)
        .eq('id', itemId)
        .single()

      if (error) throw error
      return data as MenuItemWithSchedules
    },
    enabled: !!itemId,
  })
}

interface CreateMenuItemInput {
  restaurantId: string
  values: Omit<MenuItem, 'id' | 'restaurant_id' | 'created_at' | 'updated_at'>
  imageFile?: File
  schedules?: Array<Omit<ItemSchedule, 'id' | 'item_id'>>
}

export function useCreateMenuItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ restaurantId, values, imageFile, schedules = [] }: CreateMenuItemInput) => {
      // 1. Insert item to get the ID
      const { data, error } = await supabase
        .from('menu_items')
        .insert({ ...values, restaurant_id: restaurantId })
        .select()
        .single()

      if (error) throw error

      let finalData = data

      // 2. Upload image if provided
      if (imageFile && data) {
        const imageUrl = await uploadMenuImage(restaurantId, data.id, imageFile)
        const { error: updateError } = await supabase
          .from('menu_items')
          .update({ image_url: imageUrl })
          .eq('id', data.id)

        if (updateError) throw updateError
        finalData = { ...data, image_url: imageUrl }
      }

      // 3. Insert schedules if provided
      if (schedules.length > 0 && finalData) {
        const { error: schedError } = await supabase
          .from('item_schedules')
          .insert(schedules.map((s) => ({ ...s, item_id: finalData.id })))
        if (schedError) throw schedError
      }

      return finalData
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['menu_items', variables.restaurantId] })
    },
  })
}

interface UpdateMenuItemInput {
  id: string
  restaurantId: string
  values: Partial<Omit<MenuItem, 'id' | 'restaurant_id' | 'created_at'>>
  imageFile?: File
  /** IDs of existing item_schedules to delete */
  scheduleIdsToDelete?: string[]
  /** New schedule rows to insert (no id yet) */
  schedulesToAdd?: Array<Omit<ItemSchedule, 'id' | 'item_id'>>
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      restaurantId,
      values,
      imageFile,
      scheduleIdsToDelete = [],
      schedulesToAdd = [],
    }: UpdateMenuItemInput) => {
      let updatedValues = { ...values, updated_at: new Date().toISOString() }

      // Upload new image if provided
      if (imageFile) {
        const imageUrl = await uploadMenuImage(restaurantId, id, imageFile)
        updatedValues = { ...updatedValues, image_url: imageUrl }
      }

      const { data, error } = await supabase
        .from('menu_items')
        .update(updatedValues)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Delete removed schedules
      if (scheduleIdsToDelete.length > 0) {
        const { error: delError } = await supabase
          .from('item_schedules')
          .delete()
          .in('id', scheduleIdsToDelete)
        if (delError) throw delError
      }

      // Insert new schedules
      if (schedulesToAdd.length > 0) {
        const { error: insError } = await supabase
          .from('item_schedules')
          .insert(schedulesToAdd.map((s) => ({ ...s, item_id: id })))
        if (insError) throw insError
      }

      return data
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['menu_items', variables.restaurantId] })
      void queryClient.invalidateQueries({ queryKey: ['menu_item', variables.id] })
    },
  })
}

export function useToggleAvailability(restaurantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, available }: { id: string; available: boolean }) => {
      const { error } = await supabase
        .from('menu_items')
        .update({ available, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['menu_items', restaurantId] })
    },
  })
}

// ─── Item Pairings ────────────────────────────────────────────────────────────

export function useItemPairings(itemId: string | undefined) {
  return useQuery({
    queryKey: ['item_pairings', itemId],
    queryFn: async () => {
      if (!itemId) return [] as ItemPairing[]
      const { data, error } = await supabase
        .from('item_pairings')
        .select('id, item_id, paired_item_id, pairing_note')
        .eq('item_id', itemId)
      if (error) throw error
      return data as ItemPairing[]
    },
    enabled: !!itemId,
  })
}

export function useSyncPairings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      itemId,
      pairings,
    }: {
      itemId: string
      pairings: Array<{ paired_item_id: string; pairing_note: string }>
    }) => {
      const { error: delError } = await supabase
        .from('item_pairings')
        .delete()
        .eq('item_id', itemId)
      if (delError) throw delError

      if (pairings.length > 0) {
        const { error: insError } = await supabase
          .from('item_pairings')
          .insert(
            pairings.map((p) => ({
              item_id: itemId,
              paired_item_id: p.paired_item_id,
              pairing_note: p.pairing_note || null,
            }))
          )
        if (insError) throw insError
      }
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['item_pairings', variables.itemId] })
    },
  })
}

export function useDeleteMenuItem(restaurantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, hasImage }: { id: string; hasImage: boolean }) => {
      if (hasImage) {
        await deleteMenuImage(restaurantId, id)
      }
      const { error } = await supabase.from('menu_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['menu_items', restaurantId] })
    },
  })
}
