import { describe, expect, it } from 'vitest'
import type { ITemplateDocumentRecord, ITemplateSchema } from '@/editor'
import type { IMedicalRecordQualityDefect } from '@/platform/emr-workbench/domain'
import { buildQualityAnalyticsCenterViewModel } from '@/platform/emr-workbench/modules'

const schema: ITemplateSchema = {
  id: 'quality-analytics-record',
  name: '质量分析病历',
  version: '1.0.0',
  blocks: []
}

interface IAnalyticsDocumentRecord extends ITemplateDocumentRecord {
  archived?: boolean
  departmentText?: string
  doctorText?: string
}

interface IAnalyticsDefect extends IMedicalRecordQualityDefect {
  department?: string
  overdue?: boolean
}

function createDocument(input: {
  id: string
  departmentText: string
  doctorText: string
  archived: boolean
}): IAnalyticsDocumentRecord {
  return {
    id: input.id,
    patientId: `${input.id}-patient`,
    encounterId: `${input.id}-encounter`,
    title: '入院记录',
    status: input.archived ? 'archived' : 'signed',
    archived: input.archived,
    departmentText: input.departmentText,
    doctorText: input.doctorText,
    createdAt: 0,
    updatedAt: 1000,
    template: {
      id: schema.id,
      name: schema.name,
      version: schema.version,
      boundAt: 0,
      snapshot: schema
    },
    content: {
      flatValues: {},
      structuredValues: {}
    },
    migrationHistory: [],
    traceEvents: []
  }
}

function createDefect(input: {
  id: string
  documentId: string
  owner: string
  department: string
  status: 'closed' | 'returned'
  overdue: boolean
}): IAnalyticsDefect {
  return {
    id: input.id,
    sourceIssueId: `${input.id}-issue`,
    documentId: input.documentId,
    documentTitle: '入院记录',
    templateId: schema.id,
    templateVersion: schema.version,
    templateText: `${schema.name} · v${schema.version}`,
    category: '终末质控',
    level: 'blocker',
    severity: 'blocker',
    levelText: '阻断',
    message: '终末质控缺陷',
    actionHint: '请整改后复核',
    owner: input.owner,
    department: input.department,
    status: input.status,
    statusText: input.status === 'closed' ? '复核已关闭' : '已退回医生',
    createdAt: 1000,
    updatedAt: 1200,
    returnCount: input.status === 'returned' ? 1 : 0,
    overdue: input.overdue,
    events: []
  }
}

describe('quality analytics center view model', () => {
  it('汇总终末质控覆盖率、缺陷闭环率、逾期率、A级率、归档准入通过率和风险排行', () => {
    const model = buildQualityAnalyticsCenterViewModel({
      documents: [
        createDocument({
          id: 'record-1',
          departmentText: '呼吸内科',
          doctorText: '王医生',
          archived: true
        }),
        createDocument({
          id: 'record-2',
          departmentText: '呼吸内科',
          doctorText: '李医生',
          archived: false
        })
      ],
      qualityResults: {
        'record-1': { conclusion: 'passed', score: 95, grade: 'A' },
        'record-2': { conclusion: 'blocked', score: 78, grade: 'C' }
      },
      defects: [
        createDefect({
          id: 'defect-1',
          documentId: 'record-1',
          owner: '王医生',
          department: '呼吸内科',
          status: 'closed',
          overdue: false
        }),
        createDefect({
          id: 'defect-2',
          documentId: 'record-2',
          owner: '李医生',
          department: '呼吸内科',
          status: 'returned',
          overdue: true
        })
      ],
      archiveItems: [
        { id: 'record-1', canArchive: true },
        { id: 'record-2', canArchive: false }
      ]
    })

    expect(model.summary.coverageRateText).toBe('100%')
    expect(model.summary.defectClosureRateText).toBe('50%')
    expect(model.summary.overdueRateText).toBe('50%')
    expect(model.summary.gradeARateText).toBe('50%')
    expect(model.summary.archivePassRateText).toBe('50%')
    expect(model.departmentRankings[0].name).toBe('呼吸内科')
    expect(model.doctorRankings.map(item => item.name)).toEqual(['李医生', '王医生'])
  })
})