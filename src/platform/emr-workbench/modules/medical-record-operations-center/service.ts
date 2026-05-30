import type { ITemplateDocumentRecord } from '../../../../editor/template/TemplateDocumentStore'
import type {
  IMedicalRecordQualityDefect,
  MedicalRecordDefectStatus
} from '../../domain'
import {
  buildMedicalRecordArchiveCenterViewModel,
  type IMedicalRecordArchiveRequirements,
  type IMedicalRecordArchiveDomain,
  type IMedicalRecordArchiveItem,
  type IMedicalRecordTerminalQualitySummary
} from '../archive-center'
import {
  buildMedicalRecordQualityViewModel,
  type IMedicalRecordQualityRulePackage,
  type IMedicalRecordQualityTraceDomain,
  type IMedicalRecordQualityViewModel
} from '../medical-record-quality-center'

export type MedicalRecordOperationQueue =
  | 'pendingQuality'
  | 'returnedRectification'
  | 'pendingArchive'
  | 'archiveBlocked'

export interface IMedicalRecordOperationsDomain
  extends IMedicalRecordQualityTraceDomain,
    IMedicalRecordArchiveDomain {
  getOpenDefectCount?: (documentId: string) => number
}

export interface IMedicalRecordOperationsQueueItem {
  documentId: string
  title: string
  patientText: string
  templateText: string
  ownerText: string
  statusText: string
  queue: MedicalRecordOperationQueue
  queueText: string
  riskText: string
  blockerCount: number
  warningCount: number
  openDefectCount: number
  blockerReasonText: string
  latestWrittenText: string
}

export interface IMedicalRecordOperationsQueueGroup {
  queue: MedicalRecordOperationQueue
  queueText: string
  itemCount: number
  items: IMedicalRecordOperationsQueueItem[]
}

export interface IMedicalRecordOperationsCenterViewModel {
  summary: {
    documentCount: number
    pendingQualityCount: number
    returnedRectificationCount: number
    pendingArchiveCount: number
    archiveBlockedCount: number
  }
  queues: IMedicalRecordOperationsQueueGroup[]
}

function getQueueText(queue: MedicalRecordOperationQueue) {
  if (queue === 'pendingQuality') return '待质控病历'
  if (queue === 'returnedRectification') return '退回整改病历'
  if (queue === 'pendingArchive') return '待归档病历'
  return '归档阻断病历'
}

function getOpenDefectCountByStatus(
  defects: IMedicalRecordQualityDefect[],
  statuses: MedicalRecordDefectStatus[]
) {
  const counts = new Map<string, number>()
  defects
    .filter(defect => statuses.includes(defect.status))
    .forEach(defect => {
      counts.set(defect.documentId, (counts.get(defect.documentId) ?? 0) + 1)
    })
  return counts
}

function getBlockerReasonText(item: IMedicalRecordArchiveItem) {
  const blockers = item.checklist
    .filter(check => !check.passed && check.level === 'blocker')
    .map(check => check.label)
  return blockers.length ? blockers.join('、') : '无阻断项'
}

const OPEN_DEFECT_STATUSES: MedicalRecordDefectStatus[] = [
  'open',
  'returned',
  'secondReturned',
  'rectified',
  'appealing'
]

const RETURNED_RECTIFICATION_STATUSES: MedicalRecordDefectStatus[] = [
  'returned',
  'secondReturned',
  'rectified',
  'appealing'
]

function createQueueItems(args: {
  queue: MedicalRecordOperationQueue
  documentIds: string[]
  qualityMap: Map<string, IMedicalRecordQualityViewModel['items'][number]>
  archiveMap: Map<string, IMedicalRecordArchiveItem>
  openDefectCountMap: Map<string, number>
}): IMedicalRecordOperationsQueueItem[] {
  const uniqueIds = Array.from(new Set(args.documentIds))
  return uniqueIds
    .map(documentId => {
      const quality = args.qualityMap.get(documentId)
      const archive = args.archiveMap.get(documentId)
      if (!quality || !archive) return null
      const openDefectCount = args.openDefectCountMap.get(documentId) ?? 0
      return {
        documentId,
        title: quality.title,
        patientText: quality.patientText,
        templateText: quality.templateText,
        ownerText: quality.ownerText,
        statusText: archive.archiveStatusText,
        queue: args.queue,
        queueText: getQueueText(args.queue),
        riskText: quality.riskText,
        blockerCount: quality.blockerCount,
        warningCount: quality.warningCount,
        openDefectCount,
        blockerReasonText: getBlockerReasonText(archive),
        latestWrittenText: quality.latestWrittenText
      }
    })
    .filter((item): item is IMedicalRecordOperationsQueueItem => Boolean(item))
    .sort((a, b) => b.blockerCount - a.blockerCount
      || b.openDefectCount - a.openDefectCount
      || a.title.localeCompare(b.title))
}

