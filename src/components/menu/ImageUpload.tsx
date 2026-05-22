import { useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ImageUploadProps {
  currentUrl?: string | null
  onFileSelect: (file: File) => void
  onRemove?: () => void
  className?: string
}

export function ImageUpload({ currentUrl, onFileSelect, onRemove, className }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    onFileSelect(file)
  }

  const handleRemove = () => {
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ''
    onRemove?.()
  }

  const displayUrl = preview ?? currentUrl

  return (
    <div className={cn('relative', className)}>
      {displayUrl ? (
        <div className="relative group">
          <img
            src={displayUrl}
            alt="Menu item"
            className="h-40 w-full rounded-lg object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              Change
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="h-8 w-8"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <ImagePlus className="h-8 w-8" />
          <span className="text-sm">Upload image</span>
          <span className="text-xs">WebP recommended · Max 2MB · 800×600</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
      />
    </div>
  )
}
