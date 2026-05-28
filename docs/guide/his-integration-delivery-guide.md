# HIS 产品化接入交付指南

本文档面向医院信息科、HIS 厂商、实施工程师和平台研发，说明如何把模板平台以低侵入方式接入三方 HIS 系统，并完成联调、验收和故障排查。

## 1. 交付物清单

一次标准 HIS 接入交付至少包含以下材料：

- 医院级接入配置包：连接器配置、上下文映射、字段映射、字典映射、策略开关和验收基线。
- HIS 接入验收报告：上下文透传、字段映射命中率、结构化导出、状态回写、错误码和耗时统计。
- 可复现回放包：失败或已重放请求的上下文样例、回写载荷、幂等键和处理状态。
- 联调工作台截图或导出记录：连接器状态、上下文会话、字段覆盖、接口日志、告警和人工补偿任务。
- 本文档中的接入说明、联调流程和故障排查手册。

## 2. 接入说明

### 2.1 接入边界

平台不替换 HIS，不承载挂号、收费、医嘱、检验、病案首页等 HIS 核心业务。P3 接入只覆盖模板、病历书写、质控、整改、归档和协同状态回写。

HIS 侧负责提供可信上下文、患者就诊数据和状态接收接口；平台侧负责模板运行、结构化字段、质控归档、回写补偿和联调观测。

### 2.2 推荐接入方式

优先使用 HIS 内嵌页面方式接入：HIS 在医生工作站内嵌模板平台页面，并通过可信票据或 SSO 令牌传入患者、就诊、医生、科室和文书任务上下文。

备选方式包括：

- 单点跳转：HIS 打开平台独立页面，平台完成上下文换票后进入文书工作台。
- 回调协同：平台在质控、归档或退回节点回调 HIS 状态接口。

### 2.3 标准连接器能力

连接器统一由 `HisIntegrationDomainService` 管理，标准能力包括：

- `context`：解析 HIS 上下文并生成平台统一上下文。
- `read`：按字段映射读取患者、就诊、诊断、生命体征等数据。
- `writeback`：回写文书状态、结构化结果、质控结论、归档结果和修订结论。
- `callback`：承接 HIS 主动回调或异步通知。

连接器运行模式分为 `mock`、`sandbox` 和 `production`。实施阶段应先在沙箱验证配置包和验收基线，再切换生产连接器。

### 2.4 医院级接入配置包

配置包用于隔离医院差异，建议以医院默认包为基线，再按院区覆盖局部差异。平台解析时优先使用院区包，找不到时回退到医院默认包。

配置包核心内容：

```ts
{
  hospitalId: 'hospital-a',
  campusId: 'east',
  connectorId: 'his-sandbox',
  connectorConfig: {
    mode: 'sandbox',
    authType: 'trustedTicket',
    launchModes: ['embedded', 'redirect'],
    dataSources: ['his.patient', 'his.document'],
    capabilities: ['context', 'read', 'writeback']
  },
  contextMappings: [
    { sourceKey: 'PAT_ID', targetKey: 'patientId', required: true },
    { sourceKey: 'VISIT_ID', targetKey: 'encounterId', required: true }
  ],
  fieldMappings: [
    {
      metadataFieldId: 'metadata:patient.name',
      dataSource: 'his.patient',
      interfaceField: 'PAT_NAME',
      exportPath: 'patient.name'
    }
  ],
  dictionaryMappings: [
    { dictionaryCode: 'gender', sourceValue: '1', targetValue: '男' }
  ],
  strategySwitches: {
    enableRetry: true,
    enableReplay: true,
    enableAudit: true
  },
  acceptanceBaseline: {
    minFieldCoverageRate: 90,
    maxFailedTraceCount: 0,
    requiredCapabilities: ['context', 'read', 'writeback']
  }
}
```

## 3. 联调流程

### 3.1 准备阶段

1. 确认 HIS 提供沙箱环境、可信票据或 SSO 令牌、患者就诊样例和状态回写地址。
2. 在字段主数据管理台维护医院字段映射和字典映射。
3. 创建医院级接入配置包，设置连接器、上下文映射、策略开关和验收基线。
4. 准备至少 3 类样例：正常患者、字段缺失患者、需要质控退回或归档回写的患者。

### 3.2 上下文联调

