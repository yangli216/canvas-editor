import { describe, expect, it } from 'vitest'
import {
  TemplateDocumentStore,
  type ITemplateDocumentStorageLike,
  ITemplateDocumentRecord,
  ITemplateDocumentTraceEvent,
  ITemplateDocumentWritingSummary,
  ITemplateSchema
} from '@/editor'
import {
  MedicalRecordDomainService,
  TemplateDomainService
} from '@/platform/emr-workbench/domain'
import {
  buildMedicalRecordArchiveCenterViewModel,
  type IMedicalRecordArchiveDomain
} from '@/platform/emr-workbench/modules'

const schema: ITemplateSchema = {
  id: 'admission-record',
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
    status: input.status ?? 'signed',
    createdAt: input.createdAt ?? 0,
    updatedAt: input.updatedAt ?? 2000,
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
        diagnosis: '肺炎'
      },
      structuredValues: {
        notes: {
          chiefComplaint: '咳嗽三天'
        }
      },
      ...input.content
    },
    migrationHistory: [],
    traceEvents: input.traceEvents ?? []
  }
}

function createDomain(
  summaries: Record<string, Partial<ITemplateDocumentWritingSummary>>,
  timelines: Record<string, ITemplateDocumentTraceEvent[]>,
  revisions: Record<string, ReturnType<MedicalRecordDomainService['getPostArchiveRevisionSummary']>> = {},
  openDefectCounts: Record<string, number> = {}
): IMedicalRecordArchiveDomain {
  return {
    getWritingSummary: id => {
      const summary = summaries[id]
      if (!summary) return null
      return {
        documentId: id,
        status: 'signed',
        templateId: schema.id,
        templateVersion: schema.version,
        writers: [],
        changedFieldIds: [],
        fieldChangeCount: 0,
        writingEventCount: 0,
        autosaveCount: 0,
        saveCount: 0,
        signCount: 0,
        reviewCount: 0,
        ...summary
      }
    },
    getTraceTimeline: id => timelines[id] ?? [],
    getPostArchiveRevisionSummary: id => revisions[id] ?? {
      revisionCount: 0,
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0
    },
    getOpenDefectCount: id => openDefectCounts[id] ?? 0
  }
}

function createStorage() {
  const data = new Map<string, string>()
  const storage: ITemplateDocumentStorageLike = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: key => {
      data.delete(key)
    }
  }
  return storage
}

function createTemplateSchema(id: string): ITemplateSchema {
  return {
    ...schema,
    id,
    blocks: schema.blocks.map(block => {
      if (block.type !== 'fieldRow') return block
      return {
        ...block,
        fields: block.fields.map(field => ({ ...field }))
      }
    })
  }
}

