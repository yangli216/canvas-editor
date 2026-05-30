# 病历质控体系化重构实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将病历质控从轻量 issue 生成器升级为可支撑医院临床验收的“质控标准 + 质控执行 + 缺陷闭环 + 质控运营”平台能力。

**架构：** 所有 HIS/EMR 业务逻辑留在 `src/platform/emr-workbench/`，编辑器内核不新增病历质控逻辑。新增标准、评分、执行、任务四个 domain service；新增质控标准、任务、评分、运营分析四个 platform module；保留并增强现有 `medical-record-quality-center`、`defect-center`、`archive-center` 和 `medical-record-operations-center`。

**技术栈：** TypeScript、Vitest、现有 platform module/view model 模式、现有 `TemplateDocumentStore`/`MedicalRecordDomainService` 病历事实模型、现有 DOM view 构建风格。

---

## 文件结构

### 新建文件

- `src/platform/emr-workbench/domain/quality-standard-domain-service.ts`
  - 质控规则包、规则版本、适用范围、启停、评分策略和规则快照。
- `src/platform/emr-workbench/domain/quality-scoring-domain-service.ts`
  - 根据规则命中计算得分、扣分明细、病历等级、一票否决和封顶扣分。
- `src/platform/emr-workbench/domain/quality-execution-domain-service.ts`
  - 执行环节、科室、终末、归档、专项质控，输出质控结果和缺陷来源。
- `src/platform/emr-workbench/domain/quality-inspection-task-domain-service.ts`
  - 管理全检、抽检、专项任务、分派、领取、复核和完成状态。
- `src/platform/emr-workbench/modules/quality-standard-center/index.ts`
  - 质控标准中心 module 入口和导出。
- `src/platform/emr-workbench/modules/quality-standard-center/service.ts`
  - 质控规则包、评分策略和启停治理 view model。
- `src/platform/emr-workbench/modules/quality-standard-center/view.ts`
  - 规则包和评分策略配置摘要视图。
- `src/platform/emr-workbench/modules/quality-task-center/index.ts`
  - 质控任务中心 module 入口和导出。
- `src/platform/emr-workbench/modules/quality-task-center/service.ts`
  - 质控任务队列、逾期、分派状态 view model。
- `src/platform/emr-workbench/modules/quality-task-center/view.ts`
  - 质控员任务工作台视图。
- `src/platform/emr-workbench/modules/quality-scoring-center/index.ts`
  - 单份病历评分中心 module 入口和导出。
- `src/platform/emr-workbench/modules/quality-scoring-center/service.ts`
  - 单份病历质控结论、得分、等级、扣分明细 view model。
- `src/platform/emr-workbench/modules/quality-scoring-center/view.ts`
  - 单份病历评分和扣分证据视图。
- `src/platform/emr-workbench/modules/quality-analytics-center/index.ts`
  - 质控运营分析中心 module 入口和导出。
- `src/platform/emr-workbench/modules/quality-analytics-center/service.ts`
  - 覆盖率、闭环率、逾期率、甲级率、归档合格率、科室/医生排名。
- `src/platform/emr-workbench/modules/quality-analytics-center/view.ts`
  - 运营指标和排行视图。
- `tests/platform/qualityStandardDomainService.test.ts`
  - 规则包版本、启停、适用范围、评分策略和影响评估输入测试。
- `tests/platform/qualityScoringDomainService.test.ts`
  - 扣分、一票否决、封顶扣分、等级计算测试。
- `tests/platform/qualityExecutionDomainService.test.ts`
  - 环节、终末、归档和专项质控执行结果测试。
- `tests/platform/qualityInspectionTaskDomainService.test.ts`
  - 全检、抽检、专项任务、分派、领取、复核测试。
- `tests/platform/qualityAnalyticsCenter.test.ts`
  - 质控覆盖率、闭环率、逾期率、甲级率、归档合格率和排行测试。
- `tests/platform/medicalRecordQualityWorkflowV2.test.ts`
  - 覆盖“提交 -> 任务生成 -> 退回整改 -> 终末评分 -> 归档阻断 -> 运营统计”。

### 修改文件

- `src/platform/emr-workbench/domain/index.ts`
  - 导出新增 domain service 与类型。
- `src/platform/emr-workbench/domain/medical-record-defect-domain-service.ts`
  - 扩展缺陷严重程度、SLA、逾期、二次退回、申诉和来源任务/结果。
- `src/platform/emr-workbench/modules/index.ts`
  - 导出新增四个质控模块与类型。
- `src/platform/emr-workbench/modules/medical-record-quality-center/service.ts`
  - 保持现有 issue 生成兼容，增加向新执行结果/评分结论的桥接字段。
- `src/platform/emr-workbench/modules/defect-center/service.ts`
  - 展示 SLA、逾期、二次退回、申诉状态和缺陷来源。
- `src/platform/emr-workbench/modules/defect-center/view.ts`
  - 在缺陷列表中展示 SLA、逾期、申诉和二次退回标签。
- `src/platform/emr-workbench/modules/archive-center/service.ts`
  - 接入终末质控结论、病案首页、编码质量和资料完整性归档准入。
- `src/platform/emr-workbench/modules/medical-record-operations-center/service.ts`
  - 整合质控任务队列、逾期整改和归档阻断原因。
- `docs/下一阶段迭代工作Todolist.md`
  - 记录 P4 病历质控体系化重构进展。

## 任务 1：建立质控标准与评分底座

**文件：**
- 创建：`src/platform/emr-workbench/domain/quality-standard-domain-service.ts`
- 创建：`src/platform/emr-workbench/domain/quality-scoring-domain-service.ts`
- 修改：`src/platform/emr-workbench/domain/index.ts`
- 测试：`tests/platform/qualityStandardDomainService.test.ts`
- 测试：`tests/platform/qualityScoringDomainService.test.ts`

- [ ] **步骤 1：编写失败的标准库测试**

