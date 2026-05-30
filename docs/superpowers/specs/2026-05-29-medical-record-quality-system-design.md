# P4 病历质控体系化重构与临床验收闭环设计

日期：2026-05-29

## 1. 背景与目标

当前平台已经完成 P2 病历质控与归档运营闭环，具备病历实例质控、缺陷整改、归档冻结、归档后修订和模板反哺能力。但现有病历质控能力仍偏轻量，核心模型更接近“质控 issue 生成器 + 缺陷状态流转”，尚不足以支撑医院临床质控系统的建设和验收要求。

P4 目标是按推荐方案 B，将病历质控从单一问题列表重构为“质控标准 + 质控执行 + 缺陷闭环 + 质控运营”四层平台能力。在不污染编辑器内核的前提下，把医院常见的环节质控、终末质控、专项质控、病案首页/编码质量、评分扣分、质控任务、整改 SLA、运营统计和归档准入沉淀到 `src/platform/emr-workbench/`。

## 2. 当前能力边界

现有能力主要分布在以下模块：

- `medical-record-quality-center`：生成病历质控问题、风险等级、规则命中统计和规则变更影响评估。
- `defect-center` + `MedicalRecordDefectDomainService`：将质控 issue 固化为缺陷，支持退回、整改、复核关闭和转模板问题。
- `archive-center`：基于质控阻断项、签名复核、结构化导出和缺陷关闭状态执行归档前检查。
- `medical-record-operations-center`：汇总待质控、退回整改、待归档和归档阻断队列。

现有不足：

- 质控标准缺少版本化标准库、适用范围、扣分、病历等级和规则启停治理。
- 质控执行缺少任务模型，无法表达全检、抽检、专项检查、质控员分派和复核工作量。
- 缺陷闭环缺少 SLA、逾期、二次退回、申诉和催办。
- 终末质控和归档准入缺少病案首页、诊断编码、资料完整性等医院验收常见检查项。
- 运营侧缺少科室/医生质量画像、质控覆盖率、整改闭环率、缺陷复发率、归档合格率等指标。

## 3. 医院质控系统建设要求

### 3.1 质控范围

系统应覆盖以下质控场景：

- 环节质控：医生书写中、提交前、签名前、上级复核前的实时或准实时提醒。
- 科室质控：科室质控员对本科室病历执行抽检、全检和退回整改。
- 终末质控：病案室或质控办在归档前进行完整性、规范性和质量评分。
- 专项质控：围绕手术、死亡、危急值、抗菌药物、知情同意、病案首页等专项主题检查。
- 归档质检：归档前校验未关闭阻断缺陷、签名复核、结构化导出、病案首页、编码和资料完整性。
- 归档后追溯：归档后发现问题时保留原归档快照，生成修订记录和影响范围复核。

### 3.2 质控标准

质控标准应支持：

- 标准库：按医院、院区、科室、文书类型、模板、质控阶段维护规则包。
- 规则版本：每次规则调整形成版本，病历质控结果记录命中的规则版本。
- 规则分类：基础完整性、内容规范、时限要求、签名复核、逻辑一致性、病案首页、编码质量、资料完整性。
- 严重程度：阻断、警告、提示，并支持与缺陷等级映射。
- 扣分模型：每条规则可配置扣分、封顶扣分、是否一票否决。
- 定位能力：规则命中时能定位到病历实例、模板版本、字段、业务编码、书写事件或整份病历。
- 治理能力：规则启停、灰度范围、影响评估、命中统计和规则调整说明。

### 3.3 质控任务

质控任务应支持：

- 任务来源：自动规则触发、科室抽检、病案室终末质控、专项检查、人工创建。
- 任务范围：按科室、医生、患者、文书类型、模板版本、时间范围、风险等级筛选。
- 抽检策略：全检、按比例抽检、按风险抽检、按文书类型抽检、专项抽检。
- 任务流转：待分派、待质控、质控中、待复核、已完成、已取消。
- 执行留痕：质控员、质控时间、命中规则、人工判定、整改要求、复核意见。

