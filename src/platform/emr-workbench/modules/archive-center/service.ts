import type {
  ITemplateDocumentRecord,
  ITemplateDocumentTraceEvent,
  TemplateDocumentStatus
} from '../../../../editor/template/TemplateDocumentStore'
import {
  buildMedicalRecordQualityViewModel,
  type IMedicalRecordQualityRulePackage,
  type IMedicalRecordQualityTraceDomain
} from '../medical-record-quality-center'
import type { IMedicalRecordPostArchiveRevisionRequest } from '../../domain'

export interface IMedicalRecordArchiveRevisionSummary {
  revisionCount: number
  pendingCount: number
  approvedCount: number
  rejectedCount: number
  latestStatusText?: string
  latestReason?: string
  latestUpdatedAt?: number
}

export interface IMedicalRecordTerminalQualitySummary {
  conclusion: 'passed' | 'warning' | 'blocked'
  score: number
  grade: 'A' | 'B' | 'C' | 'D'
}

export interface IMedicalRecordArchiveRequirements {
  requireHomepage?: boolean
  requireCoding?: boolean
  requireAttachments?: boolean
}

export interface IMedicalRecordArchiveDomain extends IMedicalRecordQualityTraceDomain {
  getPostArchiveRevisions?: (documentId?: string) => IMedicalRecordPostArchiveRevisionRequest[]
  getPostArchiveRevisionSummary?: (documentId: string) => IMedicalRecordArchiveRevisionSummary
  getOpenDefectCount?: (documentId: string) => number
}

export type MedicalRecordArchiveStatus =
  | 'writing'
  | 'submitted'
  | 'pendingQuality'
  | 'qualityReturned'
  | 'pendingArchive'
  | 'archived'
  | 'postArchiveRevision'

export interface IMedicalRecordArchiveChecklistItem {
  id: string
  label: string
  passed: boolean
  level: 'blocker' | 'warning' | 'info'
  detail: string
  actionHint: string
}

export interface IMedicalRecordArchiveItem {
  id: string
  title: string
  patientText: string
  templateText: string
  status: TemplateDocumentStatus
  archiveStatus: MedicalRecordArchiveStatus
  archiveStatusText: string
  ownerText: string
  latestWrittenText: string
  archivedAtText: string
  blockerCount: number
  warningCount: number
  checklist: IMedicalRecordArchiveChecklistItem[]
  canArchive: boolean
  revisionSummary: IMedicalRecordArchiveRevisionSummary
  snapshotSummary: {
    templateVersion: string
    fieldCount: number
    structuredValueCount: number
    traceCount: number
  }
}

export interface IMedicalRecordArchiveCenterViewModel {
  summary: {
    documentCount: number
    pendingArchiveCount: number
    canArchiveCount: number
    blockedCount: number
    archivedCount: number
    postArchiveRevisionCount: number
  }
  items: IMedicalRecordArchiveItem[]
}

const STATUS_TEXT: Record<MedicalRecordArchiveStatus, string> = {
  writing: '书写中',
  submitted: '已提交',
  pendingQuality: '待质控',
  qualityReturned: '质控退回',
  pendingArchive: '待归档',
  archived: '已归档',
  postArchiveRevision: '归档后修订'
}

function formatTime(timestamp?: number) {
  return timestamp ? new Date(timestamp).toLocaleString() : '暂无'
}

function getArchivedAt(timeline: ITemplateDocumentTraceEvent[]) {
  return timeline.find(event => (
    event.action === 'status_change' && event.statusAfter === 'archived'
  ))?.timestamp
}

function hasStructuredExport(record: ITemplateDocumentRecord) {
  return Boolean(
    Object.keys(record.content.structuredValues ?? {}).length
    || Object.keys(record.content.flatValues ?? {}).length
  )
}

function hasNonEmptyValue(value: unknown) {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0
  }
  return true
}

function hasStructuredValue(record: ITemplateDocumentRecord, key: string) {
  const structuredValues = record.content.structuredValues ?? {}
  return Object.prototype.hasOwnProperty.call(structuredValues, key)
    && hasNonEmptyValue(structuredValues[key])
}

function createTerminalQualityCheck(
  terminalQuality?: IMedicalRecordTerminalQualitySummary
): IMedicalRecordArchiveChecklistItem {
  const passed = terminalQuality?.conclusion === 'passed'
    || terminalQuality?.conclusion === 'warning'
  return {
    id: 'terminal-quality',
    label: '终末质控',
    passed,
    level: 'blocker',
    detail: terminalQuality
      ? `结论 ${terminalQuality.conclusion}，${terminalQuality.score} 分，${terminalQuality.grade} 级`
      : '缺少终末质控结论',
    actionHint: '需完成终末质控且未阻断后再归档'
  }
}

