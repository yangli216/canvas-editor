import type { ITemplateDocumentTraceOptions } from '../../../editor/template/TemplateDocumentStore'
import { MedicalRecordDomainService } from './medical-record-domain-service'

export type MedicalRecordDefectLevel = 'blocker' | 'warning' | 'info'
export type MedicalRecordDefectStatus =
  | 'open'
  | 'returned'
  | 'rectified'
  | 'closed'
  | 'templateIssue'

export type MedicalRecordDefectEventAction =
  | 'created'
  | 'returned'
  | 'rectified'
  | 'closed'
  | 'template_issue'

export interface IMedicalRecordDefectSourceIssue {
  id: string
  level: MedicalRecordDefectLevel
  category: string
  message: string
  actionHint: string
  fieldId?: string
  fieldLabel?: string
}

export interface IMedicalRecordDefectSourceItem {
  id: string
  templateId: string
  templateText: string
  title: string
  ownerText: string
  issues: IMedicalRecordDefectSourceIssue[]
}

export interface IMedicalRecordDefectEvent {
  action: MedicalRecordDefectEventAction
  operator: string
  timestamp: number
  note?: string
}

export interface IMedicalRecordQualityDefect {
  id: string
  sourceIssueId: string
  documentId: string
  documentTitle: string
  templateId: string
  templateVersion: string
  templateText: string
  fieldId?: string
  fieldLabel?: string
  category: string
  level: MedicalRecordDefectLevel
  levelText: string
  message: string
  actionHint: string
  owner: string
  status: MedicalRecordDefectStatus
  statusText: string
  createdAt: number
  updatedAt: number
  returnedAt?: number
  rectifiedAt?: number
  closedAt?: number
  templateIssueAt?: number
  returnReason?: string
  rectificationNote?: string
  reviewOpinion?: string
  templateIssueSuggestion?: string
  events: IMedicalRecordDefectEvent[]
}

export interface IMedicalRecordTemplateFeedbackSummary {
  id: string
  templateId: string
  templateText: string
  category: string
  count: number
  blockerCount: number
  fieldLabels: string[]
  messages: string[]
  suggestion: string
}

const STATUS_TEXT: Record<MedicalRecordDefectStatus, string> = {
  open: '待分派',
  returned: '已退回医生',
  rectified: '医生已整改',
  closed: '复核已关闭',
  templateIssue: '已转模板问题'
}

const LEVEL_TEXT: Record<MedicalRecordDefectLevel, string> = {
  blocker: '阻断',
  warning: '警告',
  info: '提示'
}

function createDefectId(documentId: string, issueId: string) {
  return `defect:${documentId}:${issueId}`
}

function cloneDefect(defect: IMedicalRecordQualityDefect) {
  return JSON.parse(JSON.stringify(defect)) as IMedicalRecordQualityDefect
}

function getTemplateVersion(templateText: string) {
  const matched = templateText.match(/v(.+)$/)
  return matched?.[1] ?? 'unknown'
}

function getEventAction(status: MedicalRecordDefectStatus): MedicalRecordDefectEventAction {
  if (status === 'templateIssue') return 'template_issue'
  if (status === 'open') return 'created'
  return status
}

export class MedicalRecordDefectDomainService {
  private defects = new Map<string, IMedicalRecordQualityDefect>()

  constructor(
    private readonly medicalRecordDomain: MedicalRecordDomainService
  ) {}

  syncFromQualityItems(
    items: IMedicalRecordDefectSourceItem[],
    operator = '质控系统'
  ) {
    const now = Date.now()
    items.forEach(item => {
      item.issues
        .filter(issue => issue.level !== 'info')
        .forEach(issue => {
          const id = createDefectId(item.id, issue.id)
          const current = this.defects.get(id)
          if (current) {
            if (current.status === 'closed' || current.status === 'templateIssue') return
            this.defects.set(id, {
              ...current,
              level: issue.level,
              levelText: LEVEL_TEXT[issue.level],
              category: issue.category,
              message: issue.message,
              actionHint: issue.actionHint,
              fieldId: issue.fieldId,
              fieldLabel: issue.fieldLabel,
              updatedAt: now
            })
            return
          }
          this.defects.set(id, {
            id,
            sourceIssueId: issue.id,
            documentId: item.id,
            documentTitle: item.title,
            templateId: item.templateId,
            templateVersion: getTemplateVersion(item.templateText),
            templateText: item.templateText,
            fieldId: issue.fieldId,
            fieldLabel: issue.fieldLabel,
            category: issue.category,
            level: issue.level,
            levelText: LEVEL_TEXT[issue.level],
            message: issue.message,
            actionHint: issue.actionHint,
            owner: item.ownerText,
            status: 'open',
            statusText: STATUS_TEXT.open,
            createdAt: now,
            updatedAt: now,
            events: [{ action: 'created', operator, timestamp: now, note: '由病历质控结果生成缺陷' }]
          })
        })
    })
    return this.list()
  }