### 3.4 缺陷整改

缺陷闭环应支持：

- 缺陷来源：自动规则、人工质控、专项质控、归档前检查、归档后追溯。
- 缺陷等级：阻断、严重、一般、提示，可映射到扣分和归档阻断。
- 处理状态：待分派、已退回、医生整改中、医生已整改、待复核、复核通过、二次退回、申诉中、已关闭、已转模板问题。
- SLA：每类缺陷可配置整改时限、复核时限、逾期标记和催办策略。
- 闭环证据：退回原因、整改说明、复核意见、before/after 字段差异、操作人和时间线。
- 模板反哺：高频缺陷可生成模板问题单，串联修订草稿、验证、发布和影响范围复核。

### 3.5 运营验收

系统应能输出以下指标：

- 质控覆盖率：已质控病历数 / 应质控病历数。
- 自动规则命中率：自动规则命中问题数 / 总问题数。
- 缺陷整改闭环率：已关闭缺陷数 / 已生成缺陷数。
- 平均整改时长：缺陷退回到关闭的平均耗时。
- 逾期率：逾期缺陷数 / 应整改缺陷数。
- 归档合格率：可归档且无阻断缺陷病历数 / 待归档病历数。
- 病历甲级率：达到甲级评分标准的病历数 / 已评分病历数。
- 缺陷复发率：同模板、同字段、同规则在一段时间内重复命中的比例。
- 科室/医生排名：按病历得分、缺陷数、逾期数、整改时长聚合。

## 4. 推荐架构

### 4.1 四层架构

P4 采用四层架构：

1. 质控标准层：维护规则包、评分标准、抽检策略和归档标准。
2. 质控执行层：根据标准和病历事实生成质控任务、质控结果、评分和缺陷。
3. 缺陷闭环层：管理缺陷状态、整改 SLA、复核、申诉和模板反哺。
4. 质控运营层：输出工作台队列、质量画像、趋势分析、验收指标和报告。

### 4.2 新增领域服务

新增服务均位于 `src/platform/emr-workbench/domain/`：

- `QualityStandardDomainService`
  - 维护规则包、规则版本、评分标准、抽检策略、归档标准。
  - 提供规则启停、版本快照、影响评估输入。
- `QualityExecutionDomainService`
  - 执行环节质控、终末质控和专项质控。
  - 生成质控任务、质控结果、规则命中证据和评分输入。
- `QualityScoringDomainService`
  - 根据规则命中和扣分标准计算病历得分、病历等级、扣分明细。
  - 支持一票否决和封顶扣分。
- `QualityInspectionTaskDomainService`
  - 管理质控任务、抽检计划、任务分派、领取、复核和完成。
  - 记录质控员工作量和任务状态。

现有服务演进：

- `MedicalRecordDefectDomainService`
  - 扩展缺陷状态、SLA、逾期、二次退回、申诉和催办。
- `MedicalRecordDomainService`
  - 继续负责病历事实、归档冻结、归档后修订和时间线。
- `TemplateDomainService`
  - 继续负责模板缺陷反哺、修订草稿、验证和发布。

### 4.3 新增平台模块

新增模块均位于 `src/platform/emr-workbench/modules/`，延续 `index.ts + service.ts + view.ts` 模式：

- `quality-standard-center`
  - 规则包、评分标准、抽检策略、归档标准配置视图。
- `quality-task-center`
  - 质控员工作台，展示待质控、待复核、逾期整改、专项任务。
- `quality-scoring-center`
  - 单份病历评分、扣分明细、病历等级和命中证据。
- `quality-analytics-center`
  - 科室、医生、模板、文书类型维度的质量指标和趋势。

保留并增强：

- `medical-record-quality-center`：从“所有质控能力入口”收敛为“病历质控结果摘要”。
- `defect-center`：增强为“缺陷整改与复核中心”。
- `archive-center`：消费终末质控结论和归档标准，不再自行承担所有归档规则。
- `medical-record-operations-center`：整合新任务中心和归档阻断队列。