function createStructuredRequirementCheck(
  record: ITemplateDocumentRecord,
  key: string,
  label: string,
  actionHint: string
): IMedicalRecordArchiveChecklistItem {
  const passed = hasStructuredValue(record, key)
  return {
    id: key,
    label,
    passed,
    level: 'blocker',
    detail: passed ? `已具备${label}` : `缺少${label}`,
    actionHint
  }
}

function buildChecklist(args: {
  record: ITemplateDocumentRecord
  timeline: ITemplateDocumentTraceEvent[]
  signCount: number
  reviewCount: number
  qualityBlockerCount: number
  qualityWarningCount: number
  openDefectCount: number
  terminalQuality?: IMedicalRecordTerminalQualitySummary
  includeTerminalQuality: boolean
  archiveRequirements?: IMedicalRecordArchiveRequirements
}): IMedicalRecordArchiveChecklistItem[] {
  const { record } = args
  const hasTemplateSnapshot = Boolean(
    record.template.id
    && record.template.version
    && record.template.snapshot
  )
  const signed = record.status === 'signed'
    || record.status === 'archived'
    || args.signCount > 0
  const reviewed = args.reviewCount > 0
  const structuredExportReady = hasStructuredExport(record)
  const qualityBlockersCleared = args.qualityBlockerCount === 0
  const defectsClosed = args.openDefectCount === 0

  const checklist: IMedicalRecordArchiveChecklistItem[] = [
    {
      id: 'quality-blockers',
      label: '质控阻断项',
      passed: qualityBlockersCleared,
      level: 'blocker',
      detail: qualityBlockersCleared
        ? '未发现归档阻断项'
        : `仍有 ${args.qualityBlockerCount} 个阻断项待处理`,
      actionHint: '先退回医生补录、补签名或修复模板字段后再归档'
    },
    {
      id: 'defect-closure',
      label: '缺陷关闭',
      passed: defectsClosed,
      level: 'blocker',
      detail: defectsClosed
        ? '质控缺陷均已关闭'
        : `仍有 ${args.openDefectCount} 个缺陷待关闭`,
      actionHint: '请在缺陷整改中心完成整改复核并关闭缺陷'
    },
    {
      id: 'signature',
      label: '医生签名',
      passed: signed,
      level: 'blocker',
      detail: signed ? '已完成医生签名' : '缺少医生签名',
      actionHint: '退回医生完成签名'
    },
    {
      id: 'review',
      label: '上级复核',
      passed: reviewed,
      level: 'blocker',
      detail: reviewed ? '已完成上级复核' : '缺少上级复核记录',
      actionHint: '请上级医生复核后再归档'
    },
    {
      id: 'template-snapshot',
      label: '模板版本快照',
      passed: hasTemplateSnapshot,
      level: 'blocker',
      detail: hasTemplateSnapshot
        ? `已绑定模板 v${record.template.version}`
        : '缺少模板版本快照',
      actionHint: '需要重新绑定模板快照后再归档'
    },
    {
      id: 'structured-export',
      label: '结构化导出',
      passed: structuredExportReady,
      level: 'warning',
      detail: structuredExportReady
        ? '已具备结构化字段值'
        : '尚未生成结构化字段值',
      actionHint: '建议先完成结构化导出预检'
    },
    {
      id: 'quality-warnings',
      label: '警告项复核',
      passed: args.qualityWarningCount === 0,
      level: 'warning',
      detail: args.qualityWarningCount
        ? `仍有 ${args.qualityWarningCount} 个警告项需人工确认`
        : '无待确认警告项',
      actionHint: '警告项不阻断归档，但建议归档前确认'
    }
  ]

  if (args.includeTerminalQuality) {
    checklist.push(createTerminalQualityCheck(args.terminalQuality))
  }

  if (args.archiveRequirements?.requireHomepage) {
    checklist.push(createStructuredRequirementCheck(
      record,
      'homepage',
      '病案首页',
      '请先生成或补全病案首页结构化数据'
    ))
  }
  if (args.archiveRequirements?.requireCoding) {
    checklist.push(createStructuredRequirementCheck(
      record,
      'coding',
      '诊疗编码',
      '请先完成诊断和手术操作编码'
    ))
  }
  if (args.archiveRequirements?.requireAttachments) {
    checklist.push(createStructuredRequirementCheck(
      record,
      'attachments',
      '归档附件',
      '请先补齐归档所需附件'
    ))
  }

  return checklist
}