```ts
import { describe, expect, it } from 'vitest'
import {
  QualityStandardDomainService,
  type IQualityRulePackageInput
} from '@/platform/emr-workbench/domain'

describe('QualityStandardDomainService', () => {
  it('创建规则包版本并按阶段、科室和文书类型匹配规则', () => {
    const service = new QualityStandardDomainService()
    const input: IQualityRulePackageInput = {
      id: 'terminal-admission-quality',
      name: '终末入院记录质控',
      stage: 'terminal',
      target: {
        departments: ['呼吸内科'],
        documentTypes: ['入院记录']
      },
      scoringPolicyId: 'standard-100',
      rules: [
        {
          id: 'homepage-required',
          name: '病案首页必须完整',
          category: '病案首页',
          level: 'blocker',
          checkType: 'homepage',
          deduction: 10,
          veto: true,
          actionHint: '请补齐病案首页后再归档'
        }
      ]
    }

    const created = service.createRulePackage(input, '质控办')
    const matched = service.matchRulePackages({
      stage: 'terminal',
      department: '呼吸内科',
      documentType: '入院记录',
      templateId: 'tpl-admission'
    })

    expect(created.version).toBe('1.0.0')
    expect(created.enabled).toBe(true)
    expect(created.createdBy).toBe('质控办')
    expect(matched.map(item => item.id)).toEqual(['terminal-admission-quality'])
    expect(matched[0].rules[0].veto).toBe(true)
  })

  it('停用规则包后生成新版本并保留版本快照', () => {
    const service = new QualityStandardDomainService()
    service.createRulePackage({
      id: 'writing-quality',
      name: '环节质控',
      stage: 'writing',
      rules: [
        {
          id: 'chief-complaint-required',
          name: '主诉必填',
          category: '基础完整性',
          level: 'serious',
          checkType: 'field',
          fieldId: 'chiefComplaint',
          deduction: 5,
          actionHint: '请补录主诉'
        }
      ]
    })

    const disabled = service.setRulePackageEnabled('writing-quality', false, '质控办')

    expect(disabled?.enabled).toBe(false)
    expect(disabled?.version).toBe('1.0.1')
    expect(service.getRulePackageSnapshots('writing-quality')).toHaveLength(2)
    expect(service.matchRulePackages({ stage: 'writing' })).toEqual([])
  })
})
```

- [ ] **步骤 2：运行标准库测试验证失败**

运行：`npx vitest run tests/platform/qualityStandardDomainService.test.ts --threads=false`

预期：FAIL，报错包含 `No matching export in ... domain` 或 `QualityStandardDomainService` 未导出。

- [ ] **步骤 3：编写最少标准库实现**

```ts
export type QualityRuleStage = 'writing' | 'department' | 'terminal' | 'archive' | 'special'
export type QualityRuleLevel = 'blocker' | 'serious' | 'normal' | 'info'
export type QualityRuleCheckType = 'field' | 'content' | 'timeliness' | 'consistency' | 'homepage' | 'coding' | 'attachment'

export interface IQualityRuleTarget {
  departments?: string[]
  documentTypes?: string[]
  templateIds?: string[]
}

export interface IQualityRule {
  id: string
  name: string
  category: string
  level: QualityRuleLevel
  checkType: QualityRuleCheckType
  fieldId?: string
  businessCode?: string
  expression?: string
  deduction?: number
  maxDeduction?: number
  veto?: boolean
  actionHint: string
}

export interface IQualityRulePackageInput {
  id: string
  name: string
  stage: QualityRuleStage
  target?: IQualityRuleTarget
  scoringPolicyId?: string
  rules: IQualityRule[]
}

export interface IQualityRulePackage extends IQualityRulePackageInput {
  version: string
  enabled: boolean
  createdAt: number
  updatedAt: number
  createdBy: string
  updatedBy: string
}

export interface IQualityRuleMatchContext {
  stage: QualityRuleStage
  department?: string
  documentType?: string
  templateId?: string
}

function cloneRulePackage(rulePackage: IQualityRulePackage) {
  return JSON.parse(JSON.stringify(rulePackage)) as IQualityRulePackage
}

function bumpPatchVersion(version: string) {
  const [major, minor, patch] = version.split('.').map(Number)
  return [major || 1, minor || 0, (patch || 0) + 1].join('.')
}

function matchesTarget(target: IQualityRuleTarget | undefined, context: IQualityRuleMatchContext) {
  if (!target) return true
  if (target.departments?.length && !context.department) return false
  if (target.departments?.length && !target.departments.includes(context.department)) return false
  if (target.documentTypes?.length && !context.documentType) return false
  if (target.documentTypes?.length && !target.documentTypes.includes(context.documentType)) return false
  if (target.templateIds?.length && !context.templateId) return false
  if (target.templateIds?.length && !target.templateIds.includes(context.templateId)) return false
  return true
}

export class QualityStandardDomainService {
  private readonly packages = new Map<string, IQualityRulePackage>()
  private readonly snapshots = new Map<string, IQualityRulePackage[]>()

  createRulePackage(input: IQualityRulePackageInput, operator = '质控管理员') {
    const now = Date.now()
    const rulePackage: IQualityRulePackage = {
      ...input,
      version: '1.0.0',
      enabled: true,
      createdAt: now,
      updatedAt: now,
      createdBy: operator,
      updatedBy: operator
    }
    this.packages.set(input.id, rulePackage)
    this.snapshots.set(input.id, [cloneRulePackage(rulePackage)])
    return cloneRulePackage(rulePackage)
  }

  setRulePackageEnabled(id: string, enabled: boolean, operator = '质控管理员') {
    const current = this.packages.get(id)
    if (!current) return null
    const next: IQualityRulePackage = {
      ...current,
      enabled,
      version: bumpPatchVersion(current.version),
      updatedAt: Date.now(),
      updatedBy: operator
    }
    this.packages.set(id, next)
    this.snapshots.set(id, [...(this.snapshots.get(id) ?? []), cloneRulePackage(next)])
    return cloneRulePackage(next)
  }

  matchRulePackages(context: IQualityRuleMatchContext) {
    return Array.from(this.packages.values())
      .filter(item => item.enabled)
      .filter(item => item.stage === context.stage)
      .filter(item => matchesTarget(item.target, context))
      .map(cloneRulePackage)
  }

  getRulePackageSnapshots(id: string) {
    return (this.snapshots.get(id) ?? []).map(cloneRulePackage)
  }

  listRulePackages() {
    return Array.from(this.packages.values()).map(cloneRulePackage)
  }
}
```

- [ ] **步骤 4：导出标准库服务**

在 `src/platform/emr-workbench/domain/index.ts` 追加导出：

