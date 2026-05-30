import { afterEach, describe, expect, it, vi } from 'vitest'
import { TemplateFeedback } from '@/components/template-designer/TemplateFeedback'
import { TemplateManager } from '@/components/template-designer/TemplateManager'
import {
  TemplateDocumentStore,
  type ITemplateDocumentStorageLike,
  type ITemplateSchema
} from '@/editor'

const schema: ITemplateSchema = {
  id: 'admission-record-template-manager',
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

interface TemplateManagerArchiveAccess {
  _archiveMedicalRecord(documentId: string): Promise<void>
  _openMedicalRecordArchiveCenter(): void
  _openMedicalRecordOperationsCenter(): void
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

function createManagerWithBlockedArchiveRecord() {
  const host = document.createElement('div')
  document.body.append(host)
  const store = new TemplateDocumentStore(
    `canvas-editor:template-manager-archive:${Math.random()}`,
    createStorage()
  )
  const record = store.create({
    id: 'record-template-manager-archive',
    schema,
    title: '入院记录',
    patientId: 'patient-001',
    encounterId: 'encounter-001',
    status: 'completed',
    flatValues: {
      chiefComplaint: '',
      diagnosis: '肺炎'
    },
    structuredValues: {
      diagnosis: {
        primary: '肺炎'
      }
    },
    trace: {
      operator: '王医生'
    }
  })
  store.signDocument(record.id, { operator: '王医生' })
  store.reviewWriting(record.id, { operator: '上级医生' })
  const manager = new TemplateManager({
    onApply: () => {},
    documentStore: store,
    mode: 'page',
    host
  })
  return {
    manager,
    access: manager as unknown as TemplateManagerArchiveAccess,
    store,
    recordId: record.id
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('TemplateManager 病历归档门禁入口', () => {
  it('运营和归档质检入口透传终末质控与归档准入阻断原因', () => {
    const dialogs: Array<{ title: string; content?: HTMLElement }> = []
    vi.spyOn(TemplateFeedback, 'openDialog').mockImplementation(options => {
      dialogs.push({
        title: options.title,
        content: options.content
      })
      return { close: () => {} }
    })
    const { access, manager } = createManagerWithBlockedArchiveRecord()

    access._openMedicalRecordOperationsCenter()
    access._openMedicalRecordArchiveCenter()

    const operationsDialog = dialogs.find(dialog => (
      dialog.title === '病历运营闭环工作台'
    ))
    const archiveDialog = dialogs.find(dialog => (
      dialog.title === '病历归档质检'
    ))

    expect(operationsDialog?.content?.textContent).toContain('终末质控')
    expect(operationsDialog?.content?.textContent).toContain('病案首页')
    expect(archiveDialog?.content?.textContent).toContain('终末质控')
    expect(archiveDialog?.content?.textContent).toContain('病案首页')

    manager.dispose()
  })

  it('归档冻结前二次校验不能绕过新增准入门禁', async () => {
    const confirmSpy = vi.spyOn(TemplateFeedback, 'confirm').mockResolvedValue(true)
    const toastSpy = vi.spyOn(TemplateFeedback, 'toast').mockImplementation(() => {})
    const { access, manager, recordId, store } = createManagerWithBlockedArchiveRecord()

    await access._archiveMedicalRecord(recordId)

    const toastText = toastSpy.mock.calls.map(([message]) => message).join(' ')
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(toastText).toContain('终末质控')
    expect(toastText).toContain('病案首页')
    expect(store.get(recordId)?.status).toBe('signed')

    manager.dispose()
  })
})