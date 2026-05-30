import type {
  IMedicalRecordQualityDefect,
  IMedicalRecordTemplateFeedbackSummary,
  MedicalRecordDefectStatus
} from '../../domain'

export interface IMedicalRecordDefectCenterItem {
  id: string
  documentId: string
  documentTitle: string
  templateId: string
  templateText: string
  fieldId?: string
  fieldLabel: string
  category: string
  levelText: string
  message: string
  actionHint: string
  owner: string
  status: MedicalRecordDefectStatus
  statusText: string
  latestEventText: string
  updatedAtText: string
  dueAtText: string
  overdue: boolean
  returnCountText: string
  appealText: string
  sourceText: string
  returnReason?: string
  rectificationNote?: string
  reviewOpinion?: string
}

export interface IMedicalRecordDefectCenterViewModel {
  summary: {
    totalCount: number
    openCount: number
    returnedCount: number
    rectifiedCount: number
    closedCount: number
    templateIssueCount: number
    templateFeedbackCount: number
    overdueCount: number
    secondReturnedCount: number
    appealingCount: number
  }
  items: IMedicalRecordDefectCenterItem[]
  templateFeedback: IMedicalRecordTemplateFeedbackSummary[]
}

function formatTime(timestamp?: number) {
  return timestamp ? new Date(timestamp).toLocaleString() : '暂无'
}

function getAppealText(defect: IMedicalRecordQualityDefect) {
  if (!defect.appealReason) return '暂无申诉'
  return defect.appealStatus === 'submitted'
    ? '申诉中'
    : defect.appealReason
}

function getSourceText(defect: IMedicalRecordQualityDefect) {
  const sources = [
    defect.sourceTaskId ? `任务 ${defect.sourceTaskId}` : '',
    defect.sourceResultId ? `结果 ${defect.sourceResultId}` : '',
    typeof defect.deduction === 'number' ? `扣 ${defect.deduction} 分` : ''
  ].filter(Boolean)
  return sources.join(' / ') || '病历质控'
}

function isOverdue(defect: IMedicalRecordQualityDefect, now: number) {
  if (!defect.dueAt) return false
  if (defect.status === 'closed' || defect.status === 'templateIssue') return false
  return defect.dueAt < now
}

function toItem(
  defect: IMedicalRecordQualityDefect,
  now: number
): IMedicalRecordDefectCenterItem {
  const latestEvent = defect.events.at(-1)
  const returnCount = defect.returnCount ?? 0
  return {
    id: defect.id,
    documentId: defect.documentId,
    documentTitle: defect.documentTitle,
    templateId: defect.templateId,
    templateText: defect.templateText,
    fieldId: defect.fieldId,
    fieldLabel: defect.fieldLabel || defect.fieldId || '整份病历',
    category: defect.category,
    levelText: defect.levelText,
    message: defect.message,
    actionHint: defect.actionHint,
    owner: defect.owner,
    status: defect.status,
    statusText: defect.statusText,
    latestEventText: latestEvent
      ? `${latestEvent.operator} · ${latestEvent.note || latestEvent.action}`
      : '暂无流转',
    updatedAtText: formatTime(defect.updatedAt),
    dueAtText: formatTime(defect.dueAt),
    overdue: isOverdue(defect, now),
    returnCountText: returnCount ? `退回 ${returnCount} 次` : '未退回',
    appealText: getAppealText(defect),
    sourceText: getSourceText(defect),
    returnReason: defect.returnReason,
    rectificationNote: defect.rectificationNote,
    reviewOpinion: defect.reviewOpinion
  }
}

export function buildMedicalRecordDefectCenterViewModel(args: {
  defects: IMedicalRecordQualityDefect[]
  templateFeedback?: IMedicalRecordTemplateFeedbackSummary[]
  now?: number
}): IMedicalRecordDefectCenterViewModel {
  const now = args.now ?? Date.now()
  const items = args.defects.map(defect => toItem(defect, now)).sort((a, b) => {
    const statusOrder: Record<MedicalRecordDefectStatus, number> = {
      secondReturned: 0,
      appealing: 1,
      returned: 2,
      rectified: 3,
      open: 4,
      templateIssue: 5,
      closed: 6
    }
    return statusOrder[a.status] - statusOrder[b.status]
      || a.documentTitle.localeCompare(b.documentTitle)
  })

  return {
    summary: {
      totalCount: items.length,
      openCount: items.filter(item => item.status === 'open').length,
      returnedCount: items.filter(item => item.status === 'returned').length,
      rectifiedCount: items.filter(item => item.status === 'rectified').length,
      closedCount: items.filter(item => item.status === 'closed').length,
      templateIssueCount: items.filter(item => item.status === 'templateIssue').length,
      templateFeedbackCount: args.templateFeedback?.length ?? 0,
      overdueCount: items.filter(item => item.overdue).length,
      secondReturnedCount: items.filter(item => item.status === 'secondReturned').length,
      appealingCount: items.filter(item => item.status === 'appealing').length
    },
    items,
    templateFeedback: args.templateFeedback ?? []
  }
}