## 5. 核心数据模型

### 5.1 质控标准

```ts
interface IQualityRulePackage {
  id: string
  name: string
  version: string
  stage: 'writing' | 'department' | 'terminal' | 'archive' | 'special'
  target: IQualityRuleTarget
  enabled: boolean
  rules: IQualityRule[]
  scoringPolicyId?: string
  createdAt: number
  updatedAt: number
}

interface IQualityRule {
  id: string
  name: string
  category: string
  level: 'blocker' | 'serious' | 'normal' | 'info'
  checkType: 'field' | 'content' | 'timeliness' | 'consistency' | 'homepage' | 'coding' | 'attachment'
  fieldId?: string
  businessCode?: string
  expression?: string
  deduction?: number
  maxDeduction?: number
  veto?: boolean
  actionHint: string
}
```

### 5.2 质控任务

```ts
interface IQualityInspectionTask {
  id: string
  source: 'auto' | 'sampling' | 'special' | 'manual' | 'archive'
  status: 'pendingAssign' | 'pendingCheck' | 'checking' | 'pendingReview' | 'completed' | 'cancelled'
  scope: IQualityInspectionScope
  assignee?: string
  reviewer?: string
  documentIds: string[]
  createdAt: number
  dueAt?: number
  completedAt?: number
}
```

### 5.3 质控结果与评分

```ts
interface IQualityInspectionResult {
  id: string
  taskId?: string
  documentId: string
  stage: IQualityRulePackage['stage']
  rulePackageIds: string[]
  issueIds: string[]
  score: number
  grade: 'A' | 'B' | 'C' | 'D'
  conclusion: 'passed' | 'warning' | 'blocked'
  inspectedBy: string
  inspectedAt: number
}

interface IQualityScoreDetail {
  ruleId: string
  ruleName: string
  category: string
  deduction: number
  reason: string
  fieldId?: string
  evidenceText?: string
}
```

### 5.4 缺陷扩展

现有 `IMedicalRecordQualityDefect` 增加：

- `severity`: 阻断、严重、一般、提示。
- `deduction`: 本缺陷扣分。
- `dueAt`: 整改截止时间。
- `overdue`: 是否逾期。
- `returnCount`: 退回次数。
- `appealStatus`: 申诉状态。
- `sourceTaskId`: 来源质控任务。
- `sourceResultId`: 来源质控结果。

## 6. 工作流设计

### 6.1 环节质控

1. 医生书写或提交病历。
2. `QualityExecutionDomainService` 按 writing/department 规则包执行检查。
3. 生成问题、扣分预估和可操作提示。
4. 阻断项阻止提交或提示退回补录。

### 6.2 科室质控

1. 系统按科室策略生成全检或抽检任务。
2. 科室质控员领取任务。
3. 自动规则先生成问题，质控员可确认、追加或忽略。
4. 生成缺陷并退回医生整改。
5. 医生整改后进入复核，复核通过后关闭。

### 6.3 终末质控与归档

1. 病历签名复核后进入终末质控任务池。
2. 终末质控执行完整性、规范性、病案首页、编码和资料检查。
3. `QualityScoringDomainService` 生成病历得分和等级。
4. `archive-center` 消费终末质控结论和未关闭缺陷，决定是否可归档。
5. 归档时冻结质控结论、评分、扣分明细、规则版本和缺陷闭环状态。

### 6.4 专项质控

1. 质控办配置专项规则和抽检范围。
2. 系统生成专项质控任务。
3. 任务结果进入质量分析，不一定阻断归档，但可形成整改和模板反哺。

## 7. UI 设计原则

P4 不做营销式页面，仍保持临床工作台风格：信息密度高、操作路径短、状态清晰。

核心视图：

