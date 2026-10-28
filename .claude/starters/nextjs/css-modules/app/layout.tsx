import type { Metadata } from 'next'
import { inter } from '@/app/ui/fonts'
import './globals.css'

export const metadata: Metadata = {
  title: { template: '%s | __PROJECT_NAME__', default: '__PROJECT_NAME__' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
