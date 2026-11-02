'use client'

import { useReportWebVitals } from 'next/web-vitals'

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0]

// Defined outside the component so its reference never changes (no duplicate reports).
const logWebVital: ReportWebVitalsCallback = ({ name, value, rating }) => {
  const rounded = name === 'CLS' ? Number(value.toFixed(3)) : Math.round(value)
  console.debug(JSON.stringify({ metric: name, value: rounded, rating }))
}

/** Development only for now; production reporting arrives with Vercel Analytics in M7. */
export default function WebVitals() {
  useReportWebVitals(logWebVital)
  return null
}
