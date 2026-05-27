import type {
  ITemplateDocumentRecord,
  ITemplateDocumentTraceEvent,
  TemplateDocumentStatus
} from '../../../../editor/template/TemplateDocumentStore'
import { templateDataAdapterRegistry } from '../../../../editor/template/TemplateDataAdapter'
import { buildTemplateFieldRuntimeIndex } from '../../../../editor/template/TemplateRuntime'
import {
  validateSchema,
  type ITemplateCondition,
  type ITemplateRule
} from '../../../../editor/template/index'

export type MedicalRecordQualityStage = 'writing' | 'submit' | 'archive'
export type MedicalRecordQualityLevel = 'blocker' | 'warning' | 'info'
export type MedicalRecordQualityTimeAnchor = 'createdAt' | 'lastWrittenAt'
export type MedicalRecordQualityTimeTarget =
  | 'firstWrittenAt'
  | 'lastWrittenAt'
  | 'signedAt'
  | 'reviewedAt'
  | 'archivedAt'

export interface IMedicalRecordQualityRuleTarget {
  departments?: string[]
  documentTypes?: string[]
  templateIds?: string[]
  statuses?: TemplateDocumentStatus[]
  stages?: MedicalRecordQualityStage[]
}

export interface IMedicalRecordContentQualityRule {
  id: string
  name: string
  level?: MedicalRecordQualityLevel
  target?: IMedicalRecordQualityRuleTarget
  fieldId?: string
  businessCode?: string
  minLength?: number
  requiredKeywords?: string[]
  forbiddenKeywords?: string[]
  message?: string
  actionHint?: string
}

export interface IMedicalRecordTimelinessQualityRule {
  id: string
  name: string
  level?: MedicalRecordQualityLevel
  missingLevel?: MedicalRecordQualityLevel
  target?: IMedicalRecordQualityRuleTarget
  anchor?: MedicalRecordQualityTimeAnchor
  targetTime: MedicalRecordQualityTimeTarget
  withinHours: number
  message?: string
  missingMessage?: string
  actionHint?: string
}

export interface IMedicalRecordQualityRulePackage {
  id: string
  name: string
  target?: IMedicalRecordQualityRuleTarget
  contentRules?: IMedicalRecordContentQualityRule[]
  timelinessRules?: IMedicalRecordTimelinessQualityRule[]
}

export interface IMedicalRecordQualityIssue {
  id: string
  level: MedicalRecordQualityLevel
  levelText: string
  category: string
  message: string
  actionHint: string
  fieldId?: string
  fieldLabel?: string
  traceAction?: string
  rulePackageId?: string
  rulePackageName?: string
  ruleId?: string
  ruleName?: string
}

export interface IMedicalRecordQualityItem {
  id: string
  title: string
  templateId: string
  departmentText: string
  documentTypeText: string
  patientText: string
  templateText: string
  status: TemplateDocumentStatus
  statusText: string
  stage: MedicalRecordQualityStage
  stageText: string
  riskLevel: MedicalRecordQualityLevel
  riskText: string
  ownerText: string
  latestWrittenAt?: number
  latestWrittenText: string
  blockerCount: number
  warningCount: number
  issues: IMedicalRecordQualityIssue[]
}

export interface IMedicalRecordQualityViewModel {
  summary: {
    documentCount: number
    blockerDocumentCount: number
    warningDocumentCount: number
    pendingArchiveCount: number
    signedCount: number
    archivedCount: number
  }
  analytics: {
    hitStats: IMedicalRecordQualityRuleHitStats
    impactAssessment?: IMedicalRecordQualityRuleImpactAssessment
  }
  filterOptions: {
    departments: string[]
    documentTypes: string[]
    owners: string[]
    statuses: Array<{
      value: TemplateDocumentStatus
      label: string
    }>
  }
  items: IMedicalRecordQualityItem[]
}

export interface IMedicalRecordQualityRuleHitStat {
  key: string
  label: string
  hitCount: number
  blockerCount: number
  warningCount: number
  documentCount: number
}

export interface IMedicalRecordQualityRuleHitStats {
  byCategory: IMedicalRecordQualityRuleHitStat[]
  byTemplate: IMedicalRecordQualityRuleHitStat[]
  byDocumentType: IMedicalRecordQualityRuleHitStat[]
  byRulePackage: IMedicalRecordQualityRuleHitStat[]
}

