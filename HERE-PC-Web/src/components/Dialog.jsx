import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export function Dialog({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  closeDisabled = false,
  width = 'max-w-lg',
}) {
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return undefined
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !closeDisabled) onCloseRef.current?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [closeDisabled, open])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose?.()
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="here-dialog-title"
        tabIndex={-1}
        className={`w-full ${width} overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl outline-none`}
      >
        <header className="flex items-start gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="here-dialog-title" className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            title="关闭"
            aria-label="关闭弹窗"
            disabled={closeDisabled}
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</footer>}
      </section>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title = '确认操作',
  message,
  confirmLabel = '确认',
  cancelLabel = '取消',
  tone = 'default',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const confirmStyles = tone === 'danger'
    ? 'bg-rose-600 hover:bg-rose-700'
    : tone === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700'
      : 'bg-emerald-700 hover:bg-emerald-800'

  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      closeDisabled={busy}
      footer={(
        <>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`h-9 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50 ${confirmStyles}`}
          >
            {busy ? '处理中...' : confirmLabel}
          </button>
        </>
      )}
    >
      <p className="text-sm leading-6 text-slate-600">{message}</p>
    </Dialog>
  )
}

export function NoticeDialog({ open, title, message, onClose }) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      footer={(
        <button type="button" onClick={onClose} className="h-9 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
          知道了
        </button>
      )}
    >
      <p className="text-sm leading-6 text-slate-600">{message}</p>
    </Dialog>
  )
}
