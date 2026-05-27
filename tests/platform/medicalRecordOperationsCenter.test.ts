import { describe, expect, it } from 'vitest'
import type {
  ITemplateDocumentRecord,
  ITemplateDocumentTraceEvent,
  ITemplateDocumentWritingSummary,
  ITemplateSchema
} from '@/editor'
import type { IMedicalRecordQualityDefect } from '@/platform/emr-workbench/domain'
import {
  buildMedicalRecordOperationsCenterViewModel,
  type IMedicalRecordOperationsDomain
} from '@/platform/emr-workbench/modules'

const schema: ITemplateSchema = {
  id: 'admission-record-operations',
  name: '入院记录',
  version: '1.0.0',
  blocks: [
    {
      type: 'fieldRow',
      fields: [
        {
          id: 'chiefComplaint',
          type: 'textarea',
          label: '主诉',
          required: true,
          metadata: {
            businessCode: 'notes.chiefComplaint',
            dataSource: 'emr.notes',
            exportPath: 'notes.chiefComplaint'
          }
        },
        {
          id: 'diagnosis',
          type: 'textarea',
          label: '诊断',
          required: true,
          metadata: {
            businessCode: 'diagnosis.primary',
            dataSource: 'his.diagnosis',
            exportPath: 'diagnosis.primary'
          }
        }
      ]
    }
  ]
}

function createTrace(
  input: Partial<ITemplateDocumentTraceEvent>
): ITemplateDocumentTraceEvent {
  return {
    id: input.id ?? `trace-${input.action ?? 'save'}`,
    action: input.action ?? 'writing_save',
    timestamp: input.timestamp ?? 1000,
    operator: input.operator ?? '王医生',
    title: input.title ?? '保存病历内容',
    templateId: schema.id,
    templateVersion: schema.version,
    ...input
  }
}

function createRecord(
  input: Partial<ITemplateDocumentRecord>
): ITemplateDocumentRecord {
  return {
    id: input.id ?? 'record-1',
    patientId: 'patient-001',
    encounterId: 'encounter-001',
    title: input.title ?? '入院记录',
    status: input.status ?? 'completed',
    createdAt: input.createdAt ?? 0,
    updatedAt: input.updatedAt ?? 1000,
    template: {
      id: schema.id,
      name: schema.name,
      version: schema.version,
      boundAt: 0,
      snapshot: schema
    },
    content: {
      flatValues: {
        chiefComplaint: '咳嗽三天',
        diagnosis: '肺炎感染'
      },
      structuredValues: {
        diagnosis: {
          primary: '肺炎感染'
        }
      },
      ...input.content
    },
    migrationHistory: [],
    traceEvents: input.traceEvents ?? []
  }
}

function createDomain(args: {
  summaries: Record<string, Partial<ITemplateDocumentWritingSummary>>
  timelines: Record<string, ITemplateDocumentTraceEvent[]>
  openDefectCounts: Record<string, number>
}): IMedicalRecordOperationsDomain {
  return {
    getWritingSummary: id => {
      const summary = args.summaries[id]
      if (!summary) return null
      return {
        documentId: id,
        status: 'completed',
        templateId: schema.id,
        templateVersion: schema.version,
        writers: ['王医生'],
        changedFieldIds: [],
        fieldChangeCount: 0,
        writingEventCount: 0,
        autosaveCount: 0,
        saveCount: 1,
        signCount: 0,
        reviewCount: 0,
        ...summary
      }
    },
    getTraceTimeline: id => args.timelines[id] ?? [],
    getPostArchiveRevisionSummary: () => ({
      revisionCount: 0,
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0
    }),
    getOpenDefectCount: id => args.openDefectCounts[id] ?? 0
  }
}

