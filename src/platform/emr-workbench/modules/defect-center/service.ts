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
  }
  items: IMedicalRecordDefectCenterItem[]
  templateFeedback: IMedicalRecordTemplateFeedbackSummary[]
}

function formatTime(timestamp?: number) {
  return timestamp ? new Date(timestamp).toLocaleString() : '暂无'
}

function toItem(defect: IMedicalRecordQualityDefect): IMedicalRecordDefectCenterItem {
  const latestEvent = defect.events.at(-1)
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
    returnReason: defect.returnReason,
    rectificationNote: defect.rectificationNote,
    reviewOpinion: defect.reviewOpinion
  }
}

export function buildMedicalRecordDefectCenterViewModel(args: {
  defects: IMedicalRecordQualityDefect[]
  templateFeedback?: IMedicalRecordTemplateFeedbackSummary[]
}): IMedicalRecordDefectCenterViewModel {
  const items = args.defects.map(toItem).sort((a, b) => {
    const statusOrder: Record<MedicalRecordDefectStatus, number> = {
      returned: 0,
      rectified: 1,
      open: 2,
      templateIssue: 3,
      closed: 4
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
      templateFeedbackCount: args.templateFeedback?.length ?? 0
    },
    items,
    templateFeedback: args.templateFeedback ?? []
  }
}
