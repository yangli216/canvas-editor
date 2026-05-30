import type { IQualityInspectionResult } from '../../domain'

export interface IQualityScoringCenterDetailViewModel {
  hitId: string
  ruleId: string
  ruleName: string
  category: string
  deduction: number
  deductionText: string
  reason: string
  fieldId?: string
  evidenceText?: string
}

export interface IQualityScoringCenterViewModel {
  id: string
  documentId: string
  stage: string
  score: number
  scoreText: string
  grade: string
  gradeText: string
  conclusion: string
  conclusionText: string
  inspectedBy: string
  inspectedAt: number
  details: IQualityScoringCenterDetailViewModel[]
}

const CONCLUSION_TEXT: Record<IQualityInspectionResult['conclusion'], string> = {
  passed: '通过',
  warning: '待整改',
  blocked: '阻断归档'
}

export function buildQualityScoringCenterViewModel(
  result: IQualityInspectionResult
): IQualityScoringCenterViewModel {
  return {
    id: result.id,
    documentId: result.documentId,
    stage: result.stage,
    score: result.score,
    scoreText: `${result.score} 分`,
    grade: result.grade,
    gradeText: `${result.grade} 级`,
    conclusion: result.conclusion,
    conclusionText: CONCLUSION_TEXT[result.conclusion],
    inspectedBy: result.inspectedBy,
    inspectedAt: result.inspectedAt,
    details: result.details.map(detail => ({
      hitId: detail.hitId,
      ruleId: detail.ruleId,
      ruleName: detail.ruleName,
      category: detail.category,
      deduction: detail.deduction,
      deductionText: `${detail.deduction} 分`,
      reason: detail.reason,
      fieldId: detail.fieldId,
      evidenceText: detail.evidenceText
    }))
  }
}