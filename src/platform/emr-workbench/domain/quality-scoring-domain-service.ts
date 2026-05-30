import type { QualityRuleLevel } from './quality-standard-domain-service'

export type QualityScoreGrade = 'A' | 'B' | 'C' | 'D'

export type QualityInspectionConclusion = 'passed' | 'warning' | 'blocked'

export interface IQualityScoringPolicy {
  id: string
  baseScore: number
  gradeThresholds: {
    A: number
    B: number
    C: number
  }
  categoryMaxDeduction?: Record<string, number>
}

export interface IQualityRuleHit {
  id: string
  ruleId: string
  ruleName: string
  rulePackageId: string
  category: string
  level: QualityRuleLevel
  message: string
  actionHint: string
  deduction?: number
  veto?: boolean
  fieldId?: string
  fieldLabel?: string
  evidenceText?: string
  sourceTaskId?: string
  sourceResultId?: string
}

export interface IQualityScoreDetail {
  hitId: string
  ruleId: string
  ruleName: string
  category: string
  deduction: number
  reason: string
  fieldId?: string
  evidenceText?: string
}

export interface IQualityScoreResult {
  documentId: string
  score: number
  grade: QualityScoreGrade
  conclusion: QualityInspectionConclusion
  details: IQualityScoreDetail[]
}

export const DEFAULT_QUALITY_SCORING_POLICY: IQualityScoringPolicy = {
  id: 'default-quality-scoring-policy',
  baseScore: 100,
  gradeThresholds: { A: 90, B: 80, C: 70 }
}

function resolveGrade(
  score: number,
  thresholds: IQualityScoringPolicy['gradeThresholds']
): QualityScoreGrade {
  if (score >= thresholds.A) return 'A'
  if (score >= thresholds.B) return 'B'
  if (score >= thresholds.C) return 'C'
  return 'D'
}

function resolveConclusion(
  hits: IQualityRuleHit[],
  grade: QualityScoreGrade
): QualityInspectionConclusion {
  if (hits.some(hit => hit.level === 'blocker') || grade === 'D') {
    return 'blocked'
  }
  if (hits.length > 0) return 'warning'
  return 'passed'
}

function normalizeDeduction(deduction: number | undefined) {
  if (!deduction || deduction < 0) return 0
  return deduction
}

export class QualityScoringDomainService {
  scoreDocument(
    documentId: string,
    hits: IQualityRuleHit[],
    policy = DEFAULT_QUALITY_SCORING_POLICY
  ): IQualityScoreResult {
    const categoryDeductions: Record<string, number> = {}
    const details = hits.map(hit => {
      const rawDeduction = normalizeDeduction(hit.deduction)
      const maxDeduction = policy.categoryMaxDeduction?.[hit.category]
      const usedDeduction = categoryDeductions[hit.category] ?? 0
      const remainingDeduction = typeof maxDeduction === 'number'
        ? Math.max(maxDeduction - usedDeduction, 0)
        : rawDeduction
      const deduction = typeof maxDeduction === 'number'
        ? Math.min(rawDeduction, remainingDeduction)
        : rawDeduction

      categoryDeductions[hit.category] = usedDeduction + deduction

      return {
        hitId: hit.id,
        ruleId: hit.ruleId,
        ruleName: hit.ruleName,
        category: hit.category,
        deduction,
        reason: hit.message,
        fieldId: hit.fieldId,
        evidenceText: hit.evidenceText
      }
    })
    const score = Math.max(
      policy.baseScore - details.reduce((total, item) => total + item.deduction, 0),
      0
    )
    const grade = hits.some(hit => hit.veto)
      ? 'D'
      : resolveGrade(score, policy.gradeThresholds)

    return {
      documentId,
      score,
      grade,
      conclusion: resolveConclusion(hits, grade),
      details
    }
  }
}