describe('medical record archive center view model', () => {
  it('识别已签名且质控通过的待归档病历', () => {
    const record = createRecord({ id: 'record-ready' })
    const domain = createDomain({
      'record-ready': {
        firstWrittenAt: 1000,
        lastWrittenAt: 1000,
        writers: ['王医生'],
        signCount: 1,
        reviewCount: 1
      }
    }, {
      'record-ready': [
        createTrace({ action: 'writing_save', timestamp: 1000 }),
        createTrace({ action: 'sign', timestamp: 1200 }),
        createTrace({ action: 'review', timestamp: 1400 })
      ]
    })

    const model = buildMedicalRecordArchiveCenterViewModel({
      documents: [record],
      domain,
      now: 2000
    })

    expect(model.summary.pendingArchiveCount).toBe(1)
    expect(model.summary.canArchiveCount).toBe(1)
    expect(model.items[0].archiveStatus).toBe('pendingArchive')
    expect(model.items[0].canArchive).toBe(true)
    expect(model.items[0].checklist.every(item => (
      item.level !== 'blocker' || item.passed
    ))).toBe(true)
  })

  it('将仍有阻断项的病历归入质控退回', () => {
    const record = createRecord({
      id: 'record-blocked',
      status: 'completed',
      content: {
        flatValues: {
          chiefComplaint: '',
          diagnosis: '肺炎'
        }
      }
    })
    const domain = createDomain({
      'record-blocked': {
        firstWrittenAt: 1000,
        lastWrittenAt: 1000,
        writers: ['李医生']
      }
    }, {
      'record-blocked': [createTrace({ action: 'writing_save', timestamp: 1000 })]
    })

    const model = buildMedicalRecordArchiveCenterViewModel({
      documents: [record],
      domain,
      now: 2000
    })

    expect(model.summary.blockedCount).toBe(1)
    expect(model.summary.canArchiveCount).toBe(0)
    expect(model.items[0].archiveStatus).toBe('qualityReturned')
    expect(model.items[0].canArchive).toBe(false)
    expect(model.items[0].checklist.find(item => item.id === 'quality-blockers')?.passed).toBe(false)
  })

  it('将存在归档后修订申请的病历归入归档后修订状态', () => {
    const record = createRecord({ id: 'record-revision', status: 'archived' })
    const domain = createDomain({
      'record-revision': {
        firstWrittenAt: 1000,
        lastWrittenAt: 1000,
        writers: ['王医生'],
        signCount: 1,
        reviewCount: 1
      }
    }, {
      'record-revision': [
        createTrace({ action: 'sign', timestamp: 1200 }),
        createTrace({ action: 'review', timestamp: 1400 }),
        createTrace({
          action: 'status_change',
          statusAfter: 'archived',
          timestamp: 1600
        })
      ]
    }, {
      'record-revision': {
        revisionCount: 1,
        pendingCount: 1,
        approvedCount: 0,
        rejectedCount: 0,
        latestStatusText: '待审批',
        latestReason: '归档后补充主诉细节',
        latestUpdatedAt: 2000
      }
    })

    const model = buildMedicalRecordArchiveCenterViewModel({
      documents: [record],
      domain,
      now: 3000
    })

    expect(model.summary.postArchiveRevisionCount).toBe(1)
    expect(model.items[0].archiveStatus).toBe('postArchiveRevision')
    expect(model.items[0].revisionSummary.latestReason).toBe('归档后补充主诉细节')
  })

  it('归档前必须关闭缺陷才允许归档冻结', () => {
    const record = createRecord({ id: 'record-open-defect', status: 'signed' })
    const domain = createDomain({
      'record-open-defect': {
        firstWrittenAt: 1000,
        lastWrittenAt: 1000,
        writers: ['王医生'],
        signCount: 1,
        reviewCount: 1
      }
    }, {
      'record-open-defect': [
        createTrace({ action: 'writing_save', timestamp: 1000 }),
        createTrace({ action: 'sign', timestamp: 1200 }),
        createTrace({ action: 'review', timestamp: 1400 })
      ]
    }, {}, {
      'record-open-defect': 1
    })

    const model = buildMedicalRecordArchiveCenterViewModel({
      documents: [record],
      domain,
      now: 2000
    })

    expect(model.items[0].canArchive).toBe(false)
    expect(model.items[0].checklist.find(item => item.id === 'defect-closure')?.passed).toBe(false)
    expect(model.items[0].checklist.find(item => item.id === 'defect-closure')?.detail).toContain('1 个缺陷')
  })

  it('终末质控阻断和归档必备资料缺失时不允许归档', () => {
    const record = createRecord({ id: 'record-terminal-quality', status: 'signed' })
    const domain = createDomain({
      'record-terminal-quality': {
        firstWrittenAt: 1000,
        lastWrittenAt: 1000,
        writers: ['王医生'],
        signCount: 1,
        reviewCount: 1
      }
    }, {
      'record-terminal-quality': [
        createTrace({ action: 'writing_save', timestamp: 1000 }),
        createTrace({ action: 'sign', timestamp: 1200 }),
        createTrace({ action: 'review', timestamp: 1400 })
      ]
    })

    const model = buildMedicalRecordArchiveCenterViewModel({
      documents: [record],
      domain,
      terminalQualityResults: {
        'record-terminal-quality': {
          conclusion: 'blocked',
          score: 75,
          grade: 'D'
        }
      },
      archiveRequirements: {
        requireHomepage: true,
        requireCoding: true,
        requireAttachments: true
      },
      now: 2000
    })

    expect(model.items[0].canArchive).toBe(false)
    expect(model.items[0].checklist.map(item => item.id)).toEqual(expect.arrayContaining([
      'terminal-quality',
      'homepage',
      'coding',
      'attachments'
    ]))
  })

  it('归档必备结构化资料为空值时不允许归档', () => {
    const record = createRecord({
      id: 'record-empty-required-structured-values',
      status: 'signed',
      content: {
        flatValues: {
          chiefComplaint: '咳嗽三天',
          diagnosis: '肺炎'
        },
        structuredValues: {
          homepage: null,
          coding: {},
          attachments: []
        }
      }
    })
    const domain = createDomain({
      'record-empty-required-structured-values': {
        firstWrittenAt: 1000,
        lastWrittenAt: 1000,
        writers: ['王医生'],
        signCount: 1,
        reviewCount: 1
      }
    }, {
      'record-empty-required-structured-values': [
        createTrace({ action: 'writing_save', timestamp: 1000 }),
        createTrace({ action: 'sign', timestamp: 1200 }),
        createTrace({ action: 'review', timestamp: 1400 })
      ]
    })

    const model = buildMedicalRecordArchiveCenterViewModel({
      documents: [record],
      domain,
      archiveRequirements: {
        requireHomepage: true,
        requireCoding: true,
        requireAttachments: true
      },
      now: 2000
    })
    const checklist = model.items[0].checklist

    expect(checklist.find(item => item.id === 'homepage')?.passed).toBe(false)
    expect(checklist.find(item => item.id === 'coding')?.passed).toBe(false)
    expect(checklist.find(item => item.id === 'attachments')?.passed).toBe(false)
    expect(model.items[0].canArchive).toBe(false)
  })

  it('归档后修订申请生成差异和时间线但不覆盖归档快照', () => {
    const store = new TemplateDocumentStore(
      `canvas-editor:post-archive-revision:${Date.now()}`,
      createStorage()
    )
    const domain = new MedicalRecordDomainService(store)
    const record = store.create({
      id: 'record-archived-revision',
      schema,
      status: 'signed',
      flatValues: {
        chiefComplaint: '咳嗽三天',
        diagnosis: '肺炎'
      },
      trace: { operator: '王医生' }
    })
    store.reviewWriting(record.id, { operator: '上级医生' })
    domain.archiveDocument(record.id, { operator: '病案室' })

    const revision = domain.requestPostArchiveRevision(record.id, {
      applicant: '病案室',
      reason: '归档后补充主诉细节',
      proposedValues: {
        chiefComplaint: '咳嗽三天，伴发热'
      }
    })

    expect(revision?.status).toBe('requested')
    expect(revision?.fieldDiffs).toEqual([{ fieldId: 'chiefComplaint', before: '咳嗽三天', after: '咳嗽三天，伴发热' }])
    expect(domain.findDocument(record.id)?.content.flatValues.chiefComplaint).toBe('咳嗽三天')
    expect(domain.getTraceTimeline(record.id).map(event => event.title)).toContain('归档后修订申请')

    const reviewed = domain.reviewPostArchiveRevision(revision!.id, {
      status: 'approved',
      reviewer: '病案室主任',
      opinion: '批准修订，保留原归档快照'
    })
    expect(reviewed?.status).toBe('approved')
    expect(domain.getPostArchiveRevisionSummary(record.id).approvedCount).toBe(1)
    expect(domain.listArchivedByTemplateVersion(schema.id, schema.version)).toHaveLength(1)
    expect(domain.getTraceTimeline(record.id).map(event => event.title)).toContain('归档后修订审批')
  })

  it('将归档后发现的模板问题串联修订草稿、验证、发布和影响范围复核', () => {
    const store = new TemplateDocumentStore(
      `canvas-editor:post-archive-template-feedback:${Date.now()}`,
      createStorage()
    )
    const medicalRecordDomain = new MedicalRecordDomainService(store)
    const templateDomain = new TemplateDomainService(store)
    const feedbackSchema = createTemplateSchema(`archive-feedback-${Date.now()}`)
    templateDomain.register(feedbackSchema, '住院记录', false)
    const publishEntry = templateDomain.getEntry(feedbackSchema.id)!
    expect(templateDomain.runReleaseAction(
      'published',
      feedbackSchema.id,
      templateDomain.buildAdmissionReport(publishEntry),
      { note: '首版上线' }
    ).applied).toBe(true)

    const firstRecord = store.create({
      id: 'archive-feedback-record-1',
      schema: feedbackSchema,
      status: 'signed',
      flatValues: {
        chiefComplaint: '咳嗽三天',
        diagnosis: '肺炎'
      }
    })
    const secondRecord = store.create({
      id: 'archive-feedback-record-2',
      schema: feedbackSchema,
      status: 'signed',
      flatValues: {
        chiefComplaint: '发热一天',
        diagnosis: '上呼吸道感染'
      }
    })
    medicalRecordDomain.archiveDocument(firstRecord.id, { operator: '病案室' })
    medicalRecordDomain.archiveDocument(secondRecord.id, { operator: '病案室' })
    const revision = medicalRecordDomain.requestPostArchiveRevision(firstRecord.id, {
      applicant: '病案室',
      reason: '归档后发现主诉字段缺少结构化提示',
      proposedValues: {
        chiefComplaint: '咳嗽三天，伴发热'
      }
    })!

    const impacted = medicalRecordDomain.listArchivedByTemplateVersion(
      feedbackSchema.id,
      feedbackSchema.version
    )
    const feedback = templateDomain.createRevisionDraftFromPostArchiveRevision(
      revision,
      {
        operator: '模板管理员',
        impactedArchivedDocuments: impacted,
        impactScopeText: `影响 ${impacted.length} 份已归档病历`
      }
    )
    expect(feedback.status).toBe('revisionDraft')
    expect(feedback.sourceType).toBe('postArchiveRevision')
    expect(feedback.impactedArchivedDocumentCount).toBe(2)
    expect(feedback.impactScopeText).toBe('影响 2 份已归档病历')
    expect(templateDomain.getEntry(feedbackSchema.id)?.status).toBe('draft')

    templateDomain.addTrialRun(feedbackSchema.id, {
      scenario: '归档后修订回归验证',
      status: 'passed',
      summary: '主诉字段结构化提示已验证'
    }, '质控员')
    expect(templateDomain.getMedicalRecordTemplateFeedbackRecords(
      feedbackSchema.id
    )[0].status).toBe('trialRun')

    const releaseEntry = templateDomain.getEntry(feedbackSchema.id)!
    expect(templateDomain.runReleaseAction(
      'published',
      feedbackSchema.id,
      templateDomain.buildAdmissionReport(releaseEntry),
      { note: '归档后修订反哺模板发布' }
    ).applied).toBe(true)
    const records = templateDomain.getMedicalRecordTemplateFeedbackRecords(
      feedbackSchema.id
    )
    expect(records[0].status).toBe('published')
    expect(records[0].latestTrialRunSummary).toBe('主诉字段结构化提示已验证')
    expect(records[0].latestReleaseNote).toBe('归档后修订反哺模板发布')
  })
})
