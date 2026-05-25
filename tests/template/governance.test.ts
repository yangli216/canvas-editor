import { describe, expect, it } from 'vitest'
import {
  buildTemplateAdmissionReport,
  createMockHisAdapter,
  templateDataAdapterRegistry,
  type ITemplateSchema
} from '@/editor'
import type { ITemplateRegistryEntry } from '@/editor/template/TemplateRegistry'

function createEntry(schema: ITemplateSchema): ITemplateRegistryEntry {
  return {
    schema,
    category: '住院记录',
    builtIn: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'draft',
    versionHistory: [],
    asset: {
      department: '心内科',
      documentType: '入院记录',
      owner: '模板管理员'
    },
    trialRuns: [],
    auditLogs: []
  }
}

function createSchema(id: string): ITemplateSchema {
  return {
    version: '1.0.0',
    id,
    name: '准入测试模板',
    blocks: [
      {
        type: 'fieldRow',
        fields: [
          {
            id: 'patientName',
            type: 'text',
            label: '姓名',
            metadata: {
              businessCode: 'patient.name',
              dataSource: 'his.patient',
              exportPath: 'patient.name'
            }
          },
          {
            id: 'chiefComplaint',
            type: 'textarea',
            label: '主诉'
          }
        ]
      }
    ]
  }
}

describe('template governance admission report', () => {
  it('汇总资产、数据绑定、试运行和临床影响准入信息', () => {
    templateDataAdapterRegistry.register(createMockHisAdapter())
    const entry = createEntry(createSchema(`governance-${Date.now()}`))
    const report = buildTemplateAdmissionReport(entry, {
      documents: [
        {
          id: 'doc-001',
          status: 'draft',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          template: {
            id: entry.schema.id,
            version: '0.9.0',
            name: entry.schema.name,
            boundAt: Date.now(),
            snapshot: entry.schema
          },
          content: { flatValues: {} },
          migrationHistory: [],
          traceEvents: []
        }
      ]
    })

    expect(report.status).toBe('warning')
    expect(report.dataBindingCoverage).toBe(50)
    expect(report.clinicalImpact.boundDocumentCount).toBe(1)
    expect(report.issues.some(issue => issue.category === 'dataBinding')).toBe(true)
    expect(report.issues.some(issue => issue.category === 'trial')).toBe(true)
    expect(report.issues.some(issue => issue.category === 'clinicalImpact')).toBe(true)
  })

  it('最近一次试运行失败时会形成阻断项', () => {
    const entry = createEntry(createSchema(`governance-blocked-${Date.now()}`))
    entry.trialRuns.push({
      id: 'trial-001',
      scenario: '住院入院记录',
      status: 'failed',
      summary: '必填规则未通过',
      timestamp: Date.now()
    })

    const report = buildTemplateAdmissionReport(entry)

    expect(report.status).toBe('blocked')
    expect(report.blockerCount).toBe(1)
    expect(report.issues.some(issue => issue.category === 'trial')).toBe(true)
  })
})
