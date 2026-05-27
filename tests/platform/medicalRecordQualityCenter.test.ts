import { describe, expect, it } from 'vitest'
import type {
  ITemplateDocumentRecord,
  ITemplateDocumentTraceEvent,
  ITemplateDocumentWritingSummary,
  ITemplateSchema
} from '@/editor'
import {
  buildMedicalRecordQualityViewModel,
  type IMedicalRecordQualityRulePackage,
  type IMedicalRecordQualityTraceDomain
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

function createRecord(
  input: Partial<ITemplateDocumentRecord>
): ITemplateDocumentRecord {
  const nextSchema = input.template?.snapshot ?? schema
  return {
    id: input.id ?? 'record-1',
    patientId: 'patient-001',
    encounterId: 'encounter-001',
    title: input.title ?? '入院记录',
    status: input.status ?? 'completed',
    createdAt: 1000,
    updatedAt: 2000,
    template: {
      id: nextSchema.id,
      name: nextSchema.name,
      version: nextSchema.version,
      boundAt: 1000,
      snapshot: nextSchema,
      ...input.template
    },
    content: {
      flatValues: {},
      ...input.content
    },
    migrationHistory: [],
    traceEvents: input.traceEvents ?? []
  }
}

function createTrace(
  input: Partial<ITemplateDocumentTraceEvent>
): ITemplateDocumentTraceEvent {
  return {
    id: input.id ?? 'trace-1',
    action: input.action ?? 'writing_save',
    timestamp: input.timestamp ?? 2000,
    operator: input.operator ?? '王医生',
    title: input.title ?? '保存病历内容',
    templateId: schema.id,
    templateVersion: schema.version,
    ...input
  }
}

function createDomain(
  summaries: Record<string, Partial<ITemplateDocumentWritingSummary>>,
  timelines: Record<string, ITemplateDocumentTraceEvent[]>
): IMedicalRecordQualityTraceDomain {
  return {
    getWritingSummary: id => {
      const summary = summaries[id]
      if (!summary) return null
      return {
        documentId: id,
        status: 'completed',
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
    getTraceTimeline: id => timelines[id] ?? []
  }
}

describe('medical record quality center view model', () => {
  it('汇总病历必填缺失、签名缺失和归档前阻断项', () => {
    const record = createRecord({
      id: 'record-blocked',
      content: {
        flatValues: {
          chiefComplaint: '',
          diagnosis: '肺炎'
        }
      }
    })
    const domain = createDomain({
      'record-blocked': {
        lastWrittenAt: 2000,
        writers: ['王医生'],
        signCount: 0,
        reviewCount: 0
      }
    }, {
      'record-blocked': [createTrace({
        action: 'writing_save',
        metadata: { department: '呼吸内科' }
      })]
    })

    const model = buildMedicalRecordQualityViewModel({
      documents: [record],
      domain
    })

    expect(model.summary.documentCount).toBe(1)
    expect(model.summary.blockerDocumentCount).toBe(1)
    expect(model.summary.pendingArchiveCount).toBe(1)
    expect(model.items[0].riskLevel).toBe('blocker')
    expect(model.items[0].departmentText).toBe('呼吸内科')
    expect(model.items[0].ownerText).toBe('王医生')
    expect(model.items[0].issues.map(issue => issue.category)).toContain('必填字段')
    expect(model.items[0].issues.map(issue => issue.category)).toContain('签名复核')
    expect(model.items[0].issues.map(issue => issue.category)).toContain('归档前检查')
  })

  it('将书写中问题标记为警告并按风险排序', () => {
    const warningRecord = createRecord({
      id: 'record-warning',
      status: 'draft',
      content: {
        flatValues: {
          chiefComplaint: '',
          diagnosis: '肺炎'
        }
      }
    })
    const passedRecord = createRecord({
      id: 'record-passed',
      status: 'archived',
      content: {
        flatValues: {
          chiefComplaint: '咳嗽三天',
          diagnosis: '肺炎'
        }
      }
    })
    const domain = createDomain({
      'record-warning': {
        lastWrittenAt: 3000,
        writers: ['李医生']
      },
      'record-passed': {
        lastWrittenAt: 4000,
        writers: ['赵医生'],
        signCount: 1,
        reviewCount: 1
      }
    }, {
      'record-warning': [createTrace({ action: 'autosave', timestamp: 3000 })],
      'record-passed': [
        createTrace({ action: 'writing_save', timestamp: 4000 }),
        createTrace({ action: 'sign', timestamp: 4100 }),
        createTrace({ action: 'review', timestamp: 4200 })
      ]
    })

    const model = buildMedicalRecordQualityViewModel({
      documents: [passedRecord, warningRecord],
      domain
    })

    expect(model.summary.warningDocumentCount).toBe(1)
    expect(model.summary.archivedCount).toBe(1)
    expect(model.items.map(item => item.id)).toEqual([
      'record-warning',
      'record-passed'
    ])
    expect(model.items[0].riskLevel).toBe('warning')
    expect(model.items[0].stageText).toBe('书写中质控')
    expect(model.items[1].riskLevel).toBe('info')
  })

  it('汇总规则异常、数据绑定缺口并生成筛选维度', () => {
    const schemaWithGaps: ITemplateSchema = {
      ...schema,
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
              id: 'operationPlan',
              type: 'textarea',
              label: '手术计划',
              rules: [{
                type: 'required',
                condition: {
                  field: 'missingDiagnosis',
                  operator: 'equals',
                  value: '手术'
                }
              }]
            }
          ]
        }
      ]
    }
    const record = createRecord({
      id: 'record-schema-gap',
      template: {
        id: schemaWithGaps.id,
        name: schemaWithGaps.name,
        version: schemaWithGaps.version,
        boundAt: 1000,
        snapshot: schemaWithGaps
      },
      content: {
        flatValues: {
          chiefComplaint: '胸闷',
          operationPlan: ''
        }
      }
    })
    const domain = createDomain({
      'record-schema-gap': {
        lastWrittenAt: 5000,
        writers: ['陈医生'],
        signCount: 0,
        reviewCount: 0
      }
    }, {
      'record-schema-gap': [createTrace({
        action: 'writing_save',
        timestamp: 5000,
        metadata: { department: '心内科' }
      })]
    })

    const model = buildMedicalRecordQualityViewModel({
      documents: [record],
      domain
    })

    const categories = model.items[0].issues.map(issue => issue.category)
    expect(categories).toContain('规则异常')
    expect(categories).toContain('数据绑定缺口')
    expect(model.filterOptions.departments).toEqual(['心内科'])
    expect(model.filterOptions.documentTypes).toEqual(['入院记录'])
    expect(model.filterOptions.owners).toEqual(['陈医生'])
    expect(model.filterOptions.statuses.map(item => item.value)).toContain('completed')
  })

  it('支持按科室和文书类型配置内容质控与时限质控规则', () => {
    const threeHours = 3 * 60 * 60 * 1000
    const fourHours = 4 * 60 * 60 * 1000
    const rulePackages: IMedicalRecordQualityRulePackage[] = [
      {
        id: 'respiratory-admission-quality',
        name: '呼吸内科入院记录质控规则',
        target: {
          departments: ['呼吸内科'],
          documentTypes: ['入院记录']
        },
        contentRules: [
          {
            id: 'chief-complaint-quality',
            name: '主诉内容完整性',
            level: 'blocker',
            fieldId: 'chiefComplaint',
            minLength: 10,
            requiredKeywords: ['咳嗽'],
            forbiddenKeywords: ['待补'],
            actionHint: '补齐主诉发生时间、症状和持续时间'
          }
        ],
        timelinessRules: [
          {
            id: 'first-writing-within-2h',
            name: '2 小时内完成首次书写',
            level: 'warning',
            targetTime: 'firstWrittenAt',
            withinHours: 2,
            actionHint: '请质控人员确认首次病程书写是否超时'
          }
        ]
      }
    ]
    const record = createRecord({
      id: 'record-configured-rules',
      status: 'draft',
      createdAt: 0,
      updatedAt: threeHours,
      content: {
        flatValues: {
          chiefComplaint: '待补',
          diagnosis: '肺炎'
        }
      }
    })
    const domain = createDomain({
      'record-configured-rules': {
        firstWrittenAt: threeHours,
        lastWrittenAt: threeHours,
        writers: ['林医生']
      }
    }, {
      'record-configured-rules': [createTrace({
        action: 'writing_start',
        timestamp: threeHours,
        metadata: { department: '呼吸内科' }
      })]
    })

    const model = buildMedicalRecordQualityViewModel({
      documents: [record],
      domain,
      rulePackages,
      now: fourHours
    })

    const issues = model.items[0].issues
    expect(issues.map(issue => issue.category)).toContain('内容质控')
    expect(issues.map(issue => issue.category)).toContain('时限质控')
    expect(issues.some(issue => issue.message.includes('长度不足'))).toBe(true)
    expect(issues.some(issue => issue.message.includes('缺少关键词'))).toBe(true)
    expect(issues.some(issue => issue.message.includes('禁用描述'))).toBe(true)
    expect(issues.some(issue => issue.message.includes('超过 2 小时时限'))).toBe(true)
  })

  it('生成规则命中统计并评估规则变更影响', () => {
    const baselinePackages: IMedicalRecordQualityRulePackage[] = [
      {
        id: 'baseline-quality',
        name: '基线规则包',
        contentRules: [
          {
            id: 'chief-required-keyword',
            name: '主诉包含咳嗽',
            level: 'warning',
            fieldId: 'chiefComplaint',
            requiredKeywords: ['咳嗽'],
            message: '主诉缺少咳嗽关键词'
          }
        ]
      }
    ]
    const candidatePackages: IMedicalRecordQualityRulePackage[] = [
      ...baselinePackages,
      {
        id: 'candidate-quality',
        name: '候选规则包',
        contentRules: [
          {
            id: 'diagnosis-required-keyword',
            name: '诊断包含感染',
            level: 'blocker',
            fieldId: 'diagnosis',
            requiredKeywords: ['感染'],
            message: '诊断缺少感染关键词'
          }
        ]
      }
    ]
    const record = createRecord({
      id: 'record-impact',
      content: {
        flatValues: {
          chiefComplaint: '发热三天',
          diagnosis: '肺炎'
        }
      }
    })
    const domain = createDomain({
      'record-impact': {
        lastWrittenAt: 5000,
        writers: ['吴医生']
      }
    }, {
      'record-impact': [createTrace({
        action: 'writing_save',
        timestamp: 5000,
        metadata: { department: '呼吸内科' }
      })]
    })

    const model = buildMedicalRecordQualityViewModel({
      documents: [record],
      domain,
      rulePackages: baselinePackages,
      candidateRulePackages: candidatePackages,
      now: 6000
    })

    expect(model.analytics.hitStats.byCategory.some(item => item.label === '内容质控')).toBe(true)
    expect(model.analytics.hitStats.byRulePackage[0]?.key).toBe('baseline-quality')
    expect(model.analytics.hitStats.byRulePackage[0]?.hitCount).toBeGreaterThan(0)

    expect(model.analytics.impactAssessment?.newlyHitDocumentCount).toBe(1)
    expect(model.analytics.impactAssessment?.newlyHitBlockerIssueCount).toBe(1)
    expect(model.analytics.impactAssessment?.candidatePackageIds).toContain('candidate-quality')
    expect(model.analytics.impactAssessment?.newlyHitTemplateIds).toContain(schema.id)
  })
})
