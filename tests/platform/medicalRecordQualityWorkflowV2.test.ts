import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  ITemplateDocumentStorageLike,
  ITemplateSchema
} from '@/editor'
import {
  MedicalRecordDefectDomainService,
  MedicalRecordDomainService,
  QualityExecutionDomainService,
  QualityInspectionTaskDomainService,
  QualityScoringDomainService,
  QualityStandardDomainService,
  TemplateDocumentStore
} from '@/platform/emr-workbench/domain'
import {
  buildMedicalRecordArchiveCenterViewModel,
  buildQualityAnalyticsCenterViewModel,
  buildQualityTaskCenterViewModel,
  type IMedicalRecordArchiveDomain
} from '@/platform/emr-workbench/modules'

afterEach(() => {
  vi.restoreAllMocks()
})

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
            businessCode: 'notes.chiefComplaint'
          }
        },
        {
          id: 'homepageCode',
          type: 'text',
          label: '病案首页编码',
          metadata: {
            businessCode: 'homepage.code'
          }
        }
      ]
    }
  ]
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

function createArchiveDomain(args: {
  medicalRecordDomain: MedicalRecordDomainService
  defectDomain: MedicalRecordDefectDomainService
}): IMedicalRecordArchiveDomain {
  return {
    getWritingSummary: id => args.medicalRecordDomain.getWritingSummary(id),
    getTraceTimeline: id => args.medicalRecordDomain.getTraceTimeline(id),
    getPostArchiveRevisionSummary: id => (
      args.medicalRecordDomain.getPostArchiveRevisionSummary(id)
    ),
    getOpenDefectCount: id => args.defectDomain.getOpenDefectCount(id)
  }
}

