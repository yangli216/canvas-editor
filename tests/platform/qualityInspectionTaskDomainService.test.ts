import { describe, expect, it, vi } from 'vitest'
import {
  QualityInspectionTaskDomainService,
  buildQualityStandardCenterViewModel,
  buildQualityTaskCenterViewModel,
  type IQualityRulePackage
} from '@/platform/emr-workbench'

describe('QualityInspectionTaskDomainService', () => {
  it('生成全检、专项质控任务并支持分派领取复核', () => {
    const service = new QualityInspectionTaskDomainService()
    const dateNow = vi.spyOn(Date, 'now')
    dateNow.mockReturnValue(1000)

    const full = service.createTask({
      source: 'auto',
      title: '呼吸内科终末全检',
      strategy: 'full',
      scope: {
        departments: ['呼吸内科'],
        documentTypes: ['入院记录']
      },
      documentIds: ['record-1', 'record-2'],
      createdBy: '质控办',
      dueAt: 2000
    })
    const special = service.createTask({
      source: 'special',
      title: '死亡病历专项质控',
      strategy: 'special',
      scope: {
        tags: ['死亡病历']
      },
      documentIds: ['record-3'],
      createdBy: '质控办'
    })

    service.assign(full.id, '质控员 A', '质控办')
    service.claim(full.id, '质控员 A')
    service.submitReview(full.id, '质控员 A')
    service.complete(full.id, '质控主任')

    expect(service.list().map(task => task.id)).toEqual([
      special.id,
      full.id
    ])

    const completedFull = service.get(full.id)
    expect(completedFull.status).toBe('completed')
    expect(completedFull.assignee).toBe('质控员 A')
    expect(completedFull.reviewer).toBe('质控主任')

    dateNow.mockRestore()
  })
})

describe('buildQualityTaskCenterViewModel', () => {
  it('汇总逾期待分派任务并转换列表文案', () => {
    const service = new QualityInspectionTaskDomainService()
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    const task = service.createTask({
      source: 'auto',
      title: '呼吸内科终末全检',
      strategy: 'full',
      scope: {
        departments: ['呼吸内科']
      },
      documentIds: ['record-1'],
      createdBy: '质控办',
      dueAt: 1000
    })

    const model = buildQualityTaskCenterViewModel({
      tasks: [task],
      now: 3000
    })

    expect(model.summary.taskCount).toBe(1)
    expect(model.summary.overdueCount).toBe(1)
    expect(model.items[0].statusText).toBe('待分派')
    expect(model.items[0].overdue).toBe(true)

    vi.restoreAllMocks()
  })
})

describe('buildQualityStandardCenterViewModel', () => {
  it('汇总已启用终末规则包和阻断规则数量', () => {
    const rulePackages: IQualityRulePackage[] = [
      {
        id: 'terminal-admission-quality',
        name: '终末入院记录质控',
        stage: 'terminal',
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
        ],
        version: '1.0.0',
        enabled: true,
        createdAt: 1000,
        updatedAt: 1000,
        createdBy: '质控办',
        updatedBy: '质控办'
      }
    ]

    const model = buildQualityStandardCenterViewModel({
      packages: rulePackages
    })

    expect(model.summary.packageCount).toBe(1)
    expect(model.summary.enabledCount).toBe(1)
    expect(model.summary.blockerRuleCount).toBe(1)
    expect(model.packages[0].statusText).toBe('已启用')
  })
})