import type { ITemplateDocumentRecord } from '../../../../editor/template/TemplateDocumentStore'
import type { IMedicalRecordQualityDefect } from '../../domain'
import type { IMedicalRecordTerminalQualitySummary } from '../archive-center'

export interface IQualityAnalyticsDocumentInput extends ITemplateDocumentRecord {
  archived?: boolean
  departmentText?: string
  doctorText?: string
}

export interface IQualityAnalyticsDefectInput extends IMedicalRecordQualityDefect {
  department?: string
  departmentText?: string
  overdue?: boolean
}

export interface IQualityAnalyticsArchiveItemInput {
  id: string
  canArchive: boolean
}

export interface IQualityAnalyticsQualityResultInput
  extends IMedicalRecordTerminalQualitySummary {
  documentId: string
}

export type QualityAnalyticsQualityResultsInput =
  | Record<string, IMedicalRecordTerminalQualitySummary>
  | IQualityAnalyticsQualityResultInput[]

export interface IQualityAnalyticsRankingItem {
  name: string
  documentCount: number
  defectCount: number
  closedDefectCount: number
  overdueCount: number
  score: number
  scoreText: string
}

export interface IQualityAnalyticsCenterViewModel {
  summary: {
    documentCount: number
    qualityResultCount: number
    defectCount: number
    closedDefectCount: number
    overdueDefectCount: number
    gradeACount: number
    archivePassCount: number
    coverageRate: number
    coverageRateText: string
    defectClosureRate: number
    defectClosureRateText: string
    overdueRate: number
    overdueRateText: string
    gradeARate: number
    gradeARateText: string
    archivePassRate: number
    archivePassRateText: string
  }
  departmentRankings: IQualityAnalyticsRankingItem[]
  doctorRankings: IQualityAnalyticsRankingItem[]
}

interface IRankingAccumulator {
  name: string
  documentIds: Set<string>
  defectCount: number
  closedDefectCount: number
  overdueCount: number
}

function toPercentText(value: number) {
  return `${value}%`
}

function getRate(numerator: number, denominator: number) {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 100)
}

function isClosed(defect: IQualityAnalyticsDefectInput) {
  return defect.status === 'closed'
}

function isOverdue(defect: IQualityAnalyticsDefectInput, now: number) {
  if (typeof defect.overdue === 'boolean') return defect.overdue
  if (!defect.dueAt || isClosed(defect)) return false
  return defect.dueAt < now
}

function getDepartmentName(
  defect: IQualityAnalyticsDefectInput | undefined,
  document: IQualityAnalyticsDocumentInput | undefined
) {
  return defect?.departmentText
    || defect?.department
    || document?.departmentText
    || '未分科室'
}

function getDoctorName(
  defect: IQualityAnalyticsDefectInput | undefined,
  document: IQualityAnalyticsDocumentInput | undefined
) {
  return defect?.owner || document?.doctorText || '未分配'
}

function getOrCreateAccumulator(
  map: Map<string, IRankingAccumulator>,
  name: string
) {
  const current = map.get(name)
  if (current) return current
  const next: IRankingAccumulator = {
    name,
    documentIds: new Set(),
    defectCount: 0,
    closedDefectCount: 0,
    overdueCount: 0
  }
  map.set(name, next)
  return next
}

function toRankingItems(map: Map<string, IRankingAccumulator>) {
  return Array.from(map.values())
    .map(item => {
      const score = Math.max(0, 100 - item.defectCount * 5 - item.overdueCount * 10)
      return {
        name: item.name,
        documentCount: item.documentIds.size,
        defectCount: item.defectCount,
        closedDefectCount: item.closedDefectCount,
        overdueCount: item.overdueCount,
        score,
        scoreText: `${score} 分`
      }
    })
    .sort((a, b) => a.score - b.score
      || b.defectCount - a.defectCount
      || a.name.localeCompare(b.name))
}

function normalizeQualityResults(
  qualityResults: QualityAnalyticsQualityResultsInput,
  documentMap: Map<string, IQualityAnalyticsDocumentInput>
) {
  if (Array.isArray(qualityResults)) {
    return qualityResults.filter(result => documentMap.has(result.documentId))
  }
  return Object.entries(qualityResults)
    .filter(([documentId]) => documentMap.has(documentId))
    .map(([, result]) => result)
}

export function buildQualityAnalyticsCenterViewModel(args: {
  documents: IQualityAnalyticsDocumentInput[]
  qualityResults: QualityAnalyticsQualityResultsInput
  defects: IQualityAnalyticsDefectInput[]
  archiveItems: IQualityAnalyticsArchiveItemInput[]
  now?: number
}): IQualityAnalyticsCenterViewModel {
  const now = args.now ?? Date.now()
  const documentMap = new Map(args.documents.map(document => [document.id, document]))
  const qualityResults = normalizeQualityResults(
    args.qualityResults,
    documentMap
  )
  const closedDefectCount = args.defects.filter(isClosed).length
  const overdueDefectCount = args.defects.filter(defect => isOverdue(defect, now)).length
  const gradeACount = qualityResults.filter(result => result.grade === 'A').length
  const archivePassCount = args.archiveItems.filter(item => item.canArchive).length

  const coverageRate = getRate(qualityResults.length, args.documents.length)
  const defectClosureRate = getRate(closedDefectCount, args.defects.length)
  const overdueRate = getRate(overdueDefectCount, args.defects.length)
  const gradeARate = getRate(gradeACount, qualityResults.length)
  const archivePassRate = getRate(archivePassCount, args.archiveItems.length)

  const departmentMap = new Map<string, IRankingAccumulator>()
  const doctorMap = new Map<string, IRankingAccumulator>()

  args.documents.forEach(document => {
    getOrCreateAccumulator(
      departmentMap,
      getDepartmentName(undefined, document)
    ).documentIds.add(document.id)
    getOrCreateAccumulator(
      doctorMap,
      getDoctorName(undefined, document)
    ).documentIds.add(document.id)
  })

  args.defects.forEach(defect => {
    const document = documentMap.get(defect.documentId)
    const department = getOrCreateAccumulator(
      departmentMap,
      getDepartmentName(defect, document)
    )
    const doctor = getOrCreateAccumulator(
      doctorMap,
      getDoctorName(defect, document)
    )
    const overdue = isOverdue(defect, now)
    department.documentIds.add(defect.documentId)
    doctor.documentIds.add(defect.documentId)
    department.defectCount += 1
    doctor.defectCount += 1
    if (isClosed(defect)) {
      department.closedDefectCount += 1
      doctor.closedDefectCount += 1
    }
    if (overdue) {
      department.overdueCount += 1
      doctor.overdueCount += 1
    }
  })

  return {
    summary: {
      documentCount: args.documents.length,
      qualityResultCount: qualityResults.length,
      defectCount: args.defects.length,
      closedDefectCount,
      overdueDefectCount,
      gradeACount,
      archivePassCount,
      coverageRate,
      coverageRateText: toPercentText(coverageRate),
      defectClosureRate,
      defectClosureRateText: toPercentText(defectClosureRate),
      overdueRate,
      overdueRateText: toPercentText(overdueRate),
      gradeARate,
      gradeARateText: toPercentText(gradeARate),
      archivePassRate,
      archivePassRateText: toPercentText(archivePassRate)
    },
    departmentRankings: toRankingItems(departmentMap),
    doctorRankings: toRankingItems(doctorMap)
  }
}