- 质控任务中心：按任务状态、科室、文书类型、质控员、逾期状态筛选。
- 单份病历质控面板：展示质控结论、得分、等级、扣分明细、缺陷和证据。
- 缺陷整改中心：增加 SLA、逾期、二次退回、申诉筛选。
- 质控标准中心：规则包、评分标准、抽检策略、归档标准配置。
- 质控运营看板：覆盖率、闭环率、逾期率、甲级率、归档合格率、科室/医生排名。

## 8. 验收标准

P4 第一阶段验收如下：

- 支持至少三类规则包：环节质控、终末质控、病案首页/归档质控。
- 每条规则包含适用范围、严重程度、扣分、整改建议、定位信息、启停状态和版本。
- 每份病历可生成质控结论、缺陷列表、扣分明细、病历得分和病历等级。
- 质控任务支持全检、抽检、专项检查、分派、领取、复核。
- 缺陷闭环支持退回、整改、复核、关闭、逾期、二次退回和申诉。
- 归档前能阻断未关闭阻断缺陷、签名复核缺失、病案首页缺失、编码/资料不完整。
- 运营看板能展示质控覆盖率、缺陷闭环率、平均整改时长、逾期率、病历甲级率、归档合格率和科室/医生排名。
- 自动化测试覆盖规则命中、评分扣分、任务生成、整改 SLA、归档阻断和统计指标。

## 9. 实施切分

建议分四个任务推进：

1. 标准与评分底座
   - 新增 `QualityStandardDomainService` 和 `QualityScoringDomainService`。
   - 建模规则版本、扣分、病历等级和终末质控结论。
2. 质控执行与任务中心
   - 新增 `QualityExecutionDomainService` 和 `QualityInspectionTaskDomainService`。
   - 支持全检、抽检、专项任务和质控员分派。
3. 缺陷 SLA 与归档准入增强
   - 扩展 `MedicalRecordDefectDomainService`。
   - `archive-center` 接入终末质控结论、病案首页/编码/资料完整性。
4. 运营分析与文档验收
   - 新增 `quality-analytics-center`。
   - 更新平台文档和 `docs/下一阶段迭代工作Todolist.md`。

## 10. 风险与边界

- 暂不接入真实医院权限系统，先使用现有角色和 mock domain service 验证流程。
- 暂不实现真实病案首页上报、医保编码上传或 CA 签章，仅建模质量检查边界。
- 暂不做复杂 BI 大屏，只提供质控运营所需的工作台统计。
- 不改编辑器内核，所有医院质控业务逻辑必须留在 `src/platform/emr-workbench/`。
- 现有 `medical-record-quality-center` 不直接删除，先作为兼容视图逐步收敛。

## 11. 测试策略

新增和扩展以下测试：

- `tests/platform/qualityStandardDomainService.test.ts`
  - 规则包版本、启停、适用范围、评分标准。
- `tests/platform/qualityScoringDomainService.test.ts`
  - 扣分、一票否决、等级计算、封顶扣分。
- `tests/platform/qualityInspectionTaskDomainService.test.ts`
  - 全检、抽检、专项任务、分派、领取、复核。
- `tests/platform/medicalRecordDefectCenter.test.ts`
  - SLA、逾期、二次退回、申诉。
- `tests/platform/medicalRecordArchiveCenter.test.ts`
  - 终末质控结论和未关闭阻断缺陷阻断归档。
- `tests/platform/medicalRecordQualityWorkflowV2.test.ts`
  - 覆盖“提交 -> 科室质控 -> 退回整改 -> 终末质控评分 -> 归档冻结 -> 运营统计”。

## 12. 完成定义

当以下条件满足时，P4 第一阶段可认为完成：

- 质控标准、质控任务、评分、缺陷 SLA、归档准入和运营指标都有平台层模型。
- 关键工作台能展示任务、评分、缺陷、归档阻断和运营指标。
- 关键流程具备自动化测试覆盖。
- 平台文档说明新旧模块职责边界和医院验收口径。
- 编辑器内核无 HIS/EMR 质控业务逻辑新增。