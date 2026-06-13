import { createClient } from '@/lib/supabase/client'

export interface UploadedFile {
  url: string
  name: string
  type: string
}

const BUCKET = 'cell-attachments'
const MAX_BYTES = 50 * 1024 * 1024 // 50 MB

/** Upload a file to the public cell-attachments bucket and return its public URL. */
export async function uploadCellFile(
  rundownId: string,
  file: File
): Promise<UploadedFile> {
  if (file.size > MAX_BYTES) {
    throw new Error('File is too large (max 50 MB)')
  }
  const supabase = createClient()
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
  const path = `${rundownId}/${crypto.randomUUID()}${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, name: file.name, type: file.type }
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}
