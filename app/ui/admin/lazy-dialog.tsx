'use client'

import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type RefObject,
} from 'react'

// Admin dialogs load their content (the form and Radix with it) on first open, so no page
// ships that code before a dialog is wanted. The trigger is a plain button in the page bundle;
// the content module, imported with React's `lazy`, renders a controlled Radix Root around its
// own Portal and Content. `lazy` rather than `next/dynamic`: the dialogs never render on the
// server, and next/dynamic's own client code (about 2 kB) would cost more than it saves.

/** What a lazily loaded dialog's content takes from its trigger. */
export type LazyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Radix returns focus only to its own Trigger, which a lazy dialog does not have: this
   * returns it to the trigger button, unless the dialog moves it elsewhere.
   */
  onCloseAutoFocus: (event: Event) => void
}

/**
 * `lazy`, with one retry: a failed chunk load (a dropped connection) is tried again once
 * before the error boundary shows, since `lazy` keeps a rejection for good.
 */
export function lazyWithRetry<Props>(load: () => Promise<{ default: ComponentType<Props> }>) {
  return lazy(() => load().catch(() => load()))
}

/**
 * Between the first click and the content's code arriving: the dialog's scrim with a small
 * spinner, so the click visibly did something. Escape or a click on the scrim cancels it;
 * focus stays on the trigger meanwhile, and moves into the dialog when it opens.
 */
function DialogPending({ onCancel }: { onCancel: () => void }) {
  useEffect(() => {
    function cancelOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', cancelOnEscape)
    return () => document.removeEventListener('keydown', cancelOnEscape)
  }, [onCancel])

  return (
    <div
      aria-hidden
      onClick={onCancel}
      className="bg-scrim animate-fade-in fixed inset-0 z-30 flex cursor-wait items-center justify-center"
    >
      <span className="rounded-chip bg-surface-raised shadow-card p-3">
        <ArrowPathIcon className="text-text-muted size-6 animate-spin" />
      </span>
    </div>
  )
}

function LoadFailed() {
  const t = useTranslations('Common')
  return (
    <p role="alert" className="text-danger basis-full text-sm">
      {t('dialogLoadFailed')}
    </p>
  )
}

/** Closes the dialog and says so when its code cannot load; the next opening tries again. */
class LoadBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    return this.state.failed ? <LoadFailed /> : this.props.children
  }
}

type LazyDialog = ReturnType<typeof useLazyDialog>

/**
 * Where a lazy dialog's content renders: from its first opening on (so Radix closes it as it
 * always does), with the pending scrim while its code loads.
 */
export function LazyDialogSlot({ dialog, children }: { dialog: LazyDialog; children: ReactNode }) {
  if (!dialog.mounted) return null
  const cancel = () => dialog.setOpen(false)
  return (
    // Keyed by the opening, so a failed load is tried again the next time.
    <LoadBoundary key={dialog.attempt} onError={cancel}>
      <Suspense fallback={dialog.open ? <DialogPending onCancel={cancel} /> : null}>
        {children}
      </Suspense>
    </LoadBoundary>
  )
}

type Options = {
  /** Starts loading the content: on hover or focus, before the click needs it. */
  preload: () => void
  /** Runs each time the dialog opens, to reset what the last opening left behind. */
  onOpen?: () => void
  /** Where focus goes on close instead of the trigger; return true when it was moved. */
  moveFocusOnClose?: () => boolean
  /** The trigger button's ref, for a component that also moves focus to it itself. */
  triggerRef?: RefObject<HTMLButtonElement | null>
}

/** A lazily loaded dialog's open state, its trigger button's props and its content's props. */
export function useLazyDialog({ preload, onOpen, moveFocusOnClose, triggerRef: given }: Options) {
  const [open, setOpen] = useState(false)
  // The content mounts on first open and then stays, so Radix closes it as it always does.
  const [mounted, setMounted] = useState(false)
  // Counts openings, so a failed load gets a fresh try on the next one.
  const [attempt, setAttempt] = useState(0)
  const ownRef = useRef<HTMLButtonElement>(null)
  const triggerRef = given ?? ownRef

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setMounted(true)
      setAttempt((count) => count + 1)
      onOpen?.()
    }
  }

  const content: LazyDialogProps = {
    open,
    onOpenChange,
    onCloseAutoFocus(event) {
      event.preventDefault()
      if (moveFocusOnClose?.()) return
      triggerRef.current?.focus()
    },
  }

  return {
    open,
    mounted,
    attempt,
    setOpen: onOpenChange,
    content,
    trigger: {
      ref: triggerRef,
      type: 'button' as const,
      'aria-haspopup': 'dialog' as const,
      'aria-expanded': open,
      onClick: () => onOpenChange(true),
      onPointerEnter: preload,
      onFocus: preload,
    },
  }
}