export interface IMedicalRecordQualityRuleImpactAssessment {
  baselinePackageIds: string[]
  candidatePackageIds: string[]
  newlyHitDocumentCount: number
  resolvedDocumentCount: number
  newlyHitBlockerIssueCount: number
  newlyHitWarningIssueCount: number
  newlyHitTemplateIds: string[]
  newlyHitDocumentTypeTexts: string[]
  newlyHitDocumentIds: string[]
}

export interface IMedicalRecordQualityTraceDomain {
  getWritingSummary(id: string): {
    firstWrittenAt?: number
    lastWrittenAt?: number
    writers: string[]
    signCount: number
    reviewCount: number
  } | null
  getTraceTimeline(id: string): ITemplateDocumentTraceEvent[]
}

interface IMedicalRecordQualityContext {
  record: ITemplateDocumentRecord
  stage: MedicalRecordQualityStage
  departmentText: string
  documentTypeText: string
  timeline: ITemplateDocumentTraceEvent[]
  summary: ReturnType<IMedicalRecordQualityTraceDomain['getWritingSummary']>
  now: number
}

export const DEFAULT_MEDICAL_RECORD_QUALITY_RULE_PACKAGES: IMedicalRecordQualityRulePackage[] = [
  {
    id: 'default-medical-record-quality',
    name: '默认病历质控规则包',
    contentRules: [
      {
        id: 'content-placeholder-check',
        name: '病历内容占位符检查',
        level: 'warning',
        forbiddenKeywords: ['待补', '待完善', 'TODO', 'todo'],
        message: '病历内容仍包含占位符或待完善描述',
        actionHint: '请补齐真实病历内容后再提交或归档'
      }
    ],
    timelinessRules: [
      {
        id: 'first-writing-within-24h',
        name: '24 小时内开始书写',
        level: 'warning',
        missingLevel: 'warning',
        targetTime: 'firstWrittenAt',
        withinHours: 24,
        missingMessage: '病历创建后尚未开始书写',
        actionHint: '请提醒责任医生尽快完成首次病历书写'
      },
      {
        id: 'sign-within-72h',
        name: '72 小时内完成签名',
        level: 'blocker',
        missingLevel: 'blocker',
        target: { statuses: ['completed', 'signed', 'archived'] },
        targetTime: 'signedAt',
        withinHours: 72,
        missingMessage: '病历已提交但未在时限内完成签名',
        actionHint: '退回或提醒医生补签名'
      },
      {
        id: 'review-within-96h',
        name: '96 小时内完成上级复核',
        level: 'blocker',
        missingLevel: 'blocker',
        target: { statuses: ['signed', 'archived'] },
        targetTime: 'reviewedAt',
        withinHours: 96,
        missingMessage: '病历已签名但未在时限内完成上级复核',
        actionHint: '请上级医生完成复核后再归档'
      }
    ]
  }
]

const DOCUMENT_STATUS_LABEL: Record<TemplateDocumentStatus, string> = {
  draft: '书写中',
  completed: '已提交',
  signed: '已签名',
  archived: '已归档'
}

function formatTime(timestamp?: number) {
  return timestamp ? new Date(timestamp).toLocaleString() : '暂无书写记录'
}

function getIssueText(level: MedicalRecordQualityLevel) {
  return level === 'blocker'
    ? '阻断'
    : level === 'warning'
      ? '警告'
      : '提示'
}

function getQualityStage(
  record: ITemplateDocumentRecord
): MedicalRecordQualityStage {
  if (record.status === 'draft') return 'writing'
  if (record.status === 'archived') return 'archive'
  return 'submit'
}

function getQualityStageText(stage: MedicalRecordQualityStage) {
  return stage === 'writing'
    ? '书写中质控'
    : stage === 'submit'
      ? '提交前质控'
      : '归档前质控'
}

function hasValue(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value.length > 0
  return value != null && String(value).trim() !== ''
}

function getContentIssueLevel(
  record: ITemplateDocumentRecord
): MedicalRecordQualityLevel {
  return record.status === 'draft' || record.status === 'archived'
    ? 'warning'
    : 'blocker'
}

