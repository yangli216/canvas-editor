import { describe, expect, it } from 'vitest'
import type {
  ITemplateDocumentRecord,
  ITemplateSchema
} from '@/editor'
import {
  QualityExecutionDomainService,
  QualityScoringDomainService,
  QualityStandardDomainService,
  type IQualityInspectionResult
} from '@/platform/emr-workbench/domain'
import {
  buildQualityScoringCenterViewModel
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
          metadata: {
            businessCode: 'notes.chiefComplaint',
            dataSource: 'emr.notes',
            exportPath: 'notes.chiefComplaint'
          }
        },
        {
          id: 'homepageCode',
          type: 'text',
          label: '病案首页编码',
          metadata: {
            businessCode: 'homepage.code',
            dataSource: 'his.homepage',
            exportPath: 'homepage.code'
          }
        }
      ]
    }
  ]
}

function createRecord(
  input: {
    chiefComplaint?: string | null
    homepageCode?: string | null
  } = {}
): ITemplateDocumentRecord {
  return {
    id: 'record-1',
    patientId: 'patient-001',
    encounterId: 'encounter-001',
    title: '入院记录',
    status: 'completed',
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
      flatValues: {
        chiefComplaint: input.chiefComplaint ?? '咳嗽三天',
        homepageCode: input.homepageCode ?? 'A001'
      }
    },
    migrationHistory: [],
    traceEvents: []
  }
}

describe('QualityExecutionDomainService', () => {
  it('执行终末质控并生成评分、等级、命中证据和结论', () => {
    const standard = new QualityStandardDomainService()
    const scoring = new QualityScoringDomainService()
    standard.createRulePackage({
      id: 'terminal-admission-quality',
      name: '终末入院记录质控',
      stage: 'terminal',
      target: {
        documentTypes: ['入院记录']
      },
      rules: [
        {
          id: 'chief-complaint-required',
          name: '主诉必填',
          category: '入院记录完整性',
          level: 'serious',
          checkType: 'field',
          fieldId: 'chiefComplaint',
          deduction: 5,
          actionHint: '补充主诉后再提交终末质控'
        },
        {
          id: 'homepage-code-required',
          name: '首页编码必填',
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

    const execution = new QualityExecutionDomainService(standard, scoring)
    const result = execution.inspectDocument({
      record: createRecord({ chiefComplaint: '', homepageCode: '' }),
      stage: 'terminal',
      department: '呼吸内科',
      inspectedBy: '质控员'
    })

    expect(result.documentId).toBe('record-1')
    expect(result.stage).toBe('terminal')
    expect(result.hits.map(hit => hit.ruleId)).toEqual([
      'chief-complaint-required',
      'homepage-code-required'
    ])
    expect(result.score).toBe(85)
    expect(result.grade).toBe('D')
    expect(result.conclusion).toBe('blocked')
    expect(result.hits[0].fieldLabel).toBe('主诉')
  })
})

describe('buildQualityScoringCenterViewModel', () => {
  it('格式化单份病历评分摘要和扣分明细', () => {
    const result: IQualityInspectionResult = {
      id: 'inspection-1',
      documentId: 'record-1',
      stage: 'terminal',
      rulePackageIds: ['terminal-admission-quality'],
      issueIds: ['record-1:terminal-admission-quality:homepage-code-required'],
      hits: [],
      score: 90,
      grade: 'D',
      conclusion: 'blocked',
      details: [
        {
          hitId: 'record-1:terminal-admission-quality:homepage-code-required',
          ruleId: 'homepage-code-required',
          ruleName: '首页编码必填',
          category: '病案首页',
          deduction: 10,
          reason: '首页编码必填 未满足质控要求'
        }
      ],
      inspectedBy: '质控员',
      inspectedAt: 1000
    }

    const model = buildQualityScoringCenterViewModel(result)

    expect(model.scoreText).toBe('90 分')
    expect(model.gradeText).toBe('D 级')
    expect(model.conclusionText).toBe('阻断归档')
    expect(model.details[0].category).toBe('病案首页')
  })
})