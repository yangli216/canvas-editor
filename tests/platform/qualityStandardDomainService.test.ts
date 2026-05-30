import { describe, expect, it } from 'vitest'
import {
  QualityStandardDomainService,
  type IQualityRulePackageInput
} from '@/platform/emr-workbench/domain'

describe('QualityStandardDomainService', () => {
  it('创建规则包版本并按场景和模板范围匹配', () => {
    const service = new QualityStandardDomainService()
    const operator = '张质控'
    const input: IQualityRulePackageInput = {
      id: 'terminal-admission-quality',
      name: '终末入院记录质控',
      stage: 'terminal',
      target: {
        departments: ['respiratory'],
        documentTypes: ['admission'],
        templateIds: ['admission-v1']
      },
      scoringPolicyId: 'terminal-policy',
      rules: [
        {
          id: 'missing-chief-complaint',
          name: '主诉缺失',
          category: '入院记录完整性',
          level: 'blocker',
          checkType: 'field',
          fieldId: 'chiefComplaint',
          deduction: 10,
          veto: true,
          actionHint: '补充主诉后再提交终末质控'
        }
      ]
    }

    const created = service.createRulePackage(input, operator)
    const matched = service.matchRulePackages({
      stage: 'terminal',
      department: 'respiratory',
      documentType: 'admission',
      templateId: 'admission-v1'
    })

    expect(created.version).toBe('1.0.0')
    expect(created.enabled).toBe(true)
    expect(created.createdBy).toBe(operator)
    expect(matched).toHaveLength(1)
    expect(matched[0].id).toBe('terminal-admission-quality')
    expect(matched[0].rules[0].veto).toBe(true)
  })

  it('按病历状态限制规则包匹配范围', () => {
    const service = new QualityStandardDomainService()
    const input: IQualityRulePackageInput = {
      id: 'signed-record-quality',
      name: '已签名病历质控',
      stage: 'terminal',
      target: {
        statuses: ['signed']
      },
      rules: [
        {
          id: 'signed-record-homepage-check',
          name: '已签名病案首页复核',
          category: '病案首页',
          level: 'serious',
          checkType: 'homepage',
          deduction: 6,
          actionHint: '复核签名后病案首页关键字段'
        }
      ]
    }

    service.createRulePackage(input)

    expect(
      service.matchRulePackages({
        stage: 'terminal',
        status: 'completed'
      })
    ).toHaveLength(0)
    expect(
      service.matchRulePackages({
        stage: 'terminal',
        status: 'signed'
      })
    ).toHaveLength(1)
  })

  it('停用规则包后生成新 patch 版本并从匹配结果移除', () => {
    const service = new QualityStandardDomainService()
    service.createRulePackage({
      id: 'writing-basic-quality',
      name: '书写中基础质控',
      stage: 'writing',
      rules: [
        {
          id: 'empty-diagnosis',
          name: '诊断为空',
          category: '诊断完整性',
          level: 'serious',
          checkType: 'field',
          fieldId: 'diagnosis',
          deduction: 8,
          actionHint: '补充诊断内容'
        }
      ]
    })

    const disabled = service.setRulePackageEnabled(
      'writing-basic-quality',
      false,
      '李质控'
    )
    const snapshots = service.getRulePackageSnapshots('writing-basic-quality')

    expect(disabled.version).toBe('1.0.1')
    expect(disabled.enabled).toBe(false)
    expect(disabled.updatedBy).toBe('李质控')
    expect(snapshots).toHaveLength(2)
    expect(service.matchRulePackages({ stage: 'writing' })).toEqual([])
  })
})