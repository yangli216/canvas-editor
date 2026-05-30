import type {
  IQualityInspectionTask,
  QualityInspectionStrategy,
  QualityInspectionTaskSource,
  QualityInspectionTaskStatus
} from '../../domain/quality-inspection-task-domain-service'

export interface IQualityTaskCenterViewModel {
  summary: {
    taskCount: number
    pendingAssignCount: number
    checkingCount: number
    pendingReviewCount: number
    completedCount: number
    overdueCount: number
  }
  items: Array<{
    id: string
    title: string
    sourceText: string
    strategyText: string
    status: QualityInspectionTaskStatus
    statusText: string
    assigneeText: string
    documentCount: number
    overdue: boolean
    dueText: string
  }>
}

const SOURCE_TEXT: Record<QualityInspectionTaskSource, string> = {
  auto: '自动质控',
  sampling: '抽样质控',
  special: '专项质控',
  manual: '人工创建',
  archive: '归档质控'
}

const STRATEGY_TEXT: Record<QualityInspectionStrategy, string> = {
  full: '全检',
  sampling: '抽检',
  risk: '风险筛查',
  documentType: '文书类型',
  special: '专项'
}

const STATUS_TEXT: Record<QualityInspectionTaskStatus, string> = {
  pendingAssign: '待分派',
  pendingCheck: '待领取',
  checking: '质控中',
  pendingReview: '待复核',
  completed: '已完成',
  cancelled: '已取消'
}

function formatTime(timestamp?: number) {
  return timestamp ? new Date(timestamp).toLocaleString() : '未设置'
}

function isOverdue(task: IQualityInspectionTask, now: number) {
  return Boolean(
    task.dueAt &&
    task.dueAt < now &&
    task.status !== 'completed' &&
    task.status !== 'cancelled'
  )
}

export function buildQualityTaskCenterViewModel(args: {
  tasks: IQualityInspectionTask[]
  now?: number
}): IQualityTaskCenterViewModel {
  const now = args.now ?? Date.now()
  const items = args.tasks.map(task => ({
    id: task.id,
    title: task.title,
    sourceText: SOURCE_TEXT[task.source],
    strategyText: STRATEGY_TEXT[task.strategy],
    status: task.status,
    statusText: STATUS_TEXT[task.status],
    assigneeText: task.assignee || '未分派',
    documentCount: task.documentIds.length,
    overdue: isOverdue(task, now),
    dueText: formatTime(task.dueAt)
  }))

  return {
    summary: {
      taskCount: items.length,
      pendingAssignCount: items.filter(item => item.status === 'pendingAssign')
        .length,
      checkingCount: items.filter(item => item.status === 'checking').length,
      pendingReviewCount: items.filter(item => item.status === 'pendingReview')
        .length,
      completedCount: items.filter(item => item.status === 'completed').length,
      overdueCount: items.filter(item => item.overdue).length
    },
    items
  }
}