export function buildMedicalRecordOperationsCenterViewModel(args: {
  documents: ITemplateDocumentRecord[]
  domain: IMedicalRecordOperationsDomain
  defects: IMedicalRecordQualityDefect[]
  rulePackages?: IMedicalRecordQualityRulePackage[]
  terminalQualityResults?: Record<string, IMedicalRecordTerminalQualitySummary>
  archiveRequirements?: IMedicalRecordArchiveRequirements
  now?: number
}): IMedicalRecordOperationsCenterViewModel {
  const qualityModel = buildMedicalRecordQualityViewModel({
    documents: args.documents,
    domain: args.domain,
    rulePackages: args.rulePackages,
    now: args.now
  })
  const archiveModel = buildMedicalRecordArchiveCenterViewModel({
    documents: args.documents,
    domain: args.domain,
    rulePackages: args.rulePackages,
    terminalQualityResults: args.terminalQualityResults,
    archiveRequirements: args.archiveRequirements,
    now: args.now
  })

  const qualityMap = new Map(qualityModel.items.map(item => [item.id, item]))
  const archiveMap = new Map(archiveModel.items.map(item => [item.id, item]))

  const openDefectCountMap = args.domain.getOpenDefectCount
    ? new Map(args.documents.map(document => [
        document.id,
        args.domain.getOpenDefectCount?.(document.id) ?? 0
      ]))
    : getOpenDefectCountByStatus(args.defects, OPEN_DEFECT_STATUSES)

  const returnedRectificationIds = args.defects
    .filter(defect => RETURNED_RECTIFICATION_STATUSES.includes(defect.status))
    .map(defect => defect.documentId)
  const returnedRectificationIdSet = new Set(returnedRectificationIds)

  const archiveBlockedIds = archiveModel.items
    .filter(item => (
      item.status !== 'archived'
      && item.status !== 'completed'
      && !item.canArchive
      && item.archiveStatus !== 'writing'
    ))
    .map(item => item.id)
  const archiveBlockedIdSet = new Set(archiveBlockedIds)

  const pendingQualityIds = archiveModel.items
    .filter(item => (
      (item.archiveStatus === 'pendingQuality' || item.status === 'completed')
      && !returnedRectificationIdSet.has(item.id)
      && !archiveBlockedIdSet.has(item.id)
    ))
    .map(item => item.id)

  const pendingArchiveIds = archiveModel.items
    .filter(item => (
      item.archiveStatus === 'pendingArchive'
      && item.canArchive
      && !returnedRectificationIdSet.has(item.id)
    ))
    .map(item => item.id)

  const queues: IMedicalRecordOperationsQueueGroup[] = [
    {
      queue: 'pendingQuality',
      queueText: getQueueText('pendingQuality'),
      items: createQueueItems({
        queue: 'pendingQuality',
        documentIds: pendingQualityIds,
        qualityMap,
        archiveMap,
        openDefectCountMap
      }),
      itemCount: 0
    },
    {
      queue: 'returnedRectification',
      queueText: getQueueText('returnedRectification'),
      items: createQueueItems({
        queue: 'returnedRectification',
        documentIds: returnedRectificationIds,
        qualityMap,
        archiveMap,
        openDefectCountMap
      }),
      itemCount: 0
    },
    {
      queue: 'pendingArchive',
      queueText: getQueueText('pendingArchive'),
      items: createQueueItems({
        queue: 'pendingArchive',
        documentIds: pendingArchiveIds,
        qualityMap,
        archiveMap,
        openDefectCountMap
      }),
      itemCount: 0
    },
    {
      queue: 'archiveBlocked',
      queueText: getQueueText('archiveBlocked'),
      items: createQueueItems({
        queue: 'archiveBlocked',
        documentIds: archiveBlockedIds,
        qualityMap,
        archiveMap,
        openDefectCountMap
      }),
      itemCount: 0
    }
  ]

  queues.forEach(queue => {
    queue.itemCount = queue.items.length
  })

  return {
    summary: {
      documentCount: args.documents.length,
      pendingQualityCount: queues.find(item => item.queue === 'pendingQuality')?.itemCount ?? 0,
      returnedRectificationCount: queues.find(item => item.queue === 'returnedRectification')?.itemCount ?? 0,
      pendingArchiveCount: queues.find(item => item.queue === 'pendingArchive')?.itemCount ?? 0,
      archiveBlockedCount: queues.find(item => item.queue === 'archiveBlocked')?.itemCount ?? 0
    },
    queues
  }
}