```ts
export {
  QualityStandardDomainService,
  type IQualityRule,
  type IQualityRuleMatchContext,
  type IQualityRulePackage,
  type IQualityRulePackageInput,
  type IQualityRuleTarget,
  type QualityRuleCheckType,
  type QualityRuleLevel,
  type QualityRuleStage
} from './quality-standard-domain-service'
```

- [ ] **步骤 5：运行标准库测试验证通过**

运行：`npx vitest run tests/platform/qualityStandardDomainService.test.ts --threads=false`

预期：PASS，输出包含 `2 passed`。

- [ ] **步骤 6：编写失败的评分测试**

```ts
import { describe, expect, it } from 'vitest'
import {
  QualityScoringDomainService,
  type IQualityRuleHit
} from '@/platform/emr-workbench/domain'

describe('QualityScoringDomainService', () => {
  it('按扣分明细计算得分和病历等级', () => {
    const service = new QualityScoringDomainService()
    const hits: IQualityRuleHit[] = [
      {
        id: 'hit-1',
        ruleId: 'chief-complaint-required',
        ruleName: '主诉必填',
        rulePackageId: 'terminal-admission-quality',
        category: '基础完整性',
        level: 'serious',
        message: '主诉未填写',
        actionHint: '请补录主诉',
        deduction: 5,
        fieldId: 'chiefComplaint'
      },
      {
        id: 'hit-2',
        ruleId: 'diagnosis-coding',
        ruleName: '诊断编码规范',
        rulePackageId: 'terminal-admission-quality',
        category: '编码质量',
        level: 'normal',
        message: '诊断缺少 ICD 编码',
        actionHint: '请补齐诊断编码',
        deduction: 8
      }
    ]

    const result = service.score({ documentId: 'record-1', hits })

    expect(result.score).toBe(87)
    expect(result.grade).toBe('B')
    expect(result.conclusion).toBe('warning')
    expect(result.details.map(item => item.ruleId)).toEqual([
      'chief-complaint-required',
      'diagnosis-coding'
    ])
  })

  it('支持一票否决和分类封顶扣分', () => {
    const service = new QualityScoringDomainService()
    const result = service.score({
      documentId: 'record-2',
      policy: {
        id: 'standard-100',
        baseScore: 100,
        gradeThresholds: { A: 90, B: 80, C: 70 },
        categoryMaxDeduction: { 病案首页: 15 }
      },
      hits: [
        {
          id: 'hit-1',
          ruleId: 'homepage-required',
          ruleName: '病案首页必须完整',
          rulePackageId: 'archive-quality',
          category: '病案首页',
          level: 'blocker',
          message: '病案首页缺失',
          actionHint: '请补齐病案首页',
          deduction: 20,
          veto: true
        }
      ]
    })

    expect(result.score).toBe(85)
    expect(result.grade).toBe('D')
    expect(result.conclusion).toBe('blocked')
    expect(result.details[0].deduction).toBe(15)
  })
})
```

- [ ] **步骤 7：运行评分测试验证失败**

运行：`npx vitest run tests/platform/qualityScoringDomainService.test.ts --threads=false`

预期：FAIL，报错包含 `QualityScoringDomainService` 未导出。

- [ ] **步骤 8：编写最少评分实现**

```ts
import type { QualityRuleLevel } from './quality-standard-domain-service'

export type QualityScoreGrade = 'A' | 'B' | 'C' | 'D'
export type QualityInspectionConclusion = 'passed' | 'warning' | 'blocked'

export interface IQualityScoringPolicy {
  id: string
  baseScore: number
  gradeThresholds: { A: number; B: number; C: number }
  categoryMaxDeduction?: Record<string, number>
}

export interface IQualityRuleHit {
  id: string
  ruleId: string
  ruleName: string
  rulePackageId: string
  category: string
  level: QualityRuleLevel
  message: string
  actionHint: string
  deduction?: number
  veto?: boolean
  fieldId?: string
  fieldLabel?: string
  evidenceText?: string
}

export interface IQualityScoreDetail {
  hitId: string
  ruleId: string
  ruleName: string
  category: string
  deduction: number
  reason: string
  fieldId?: string
  evidenceText?: string
}

export interface IQualityScoreResult {
  documentId: string
  score: number
  grade: QualityScoreGrade
  conclusion: QualityInspectionConclusion
  details: IQualityScoreDetail[]
}

const DEFAULT_POLICY: IQualityScoringPolicy = {
  id: 'default-100',
  baseScore: 100,
  gradeThresholds: { A: 90, B: 80, C: 70 }
}

function resolveGrade(score: number, veto: boolean, policy: IQualityScoringPolicy): QualityScoreGrade {
  if (veto) return 'D'
  if (score >= policy.gradeThresholds.A) return 'A'
  if (score >= policy.gradeThresholds.B) return 'B'
  if (score >= policy.gradeThresholds.C) return 'C'
  return 'D'
}

function resolveConclusion(hits: IQualityRuleHit[], grade: QualityScoreGrade): QualityInspectionConclusion {
  if (hits.some(hit => hit.level === 'blocker') || grade === 'D') return 'blocked'
  if (hits.length) return 'warning'
  return 'passed'
}

export class QualityScoringDomainService {
  score(args: {
    documentId: string
    hits: IQualityRuleHit[]
    policy?: IQualityScoringPolicy
  }): IQualityScoreResult {
    const policy = args.policy ?? DEFAULT_POLICY
    const categoryTotals = new Map<string, number>()
    const details = args.hits.map(hit => {
      const rawDeduction = hit.deduction ?? 0
      const current = categoryTotals.get(hit.category) ?? 0
      const max = policy.categoryMaxDeduction?.[hit.category]
      const deduction = max == null
        ? rawDeduction
        : Math.max(0, Math.min(rawDeduction, max - current))
      categoryTotals.set(hit.category, current + deduction)
      return {
        hitId: hit.id,
        ruleId: hit.ruleId,
        ruleName: hit.ruleName,
        category: hit.category,
        deduction,
        reason: hit.message,
        fieldId: hit.fieldId,
        evidenceText: hit.evidenceText
      }
    })
    const totalDeduction = details.reduce((sum, item) => sum + item.deduction, 0)
    const score = Math.max(0, policy.baseScore - totalDeduction)
    const veto = args.hits.some(hit => hit.veto)
    const grade = resolveGrade(score, veto, policy)
    return {
      documentId: args.documentId,
      score,
      grade,
      conclusion: resolveConclusion(args.hits, grade),
      details
    }
  }
}
```

