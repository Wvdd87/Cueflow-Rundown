import type { Metadata } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed, JetBrains_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

// CueFlow design language — IBM Plex Sans (body), IBM Plex Sans Condensed
// (uppercase labels/buttons), JetBrains Mono (all numbers / times).
const plexSans = IBM_Plex_Sans({
  variable: '--font-plex-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
})

const plexCondensed = IBM_Plex_Sans_Condensed({
  variable: '--font-plex-cond',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Rundown Studio',
  description: 'Keep your show on time.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexCondensed.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#09090d] text-[#c8c9d0] font-sans">
        {children}
        <Toaster richColors />
      </body>
    </html>
  )
}
