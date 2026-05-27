import { describe, expect, it } from 'vitest'
import {
  TemplateDocumentStore,
  type ITemplateDocumentStorageLike,
  type ITemplateSchema
} from '@/editor'
import {
  MedicalRecordDefectDomainService,
  MedicalRecordDomainService,
  TemplateDomainService
} from '@/platform/emr-workbench/domain'
import {
  buildMedicalRecordDefectCenterViewModel,
  buildMedicalRecordQualityViewModel
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

function createDomains() {
  const store = new TemplateDocumentStore(
    `canvas-editor:defect-test:${Math.random()}`,
    createStorage()
  )
  const medicalRecordDomain = new MedicalRecordDomainService(store)
  const templateDomain = new TemplateDomainService(store)
  const defectDomain = new MedicalRecordDefectDomainService(medicalRecordDomain)
  return { store, medicalRecordDomain, templateDomain, defectDomain }
}

function createSchema(id: string): ITemplateSchema {
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

function createBlockedRecord(
  store: TemplateDocumentStore,
  id: string,
  doctor = '王医生',
  targetSchema = schema
) {
  const record = store.create({
    id,
    schema: targetSchema,
    title: '入院记录',
    patientId: `patient-${id}`,
    encounterId: `encounter-${id}`,
    status: 'completed',
    flatValues: {
      chiefComplaint: '',
      diagnosis: '肺炎'
    },
    trace: {
      operator: doctor
    }
  })
  store.write(record.id, {
    flatValues: {
      diagnosis: '肺炎'
    },
    operator: doctor,
    commit: true,
    title: '保存病历内容'
  })
  return record
}

function syncDefects(args: ReturnType<typeof createDomains>) {
  const qualityModel = buildMedicalRecordQualityViewModel({
    documents: args.medicalRecordDomain.list(),
    domain: args.medicalRecordDomain,
    now: 5000
  })
  return args.defectDomain.syncFromQualityItems(qualityModel.items)
}

describe('medical record defect remediation center', () => {
  it('将质控问题固化为缺陷，并流转退回、整改、复核关闭留痕', () => {
    const domains = createDomains()
    createBlockedRecord(domains.store, 'record-1')

    const defects = syncDefects(domains)
    const requiredDefect = defects.find(defect => (
      defect.category === '必填字段' && defect.fieldId === 'chiefComplaint'
    ))

    expect(requiredDefect).toBeTruthy()
    expect(requiredDefect?.status).toBe('open')
    expect(requiredDefect?.documentId).toBe('record-1')
    expect(requiredDefect?.templateId).toBe(schema.id)

    const returned = domains.defectDomain.returnToDoctor(requiredDefect!.id, {
      operator: '质控员',
      reason: '请补充主诉后再提交'
    })
    expect(returned?.status).toBe('returned')
    expect(returned?.returnReason).toBe('请补充主诉后再提交')

    const rectified = domains.defectDomain.markRectified(requiredDefect!.id, {
      operator: '王医生',
      note: '已补充主诉'
    })
    expect(rectified?.status).toBe('rectified')
    expect(rectified?.rectificationNote).toBe('已补充主诉')

    const closed = domains.defectDomain.close(requiredDefect!.id, {
      operator: '质控员',
      opinion: '复核通过'
    })
    expect(closed?.status).toBe('closed')
    expect(closed?.closedAt).toBeTruthy()

    const timelineTitles = domains.medicalRecordDomain
      .getTraceTimeline('record-1')
      .map(event => event.title)
    expect(timelineTitles).toContain('质控退回')
    expect(timelineTitles).toContain('医生整改')
    expect(timelineTitles).toContain('质控复核关闭')
  })

  it('汇总高频缺陷并支持转模板问题单', () => {
    const domains = createDomains()
    createBlockedRecord(domains.store, 'record-1', '王医生')
    createBlockedRecord(domains.store, 'record-2', '李医生')
    syncDefects(domains)

    const feedback = domains.defectDomain.getTemplateFeedbackSummary(2)
    const requiredFeedback = feedback.find(item => item.category === '必填字段')

    expect(requiredFeedback?.templateId).toBe(schema.id)
    expect(requiredFeedback?.count).toBe(2)
    expect(requiredFeedback?.fieldLabels).toContain('主诉')

    const requiredDefect = domains.defectDomain.list().find(defect => (
      defect.category === '必填字段' && defect.fieldId === 'chiefComplaint'
    ))
    const templateIssue = domains.defectDomain.convertToTemplateIssue(
      requiredDefect!.id,
      {
        operator: '模板管理员',
        suggestion: '主诉字段需要增加提示语和默认数据绑定'
      }
    )

    expect(templateIssue?.status).toBe('templateIssue')
    expect(templateIssue?.templateIssueSuggestion).toContain('主诉字段')
  })

  it('构建缺陷整改中心汇总模型', () => {
    const domains = createDomains()
    createBlockedRecord(domains.store, 'record-1')
    const defects = syncDefects(domains)
    const target = defects.find(defect => defect.category === '必填字段')!
    domains.defectDomain.returnToDoctor(target.id)

    const model = buildMedicalRecordDefectCenterViewModel({
      defects: domains.defectDomain.list(),
      templateFeedback: domains.defectDomain.getTemplateFeedbackSummary(1)
    })

    expect(model.summary.totalCount).toBeGreaterThan(0)
    expect(model.summary.returnedCount).toBe(1)
    expect(model.summary.templateFeedbackCount).toBeGreaterThan(0)
    expect(model.items[0].status).toBe('returned')
  })

  it('将病历缺陷反哺到模板版本中心的修订、验证和发布记录', () => {
    const domains = createDomains()
    const feedbackSchema = createSchema(`admission-feedback-${Date.now()}`)
    domains.templateDomain.register(feedbackSchema, '住院记录', false)
    const publishEntry = domains.templateDomain.getEntry(feedbackSchema.id)!
    const publishResult = domains.templateDomain.runReleaseAction(
      'published',
      feedbackSchema.id,
      domains.templateDomain.buildAdmissionReport(publishEntry),
      { note: '首版上线' }
    )
    expect(publishResult.applied).toBe(true)

    createBlockedRecord(domains.store, 'record-feedback-1', '王医生', feedbackSchema)
    createBlockedRecord(domains.store, 'record-feedback-2', '李医生', feedbackSchema)
    syncDefects(domains)
    const target = domains.defectDomain.list().find(defect => (
      defect.templateId === feedbackSchema.id
      && defect.category === '必填字段'
      && defect.fieldId === 'chiefComplaint'
    ))!
    const templateIssue = domains.defectDomain.convertToTemplateIssue(target.id, {
      operator: '模板管理员',
      suggestion: '主诉字段需要增加提示语和默认数据绑定'
    })!

    const feedback = domains.templateDomain.createRevisionDraftFromDefect(
      templateIssue,
      '模板管理员'
    )
    expect(feedback.status).toBe('revisionDraft')
    expect(feedback.revisionDraftVersion).toBe(feedbackSchema.version)
    expect(domains.templateDomain.getEntry(feedbackSchema.id)?.status).toBe('draft')

    domains.templateDomain.addTrialRun(feedbackSchema.id, {
      scenario: '病历缺陷回归验证',
      status: 'passed',
      summary: '主诉字段提示语回归通过'
    }, '质控员')
    expect(domains.templateDomain.getMedicalRecordTemplateFeedbackRecords(
      feedbackSchema.id
    )[0].status).toBe('trialRun')

    const releaseEntry = domains.templateDomain.getEntry(feedbackSchema.id)!
    const releaseResult = domains.templateDomain.runReleaseAction(
      'published',
      feedbackSchema.id,
      domains.templateDomain.buildAdmissionReport(releaseEntry),
      { note: '病历缺陷反哺修复发布' }
    )
    expect(releaseResult.applied).toBe(true)

    const records = domains.templateDomain.getMedicalRecordTemplateFeedbackRecords(
      feedbackSchema.id
    )
    expect(records[0].status).toBe('published')
    expect(records[0].latestTrialRunSummary).toBe('主诉字段提示语回归通过')
    expect(records[0].latestReleaseNote).toBe('病历缺陷反哺修复发布')
  })
})