- [ ] **步骤 9：导出评分服务**

在 `src/platform/emr-workbench/domain/index.ts` 追加导出：

```ts
export {
  QualityScoringDomainService,
  type IQualityRuleHit,
  type IQualityScoreDetail,
  type IQualityScoreResult,
  type IQualityScoringPolicy,
  type QualityInspectionConclusion,
  type QualityScoreGrade
} from './quality-scoring-domain-service'
```

- [ ] **步骤 10：运行任务 1 测试验证通过**

运行：`npx vitest run tests/platform/qualityStandardDomainService.test.ts tests/platform/qualityScoringDomainService.test.ts --threads=false`

预期：PASS，输出包含 `2 passed` 测试文件。

- [ ] **步骤 11：Commit**

```bash
git add \
  tests/platform/qualityStandardDomainService.test.ts \
  tests/platform/qualityScoringDomainService.test.ts \
  src/platform/emr-workbench/domain/quality-standard-domain-service.ts \
  src/platform/emr-workbench/domain/quality-scoring-domain-service.ts \
  src/platform/emr-workbench/domain/index.ts
git commit -m "feat: add medical record quality standards and scoring"
```

## 任务 2：建立质控执行服务与单份病历评分中心

**文件：**
- 创建：`src/platform/emr-workbench/domain/quality-execution-domain-service.ts`
- 创建：`src/platform/emr-workbench/modules/quality-scoring-center/index.ts`
- 创建：`src/platform/emr-workbench/modules/quality-scoring-center/service.ts`
- 创建：`src/platform/emr-workbench/modules/quality-scoring-center/view.ts`
- 修改：`src/platform/emr-workbench/domain/index.ts`
- 修改：`src/platform/emr-workbench/modules/index.ts`
- 测试：`tests/platform/qualityExecutionDomainService.test.ts`

- [ ] **步骤 1：编写失败的执行服务测试**

```ts
import { describe, expect, it } from 'vitest'
import type { ITemplateDocumentRecord, ITemplateSchema } from '@/editor'
import {
  QualityExecutionDomainService,
  QualityScoringDomainService,
  QualityStandardDomainService
} from '@/platform/emr-workbench/domain'
import { buildQualityScoringCenterViewModel } from '@/platform/emr-workbench/modules'

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
          id: 'homepageCode',
          type: 'input',
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

function createRecord(flatValues: Record<string, string>): ITemplateDocumentRecord {
  return {
    id: 'record-1',
    patientId: 'patient-1',
    encounterId: 'encounter-1',
    title: '入院记录',
    status: 'signed',
    createdAt: 0,
    updatedAt: 1000,
    template: {
      id: schema.id,
      name: schema.name,
      version: schema.version,
      boundAt: 0,
      snapshot: schema
    },
    content: { flatValues },
    migrationHistory: [],
    traceEvents: []
  }
}

describe('QualityExecutionDomainService', () => {
  it('执行终末质控并生成评分、等级、命中证据和结论', () => {
    const standard = new QualityStandardDomainService()
    standard.createRulePackage({
      id: 'terminal-admission-quality',
      name: '终末入院记录质控',
      stage: 'terminal',
      target: { documentTypes: ['入院记录'] },
      rules: [
        {
          id: 'chief-complaint-required',
          name: '主诉必填',
          category: '基础完整性',
          level: 'serious',
          checkType: 'field',
          fieldId: 'chiefComplaint',
          deduction: 5,
          actionHint: '请补录主诉'
        },
        {
          id: 'homepage-code-required',
          name: '病案首页编码必填',
          category: '病案首页',
          level: 'blocker',
          checkType: 'homepage',
          businessCode: 'homepage.code',
          deduction: 10,
          veto: true,
          actionHint: '请补齐病案首页编码'
        }
      ]
    })
    const execution = new QualityExecutionDomainService(
      standard,
      new QualityScoringDomainService()
    )

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

  it('构建单份病历评分中心模型', () => {
    const result = {
      id: 'quality-result:record-1:terminal',
      documentId: 'record-1',
      stage: 'terminal' as const,
      rulePackageIds: ['terminal-admission-quality'],
      issueIds: ['hit-1'],
      hits: [],
      score: 90,
      grade: 'D' as const,
      conclusion: 'blocked' as const,
      details: [
        {
          hitId: 'hit-1',
          ruleId: 'homepage-code-required',
          ruleName: '病案首页编码必填',
          category: '病案首页',
          deduction: 10,
          reason: '病案首页编码未满足质控要求',
          fieldId: 'homepageCode'
        }
      ],
      inspectedBy: '质控员',
      inspectedAt: 1000
    }

    const model = buildQualityScoringCenterViewModel({ result })

    expect(model.summary.scoreText).toBe('90 分')
    expect(model.summary.gradeText).toBe('D 级')
    expect(model.summary.conclusionText).toBe('阻断归档')
    expect(model.details[0].category).toBe('病案首页')
  })
})
```

- [ ] **步骤 2：运行执行服务测试验证失败**

运行：`npx vitest run tests/platform/qualityExecutionDomainService.test.ts --threads=false`

预期：FAIL，报错包含 `QualityExecutionDomainService` 或 `buildQualityScoringCenterViewModel` 未导出。

- [ ] **步骤 3：实现执行服务**

实现 `QualityExecutionDomainService.inspectDocument()`：

```ts
const packages = this.standardDomain.matchRulePackages({
  stage: args.stage,
  department: args.department,
  documentType: args.record.template.snapshot.name || args.record.template.name,
  templateId: args.record.template.id
})
const hits = packages.flatMap(rulePackage => (
  rulePackage.rules
    .map(rule => buildHit(args.record, rulePackage, rule))
    .filter((hit): hit is IQualityRuleHit => Boolean(hit))
))
const score = this.scoringDomain.score({ documentId: args.record.id, hits })
return {
  id: `quality-result:${args.record.id}:${args.stage}`,
  taskId: args.taskId,
  documentId: args.record.id,
  stage: args.stage,
  rulePackageIds: packages.map(item => item.id),
  issueIds: hits.map(hit => hit.id),
  hits,
  score: score.score,
  grade: score.grade,
  conclusion: score.conclusion,
  details: score.details,
  inspectedBy: args.inspectedBy ?? '质控系统',
  inspectedAt: args.now ?? Date.now()
}
```

