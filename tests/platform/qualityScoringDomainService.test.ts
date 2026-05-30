import { describe, expect, it } from 'vitest'
import {
  QualityScoringDomainService,
  type IQualityRuleHit,
  type IQualityScoringPolicy
} from '@/platform/emr-workbench/domain'

describe('QualityScoringDomainService', () => {
  it('按命中规则扣分并给出预警结论', () => {
    const service = new QualityScoringDomainService()
    const hits: IQualityRuleHit[] = [
      {
        id: 'hit-chief-complaint',
        ruleId: 'missing-chief-complaint',
        ruleName: '主诉缺失',
        rulePackageId: 'writing-basic-quality',
        category: '入院记录完整性',
        level: 'normal',
        message: '主诉未填写',
        actionHint: '补充主诉',
        deduction: 5
      },
      {
        id: 'hit-diagnosis',
        ruleId: 'missing-diagnosis',
        ruleName: '诊断缺失',
        rulePackageId: 'writing-basic-quality',
        category: '诊断完整性',
        level: 'serious',
        message: '诊断未填写',
        actionHint: '补充诊断',
        deduction: 8
      }
    ]

    const result = service.scoreDocument('record-warning', hits)

    expect(result.score).toBe(87)
    expect(result.grade).toBe('B')
    expect(result.conclusion).toBe('warning')
    expect(result.details.map(detail => detail.ruleId)).toEqual([
      'missing-chief-complaint',
      'missing-diagnosis'
    ])
  })

  it('一票否决会降为 D 且病案首页分类扣分受封顶限制', () => {
    const service = new QualityScoringDomainService()
    const policy: IQualityScoringPolicy = {
      id: 'homepage-terminal-policy',
      baseScore: 100,
      gradeThresholds: { A: 90, B: 80, C: 70 },
      categoryMaxDeduction: {
        病案首页: 15
      }
    }
    const hits: IQualityRuleHit[] = [
      {
        id: 'hit-homepage-diagnosis',
        ruleId: 'homepage-main-diagnosis-error',
        ruleName: '主要诊断填写错误',
        rulePackageId: 'terminal-homepage-quality',
        category: '病案首页',
        level: 'blocker',
        message: '主要诊断与出院小结不一致',
        actionHint: '核对并修正病案首页主要诊断',
        deduction: 20,
        veto: true,
        fieldId: 'homepage.primaryDiagnosis',
        evidenceText: '出院诊断：肺炎；首页主要诊断：上呼吸道感染'
      }
    ]

    const result = service.scoreDocument('record-blocked', hits, policy)

    expect(result.details[0].deduction).toBe(15)
    expect(result.score).toBe(85)
    expect(result.grade).toBe('D')
    expect(result.conclusion).toBe('blocked')
  })

  it('同一分类多条命中累计达到封顶后截断扣分', () => {
    const service = new QualityScoringDomainService()
    const policy: IQualityScoringPolicy = {
      id: 'homepage-category-cap-policy',
      baseScore: 100,
      gradeThresholds: { A: 90, B: 80, C: 70 },
      categoryMaxDeduction: {
        病案首页: 15
      }
    }
    const hits: IQualityRuleHit[] = [
      {
        id: 'hit-homepage-diagnosis',
        ruleId: 'homepage-main-diagnosis-error',
        ruleName: '主要诊断填写错误',
        rulePackageId: 'terminal-homepage-quality',
        category: '病案首页',
        level: 'serious',
        message: '主要诊断与出院小结不一致',
        actionHint: '核对并修正病案首页主要诊断',
        deduction: 10
      },
      {
        id: 'hit-homepage-operation',
        ruleId: 'homepage-operation-missing',
        ruleName: '手术操作漏填',
        rulePackageId: 'terminal-homepage-quality',
        category: '病案首页',
        level: 'normal',
        message: '首页手术操作未同步',
        actionHint: '补充首页手术操作',
        deduction: 10
      }
    ]

    const result = service.scoreDocument('record-category-cap', hits, policy)

    expect(result.details.map(detail => detail.deduction)).toEqual([10, 5])
    expect(result.score).toBe(85)
  })
})