import { Inbox, LoaderCircle, TriangleAlert } from 'lucide-react'

export function LoadingState({ text = '正在加载数据...' }) {
  return (
    <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">
      <LoaderCircle className="mr-2 animate-spin" size={20} />
      {text}
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center text-center">
      <TriangleAlert className="mb-3 text-rose-500" size={28} />
      <p className="text-sm text-slate-600">{message || '数据加载失败'}</p>
      {onRetry && (
        <button
          type="button"
          className="mt-4 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          onClick={onRetry}
        >
          重新加载
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title = '暂无数据', description }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center text-center">
      <Inbox className="mb-3 text-slate-400" size={30} />
      <p className="font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
  )
}
