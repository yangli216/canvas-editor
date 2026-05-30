import type {
  ITemplateDocumentRecord,
  TemplateDocumentStatus
} from '../../../editor/template/TemplateDocumentStore'
import {
  buildTemplateFieldRuntimeIndex,
  type ITemplateFieldRuntimeNode
} from '../../../editor/template/TemplateRuntime'
import {
  QualityScoringDomainService,
  type IQualityRuleHit,
  type IQualityScoreDetail,
  type IQualityScoreResult,
  type QualityInspectionConclusion,
  type QualityScoreGrade
} from './quality-scoring-domain-service'
import {
  QualityStandardDomainService,
  type IQualityRule,
  type IQualityRulePackage,
  type QualityRuleCheckType,
  type QualityRuleStage
} from './quality-standard-domain-service'

export interface IQualityInspectionResult {
  id: string
  taskId?: string
  documentId: string
  stage: QualityRuleStage
  rulePackageIds: string[]
  issueIds: string[]
  hits: IQualityRuleHit[]
  score: number
  grade: QualityScoreGrade
  conclusion: QualityInspectionConclusion
  details: IQualityScoreDetail[]
  inspectedBy: string
  inspectedAt: number
}

export interface IQualityDocumentInspectionArgs {
  record: ITemplateDocumentRecord
  stage: QualityRuleStage
  department?: string
  status?: TemplateDocumentStatus
  inspectedBy?: string
  taskId?: string
  now?: number
}

const EXECUTABLE_CHECK_TYPES: QualityRuleCheckType[] = [
  'field',
  'homepage',
  'coding',
  'attachment'
]

function hasValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0
  return value != null && String(value).trim() !== ''
}

function isExecutableRule(rule: IQualityRule) {
  return EXECUTABLE_CHECK_TYPES.includes(rule.checkType)
}

function resolveRuleNodes(
  nodes: Map<string, ITemplateFieldRuntimeNode>,
  businessNodes: Map<string, ITemplateFieldRuntimeNode[]>,
  rule: IQualityRule
) {
  if (rule.fieldId) {
    const node = nodes.get(rule.fieldId)
    return node ? [node] : []
  }
  if (rule.businessCode) return businessNodes.get(rule.businessCode) ?? []
  return []
}

function createRuleHit(args: {
  record: ITemplateDocumentRecord
  rulePackage: IQualityRulePackage
  rule: IQualityRule
  nodes: ITemplateFieldRuntimeNode[]
}): IQualityRuleHit | null {
  const targetNode = args.nodes[0]
  if (!targetNode) return null
  const hasAnyValue = args.nodes.some(node => (
    hasValue(args.record.content.flatValues[node.field.id])
  ))
  if (hasAnyValue) return null

  const fieldLabel = targetNode.field.label || targetNode.field.id
  return {
    id: `${args.record.id}:${args.rulePackage.id}:${args.rule.id}`,
    ruleId: args.rule.id,
    ruleName: args.rule.name,
    rulePackageId: args.rulePackage.id,
    category: args.rule.category,
    level: args.rule.level,
    message: `${args.rule.name} 未满足质控要求`,
    actionHint: args.rule.actionHint,
    deduction: args.rule.deduction,
    veto: args.rule.veto,
    fieldId: targetNode.field.id,
    fieldLabel,
    evidenceText: `${fieldLabel}：未填写`
  }
}

export class QualityExecutionDomainService {
  constructor(
    private readonly standard: QualityStandardDomainService,
    private readonly scoring: QualityScoringDomainService
  ) {}

  inspectDocument(
    args: IQualityDocumentInspectionArgs
  ): IQualityInspectionResult {
    const { record, stage } = args
    const rulePackages = this.standard.matchRulePackages({
      stage,
      department: args.department,
      documentType: record.template.snapshot.name || record.template.name,
      templateId: record.template.id,
      status: args.status || record.status
    })
    const hits = this.createHits(record, rulePackages)
    const scoringResult = this.score(record.id, hits)
    const inspectedAt = args.now ?? Date.now()

    return {
      id: `quality-inspection:${record.id}:${stage}:${inspectedAt}`,
      taskId: args.taskId,
      documentId: record.id,
      stage,
      rulePackageIds: rulePackages.map(rulePackage => rulePackage.id),
      issueIds: hits.map(hit => hit.id),
      hits,
      score: scoringResult.score,
      grade: scoringResult.grade,
      conclusion: scoringResult.conclusion,
      details: scoringResult.details,
      inspectedBy: args.inspectedBy ?? '系统质控',
      inspectedAt
    }
  }

  private createHits(
    record: ITemplateDocumentRecord,
    rulePackages: IQualityRulePackage[]
  ) {
    const index = buildTemplateFieldRuntimeIndex(record.template.snapshot)
    const hits: IQualityRuleHit[] = []

    rulePackages.forEach(rulePackage => {
      rulePackage.rules
        .filter(isExecutableRule)
        .forEach(rule => {
          const nodes = resolveRuleNodes(index.byId, index.byBusinessCode, rule)
          const hit = createRuleHit({ record, rulePackage, rule, nodes })
          if (hit) hits.push(hit)
        })
    })

    return hits
  }

  private score(documentId: string, hits: IQualityRuleHit[]) {
    const scoring = this.scoring as QualityScoringDomainService & {
      score?: (args: {
        documentId: string
        hits: IQualityRuleHit[]
      }) => IQualityScoreResult
    }
    if (scoring.score) return scoring.score({ documentId, hits })
    return this.scoring.scoreDocument(documentId, hits)
  }
}