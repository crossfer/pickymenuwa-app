import imageCompression from 'browser-image-compression'
import { supabase } from './supabase'

const BUCKET = 'menu-images'
const MAX_SIZE_MB = 2
const MAX_WIDTH_PX = 800
const MAX_HEIGHT_PX = 600

/**
 * Compress an image file to WebP, max 800×600, max 2MB.
 */
export async function compressImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: MAX_SIZE_MB,
    maxWidthOrHeight: Math.max(MAX_WIDTH_PX, MAX_HEIGHT_PX),
    useWebWorker: true,
    fileType: 'image/webp' as const,
  }
  return imageCompression(file, options)
}

/**
 * Upload a menu item image to Supabase Storage.
 * Returns the public URL or throws on error.
 */
export async function uploadMenuImage(
  restaurantId: string,
  itemId: string,
  file: File
): Promise<string> {
  const compressed = await compressImage(file)
  const path = `${restaurantId}/${itemId}.webp`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, compressed, {
      upsert: true,
      contentType: 'image/webp',
    })

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Delete a menu item image from Supabase Storage.
 */
export async function deleteMenuImage(
  restaurantId: string,
  itemId: string
): Promise<void> {
  const path = `${restaurantId}/${itemId}.webp`
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}