1. HIS 以 `embedded` 或 `redirect` 模式打开平台。
2. 平台通过连接器解析上下文，生成统一上下文对象。
3. 在 HIS 联调工作台确认上下文会话有效，重点检查 `patientId`、`encounterId`、`departmentId`、`operatorId`、`taskId`。

### 3.3 字段回填联调

1. 使用医院映射配置读取沙箱患者字段。
2. 检查字段覆盖率、缺失字段和字段备注。
3. 对缺失字段判断原因：映射缺失、HIS 未返回、字典值无法转换或上下文不完整。
4. 调整映射后重新读取，直到达到验收基线。

### 3.4 状态回写联调

1. 使用平台协同状态触发 HIS 回写。
2. 检查幂等键是否稳定，格式为 `sessionId:documentId:platformStatus`。
3. 验证实时回写、异步回写和仅审计留痕策略是否符合配置。
4. 对失败回写执行重试；重试仍失败时生成补偿记录。

### 3.5 验收输出

联调完成后输出 HIS 接入验收报告，报告应至少覆盖：

- 连接器数量、会话数量和接口追踪数量。
- 字段诊断数量、命中字段数和字段覆盖率。
- 状态回写成功次数和失败追踪数量。
- 可复现回放包和待处理人工补偿任务。

## 4. 故障排查手册

### 4.1 上下文会话失败

常见原因：票据过期、HIS 未传必要 scope、上下文字段名与配置包不一致。

处理步骤：

1. 在联调工作台查看 `launch` 追踪的失败消息。
2. 对照配置包的 `contextMappings`，确认 `patientId` 和 `encounterId` 是否可解析。
3. 要求 HIS 厂商提供同一患者的请求样例，复现上下文解析。

### 4.2 字段覆盖率不足

常见原因：主数据字段未配置医院映射、接口字段名变化、字典值未维护、HIS 沙箱样例数据为空。

处理步骤：

1. 查看字段回填诊断中的缺失字段和备注。
2. 在字段主数据管理台执行映射预检，定位缺失字段和缺失字典。
3. 对接口字段变更创建映射快照并比较差异。
4. 重新读取字段，确认字段覆盖率达到验收基线。

### 4.3 状态回写失败

常见原因：HIS 接口超时、状态编码未识别、结构化载荷超出 HIS 限制、幂等键重复策略不一致。

处理步骤：

1. 查看 `writeBack` 接口日志，确认失败消息和耗时。
2. 检查平台状态与 HIS 状态编码映射，如 `pendingArchive -> PENDING_ARCHIVE`。
3. 使用同一幂等键重试，避免 HIS 侧产生重复文书状态。
4. 重试仍失败时保留补偿记录，交由人工重放处理。

### 4.4 人工重放与补偿

当回写失败且 `retryable` 为 true 时，平台会生成可重放记录。实施人员应先确认 HIS 侧故障已经解除，再执行人工重放。

处理步骤：

1. 在 HIS 联调工作台查看待处理人工补偿任务。
2. 导出回放包，确认 `sampleContext`、`payload` 和 `idempotencyKey`。
3. 调用人工重放入口，观察补偿状态从 `pending` 变为 `completed`。
4. 将重放结果追加到验收报告或故障单。

### 4.5 告警阈值处理

运维快照会按失败接口数量生成告警。若失败数量达到阈值，应暂停切换生产连接器，先完成根因定位。

处理步骤：

1. 查看告警代码和阈值，例如 `writeback.failed.threshold`。
2. 按连接器过滤接口日志，区分 HIS 接口异常、网络异常和配置异常。
3. 若为配置异常，修正配置包后重新生成验收报告。
4. 若为 HIS 接口异常，由信息科或 HIS 厂商提供恢复确认后再重放。

## 5. 上线检查表

- [ ] 使用沙箱连接器完成上下文、字段读取和状态回写联调。
- [ ] 字段覆盖率达到配置包验收基线。
- [ ] 所有必需能力均已配置：`context`、`read`、`writeback`。
- [ ] 回写失败具备重试、回放包和人工补偿入口。
- [ ] 联调工作台无未处理告警或待处理补偿任务。
- [ ] 医院实施侧已获得配置包、验收报告、回放样例和本故障排查手册。

## 6. 相关代码入口

- `src/platform/emr-workbench/domain/his-integration-domain-service.ts`
- `src/platform/emr-workbench/domain/business-metadata-domain-service.ts`
- `src/platform/emr-workbench/modules/his-integration-center/`
- `src/components/template-designer/TemplateManager.ts`