`buildHit()` 使用 `buildTemplateFieldRuntimeIndex(record.template.snapshot)`，按 `rule.fieldId` 或 `rule.businessCode` 找字段；当字段值为空时生成 `IQualityRuleHit`，并写入 `fieldId`、`fieldLabel`、`deduction`、`veto`、`evidenceText`。

- [ ] **步骤 4：实现评分中心模块**

`buildQualityScoringCenterViewModel()` 返回：

```ts
return {
  summary: {
    documentId: args.result.documentId,
    scoreText: `${args.result.score} 分`,
    gradeText: `${args.result.grade} 级`,
    conclusionText: args.result.conclusion === 'blocked'
      ? '阻断归档'
      : args.result.conclusion === 'warning'
        ? '人工确认'
        : '质控通过',
    inspectedBy: args.result.inspectedBy,
    inspectedAtText: new Date(args.result.inspectedAt).toLocaleString()
  },
  details: args.result.details.map(detail => ({
    ruleId: detail.ruleId,
    ruleName: detail.ruleName,
    category: detail.category,
    deductionText: `${detail.deduction} 分`,
    reason: detail.reason,
    fieldText: detail.fieldId || '整份病历'
  }))
}
```

`createQualityScoringCenterView()` 使用 `tm-version-center__summary` 展示病历、得分、等级、结论，用 `tm-center-list` 展示扣分明细。

- [ ] **步骤 5：导出执行服务和评分中心模块**

在 `src/platform/emr-workbench/domain/index.ts` 导出：

```ts
export {
  QualityExecutionDomainService,
  type IQualityInspectionResult
} from './quality-execution-domain-service'
```

在 `src/platform/emr-workbench/modules/index.ts` 导出：

```ts
export {
  QualityScoringCenterModule,
  buildQualityScoringCenterViewModel,
  createQualityScoringCenterView,
  type IQualityScoringCenterViewModel
} from './quality-scoring-center'
```

- [ ] **步骤 6：运行任务 2 测试验证通过**

运行：`npx vitest run tests/platform/qualityExecutionDomainService.test.ts --threads=false`

预期：PASS，输出包含 `2 passed`。

- [ ] **步骤 7：Commit**

```bash
git add \
  tests/platform/qualityExecutionDomainService.test.ts \
  src/platform/emr-workbench/domain/quality-execution-domain-service.ts \
  src/platform/emr-workbench/domain/index.ts \
  src/platform/emr-workbench/modules/quality-scoring-center \
  src/platform/emr-workbench/modules/index.ts
git commit -m "feat: add medical record quality execution and scoring center"
```

## 任务 3：建立质控任务中心与规则标准中心

**文件：**
- 创建：`src/platform/emr-workbench/domain/quality-inspection-task-domain-service.ts`
- 创建：`src/platform/emr-workbench/modules/quality-task-center/index.ts`
- 创建：`src/platform/emr-workbench/modules/quality-task-center/service.ts`
- 创建：`src/platform/emr-workbench/modules/quality-task-center/view.ts`
- 创建：`src/platform/emr-workbench/modules/quality-standard-center/index.ts`
- 创建：`src/platform/emr-workbench/modules/quality-standard-center/service.ts`
- 创建：`src/platform/emr-workbench/modules/quality-standard-center/view.ts`
- 修改：`src/platform/emr-workbench/domain/index.ts`
- 修改：`src/platform/emr-workbench/modules/index.ts`
- 测试：`tests/platform/qualityInspectionTaskDomainService.test.ts`

- [ ] **步骤 1：编写失败的任务服务测试**

```ts
import { describe, expect, it } from 'vitest'
import { QualityInspectionTaskDomainService } from '@/platform/emr-workbench/domain'
import {
  buildQualityStandardCenterViewModel,
  buildQualityTaskCenterViewModel
} from '@/platform/emr-workbench/modules'

describe('QualityInspectionTaskDomainService', () => {
  it('生成全检、抽检和专项质控任务并支持分派领取复核', () => {
    const service = new QualityInspectionTaskDomainService()
    const full = service.createTask({
      source: 'auto',
      title: '呼吸内科终末全检',
      strategy: 'full',
      scope: { departments: ['呼吸内科'], documentTypes: ['入院记录'] },
      documentIds: ['record-1', 'record-2'],
      createdBy: '质控办',
      dueAt: 2000
    })
    const special = service.createTask({
      source: 'special',
      title: '死亡病历专项质控',
      strategy: 'special',
      scope: { tags: ['死亡病历'] },
      documentIds: ['record-3'],
      createdBy: '质控办'
    })

    service.assign(full.id, '质控员 A', '质控办')
    service.claim(full.id, '质控员 A')
    service.submitReview(full.id, '质控员 A')
    service.complete(full.id, '质控主任')

    expect(service.list().map(item => item.id)).toEqual([special.id, full.id])
    expect(service.get(full.id)?.status).toBe('completed')
    expect(service.get(full.id)?.assignee).toBe('质控员 A')
    expect(service.get(full.id)?.reviewer).toBe('质控主任')
  })

  it('构建任务中心模型并标记逾期任务', () => {
    const service = new QualityInspectionTaskDomainService()
    service.createTask({
      source: 'sampling',
      title: '科室抽检',
      strategy: 'sampling',
      scope: { departments: ['心内科'] },
      documentIds: ['record-1'],
      createdBy: '质控办',
      dueAt: 1000
    })

    const model = buildQualityTaskCenterViewModel({
      tasks: service.list(),
      now: 3000
    })

    expect(model.summary.taskCount).toBe(1)
    expect(model.summary.overdueCount).toBe(1)
    expect(model.items[0].statusText).toBe('待分派')
    expect(model.items[0].overdue).toBe(true)
  })

  it('构建质控标准中心模型', () => {
    const model = buildQualityStandardCenterViewModel({
      packages: [
        {
          id: 'pkg-1',
          name: '终末质控',
          stage: 'terminal',
          version: '1.0.0',
          enabled: true,
          createdAt: 1000,
          updatedAt: 1000,
          createdBy: '质控办',
          updatedBy: '质控办',
          rules: [
            {
              id: 'rule-1',
              name: '病案首页必填',
              category: '病案首页',
              level: 'blocker',
              checkType: 'homepage',
              actionHint: '补齐病案首页'
            }
          ]
        }
      ]
    })

    expect(model.summary.packageCount).toBe(1)
    expect(model.summary.enabledCount).toBe(1)
    expect(model.summary.blockerRuleCount).toBe(1)
    expect(model.packages[0].statusText).toBe('已启用')
  })
})
```