function getMetadataValue(
  event: ITemplateDocumentTraceEvent,
  key: string
) {
  const value = event.metadata?.[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function resolveBusinessValue(
  record: ITemplateDocumentRecord,
  businessCodes: string[]
) {
  const index = buildTemplateFieldRuntimeIndex(record.template.snapshot)
  for (const businessCode of businessCodes) {
    const nodes = index.byBusinessCode.get(businessCode) ?? []
    for (const node of nodes) {
      const value = record.content.flatValues[node.field.id]
      if (hasValue(value)) return String(value)
    }
  }
  return undefined
}

function resolveDepartmentText(
  record: ITemplateDocumentRecord,
  timeline: ITemplateDocumentTraceEvent[]
) {
  return timeline
    .map(event => getMetadataValue(event, 'department'))
    .find(Boolean)
    || resolveBusinessValue(record, [
      'visit.department',
      'encounter.department',
      'department'
    ])
    || '未分科室'
}

function resolveDocumentTypeText(record: ITemplateDocumentRecord) {
  return record.template.snapshot.name || record.template.name || '未分类文书'
}

function createValueMap(record: ITemplateDocumentRecord) {
  const index = buildTemplateFieldRuntimeIndex(record.template.snapshot)
  const values = new Map<string, string | null>()
  index.all.forEach(node => {
    const value = record.content.flatValues[node.field.id] ?? null
    values.set(node.field.id, value)
    if (node.metadata?.businessCode) {
      values.set(node.metadata.businessCode, value)
    }
  })
  return values
}

function evaluateCondition(
  condition: ITemplateCondition,
  values: Map<string, string | null>
) {
  const actual = values.get(condition.field) ?? ''
  const expected = condition.value
  switch (condition.operator) {
    case 'equals':
      return actual === expected
    case 'notEquals':
      return actual !== expected
    case 'includes':
      return Array.isArray(expected)
        ? expected.some(value => actual.includes(value))
        : actual.includes(String(expected))
    case 'notIncludes':
      return Array.isArray(expected)
        ? expected.every(value => !actual.includes(value))
        : !actual.includes(String(expected))
    default:
      return false
  }
}

function evaluateRule(
  rule: ITemplateRule,
  values: Map<string, string | null>
) {
  return rule.condition ? evaluateCondition(rule.condition, values) : true
}

function matchQualityTarget(
  target: IMedicalRecordQualityRuleTarget | undefined,
  context: IMedicalRecordQualityContext
) {
  if (!target) return true
  if (target.departments?.length
    && !target.departments.includes(context.departmentText)) {
    return false
  }
  if (target.documentTypes?.length
    && !target.documentTypes.includes(context.documentTypeText)) {
    return false
  }
  if (target.templateIds?.length
    && !target.templateIds.includes(context.record.template.id)) {
    return false
  }
  if (target.statuses?.length
    && !target.statuses.includes(context.record.status)) {
    return false
  }
  if (target.stages?.length && !target.stages.includes(context.stage)) {
    return false
  }
  return true
}

function resolveRuleFieldNodes(
  record: ITemplateDocumentRecord,
  rule: IMedicalRecordContentQualityRule
) {
  const index = buildTemplateFieldRuntimeIndex(record.template.snapshot)
  if (rule.fieldId) {
    const node = index.byId.get(rule.fieldId)
    return node ? [node] : []
  }
  if (rule.businessCode) {
    return index.byBusinessCode.get(rule.businessCode) ?? []
  }
  return index.all
}

function normalizeQualityText(value: string | null | undefined) {
  return value == null ? '' : String(value).trim()
}

function buildContentQualityIssues(
  context: IMedicalRecordQualityContext,
  packages: IMedicalRecordQualityRulePackage[]
): IMedicalRecordQualityIssue[] {
  const issues: IMedicalRecordQualityIssue[] = []
  packages
    .filter(rulePackage => matchQualityTarget(rulePackage.target, context))
    .forEach(rulePackage => {
      rulePackage.contentRules?.forEach(rule => {
        if (!matchQualityTarget(rule.target, context)) return
        const nodes = resolveRuleFieldNodes(context.record, rule)
        const text = nodes
          .map(node => context.record.content.flatValues[node.field.id])
          .map(normalizeQualityText)
          .filter(Boolean)
          .join('\n')
        const targetNode = nodes.length === 1 ? nodes[0] : undefined
        const targetLabel = targetNode?.field.label || targetNode?.field.id || '病历内容'
        const level = rule.level ?? getContentIssueLevel(context.record)

        if (rule.minLength && text.length < rule.minLength) {
          issues.push(createIssue({
            id: `${context.record.id}-content-min-${rulePackage.id}-${rule.id}`,
            level,
            category: '内容质控',
            message: rule.message
              || `${targetLabel} 内容长度不足 ${rule.minLength} 字`,
            actionHint: rule.actionHint || '请补充病历内容的关键事实和描述',
            fieldId: targetNode?.field.id,
            fieldLabel: targetNode?.field.label,
            rulePackageId: rulePackage.id,
            rulePackageName: rulePackage.name,
            ruleId: rule.id,
            ruleName: rule.name
          }))
        }

        const missingKeywords = rule.requiredKeywords
          ?.filter(keyword => !text.includes(keyword)) ?? []
        if (missingKeywords.length) {
          issues.push(createIssue({
            id: `${context.record.id}-content-required-${rulePackage.id}-${rule.id}`,
            level,
            category: '内容质控',
            message: rule.message
              || `${targetLabel} 缺少关键词：${missingKeywords.join('、')}`,
            actionHint: rule.actionHint || '请补齐病历内容质控要求的关键描述',
            fieldId: targetNode?.field.id,
            fieldLabel: targetNode?.field.label,
            rulePackageId: rulePackage.id,
            rulePackageName: rulePackage.name,
            ruleId: rule.id,
            ruleName: rule.name
          }))
        }

        const forbiddenKeywords = rule.forbiddenKeywords
          ?.filter(keyword => text.includes(keyword)) ?? []
        if (forbiddenKeywords.length) {
          issues.push(createIssue({
            id: `${context.record.id}-content-forbidden-${rulePackage.id}-${rule.id}`,
            level,
            category: '内容质控',
            message: rule.message
              || `${targetLabel} 包含禁用描述：${forbiddenKeywords.join('、')}`,
            actionHint: rule.actionHint || '请替换占位符或不规范描述',
            fieldId: targetNode?.field.id,
            fieldLabel: targetNode?.field.label,
            rulePackageId: rulePackage.id,
            rulePackageName: rulePackage.name,
            ruleId: rule.id,
            ruleName: rule.name
          }))
        }
      })
    })
  return issues
}

function getTimelineTimestamp(
  timeline: ITemplateDocumentTraceEvent[],
  actions: ITemplateDocumentTraceEvent['action'][]
) {
  const timestamps = timeline
    .filter(event => actions.includes(event.action))
    .map(event => event.timestamp)
  return timestamps.length ? Math.min(...timestamps) : undefined
}

function getStatusTimestamp(
  context: IMedicalRecordQualityContext,
  status: TemplateDocumentStatus
) {
  const timestamps = context.timeline
    .filter(event => event.action === 'status_change' && event.statusAfter === status)
    .map(event => event.timestamp)
  if (timestamps.length) return Math.min(...timestamps)
  return context.record.status === status ? context.record.updatedAt : undefined
}

function getTargetTimestamp(
  context: IMedicalRecordQualityContext,
  target: MedicalRecordQualityTimeTarget
) {
  if (target === 'firstWrittenAt') {
    return context.summary?.firstWrittenAt
      ?? getTimelineTimestamp(context.timeline, [
        'writing_start',
        'writing_update',
        'writing_save',
        'autosave',
        'save'
      ])
  }
  if (target === 'lastWrittenAt') return context.summary?.lastWrittenAt
  if (target === 'signedAt') return getTimelineTimestamp(context.timeline, ['sign'])
  if (target === 'reviewedAt') return getTimelineTimestamp(context.timeline, ['review'])
  return getStatusTimestamp(context, 'archived')
}

function getTimelinessTargetText(target: MedicalRecordQualityTimeTarget) {
  const textMap: Record<MedicalRecordQualityTimeTarget, string> = {
    firstWrittenAt: '首次书写',
    lastWrittenAt: '最近书写',
    signedAt: '医生签名',
    reviewedAt: '上级复核',
    archivedAt: '病历归档'
  }
  return textMap[target]
}

function buildTimelinessIssues(
  context: IMedicalRecordQualityContext,
  packages: IMedicalRecordQualityRulePackage[]
): IMedicalRecordQualityIssue[] {
  const issues: IMedicalRecordQualityIssue[] = []
  packages
    .filter(rulePackage => matchQualityTarget(rulePackage.target, context))
    .forEach(rulePackage => {
      rulePackage.timelinessRules?.forEach(rule => {
        if (!matchQualityTarget(rule.target, context)) return
        const anchorTime = rule.anchor === 'lastWrittenAt'
          ? context.summary?.lastWrittenAt
          : context.record.createdAt
        if (!anchorTime) return
        const deadline = anchorTime + rule.withinHours * 60 * 60 * 1000
        const targetTime = getTargetTimestamp(context, rule.targetTime)
        const targetText = getTimelinessTargetText(rule.targetTime)

        if (!targetTime) {
          if (context.now <= deadline) return
          issues.push(createIssue({
            id: `${context.record.id}-timeliness-missing-${rulePackage.id}-${rule.id}`,
            level: rule.missingLevel ?? rule.level ?? 'warning',
            category: '时限质控',
            message: rule.missingMessage
              || `${targetText} 未在 ${rule.withinHours} 小时内完成`,
            actionHint: rule.actionHint || '请按时限要求补齐病历流程动作',
            traceAction: rule.targetTime === 'signedAt'
              ? 'sign'
              : rule.targetTime === 'reviewedAt'
                ? 'review'
                : 'status_change',
            rulePackageId: rulePackage.id,
            rulePackageName: rulePackage.name,
            ruleId: rule.id,
            ruleName: rule.name
          }))
          return
        }

        if (targetTime > deadline) {
          issues.push(createIssue({
            id: `${context.record.id}-timeliness-overdue-${rulePackage.id}-${rule.id}`,
            level: rule.level ?? 'warning',
            category: '时限质控',
            message: rule.message
              || `${targetText} 超过 ${rule.withinHours} 小时时限`,
            actionHint: rule.actionHint || '请复核病历时效并记录整改说明',
            traceAction: rule.targetTime === 'signedAt'
              ? 'sign'
              : rule.targetTime === 'reviewedAt'
                ? 'review'
                : 'status_change',
            rulePackageId: rulePackage.id,
            rulePackageName: rulePackage.name,
            ruleId: rule.id,
            ruleName: rule.name
          }))
        }
      })
    })
  return issues
}

function createIssue(
  input: Omit<IMedicalRecordQualityIssue, 'levelText'>
): IMedicalRecordQualityIssue {
  return {
    ...input,
    levelText: getIssueText(input.level)
  }
}

function toIssueMap(items: IMedicalRecordQualityItem[]) {
  return new Map(items.map(item => [
    item.id,
    new Set(item.issues.map(issue => issue.id))
  ]))
}

function buildHitStatMap(
  items: IMedicalRecordQualityItem[],
  resolveKey: (item: IMedicalRecordQualityItem, issue: IMedicalRecordQualityIssue) => {
    key?: string
    label?: string
  }
) {
  const stats = new Map<string, IMedicalRecordQualityRuleHitStat & {
    _documents: Set<string>
  }>()
  items.forEach(item => {
    item.issues.forEach(issue => {
      const resolved = resolveKey(item, issue)
      if (!resolved.key || !resolved.label) return
      const current = stats.get(resolved.key) ?? {
        key: resolved.key,
        label: resolved.label,
        hitCount: 0,
        blockerCount: 0,
        warningCount: 0,
        documentCount: 0,
        _documents: new Set<string>()
      }
      current.hitCount += 1
      if (issue.level === 'blocker') current.blockerCount += 1
      if (issue.level === 'warning') current.warningCount += 1
      current._documents.add(item.id)
      current.documentCount = current._documents.size
      stats.set(resolved.key, current)
    })
  })
  return Array.from(stats.values())
    .map(item => ({
      key: item.key,
      label: item.label,
      hitCount: item.hitCount,
      blockerCount: item.blockerCount,
      warningCount: item.warningCount,
      documentCount: item.documentCount
    }))
    .sort((a, b) => b.hitCount - a.hitCount
      || b.blockerCount - a.blockerCount
      || a.label.localeCompare(b.label))
}

export function buildMedicalRecordQualityRuleHitStats(args: {
  items: IMedicalRecordQualityItem[]
}): IMedicalRecordQualityRuleHitStats {
  return {
    byCategory: buildHitStatMap(args.items, (_item, issue) => ({
      key: issue.category,
      label: issue.category
    })),
    byTemplate: buildHitStatMap(args.items, item => ({
      key: item.templateId,
      label: item.templateText
    })),
    byDocumentType: buildHitStatMap(args.items, item => ({
      key: item.documentTypeText,
      label: item.documentTypeText
    })),
    byRulePackage: buildHitStatMap(args.items, (_item, issue) => ({
      key: issue.rulePackageId,
      label: issue.rulePackageName || issue.rulePackageId
    }))
  }
}

export function assessMedicalRecordQualityRuleImpact(args: {
  baselineItems: IMedicalRecordQualityItem[]
  candidateItems: IMedicalRecordQualityItem[]
  baselinePackages: IMedicalRecordQualityRulePackage[]
  candidatePackages: IMedicalRecordQualityRulePackage[]
}): IMedicalRecordQualityRuleImpactAssessment {
  const baselineIssueMap = toIssueMap(args.baselineItems)
  const candidateIssueMap = toIssueMap(args.candidateItems)
  const candidateItemMap = new Map(args.candidateItems.map(item => [item.id, item]))

  const newlyHitDocumentIds: string[] = []
  let newlyHitBlockerIssueCount = 0
  let newlyHitWarningIssueCount = 0

  candidateIssueMap.forEach((issues, documentId) => {
    const baselineIssues = baselineIssueMap.get(documentId) ?? new Set<string>()
    const newlyHitIssueIds = Array.from(issues).filter(issueId => !baselineIssues.has(issueId))
    if (!newlyHitIssueIds.length) return
    newlyHitDocumentIds.push(documentId)
    const candidateItem = candidateItemMap.get(documentId)
    const issueMap = new Map(candidateItem?.issues.map(issue => [issue.id, issue]) ?? [])
    newlyHitIssueIds.forEach(issueId => {
      const issue = issueMap.get(issueId)
      if (!issue) return
      if (issue.level === 'blocker') newlyHitBlockerIssueCount += 1
      if (issue.level === 'warning') newlyHitWarningIssueCount += 1
    })
  })

  const resolvedDocumentIds = args.baselineItems
    .map(item => item.id)
    .filter(documentId => {
      const baselineIssues = baselineIssueMap.get(documentId) ?? new Set<string>()
      const candidateIssues = candidateIssueMap.get(documentId) ?? new Set<string>()
      return Array.from(baselineIssues).some(issueId => !candidateIssues.has(issueId))
    })

  const newlyHitItems = args.candidateItems
    .filter(item => newlyHitDocumentIds.includes(item.id))

  return {
    baselinePackageIds: args.baselinePackages.map(rulePackage => rulePackage.id),
    candidatePackageIds: args.candidatePackages.map(rulePackage => rulePackage.id),
    newlyHitDocumentCount: newlyHitDocumentIds.length,
    resolvedDocumentCount: resolvedDocumentIds.length,
    newlyHitBlockerIssueCount,
    newlyHitWarningIssueCount,
    newlyHitTemplateIds: Array.from(new Set(newlyHitItems.map(item => item.templateId))),
    newlyHitDocumentTypeTexts: Array.from(new Set(newlyHitItems.map(item => item.documentTypeText))),
    newlyHitDocumentIds
  }
}

function buildRequiredFieldIssues(
  record: ITemplateDocumentRecord
): IMedicalRecordQualityIssue[] {
  const index = buildTemplateFieldRuntimeIndex(record.template.snapshot)
  return Array.from(index.byId.values())
    .filter(item => item.field.required)
    .filter(item => {
      const value = record.content.flatValues[item.field.id]
      return !hasValue(value)
    })
    .map(item => createIssue({
      id: `${record.id}-required-${item.field.id}`,
      level: getContentIssueLevel(record),
      category: '必填字段',
      message: `${item.field.label || item.field.id} 尚未填写`,
      actionHint: '退回医生补录后再提交或归档',
      fieldId: item.field.id,
      fieldLabel: item.field.label
    }))
}

function buildRuleIssues(
  record: ITemplateDocumentRecord
): IMedicalRecordQualityIssue[] {
  const index = buildTemplateFieldRuntimeIndex(record.template.snapshot)
  const values = createValueMap(record)
  const issues = validateSchema(record.template.snapshot).map(error => createIssue({
    id: `${record.id}-schema-${error.fieldId}-${error.ruleIndex ?? 'field'}`,
    level: 'blocker' as const,
    category: '规则异常',
    message: error.message,
    actionHint: '进入模板版本中心修复规则配置后再发布',
    fieldId: error.fieldId
  }))

  index.all.forEach(node => {
    node.field.rules
      ?.filter(rule => rule.type === 'required')
      .filter(rule => evaluateRule(rule, values))
      .filter(() => !hasValue(record.content.flatValues[node.field.id]))
      .forEach((rule, ruleIndex) => {
        issues.push(createIssue({
          id: `${record.id}-rule-required-${node.field.id}-${ruleIndex}`,
          level: getContentIssueLevel(record),
          category: '规则异常',
          message: rule.message
            || `${node.field.label || node.field.id} 命中条件必填但尚未填写`,
          actionHint: '按当前病历内容补录条件必填字段',
          fieldId: node.field.id,
          fieldLabel: node.field.label
        }))
      })
  })

  return issues
}

function buildDataBindingIssues(
  record: ITemplateDocumentRecord
): IMedicalRecordQualityIssue[] {
  const index = buildTemplateFieldRuntimeIndex(record.template.snapshot)
  const level = getContentIssueLevel(record)
  const issues: IMedicalRecordQualityIssue[] = []

  index.all.forEach(node => {
    const { field, metadata } = node
    if (!metadata?.businessCode && !metadata?.exportPath) {
      issues.push(createIssue({
        id: `${record.id}-binding-code-${field.id}`,
        level,
        category: '数据绑定缺口',
        message: `${field.label || field.id} 未配置业务编码或导出路径`,
        actionHint: '进入模板字段配置补齐业务编码或导出路径',
        fieldId: field.id,
        fieldLabel: field.label
      }))
    }
    if (!metadata?.dataSource) {
      issues.push(createIssue({
        id: `${record.id}-binding-source-${field.id}`,
        level,
        category: '数据绑定缺口',
        message: `${field.label || field.id} 未绑定数据源`,
        actionHint: '进入模板字段配置补齐数据源',
        fieldId: field.id,
        fieldLabel: field.label
      }))
      return
    }
    if (!templateDataAdapterRegistry.getByDataSource(metadata.dataSource)) {
      issues.push(createIssue({
        id: `${record.id}-binding-adapter-${field.id}`,
        level,
        category: '数据绑定缺口',
        message: `数据源 ${metadata.dataSource} 暂无适配器覆盖`,
        actionHint: '补充业务数据适配器或更换字段数据源',
        fieldId: field.id,
        fieldLabel: field.label
      }))
    }
  })

  return issues
}

function buildTraceIssues(
  record: ITemplateDocumentRecord,
  domain: IMedicalRecordQualityTraceDomain
): IMedicalRecordQualityIssue[] {
  const summary = domain.getWritingSummary(record.id)
  const issues: IMedicalRecordQualityIssue[] = []

  if (!summary?.lastWrittenAt) {
    issues.push(createIssue({
      id: `${record.id}-writing-empty`,
      level: 'warning',
      category: '书写留痕',
      message: '暂无医生书写记录',
      actionHint: '请先开始书写或保存病历内容',
      traceAction: 'writing_start'
    }))
  }

  if (record.status !== 'draft' && !summary?.signCount) {
    issues.push(createIssue({
      id: `${record.id}-missing-sign`,
      level: 'blocker',
      category: '签名复核',
      message: '已提交病历缺少医生签名',
      actionHint: '退回医生完成签名',
      traceAction: 'sign'
    }))
  }

  if (
    (record.status === 'signed' || record.status === 'archived')
    && !summary?.reviewCount
  ) {
    issues.push(createIssue({
      id: `${record.id}-missing-review`,
      level: record.status === 'archived' ? 'warning' : 'blocker',
      category: '上级复核',
      message: '病历缺少上级复核记录',
      actionHint: '归档前需要完成上级复核',
      traceAction: 'review'
    }))
  }

  return issues
}

function buildArchiveIssues(
  record: ITemplateDocumentRecord,
  timeline: ITemplateDocumentTraceEvent[]
): IMedicalRecordQualityIssue[] {
  const issues: IMedicalRecordQualityIssue[] = []
  if (record.status === 'archived') return issues

  if (record.status !== 'signed') {
    issues.push(createIssue({
      id: `${record.id}-archive-status`,
      level: record.status === 'draft' ? 'warning' : 'blocker',
      category: '归档前检查',
      message: '病历尚未达到可归档状态',
      actionHint: '完成提交、签名和复核后再进入归档',
      traceAction: 'status_change'
    }))
  }

  const hasSaveEvent = timeline.some(event => (
    event.action === 'save'
    || event.action === 'writing_save'
    || event.action === 'autosave'
  ))
  if (!hasSaveEvent) {
    issues.push(createIssue({
      id: `${record.id}-archive-save`,
      level: 'warning',
      category: '归档前检查',
      message: '缺少保存或暂存记录',
      actionHint: '建议先保存病历内容再归档',
      traceAction: 'save'
    }))
  }

  return issues
}

function resolveRiskLevel(
  issues: IMedicalRecordQualityIssue[]
): MedicalRecordQualityLevel {
  if (issues.some(issue => issue.level === 'blocker')) return 'blocker'
  if (issues.some(issue => issue.level === 'warning')) return 'warning'
  return 'info'
}

function resolveRiskText(level: MedicalRecordQualityLevel) {
  return level === 'blocker'
    ? '高风险'
    : level === 'warning'
      ? '待确认'
      : '可归档'
}

function resolveOwnerText(
  record: ITemplateDocumentRecord,
  summary: ReturnType<IMedicalRecordQualityTraceDomain['getWritingSummary']>
) {
  return summary?.writers[0]
    || record.traceEvents.find(event => event.operator)?.operator
    || '待分派'
}

export function buildMedicalRecordQualityViewModel(args: {
  documents: ITemplateDocumentRecord[]
  domain: IMedicalRecordQualityTraceDomain
  rulePackages?: IMedicalRecordQualityRulePackage[]
  candidateRulePackages?: IMedicalRecordQualityRulePackage[]
  now?: number
}): IMedicalRecordQualityViewModel {
  const rulePackages = args.rulePackages ?? DEFAULT_MEDICAL_RECORD_QUALITY_RULE_PACKAGES
  const now = args.now ?? Date.now()
  const items = args.documents.map(record => {
    const summary = args.domain.getWritingSummary(record.id)
    const timeline = args.domain.getTraceTimeline(record.id)
    const stage = getQualityStage(record)
    const departmentText = resolveDepartmentText(record, timeline)
    const documentTypeText = resolveDocumentTypeText(record)
    const context: IMedicalRecordQualityContext = {
      record,
      stage,
      departmentText,
      documentTypeText,
      timeline,
      summary,
      now
    }
    const issues = [
      ...buildRequiredFieldIssues(record),
      ...buildRuleIssues(record),
      ...buildDataBindingIssues(record),
      ...buildContentQualityIssues(context, rulePackages),
      ...buildTimelinessIssues(context, rulePackages),
      ...buildTraceIssues(record, args.domain),
      ...buildArchiveIssues(record, timeline)
    ]
    const blockerCount = issues.filter(issue => issue.level === 'blocker').length
    const warningCount = issues.filter(issue => issue.level === 'warning').length
    const riskLevel = resolveRiskLevel(issues)

    return {
      id: record.id,
      title: record.title || record.id,
      templateId: record.template.id,
      departmentText,
      documentTypeText,
      patientText: [record.patientId, record.encounterId]
        .filter(Boolean)
        .join(' / ') || '未绑定患者',
      templateText: `${record.template.name} · v${record.template.version}`,
      status: record.status,
      statusText: DOCUMENT_STATUS_LABEL[record.status],
      stage,
      stageText: getQualityStageText(stage),
      riskLevel,
      riskText: resolveRiskText(riskLevel),
      ownerText: resolveOwnerText(record, summary),
      latestWrittenAt: summary?.lastWrittenAt,
      latestWrittenText: formatTime(summary?.lastWrittenAt),
      blockerCount,
      warningCount,
      issues
    }
  })

  const hitStats = buildMedicalRecordQualityRuleHitStats({ items })
  const impactAssessment = args.candidateRulePackages
    ? assessMedicalRecordQualityRuleImpact({
        baselineItems: items,
        candidateItems: buildMedicalRecordQualityViewModel({
          documents: args.documents,
          domain: args.domain,
          rulePackages: args.candidateRulePackages,
          now: args.now
        }).items,
        baselinePackages: rulePackages,
        candidatePackages: args.candidateRulePackages
      })
    : undefined

  return {
    summary: {
      documentCount: items.length,
      blockerDocumentCount: items.filter(item => item.blockerCount > 0).length,
      warningDocumentCount: items.filter(item => (
        item.blockerCount === 0 && item.warningCount > 0
      )).length,
      pendingArchiveCount: items.filter(item => item.status !== 'archived').length,
      signedCount: items.filter(item => item.status === 'signed').length,
      archivedCount: items.filter(item => item.status === 'archived').length
    },
    analytics: {
      hitStats,
      impactAssessment
    },
    filterOptions: {
      departments: Array.from(new Set(items.map(item => item.departmentText))).sort(),
      documentTypes: Array.from(new Set(items.map(item => item.documentTypeText))).sort(),
      owners: Array.from(new Set(items.map(item => item.ownerText))).sort(),
      statuses: Object.entries(DOCUMENT_STATUS_LABEL).map(([value, label]) => ({
        value: value as TemplateDocumentStatus,
        label
      }))
    },
    items: items.sort((a, b) => {
      const riskWeight = { blocker: 3, warning: 2, info: 1 }
      return riskWeight[b.riskLevel] - riskWeight[a.riskLevel]
        || (b.latestWrittenAt ?? 0) - (a.latestWrittenAt ?? 0)
    })
  }
}