  list() {
    return Array.from(this.defects.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(cloneDefect)
  }

  listByDocument(documentId: string) {
    return this.list().filter(defect => defect.documentId === documentId)
  }

  getOpenDefectCount(documentId: string) {
    return this.listByDocument(documentId)
      .filter(defect => defect.status !== 'closed' && defect.status !== 'templateIssue')
      .length
  }

  returnToDoctor(
    id: string,
    options: {
      operator?: string
      reason?: string
    } = {}
  ) {
    return this._transition(id, 'returned', {
      operator: options.operator ?? '质控员',
      note: options.reason ?? '质控退回医生整改',
      trace: {
        title: '质控退回',
        summary: options.reason ?? '质控缺陷退回医生整改'
      }
    })
  }

  markRectified(
    id: string,
    options: {
      operator?: string
      note?: string
    } = {}
  ) {
    return this._transition(id, 'rectified', {
      operator: options.operator ?? '医生',
      note: options.note ?? '医生已完成整改',
      trace: {
        title: '医生整改',
        summary: options.note ?? '医生完成质控缺陷整改'
      }
    })
  }

  close(
    id: string,
    options: {
      operator?: string
      opinion?: string
    } = {}
  ) {
    return this._transition(id, 'closed', {
      operator: options.operator ?? '质控员',
      note: options.opinion ?? '复核通过并关闭缺陷',
      trace: {
        title: '质控复核关闭',
        summary: options.opinion ?? '质控复核通过并关闭缺陷'
      }
    })
  }

  convertToTemplateIssue(
    id: string,
    options: {
      operator?: string
      suggestion?: string
    } = {}
  ) {
    return this._transition(id, 'templateIssue', {
      operator: options.operator ?? '模板管理员',
      note: options.suggestion ?? '高频缺陷转为模板问题单',
      trace: {
        title: '缺陷反哺模板',
        summary: options.suggestion ?? '质控缺陷已转为模板问题单'
      }
    })
  }

  getTemplateFeedbackSummary(minCount = 2): IMedicalRecordTemplateFeedbackSummary[] {
    const groups = new Map<string, IMedicalRecordQualityDefect[]>()
    this.defects.forEach(defect => {
      if (defect.status === 'closed') return
      const key = [defect.templateId, defect.category, defect.fieldId ?? 'document'].join('|')
      groups.set(key, [...(groups.get(key) ?? []), defect])
    })
    return Array.from(groups.values())
      .filter(group => group.length >= minCount)
      .map(group => {
        const first = group[0]
        const fieldLabels = Array.from(new Set(
          group.map(item => item.fieldLabel || item.fieldId).filter(Boolean) as string[]
        ))
        const messages = Array.from(new Set(group.map(item => item.message))).slice(0, 3)
        return {
          id: `${first.templateId}:${first.category}:${first.fieldId ?? 'document'}`,
          templateId: first.templateId,
          templateText: first.templateText,
          category: first.category,
          count: group.length,
          blockerCount: group.filter(item => item.level === 'blocker').length,
          fieldLabels,
          messages,
          suggestion: `建议为 ${first.templateText} 生成修订草稿，优先处理 ${first.category} 高频问题`
        }
      })
      .sort((a, b) => b.count - a.count || b.blockerCount - a.blockerCount)
  }

  private _transition(
    id: string,
    status: MedicalRecordDefectStatus,
    options: {
      operator: string
      note: string
      trace: Pick<ITemplateDocumentTraceOptions, 'title' | 'summary'>
    }
  ) {
    const current = this.defects.get(id)
    if (!current) return null
    const now = Date.now()
    const next: IMedicalRecordQualityDefect = {
      ...current,
      status,
      statusText: STATUS_TEXT[status],
      updatedAt: now,
      returnedAt: status === 'returned' ? now : current.returnedAt,
      rectifiedAt: status === 'rectified' ? now : current.rectifiedAt,
      closedAt: status === 'closed' ? now : current.closedAt,
      templateIssueAt: status === 'templateIssue' ? now : current.templateIssueAt,
      returnReason: status === 'returned' ? options.note : current.returnReason,
      rectificationNote: status === 'rectified' ? options.note : current.rectificationNote,
      reviewOpinion: status === 'closed' ? options.note : current.reviewOpinion,
      templateIssueSuggestion: status === 'templateIssue' ? options.note : current.templateIssueSuggestion,
      events: [
        ...current.events,
        {
          action: getEventAction(status),
          operator: options.operator,
          timestamp: now,
          note: options.note
        }
      ]
    }
    this.defects.set(id, next)
    this.medicalRecordDomain.store.appendTrace(current.documentId, {
      action: 'manual',
      source: 'api',
      operator: options.operator,
      title: options.trace.title,
      summary: options.trace.summary,
      metadata: {
        defectId: id,
        defectStatus: status,
        category: current.category,
        fieldId: current.fieldId,
        templateId: current.templateId,
        templateVersion: current.templateVersion
      }
    })
    return cloneDefect(next)
  }
}