- [ ] **步骤 2：运行任务服务测试验证失败**

运行：`npx vitest run tests/platform/qualityInspectionTaskDomainService.test.ts --threads=false`

预期：FAIL，报错包含 `QualityInspectionTaskDomainService` 或新增模块未导出。

- [ ] **步骤 3：实现任务 domain service**

实现类型：

```ts
export type QualityInspectionTaskSource = 'auto' | 'sampling' | 'special' | 'manual' | 'archive'
export type QualityInspectionTaskStatus = 'pendingAssign' | 'pendingCheck' | 'checking' | 'pendingReview' | 'completed' | 'cancelled'
export type QualityInspectionStrategy = 'full' | 'sampling' | 'risk' | 'documentType' | 'special'

export interface IQualityInspectionScope {
  departments?: string[]
  doctors?: string[]
  documentTypes?: string[]
  templateIds?: string[]
  tags?: string[]
}
```

`QualityInspectionTaskDomainService` 需要提供 `createTask()`、`assign()`、`claim()`、`submitReview()`、`complete()`、`get()`、`list()`。状态流转：`pendingAssign -> pendingCheck -> checking -> pendingReview -> completed`。

- [ ] **步骤 4：实现任务中心 view model 与视图**

`buildQualityTaskCenterViewModel()` 摘要字段：`taskCount`、`pendingAssignCount`、`checkingCount`、`pendingReviewCount`、`completedCount`、`overdueCount`。任务行字段：`id`、`title`、`sourceText`、`strategyText`、`status`、`statusText`、`assigneeText`、`documentCount`、`overdue`、`dueText`。

`createQualityTaskCenterView()` 使用 `tm-version-center__summary` 展示摘要，用 `tm-center-list` 展示任务列表，逾期任务使用 `tm-center-badge--danger`。

- [ ] **步骤 5：实现标准中心 view model 与视图**

`buildQualityStandardCenterViewModel()` 摘要字段：`packageCount`、`enabledCount`、`disabledCount`、`blockerRuleCount`。规则包行字段：`id`、`name`、`version`、`stage`、`enabled`、`statusText`、`ruleCount`、`blockerRuleCount`、`scoringPolicyText`。

`createQualityStandardCenterView()` 使用 `tm-version-center__summary` 展示规则包数、启用数、停用数、阻断规则数，用 `tm-center-list` 展示规则包名称、版本、阶段、规则数和状态。

- [ ] **步骤 6：导出任务和标准模块**

在 `src/platform/emr-workbench/domain/index.ts` 导出任务 domain service 和类型；在 `src/platform/emr-workbench/modules/index.ts` 导出 `QualityTaskCenterModule`、`QualityStandardCenterModule`、对应 builder、view 和 view model 类型。

- [ ] **步骤 7：运行任务 3 测试验证通过**

运行：`npx vitest run tests/platform/qualityInspectionTaskDomainService.test.ts --threads=false`

预期：PASS，输出包含 `3 passed`。

- [ ] **步骤 8：Commit**

```bash
git add \
  tests/platform/qualityInspectionTaskDomainService.test.ts \
  src/platform/emr-workbench/domain/quality-inspection-task-domain-service.ts \
  src/platform/emr-workbench/domain/index.ts \
  src/platform/emr-workbench/modules/quality-task-center \
  src/platform/emr-workbench/modules/quality-standard-center \
  src/platform/emr-workbench/modules/index.ts
git commit -m "feat: add quality inspection tasks and standard center"
```

## 任务 4：增强缺陷 SLA、二次退回和申诉

**文件：**
- 修改：`src/platform/emr-workbench/domain/medical-record-defect-domain-service.ts`
- 修改：`src/platform/emr-workbench/modules/defect-center/service.ts`
- 修改：`src/platform/emr-workbench/modules/defect-center/view.ts`
- 测试：`tests/platform/medicalRecordDefectCenter.test.ts`

- [ ] **步骤 1：编写失败的缺陷 SLA 测试**

在 `tests/platform/medicalRecordDefectCenter.test.ts` 增加：

```ts
it('支持缺陷 SLA、逾期、二次退回和申诉闭环', () => {
  const domains = createDomains()
  createBlockedRecord(domains.store, 'record-sla')
  const defects = syncDefects(domains)
  const target = defects.find(defect => defect.category === '必填字段')!

  const returned = domains.defectDomain.returnToDoctor(target.id, {
    operator: '质控员',
    reason: '请补齐主诉',
    dueAt: 1000
  })
  expect(returned?.dueAt).toBe(1000)
  expect(returned?.returnCount).toBe(1)

  const secondReturned = domains.defectDomain.returnToDoctor(target.id, {
    operator: '质控员',
    reason: '主诉仍不完整',
    dueAt: 2000
  })
  expect(secondReturned?.status).toBe('secondReturned')
  expect(secondReturned?.returnCount).toBe(2)

  const appealed = domains.defectDomain.submitAppeal(target.id, {
    operator: '王医生',
    reason: '患者无法提供完整主诉'
  })
  expect(appealed?.status).toBe('appealing')
  expect(appealed?.appealReason).toContain('患者无法提供')

  const model = buildMedicalRecordDefectCenterViewModel({
    defects: domains.defectDomain.list(),
    now: 3000
  })
  const item = model.items.find(defect => defect.id === target.id)!

  expect(model.summary.overdueCount).toBeGreaterThan(0)
  expect(model.summary.appealingCount).toBe(1)
  expect(item.overdue).toBe(true)
  expect(item.returnCountText).toBe('退回 2 次')
})
```

- [ ] **步骤 2：运行缺陷 SLA 测试验证失败**

运行：`npx vitest run tests/platform/medicalRecordDefectCenter.test.ts --threads=false`

预期：FAIL，报错包含 `dueAt` 或 `submitAppeal` 不存在。

- [ ] **步骤 3：扩展缺陷类型和状态文本**

将 `MedicalRecordDefectStatus` 扩展为：