function resolveArchiveStatus(
  record: ITemplateDocumentRecord,
  blockerCount: number,
  revisionSummary: IMedicalRecordArchiveRevisionSummary
): MedicalRecordArchiveStatus {
  if (record.status === 'archived' && revisionSummary.revisionCount > 0) {
    return 'postArchiveRevision'
  }
  if (record.status === 'archived') return 'archived'
  if (record.status === 'draft') return 'writing'
  if (blockerCount > 0) return 'qualityReturned'
  if (record.status === 'completed') return 'pendingQuality'
  if (record.status === 'signed') return 'pendingArchive'
  return 'submitted'
}

function canArchive(checklist: IMedicalRecordArchiveChecklistItem[]) {
  return checklist.every(item => item.level !== 'blocker' || item.passed)
}

export function buildMedicalRecordArchiveCenterViewModel(args: {
  documents: ITemplateDocumentRecord[]
  domain: IMedicalRecordArchiveDomain
  rulePackages?: IMedicalRecordQualityRulePackage[]
  terminalQualityResults?: Record<string, IMedicalRecordTerminalQualitySummary>
  archiveRequirements?: IMedicalRecordArchiveRequirements
  now?: number
}): IMedicalRecordArchiveCenterViewModel {
  const qualityModel = buildMedicalRecordQualityViewModel({
    documents: args.documents,
    domain: args.domain,
    rulePackages: args.rulePackages,
    now: args.now
  })
  const qualityMap = new Map(qualityModel.items.map(item => [item.id, item]))

  const items = args.documents.map(record => {
    const timeline = args.domain.getTraceTimeline(record.id)
    const summary = args.domain.getWritingSummary(record.id)
    const quality = qualityMap.get(record.id)
    const blockerCount = quality?.blockerCount ?? 0
    const warningCount = quality?.warningCount ?? 0
    const openDefectCount = args.domain.getOpenDefectCount?.(record.id) ?? 0
    const revisionSummary = args.domain.getPostArchiveRevisionSummary?.(record.id) ?? {
      revisionCount: 0,
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0
    }
    const checklist = buildChecklist({
      record,
      timeline,
      signCount: summary?.signCount ?? 0,
      reviewCount: summary?.reviewCount ?? 0,
      qualityBlockerCount: blockerCount,
      qualityWarningCount: warningCount,
      openDefectCount,
      terminalQuality: args.terminalQualityResults?.[record.id],
      includeTerminalQuality: Boolean(args.terminalQualityResults),
      archiveRequirements: args.archiveRequirements
    })
    const archiveStatus = resolveArchiveStatus(record, blockerCount, revisionSummary)

    return {
      id: record.id,
      title: record.title || record.id,
      patientText: [record.patientId, record.encounterId]
        .filter(Boolean)
        .join(' / ') || '未绑定患者',
      templateText: `${record.template.name} · v${record.template.version}`,
      status: record.status,
      archiveStatus,
      archiveStatusText: STATUS_TEXT[archiveStatus],
      ownerText: quality?.ownerText || summary?.writers[0] || '待分派',
      latestWrittenText: formatTime(summary?.lastWrittenAt),
      archivedAtText: formatTime(getArchivedAt(timeline)),
      blockerCount,
      warningCount,
      checklist,
      canArchive: record.status !== 'archived' && canArchive(checklist),
      revisionSummary,
      snapshotSummary: {
        templateVersion: record.template.version,
        fieldCount: Object.keys(record.content.flatValues ?? {}).length,
        structuredValueCount: Object.keys(record.content.structuredValues ?? {}).length,
        traceCount: record.traceEvents.length
      }
    }
  })

  return {
    summary: {
      documentCount: items.length,
      pendingArchiveCount: items.filter(item => item.archiveStatus === 'pendingArchive').length,
      canArchiveCount: items.filter(item => item.canArchive).length,
      blockedCount: items.filter(item => (
        item.status !== 'archived' && !item.canArchive
      )).length,
      archivedCount: items.filter(item => item.archiveStatus === 'archived').length,
      postArchiveRevisionCount: items.filter(item => (
        item.archiveStatus === 'postArchiveRevision'
      )).length
    },
    items: items.sort((a, b) => Number(b.canArchive) - Number(a.canArchive)
      || b.blockerCount - a.blockerCount
      || a.archiveStatusText.localeCompare(b.archiveStatusText))
  }
}