function createDefect(input: Partial<IMedicalRecordQualityDefect>): IMedicalRecordQualityDefect {
  return {
    id: input.id ?? 'defect-1',
    sourceIssueId: input.sourceIssueId ?? 'issue-1',
    documentId: input.documentId ?? 'record-1',
    documentTitle: input.documentTitle ?? '入院记录',
    templateId: input.templateId ?? schema.id,
    templateVersion: input.templateVersion ?? schema.version,
    templateText: input.templateText ?? `${schema.name} · v${schema.version}`,
    fieldId: input.fieldId,
    fieldLabel: input.fieldLabel,
    category: input.category ?? '必填字段',
    level: input.level ?? 'blocker',
    levelText: input.levelText ?? '阻断',
    message: input.message ?? '主诉缺失',
    actionHint: input.actionHint ?? '请补录主诉',
    owner: input.owner ?? '王医生',
    status: input.status ?? 'returned',
    statusText: input.statusText ?? '已退回医生',
    createdAt: input.createdAt ?? 1000,
    updatedAt: input.updatedAt ?? 1200,
    events: input.events ?? [
      {
        action: 'returned',
        operator: '质控员',
        timestamp: 1200,
        note: '请补录主诉'
      }
    ]
  }
}

describe('medical record operations center view model', () => {
  it('在一个工作台汇总待质控、退回整改、待归档和归档阻断病历', () => {
    const pendingQuality = createRecord({ id: 'record-pending-quality', status: 'completed' })
    const returnedRectification = createRecord({ id: 'record-returned', status: 'signed' })
    const pendingArchive = createRecord({ id: 'record-pending-archive', status: 'signed' })
    const archiveBlocked = createRecord({ id: 'record-archive-blocked', status: 'signed' })

    const summaries = {
      'record-pending-quality': {
        signCount: 0,
        reviewCount: 0
      },
      'record-returned': {
        signCount: 1,
        reviewCount: 1
      },
      'record-pending-archive': {
        signCount: 1,
        reviewCount: 1
      },
      'record-archive-blocked': {
        signCount: 1,
        reviewCount: 1
      }
    }

    const timelines = {
      'record-pending-quality': [
        createTrace({ action: 'writing_save', timestamp: 1000 })
      ],
      'record-returned': [
        createTrace({ action: 'writing_save', timestamp: 1000 }),
        createTrace({ action: 'sign', timestamp: 1200 }),
        createTrace({ action: 'review', timestamp: 1400 })
      ],
      'record-pending-archive': [
        createTrace({ action: 'writing_save', timestamp: 1000 }),
        createTrace({ action: 'sign', timestamp: 1200 }),
        createTrace({ action: 'review', timestamp: 1400 })
      ],
      'record-archive-blocked': [
        createTrace({ action: 'writing_save', timestamp: 1000 }),
        createTrace({ action: 'sign', timestamp: 1200 }),
        createTrace({ action: 'review', timestamp: 1400 })
      ]
    }

    const defects = [
      createDefect({
        id: 'defect-returned',
        documentId: 'record-returned',
        status: 'returned',
        statusText: '已退回医生'
      })
    ]

    const model = buildMedicalRecordOperationsCenterViewModel({
      documents: [
        pendingQuality,
        returnedRectification,
        pendingArchive,
        archiveBlocked
      ],
      domain: createDomain({
        summaries,
        timelines,
        openDefectCounts: {
          'record-archive-blocked': 2
        }
      }),
      defects,
      now: 3000
    })

    expect(model.summary.pendingQualityCount).toBe(1)
    expect(model.summary.returnedRectificationCount).toBe(1)
    expect(model.summary.pendingArchiveCount).toBe(1)
    expect(model.summary.archiveBlockedCount).toBe(1)

    const pendingQualityGroup = model.queues.find(item => item.queue === 'pendingQuality')
    expect(pendingQualityGroup?.items[0]?.documentId).toBe('record-pending-quality')

    const returnedGroup = model.queues.find(item => item.queue === 'returnedRectification')
    expect(returnedGroup?.items[0]?.documentId).toBe('record-returned')

    const blockedGroup = model.queues.find(item => item.queue === 'archiveBlocked')
    const blockedDocument = blockedGroup?.items.find(item => (
      item.documentId === 'record-archive-blocked'
    ))
    expect(blockedDocument?.openDefectCount).toBe(2)
    const allQueuedIds = model.queues.flatMap(queue => (
      queue.items.map(item => item.documentId)
    ))
    expect(new Set(allQueuedIds).size).toBe(allQueuedIds.length)
  })
})
