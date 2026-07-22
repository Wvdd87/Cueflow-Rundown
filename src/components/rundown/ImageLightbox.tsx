'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ImageLightboxProps {
  src: string
  alt?: string
  onClose: () => void
}

/** Fullscreen image viewer — used to enlarge uploaded images from cell content
 *  and dropdown attachments. Works identically while the show is running, since
 *  it's just a display-mode interaction with no dependency on live state. */
export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-8"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        title="Close (Esc)"
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ''}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
      />
    </div>,
    document.body
  )
}
