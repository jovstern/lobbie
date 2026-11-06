'use client'

import { lazy } from 'react'

/** The destructive confirmations' shared dialog, loaded on first open (`lazy-dialog`). */
export const ConfirmDialogContent = lazy(() => import('@/app/ui/admin/confirm-dialog-content'))

/** Starts loading the confirmation before the click: on its button's hover or focus. */
export function preloadConfirmDialog() {
  void import('@/app/ui/admin/confirm-dialog-content')
}
