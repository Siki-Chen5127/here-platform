export const knowledgeStatusLabels = {
  draft: '草稿',
  submitted: '待审核',
  changes_requested: '需修改',
  approved: '审核通过',
  rejected: '已拒绝',
  published: '已发布',
  archived: '已下架',
}

export const knowledgeStatusStyles = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-amber-50 text-amber-700',
  changes_requested: 'bg-orange-50 text-orange-700',
  approved: 'bg-sky-50 text-sky-700',
  rejected: 'bg-rose-50 text-rose-700',
  published: 'bg-emerald-50 text-emerald-700',
  archived: 'bg-slate-200 text-slate-700',
}

export const graphStatusLabels = {
  not_started: '未建立图谱',
  queued: '图谱排队中',
  ready: '图谱已就绪',
  failed: '图谱处理失败',
}

export const editableKnowledgeStatuses = new Set(['draft', 'changes_requested'])

export const knowledgeDomainLabels = {
  psychology: '心理专业',
  student_affairs: '学生工作政策',
}