```ts
export type MedicalRecordDefectStatus =
  | 'open'
  | 'returned'
  | 'secondReturned'
  | 'rectified'
  | 'appealing'
  | 'closed'
  | 'templateIssue'
```

将 `MedicalRecordDefectEventAction` 扩展为：

```ts
export type MedicalRecordDefectEventAction =
  | 'created'
  | 'returned'
  | 'second_returned'
  | 'rectified'
  | 'appealed'
  | 'closed'
  | 'template_issue'
```

在 `IMedicalRecordQualityDefect` 增加字段：`severity`、`deduction`、`dueAt`、`returnCount`、`appealReason`、`appealStatus`、`sourceTaskId`、`sourceResultId`。

- [ ] **步骤 4：更新缺陷创建与流转方法**

缺陷创建时填充 `returnCount: 0`、`severity`、`deduction`、`sourceTaskId`、`sourceResultId`。

`returnToDoctor()` 参数增加 `dueAt`，每次退回累加 `returnCount`，第二次及以上状态为 `secondReturned`。

新增：

```ts
submitAppeal(
  id: string,
  options: {
    operator?: string
    reason: string
  }
) {
  return this._transition(id, 'appealing', {
    operator: options.operator ?? '医生',
    note: options.reason,
    patch: {
      appealStatus: 'submitted',
      appealReason: options.reason
    },
    trace: {
      title: '缺陷申诉',
      summary: options.reason
    }
  })
}
```

`_transition()` options 增加 `patch?: Partial<IMedicalRecordQualityDefect>`，创建 `next` 时合并 `options.patch`。

- [ ] **步骤 5：更新缺陷中心 view model 与视图**

`IMedicalRecordDefectCenterItem` 增加：`dueAtText`、`overdue`、`returnCountText`、`appealText`、`sourceText`。`buildMedicalRecordDefectCenterViewModel()` 参数增加 `now?: number`，摘要增加 `overdueCount`、`secondReturnedCount`、`appealingCount`。

`createMedicalRecordDefectCenterView()` 在缺陷卡片摘要中展示 SLA、退回次数和申诉，逾期状态显示危险 badge。

- [ ] **步骤 6：运行缺陷测试验证通过**

运行：`npx vitest run tests/platform/medicalRecordDefectCenter.test.ts --threads=false`

预期：PASS，原有 4 个测试和新增 SLA 测试均通过。

- [ ] **步骤 7：Commit**

```bash
git add \
  tests/platform/medicalRecordDefectCenter.test.ts \
  src/platform/emr-workbench/domain/medical-record-defect-domain-service.ts \
  src/platform/emr-workbench/modules/defect-center/service.ts \
  src/platform/emr-workbench/modules/defect-center/view.ts
git commit -m "feat: add defect sla appeal and second return workflow"
```

## 任务 5：接入归档准入与运营分析

**文件：**
- 创建：`src/platform/emr-workbench/modules/quality-analytics-center/index.ts`
- 创建：`src/platform/emr-workbench/modules/quality-analytics-center/service.ts`
- 创建：`src/platform/emr-workbench/modules/quality-analytics-center/view.ts`
- 修改：`src/platform/emr-workbench/modules/archive-center/service.ts`
- 修改：`src/platform/emr-workbench/modules/medical-record-operations-center/service.ts`
- 修改：`src/platform/emr-workbench/modules/index.ts`
- 测试：`tests/platform/qualityAnalyticsCenter.test.ts`
- 测试：`tests/platform/medicalRecordArchiveCenter.test.ts`
- 测试：`tests/platform/medicalRecordOperationsCenter.test.ts`

- [ ] **步骤 1：编写失败的归档准入测试**

在 `tests/platform/medicalRecordArchiveCenter.test.ts` 增加终末质控、病案首页、编码和资料检查断言：

```ts
const model = buildMedicalRecordArchiveCenterViewModel({
  documents: [record],
  domain,
  terminalQualityResults: {
    'record-terminal-blocked': {
      conclusion: 'blocked',
      score: 75,
      grade: 'D'
    }
  },
  archiveRequirements: {
    requireHomepage: true,
    requireCoding: true,
    requireAttachments: true
  },
  now: 2000
})

expect(model.items[0].canArchive).toBe(false)
expect(model.items[0].checklist.map(item => item.id)).toContain('terminal-quality')
expect(model.items[0].checklist.map(item => item.id)).toContain('homepage')
expect(model.items[0].checklist.map(item => item.id)).toContain('coding')
expect(model.items[0].checklist.map(item => item.id)).toContain('attachments')
```

- [ ] **步骤 2：运行归档准入测试验证失败**

运行：`npx vitest run tests/platform/medicalRecordArchiveCenter.test.ts --threads=false`

预期：FAIL，报错包含 `terminalQualityResults` 或 `archiveRequirements` 不存在。

- [ ] **步骤 3：扩展归档中心输入与 checklist**

在 `archive-center/service.ts` 增加：

```ts
export interface IMedicalRecordTerminalQualitySummary {
  conclusion: 'passed' | 'warning' | 'blocked'
  score: number
  grade: 'A' | 'B' | 'C' | 'D'
}

export interface IMedicalRecordArchiveRequirements {
  requireHomepage?: boolean
  requireCoding?: boolean
  requireAttachments?: boolean
}
```

`buildMedicalRecordArchiveCenterViewModel()` 参数增加 `terminalQualityResults?: Record<string, IMedicalRecordTerminalQualitySummary>` 和 `archiveRequirements?: IMedicalRecordArchiveRequirements`。`buildChecklist()` 追加 `terminal-quality`、`homepage`、`coding`、`attachments` 四类检查项。

- [ ] **步骤 4：编写失败的运营分析测试**

```ts
import { describe, expect, it } from 'vitest'
import { buildQualityAnalyticsCenterViewModel } from '@/platform/emr-workbench/modules'

describe('quality analytics center', () => {
  it('计算质控覆盖率、闭环率、逾期率、甲级率、归档合格率和排行', () => {
    const model = buildQualityAnalyticsCenterViewModel({
      documents: [
        { id: 'record-1', departmentText: '呼吸内科', doctorText: '王医生', archived: true },
        { id: 'record-2', departmentText: '呼吸内科', doctorText: '李医生', archived: false }
      ],
      qualityResults: [
        { documentId: 'record-1', score: 95, grade: 'A', conclusion: 'passed' },
        { documentId: 'record-2', score: 78, grade: 'C', conclusion: 'blocked' }
      ],
      defects: [
        { documentId: 'record-1', status: 'closed', overdue: false, owner: '王医生', departmentText: '呼吸内科' },
        { documentId: 'record-2', status: 'returned', overdue: true, owner: '李医生', departmentText: '呼吸内科' }
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
```

