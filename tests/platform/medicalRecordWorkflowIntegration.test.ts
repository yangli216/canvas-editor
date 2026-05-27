import { describe, expect, it } from 'vitest'
import {
  TemplateDocumentStore,
  type ITemplateDocumentStorageLike,
  type ITemplateSchema
} from '@/editor'
import {
  MedicalRecordDefectDomainService,
  MedicalRecordDomainService
} from '@/platform/emr-workbench/domain'
import {
  buildMedicalRecordArchiveCenterViewModel,
  buildMedicalRecordQualityViewModel
} from '@/platform/emr-workbench/modules'

const schema: ITemplateSchema = {
  id: 'admission-record-integration',
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

describe('medical record workflow integration', () => {
  it('覆盖病历提交、质控退回、医生整改、复核通过和归档冻结链路', () => {
    const store = new TemplateDocumentStore(
      `canvas-editor:workflow-integration:${Date.now()}`,
      createStorage()
    )
    const medicalRecordDomain = new MedicalRecordDomainService(store)
    const defectDomain = new MedicalRecordDefectDomainService(medicalRecordDomain)

    const record = store.create({
      id: 'workflow-record-1',
      schema,
      title: '入院记录',
      patientId: 'patient-001',
      encounterId: 'encounter-001',
      status: 'draft',
      flatValues: {
        chiefComplaint: '',
        diagnosis: '肺炎感染'
      },
      trace: {
        operator: '王医生'
      }
    })

    store.startWriting(record.id, {
      operator: '王医生',
      department: '呼吸内科'
    })
    store.write(record.id, {
      flatValues: {
        diagnosis: '肺炎感染'
      },
      operator: '王医生',
      commit: true,
      title: '保存病历内容'
    })
    store.setStatus(record.id, 'completed', {
      operator: '王医生',
      title: '病历提交',
      summary: '提交质控'
    })

    const pendingQuality = buildMedicalRecordQualityViewModel({
      documents: medicalRecordDomain.list(),
      domain: medicalRecordDomain,
      now: 1000
    })
    expect(pendingQuality.items[0].blockerCount).toBeGreaterThan(0)

    const defects = defectDomain.syncFromQualityItems(pendingQuality.items)
    const requiredDefect = defects.find(defect => (
      defect.documentId === record.id
      && defect.category === '必填字段'
      && defect.fieldId === 'chiefComplaint'
    ))
    expect(requiredDefect).toBeTruthy()

    const returned = defectDomain.returnToDoctor(requiredDefect!.id, {
      operator: '质控员',
      reason: '请补录主诉后重新提交'
    })
    expect(returned?.status).toBe('returned')

    store.write(record.id, {
      flatValues: {
        chiefComplaint: '咳嗽发热三天'
      },
      operator: '王医生',
      commit: true,
      title: '整改补录主诉'
    })
    const rectified = defectDomain.markRectified(requiredDefect!.id, {
      operator: '王医生',
      note: '已按要求补录'
    })
    expect(rectified?.status).toBe('rectified')

    store.signDocument(record.id, {
      operator: '王医生'
    })
    store.reviewWriting(record.id, {
      operator: '上级医生'
    })

    const closed = defectDomain.close(requiredDefect!.id, {
      operator: '质控员',
      opinion: '复核通过'
    })
    expect(closed?.status).toBe('closed')

    const readyArchiveModel = buildMedicalRecordArchiveCenterViewModel({
      documents: medicalRecordDomain.list(),
      domain: medicalRecordDomain,
      now: 2000
    })
    expect(readyArchiveModel.items[0].archiveStatus).toBe('pendingArchive')
    expect(readyArchiveModel.items[0].canArchive).toBe(true)

    const archived = medicalRecordDomain.archiveDocument(record.id, {
      operator: '病案室',
      qualityConclusion: '整改复核通过，允许归档'
    })
    expect(archived?.applied).toBe(true)
    expect(medicalRecordDomain.findDocument(record.id)?.status).toBe('archived')

    const archivedModel = buildMedicalRecordArchiveCenterViewModel({
      documents: medicalRecordDomain.list(),
      domain: medicalRecordDomain,
      now: 3000
    })
    expect(archivedModel.items[0].archiveStatus).toBe('archived')
    expect(archivedModel.items[0].snapshotSummary.templateVersion).toBe(schema.version)

    const timelineTitles = medicalRecordDomain
      .getTraceTimeline(record.id)
      .map(event => event.title)
    expect(timelineTitles).toContain('病历提交')
    expect(timelineTitles).toContain('质控退回')
    expect(timelineTitles).toContain('医生整改')
    expect(timelineTitles).toContain('质控复核关闭')
    expect(timelineTitles).toContain('病历归档')
  })
})