describe('medical record quality workflow v2', () => {
  it('串起提交、任务生成、终末评分、缺陷退回、归档阻断和运营统计', () => {
    const dateNow = vi.spyOn(Date, 'now')
    dateNow.mockReturnValue(500)

    const store = new TemplateDocumentStore(
      `canvas-editor:quality-workflow-v2:${Date.now()}`,
      createStorage()
    )
    const medicalRecordDomain = new MedicalRecordDomainService(store)
    const defectDomain = new MedicalRecordDefectDomainService(medicalRecordDomain)
    const standardDomain = new QualityStandardDomainService()
    const scoringDomain = new QualityScoringDomainService()
    const executionDomain = new QualityExecutionDomainService(
      standardDomain,
      scoringDomain
    )
    const taskDomain = new QualityInspectionTaskDomainService()

    const record = store.create({
      id: 'record-quality-workflow-v2',
      schema,
      status: 'completed',
      title: '入院记录',
      patientId: 'patient-001',
      encounterId: 'encounter-001',
      flatValues: {
        chiefComplaint: '咳嗽三天',
        homepageCode: ''
      },
      trace: {
        operator: '王医生'
      }
    })
    store.signDocument(record.id, { operator: '王医生' })
    store.reviewWriting(record.id, { operator: '上级医生' })

    standardDomain.createRulePackage({
      id: 'terminal-homepage-quality',
      name: '终末病案首页质控',
      stage: 'terminal',
      target: {
        documentTypes: ['入院记录']
      },
      rules: [
        {
          id: 'homepage-required',
          name: '病案首页编码必填',
          category: '病案首页',
          level: 'blocker',
          checkType: 'homepage',
          businessCode: 'homepage.code',
          deduction: 10,
          veto: true,
          actionHint: '补充病案首页编码后再归档'
        }
      ]
    })

    const task = taskDomain.createTask({
      source: 'archive',
      title: '归档前终末质控',
      strategy: 'full',
      scope: {},
      documentIds: [record.id],
      createdBy: '质控办'
    })

    const result = executionDomain.inspectDocument({
      record: medicalRecordDomain.findDocument(record.id)!,
      stage: 'terminal',
      taskId: task.id,
      inspectedBy: '质控员'
    })

    const defects = defectDomain.syncFromQualityItems([{
      id: record.id,
      templateId: record.template.id,
      templateText: `${record.template.name} v${record.template.version}`,
      title: record.title ?? record.id,
      ownerText: '王医生',
      issues: result.hits.map(hit => ({
        id: hit.id,
        level: hit.level === 'blocker' ? 'blocker' : 'warning',
        category: hit.category,
        message: hit.message,
        actionHint: hit.actionHint,
        fieldId: hit.fieldId,
        fieldLabel: hit.fieldLabel,
        deduction: hit.deduction,
        sourceTaskId: task.id,
        sourceResultId: result.id
      }))
    }])
    const defect = defects.find(item => item.documentId === record.id)!
    defectDomain.returnToDoctor(defect.id, { dueAt: 1000 })
    const returnedDefect = defectDomain.listByDocument(record.id)[0]
    const analyticsDefects = defectDomain.list().map(item => ({
      ...item,
      overdue: Boolean(item.dueAt && item.dueAt < 3000)
    }))

    const archiveModel = buildMedicalRecordArchiveCenterViewModel({
      documents: medicalRecordDomain.list(),
      domain: createArchiveDomain({ medicalRecordDomain, defectDomain }),
      terminalQualityResults: {
        [record.id]: {
          conclusion: result.conclusion,
          score: result.score,
          grade: result.grade
        }
      },
      archiveRequirements: {
        requireHomepage: true
      },
      now: 3000
    })
    const taskModel = buildQualityTaskCenterViewModel({
      tasks: taskDomain.list(),
      now: 3000
    })
    const analytics = buildQualityAnalyticsCenterViewModel({
      documents: [{
        ...medicalRecordDomain.findDocument(record.id)!,
        departmentText: '未分科室',
        doctorText: '王医生',
        archived: false
      }],
      qualityResults: [{
        documentId: record.id,
        score: result.score,
        grade: result.grade,
        conclusion: result.conclusion
      }, {
        documentId: 'record-out-of-scope',
        score: 100,
        grade: 'A',
        conclusion: 'passed'
      }],
      defects: analyticsDefects,
      archiveItems: archiveModel.items.map(item => ({
        id: item.id,
        canArchive: item.canArchive
      })),
      now: 3000
    })
    const archiveItem = archiveModel.items[0]
    const checklistById = new Map(
      archiveItem.checklist.map(item => [item.id, item])
    )
    const terminalQualityCheck = checklistById.get('terminal-quality')
    const homepageCheck = checklistById.get('homepage')
    const defectClosureCheck = checklistById.get('defect-closure')

    expect(result.conclusion).toBe('blocked')
    expect(archiveItem.canArchive).toBe(false)
    expect(taskModel.summary.taskCount).toBe(1)
    expect(analytics.summary.coverageRateText).toBe('100%')
    expect(analytics.summary.archivePassRateText).toBe('0%')
    expect(terminalQualityCheck).toMatchObject({
      label: '终末质控',
      passed: false
    })
    expect(terminalQualityCheck?.detail).toContain('结论 blocked')
    expect(homepageCheck).toMatchObject({
      label: '病案首页',
      passed: false
    })
    expect(homepageCheck?.detail).toContain('缺少病案首页')
    expect(defectClosureCheck).toMatchObject({
      label: '缺陷关闭',
      passed: false
    })
    expect(defectClosureCheck?.detail).toContain('1 个缺陷待关闭')
    expect(returnedDefect).toMatchObject({
      sourceTaskId: task.id,
      sourceResultId: result.id,
      deduction: 10,
      dueAt: 1000
    })
    expect(analyticsDefects.find(item => item.id === defect.id)?.overdue).toBe(true)
    expect(task.documentIds).toContain(record.id)
    expect(task.source).toBe('archive')
    expect(task.status).toBe('pendingAssign')
    expect(task.strategy).toBe('full')
    expect(taskModel.items[0].documentCount).toBe(1)
    expect(taskModel.items[0]).toMatchObject({
      sourceText: '归档质控',
      status: 'pendingAssign',
      strategyText: '全检'
    })
  })
})