- [ ] **步骤 5：实现运营分析中心**

`buildQualityAnalyticsCenterViewModel()` 输入：`documents`、`qualityResults`、`defects`、`archiveItems`。摘要输出 `coverageRateText`、`defectClosureRateText`、`overdueRateText`、`gradeARateText`、`archivePassRateText`。排行按缺陷数和逾期数计算风险分，风险高的科室/医生排在前面。

`createQualityAnalyticsCenterView()` 使用 `tm-version-center__summary` 展示五个率，用 `tm-center-list` 分别展示科室排行和医生排行。

- [ ] **步骤 6：导出运营分析模块**

在 `src/platform/emr-workbench/modules/index.ts` 追加导出 `QualityAnalyticsCenterModule`、`buildQualityAnalyticsCenterViewModel`、`createQualityAnalyticsCenterView` 和 `IQualityAnalyticsCenterViewModel`。

- [ ] **步骤 7：运行任务 5 测试验证通过**

运行：`npx vitest run tests/platform/medicalRecordArchiveCenter.test.ts tests/platform/qualityAnalyticsCenter.test.ts tests/platform/medicalRecordOperationsCenter.test.ts --threads=false`

预期：PASS，归档、运营分析、运营队列测试均通过。

- [ ] **步骤 8：Commit**

```bash
git add \
  tests/platform/medicalRecordArchiveCenter.test.ts \
  tests/platform/qualityAnalyticsCenter.test.ts \
  tests/platform/medicalRecordOperationsCenter.test.ts \
  src/platform/emr-workbench/modules/archive-center/service.ts \
  src/platform/emr-workbench/modules/medical-record-operations-center/service.ts \
  src/platform/emr-workbench/modules/quality-analytics-center \
  src/platform/emr-workbench/modules/index.ts
git commit -m "feat: add quality archive gates and analytics center"
```

## 任务 6：端到端工作流、文档和质量门禁

**文件：**
- 测试：`tests/platform/medicalRecordQualityWorkflowV2.test.ts`
- 修改：`docs/下一阶段迭代工作Todolist.md`

- [ ] **步骤 1：编写端到端工作流测试**

测试必须完成以下断言：

```ts
expect(result.conclusion).toBe('blocked')
expect(archiveModel.items[0].canArchive).toBe(false)
expect(taskModel.summary.taskCount).toBe(1)
expect(analytics.summary.coverageRateText).toBe('100%')
expect(analytics.summary.archivePassRateText).toBe('0%')
```

测试流程：创建 `TemplateDocumentStore`、`MedicalRecordDomainService`、`MedicalRecordDefectDomainService`、`QualityStandardDomainService`、`QualityScoringDomainService`、`QualityExecutionDomainService`、`QualityInspectionTaskDomainService`；创建一份已签名但缺少病案首页编码的病历；生成归档前终末质控任务；执行终末质控；由命中结果同步缺陷并退回医生；构建归档中心和运营分析中心模型。

- [ ] **步骤 2：运行端到端测试验证通过**

运行：`npx vitest run tests/platform/medicalRecordQualityWorkflowV2.test.ts --threads=false`

预期：PASS，输出包含 `1 passed`。

- [ ] **步骤 3：更新迭代文档**

在 `docs/下一阶段迭代工作Todolist.md` 的近期进展区域追加：

```md
### 第三十八轮：P4 病历质控体系化重构

- 已按方案 B 建立病历质控标准、评分、执行、任务、缺陷 SLA、归档准入和运营分析的平台层模型。
- 新增质控标准中心、质控任务中心、单份病历评分中心、质控运营分析中心，保持编辑器内核无 HIS/EMR 质控业务逻辑新增。
- 自动化测试覆盖规则命中、评分扣分、任务生成、整改 SLA、归档阻断和运营指标。
```

- [ ] **步骤 4：运行 P4 相关测试**

运行：

```bash
npx vitest run \
  tests/platform/qualityStandardDomainService.test.ts \
  tests/platform/qualityScoringDomainService.test.ts \
  tests/platform/qualityExecutionDomainService.test.ts \
  tests/platform/qualityInspectionTaskDomainService.test.ts \
  tests/platform/qualityAnalyticsCenter.test.ts \
  tests/platform/medicalRecordDefectCenter.test.ts \
  tests/platform/medicalRecordArchiveCenter.test.ts \
  tests/platform/medicalRecordOperationsCenter.test.ts \
  tests/platform/medicalRecordQualityWorkflowV2.test.ts \
  --threads=false
```

预期：PASS，所有 P4 相关测试通过。

- [ ] **步骤 5：运行 lint 与类型检查**

运行：

```bash
npx eslint \
  src/platform/emr-workbench/domain/quality-standard-domain-service.ts \
  src/platform/emr-workbench/domain/quality-scoring-domain-service.ts \
  src/platform/emr-workbench/domain/quality-execution-domain-service.ts \
  src/platform/emr-workbench/domain/quality-inspection-task-domain-service.ts \
  src/platform/emr-workbench/modules/quality-standard-center \
  src/platform/emr-workbench/modules/quality-task-center \
  src/platform/emr-workbench/modules/quality-scoring-center \
  src/platform/emr-workbench/modules/quality-analytics-center \
  tests/platform/qualityStandardDomainService.test.ts \
  tests/platform/qualityScoringDomainService.test.ts \
  tests/platform/qualityExecutionDomainService.test.ts \
  tests/platform/qualityInspectionTaskDomainService.test.ts \
  tests/platform/qualityAnalyticsCenter.test.ts \
  tests/platform/medicalRecordQualityWorkflowV2.test.ts
npm run type:check
```

预期：两个命令均返回退出码 0。

- [ ] **步骤 6：Commit**

```bash
git add \
  tests/platform/medicalRecordQualityWorkflowV2.test.ts \
  docs/下一阶段迭代工作Todolist.md
git commit -m "test: cover medical record quality workflow v2"
```
