'use client'

import { useReportWebVitals } from 'next/web-vitals'

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0]

// Defined outside the component so its reference never changes (no duplicate reports).
const logWebVital: ReportWebVitalsCallback = ({ name, value, rating }) => {
  const rounded = name === 'CLS' ? Number(value.toFixed(3)) : Math.round(value)
  console.debug(JSON.stringify({ metric: name, value: rounded, rating }))
}

/** Logs each web vital to the console; loaded by `WebVitals` in development only. */
export default function WebVitalsReporter() {
  useReportWebVitals(logWebVital)
  return null
}
