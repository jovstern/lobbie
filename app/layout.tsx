import type { Metadata } from 'next'
import { rubik } from '@/app/ui/fonts'
import WebVitals from '@/app/ui/web-vitals'
import './globals.css'

export const metadata: Metadata = {
  title: { template: '%s | Lobbie', default: 'Lobbie' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={rubik.variable}>
      <body className="min-h-dvh font-sans antialiased">
        {process.env.NODE_ENV === 'development' && <WebVitals />}
        {children}
      </body>
    </html>
  )
}
