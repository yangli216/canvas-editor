export type HisConnectorMode = 'mock' | 'sandbox' | 'production'
export type HisConnectorAuthType = 'none' | 'trustedTicket' | 'ssoToken'
export type HisLaunchMode = 'embedded' | 'redirect' | 'callback'
export type HisConnectorCapability = 'context' | 'read' | 'writeback' | 'callback'
export type HisIntegrationTraceAction = 'launch' | 'read' | 'writeBack' | 'callback'
export type HisIntegrationTraceStatus = 'success' | 'failed'
export type HisIntegrationSessionStatus = 'active' | 'expired' | 'failed'
export type HisWriteBackDeliveryMode = 'realtime' | 'async' | 'auditOnly'
export type HisReplayRecordStatus = 'failed' | 'replayed'
export type HisOperationAlertLevel = 'warning' | 'danger'
export type HisOperationAuditAction = 'packageUpsert' | 'manualReplay'
export type HisManualCompensationStatus = 'pending' | 'completed'
export type HisWorkflowDocumentStatus =
  | 'writing'
  | 'submitted'
  | 'pendingSupplement'
  | 'pendingRectification'
  | 'pendingArchive'
  | 'archived'
  | 'returnedRewrite'

export interface IHisWorkflowStatusRule {
  status: HisWorkflowDocumentStatus
  hisStatusCode: string
  label: string
  description: string
  deliveryMode: HisWriteBackDeliveryMode
  terminal?: boolean
}

export interface IHisLaunchContext {
  launchMode: HisLaunchMode
  trustedTicket?: string
  ssoToken?: string
  scope: Record<string, string | number | undefined | null>
  variables?: Record<string, string | number | undefined | null>
}

export interface IHisUnifiedContext {
  patientId: string
  encounterId: string
  departmentId?: string
  operatorId?: string
  operatorName?: string
  roleCodes?: string[]
  wardId?: string
  taskId?: string
  documentType?: string
}

export interface IHisConnectorFieldRequest {
  fieldId: string
  businessCode: string
  dataSource: string
  exportPath?: string
}

export interface IHisConnectorFieldValue {
  fieldId: string
  value: string | string[] | null
  note?: string
}

export interface IHisConnectorReadResult {
  values: IHisConnectorFieldValue[]
  diagnostics?: string[]
}

export interface IHisIntegrationFieldDiagnostic {
  sessionId: string
  connectorId: string
  fieldId: string
  businessCode: string
  dataSource: string
  exportPath?: string
  value: string | string[] | null
  note?: string
  updatedAt: number
}

export interface IHisMappedFieldReadInput {
  metadataFieldId: string
  fieldId: string
  label?: string
  dataSource: string
  interfaceField: string
  exportPath?: string
}

export interface IHisAcceptanceReportSection {
  title: string
  status: 'success' | 'warning'
  detail: string
}

export interface IHisAcceptanceReport {
  id: string
  title: string
  hospitalId: string
  connectorId?: string
  createdAt: number
  summary: {
    connectorCount: number
    sessionCount: number
    traceCount: number
    failedTraceCount: number
    fieldDiagnosticCount: number
    coveredFieldCount: number
    fieldCoverageRate: number
    writeBackSuccessCount: number
  }
  sections: IHisAcceptanceReportSection[]
}

export interface IHisWriteBackRetryOptions {
  maxAttempts: number
}

export interface IHisWriteBackReplayRecord {
  id: string
  connectorId: string
  sessionId: string
  action: 'writeBack'
  status: HisReplayRecordStatus
  attempts: number
  payload: IHisWriteBackPayload
  idempotencyKey: string
  message?: string
  sampleContext: IHisUnifiedContext
  createdAt: number
  updatedAt: number
}

export interface IHisReplayBundle {
  id: string
  connectorId?: string
  exportedAt: number
  summary: {
    recordCount: number
    failedRecordCount: number
    replayedRecordCount: number
  }
  records: IHisWriteBackReplayRecord[]
}

export interface IHisIntegrationPackageConnectorConfig {
  mode: HisConnectorMode
  authType: HisConnectorAuthType
  launchModes: HisLaunchMode[]
  dataSources: string[]
  capabilities: HisConnectorCapability[]
  endpointAlias?: string
}

export interface IHisIntegrationPackageContextMapping {
  sourceKey: string
  targetKey: keyof IHisUnifiedContext | string
  required?: boolean
}

export interface IHisIntegrationPackageFieldMapping {
  metadataFieldId: string
  dataSource: string
  interfaceField: string
  exportPath?: string
  dictionaryCode?: string
  defaultValue?: string
}

export interface IHisIntegrationPackageDictionaryMapping {
  dictionaryCode: string
  sourceValue: string
  targetValue: string
  label?: string
}

export interface IHisIntegrationPackageStrategySwitches {
  enableRetry?: boolean
  enableReplay?: boolean
  enableAudit?: boolean
  deliveryModes?: Partial<Record<HisWorkflowDocumentStatus, HisWriteBackDeliveryMode>>
}

export interface IHisIntegrationPackageAcceptanceBaseline {
  minFieldCoverageRate: number
  maxFailedTraceCount: number
  requiredCapabilities: HisConnectorCapability[]
}

export interface IHisHospitalIntegrationPackageInput {
  hospitalId: string
  campusId?: string
  packageName: string
  connectorId: string
  connectorConfig: IHisIntegrationPackageConnectorConfig
  contextMappings: IHisIntegrationPackageContextMapping[]
  fieldMappings: IHisIntegrationPackageFieldMapping[]
  dictionaryMappings: IHisIntegrationPackageDictionaryMapping[]
  strategySwitches: IHisIntegrationPackageStrategySwitches
  acceptanceBaseline: IHisIntegrationPackageAcceptanceBaseline
}

export interface IHisHospitalIntegrationPackage
  extends IHisHospitalIntegrationPackageInput {
  id: string
  summary: {
    contextMappingCount: number
    fieldMappingCount: number
    dictionaryMappingCount: number
    enabledStrategyCount: number
    requiredCapabilityCount: number
  }
  createdAt: number
  updatedAt: number
}

export interface IHisOperationAuditEvent {
  id: string
  hospitalId?: string
  campusId?: string
  connectorId?: string
  action: HisOperationAuditAction
  message: string
  createdAt: number
}

export interface IHisInterfaceLogEntry {
  id: string
  connectorId: string
  sessionId?: string
  action: HisIntegrationTraceAction
  status: HisIntegrationTraceStatus
  message: string
  durationMs: number
  createdAt: number
}

export interface IHisOperationAlert {
  id: string
  level: HisOperationAlertLevel
  code: string
  message: string
  count: number
  threshold: number
  createdAt: number
}

export interface IHisManualCompensationEntry {
  id: string
  replayRecordId: string
  connectorId: string
  sessionId: string
  action: 'manualReplay'
  status: HisManualCompensationStatus
  message?: string
  updatedAt: number
}

export interface IHisOperationsSnapshot {
  summary: {
    packageCount: number
    interfaceLogCount: number
    failedInterfaceLogCount: number
    auditEventCount: number
    alertCount: number
    compensationEntryCount: number
  }
  packages: IHisHospitalIntegrationPackage[]
  interfaceLogs: IHisInterfaceLogEntry[]
  auditEvents: IHisOperationAuditEvent[]
  alerts: IHisOperationAlert[]
  compensationEntries: IHisManualCompensationEntry[]
}

export interface IHisWriteBackPayload {
  documentId: string
  status: string
  platformStatus?: HisWorkflowDocumentStatus
  statusText?: string
  structuredValues?: Record<string, unknown>
  qualityConclusion?: string
  archiveSnapshotId?: string
  revisionConclusion?: string
}

export interface IHisDocumentStatusSyncInput {
  documentId: string
  status: HisWorkflowDocumentStatus
  structuredValues?: Record<string, unknown>
  qualityConclusion?: string
  archiveSnapshotId?: string
  revisionConclusion?: string
}

export interface IHisWriteBackResult {
  accepted: boolean
  externalRecordId?: string
  message?: string
  retryable?: boolean
}

export interface IHisConnectorResolveContextRequest {
  launchContext: IHisLaunchContext
}

export interface IHisConnectorReadRequest {
  session: IHisIntegrationSession
  context: IHisUnifiedContext
  fields: IHisConnectorFieldRequest[]
}

export interface IHisConnectorWriteBackRequest {
  session: IHisIntegrationSession
  context: IHisUnifiedContext
  payload: IHisWriteBackPayload
  idempotencyKey: string
}

export interface IHisConnector {
  id: string
  label: string
  mode: HisConnectorMode
  authType: HisConnectorAuthType
  dataSources: string[]
  capabilities: HisConnectorCapability[]
  description?: string
  resolveContext(
    request: IHisConnectorResolveContextRequest
  ): Promise<IHisUnifiedContext> | IHisUnifiedContext
  read(
    request: IHisConnectorReadRequest
  ): Promise<IHisConnectorReadResult> | IHisConnectorReadResult
  writeBack(
    request: IHisConnectorWriteBackRequest
  ): Promise<IHisWriteBackResult> | IHisWriteBackResult
}

export interface IHisConnectorSummary {
  id: string
  label: string
  mode: HisConnectorMode
  authType: HisConnectorAuthType
  dataSources: string[]
  capabilities: HisConnectorCapability[]
  description?: string
}

export interface IHisIntegrationSession {
  id: string
  connectorId: string
  launchMode: HisLaunchMode
  status: HisIntegrationSessionStatus
  context: IHisUnifiedContext
  createdAt: number
  updatedAt: number
}

export interface IHisIntegrationTraceRecord {
  id: string
  connectorId: string
  sessionId?: string
  action: HisIntegrationTraceAction
  status: HisIntegrationTraceStatus
  message: string
  durationMs: number
  createdAt: number
}

export const HIS_WORKFLOW_STATUS_RULES: IHisWorkflowStatusRule[] = [
  {
    status: 'writing',
    hisStatusCode: 'WRITING',
    label: '书写中',
    description: '医生正在平台内编辑病历文书',
    deliveryMode: 'auditOnly'
  },
  {
    status: 'submitted',
    hisStatusCode: 'SUBMITTED',
    label: '已提交',
    description: '病历已提交，等待平台质控或上级复核',
    deliveryMode: 'realtime'
  },
  {
    status: 'pendingSupplement',
    hisStatusCode: 'PENDING_SUPPLEMENT',
    label: '待补录',
    description: '病历缺少关键字段，需要医生补录',
    deliveryMode: 'realtime'
  },
  {
    status: 'pendingRectification',
    hisStatusCode: 'PENDING_RECTIFICATION',
    label: '待整改',
    description: '质控缺陷已退回医生整改',
    deliveryMode: 'realtime'
  },
  {
    status: 'pendingArchive',
    hisStatusCode: 'PENDING_ARCHIVE',
    label: '待归档',
    description: '质控通过，等待病案归档冻结',
    deliveryMode: 'realtime'
  },
  {
    status: 'archived',
    hisStatusCode: 'ARCHIVED',
    label: '已归档',
    description: '病历已完成归档冻结',
    deliveryMode: 'async',
    terminal: true
  },
  {
    status: 'returnedRewrite',
    hisStatusCode: 'RETURNED_REWRITE',
    label: '退回重写',
    description: '病历质量问题严重，需要重新书写',
    deliveryMode: 'realtime'
  }
]

export class HisIntegrationDomainService {
  private readonly connectors = new Map<string, IHisConnector>()
  private readonly sessions = new Map<string, IHisIntegrationSession>()
  private readonly traces: IHisIntegrationTraceRecord[] = []
  private readonly replayRecords = new Map<string, IHisWriteBackReplayRecord>()
  private readonly integrationPackages = new Map<string, IHisHospitalIntegrationPackage>()
  private readonly auditEvents: IHisOperationAuditEvent[] = []
  private fieldDiagnostics: IHisIntegrationFieldDiagnostic[] = []

  registerConnector(connector: IHisConnector) {
    if (!connector.id) {
      throw new Error('HisConnector.id is required')
    }
    this.connectors.set(connector.id, connector)
  }

  listConnectors(): IHisConnectorSummary[] {
    return Array.from(this.connectors.values()).map(connector => ({
      id: connector.id,
      label: connector.label,
      mode: connector.mode,
      authType: connector.authType,
      dataSources: [...connector.dataSources],
      capabilities: [...connector.capabilities],
      description: connector.description
    }))
  }

  listSessions(): IHisIntegrationSession[] {
    return Array.from(this.sessions.values()).map(cloneSession)
  }

  listTraceRecords(): IHisIntegrationTraceRecord[] {
    return this.traces.map(trace => ({ ...trace }))
  }

  listFieldDiagnostics(): IHisIntegrationFieldDiagnostic[] {
    return this.fieldDiagnostics.map(cloneFieldDiagnostic)
  }

  listReplayRecords(): IHisWriteBackReplayRecord[] {
    return Array.from(this.replayRecords.values()).map(cloneReplayRecord)
  }

  upsertHospitalIntegrationPackage(
    input: IHisHospitalIntegrationPackageInput
  ): IHisHospitalIntegrationPackage {
    this.getConnector(input.connectorId)
    const id = createHospitalPackageId(input.hospitalId, input.campusId)
    const current = this.integrationPackages.get(id)
    const now = Date.now()
    const integrationPackage = createHospitalIntegrationPackage({
      ...input,
      id,
      createdAt: current?.createdAt ?? now,
      updatedAt: now
    })
    this.integrationPackages.set(id, integrationPackage)
    this.recordAuditEvent({
      hospitalId: input.hospitalId,
      campusId: input.campusId,
      connectorId: input.connectorId,
      action: 'packageUpsert',
      message: `已更新 ${input.packageName}`
    })
    return cloneHospitalIntegrationPackage(integrationPackage)
  }

  listHospitalIntegrationPackages(filter: {
    hospitalId?: string
    campusId?: string
    connectorId?: string
  } = {}): IHisHospitalIntegrationPackage[] {
    return Array.from(this.integrationPackages.values())
      .filter(item => {
        if (filter.hospitalId && item.hospitalId !== filter.hospitalId) return false
        if (filter.campusId && item.campusId !== filter.campusId) return false
        if (filter.connectorId && item.connectorId !== filter.connectorId) return false
        return true
      })
      .map(cloneHospitalIntegrationPackage)
  }

  resolveHospitalIntegrationPackage(args: {
    hospitalId: string
    campusId?: string
  }): IHisHospitalIntegrationPackage | undefined {
    const campusPackage = args.campusId
      ? this.integrationPackages.get(
          createHospitalPackageId(args.hospitalId, args.campusId)
        )
      : undefined
    const fallbackPackage = this.integrationPackages.get(
      createHospitalPackageId(args.hospitalId)
    )
    const resolved = campusPackage ?? fallbackPackage
    return resolved ? cloneHospitalIntegrationPackage(resolved) : undefined
  }

  listWorkflowStatusRules(): IHisWorkflowStatusRule[] {
    return HIS_WORKFLOW_STATUS_RULES.map(rule => ({ ...rule }))
  }

  getWorkflowStatusRule(
    status: HisWorkflowDocumentStatus
  ): IHisWorkflowStatusRule | undefined {
    const rule = HIS_WORKFLOW_STATUS_RULES.find(item => item.status === status)
    return rule ? { ...rule } : undefined
  }

  async createLaunchSession(args: {
    connectorId: string
    launchMode: HisLaunchMode
    trustedTicket?: string
    ssoToken?: string
    scope: Record<string, string | number | undefined | null>
    variables?: Record<string, string | number | undefined | null>
  }): Promise<IHisIntegrationSession> {
    const connector = this.getConnector(args.connectorId)
    const startedAt = Date.now()
    try {
      const context = await connector.resolveContext({
        launchContext: {
          launchMode: args.launchMode,
          trustedTicket: args.trustedTicket,
          ssoToken: args.ssoToken,
          scope: args.scope,
          variables: args.variables
        }
      })
      const now = Date.now()
      const session: IHisIntegrationSession = {
        id: createId('his-session'),
        connectorId: connector.id,
        launchMode: args.launchMode,
        status: 'active',
        context,
        createdAt: now,
        updatedAt: now
      }
      this.sessions.set(session.id, session)
      this.recordTrace({
        connectorId: connector.id,
        sessionId: session.id,
        action: 'launch',
        status: 'success',
        message: 'HIS 上下文会话已建立',
        durationMs: Date.now() - startedAt
      })
      return cloneSession(session)
    } catch (error) {
      this.recordTrace({
        connectorId: connector.id,
        action: 'launch',
        status: 'failed',
        message: getErrorMessage(error),
        durationMs: Date.now() - startedAt
      })
      throw error
    }
  }

  async readFields(
    sessionId: string,
    fields: IHisConnectorFieldRequest[]
  ): Promise<IHisConnectorReadResult> {
    const session = this.getSession(sessionId)
    const connector = this.getConnector(session.connectorId)
    const startedAt = Date.now()
    try {
      const result = await connector.read({
        session,
        context: session.context,
        fields
      })
      this.updateFieldDiagnostics(session, fields, result)
      this.recordTrace({
        connectorId: connector.id,
        sessionId: session.id,
        action: 'read',
        status: 'success',
        message: `已读取 ${result.values.length} 个字段`,
        durationMs: Date.now() - startedAt
      })
      return {
        values: result.values.map(value => ({ ...value })),
        diagnostics: result.diagnostics ? [...result.diagnostics] : undefined
      }
    } catch (error) {
      this.recordTrace({
        connectorId: connector.id,
        sessionId: session.id,
        action: 'read',
        status: 'failed',
        message: getErrorMessage(error),
        durationMs: Date.now() - startedAt
      })
      throw error
    }
  }

  async readMappedFields(
    sessionId: string,
    mappings: IHisMappedFieldReadInput[]
  ): Promise<IHisConnectorReadResult> {
    return this.readFields(
      sessionId,
      mappings.map(mapping => ({
        fieldId: mapping.fieldId,
        businessCode: mapping.interfaceField,
        dataSource: mapping.dataSource,
        exportPath: mapping.exportPath
      }))
    )
  }

  async writeBack(
    sessionId: string,
    payload: IHisWriteBackPayload,
    idempotencyKey = `${sessionId}:${payload.documentId}:${payload.status}`
  ): Promise<IHisWriteBackResult> {
    const session = this.getSession(sessionId)
    const connector = this.getConnector(session.connectorId)
    const startedAt = Date.now()
    try {
      const result = await connector.writeBack({
        session,
        context: session.context,
        payload,
        idempotencyKey
      })
      this.recordTrace({
        connectorId: connector.id,
        sessionId: session.id,
        action: 'writeBack',
        status: result.accepted ? 'success' : 'failed',
        message: result.message || (result.accepted ? 'HIS 回写成功' : 'HIS 回写失败'),
        durationMs: Date.now() - startedAt
      })
      return { ...result }
    } catch (error) {
      this.recordTrace({
        connectorId: connector.id,
        sessionId: session.id,
        action: 'writeBack',
        status: 'failed',
        message: getErrorMessage(error),
        durationMs: Date.now() - startedAt
      })
      throw error
    }
  }

  async syncDocumentStatus(
    sessionId: string,
    input: IHisDocumentStatusSyncInput
  ): Promise<IHisWriteBackResult> {
    const { payload, idempotencyKey } = this.createDocumentStatusWriteBack(
      sessionId,
      input
    )
    return this.writeBack(
      sessionId,
      payload,
      idempotencyKey
    )
  }

  async syncDocumentStatusWithRetry(
    sessionId: string,
    input: IHisDocumentStatusSyncInput,
    options: IHisWriteBackRetryOptions
  ): Promise<IHisWriteBackResult> {
    const { payload, idempotencyKey } = this.createDocumentStatusWriteBack(
      sessionId,
      input
    )
    return this.writeBackWithRetry(sessionId, payload, idempotencyKey, options)
  }

  async replayWriteBack(recordId: string): Promise<IHisWriteBackResult> {
    const record = this.replayRecords.get(recordId)
    if (!record) {
      throw new Error(`HisWriteBackReplayRecord not found: ${recordId}`)
    }
    const result = await this.writeBack(
      record.sessionId,
      record.payload,
      record.idempotencyKey
    )
    const attempts = record.attempts + 1
    this.replayRecords.set(record.id, {
      ...record,
      attempts,
      status: result.accepted ? 'replayed' : 'failed',
      message: result.message,
      updatedAt: Date.now()
    })
    return result
  }

  exportReplayBundle(filter: { connectorId?: string } = {}): IHisReplayBundle {
    const records = this.listReplayRecords().filter(record => {
      return !filter.connectorId || record.connectorId === filter.connectorId
    })
    return {
      id: createId('his-replay-bundle'),
      connectorId: filter.connectorId,
      exportedAt: Date.now(),
      summary: {
        recordCount: records.length,
        failedRecordCount: records.filter(record => record.status === 'failed').length,
        replayedRecordCount: records.filter(record => record.status === 'replayed').length
      },
      records
    }
  }

  buildOperationsSnapshot(args: {
    hospitalId?: string
    campusId?: string
    connectorId?: string
    failedTraceAlertThreshold?: number
  } = {}): IHisOperationsSnapshot {
    const packages = this.listHospitalIntegrationPackages({
      hospitalId: args.hospitalId,
      campusId: args.campusId,
      connectorId: args.connectorId
    })
    const connectorIds = new Set(packages.map(item => item.connectorId))
    if (args.connectorId) connectorIds.add(args.connectorId)

    const traces = this.listTraceRecords().filter(trace => {
      return !connectorIds.size || connectorIds.has(trace.connectorId)
    })
    const interfaceLogs = traces.map<IHisInterfaceLogEntry>(trace => ({
      ...trace
    }))
    const failedInterfaceLogCount = interfaceLogs.filter(log => {
      return log.status === 'failed'
    }).length
    const auditEvents = this.auditEvents
      .filter(event => {
        if (args.hospitalId && event.hospitalId !== args.hospitalId) return false
        if (args.connectorId && event.connectorId !== args.connectorId) return false
        return true
      })
      .map(event => ({ ...event }))
    const alerts = this.buildOperationAlerts({
      failedInterfaceLogCount,
      threshold: args.failedTraceAlertThreshold ?? 3
    })
    const compensationEntries = this.listReplayRecords()
      .filter(record => !connectorIds.size || connectorIds.has(record.connectorId))
      .map<IHisManualCompensationEntry>(record => ({
        id: `his-compensation:${record.id}`,
        replayRecordId: record.id,
        connectorId: record.connectorId,
        sessionId: record.sessionId,
        action: 'manualReplay',
        status: record.status === 'failed' ? 'pending' : 'completed',
        message: record.message,
        updatedAt: record.updatedAt
      }))

    return {
      summary: {
        packageCount: packages.length,
        interfaceLogCount: interfaceLogs.length,
        failedInterfaceLogCount,
        auditEventCount: auditEvents.length,
        alertCount: alerts.length,
        compensationEntryCount: compensationEntries.length
      },
      packages,
      interfaceLogs,
      auditEvents,
      alerts,
      compensationEntries
    }
  }

  buildAcceptanceReport(args: {
    hospitalId: string
    connectorId?: string
    title?: string
  }): IHisAcceptanceReport {
    const connectors = this.listConnectors().filter(connector => {
      return !args.connectorId || connector.id === args.connectorId
    })
    const sessions = this.listSessions().filter(session => {
      return !args.connectorId || session.connectorId === args.connectorId
    })
    const traces = this.listTraceRecords().filter(trace => {
      return !args.connectorId || trace.connectorId === args.connectorId
    })
    const fieldDiagnostics = this.listFieldDiagnostics().filter(diagnostic => {
      return !args.connectorId || diagnostic.connectorId === args.connectorId
    })
    const coveredFieldCount = fieldDiagnostics.filter(item => {
      return hasDiagnosticValue(item.value)
    }).length
    const failedTraceCount = traces.filter(trace => trace.status === 'failed').length
    const writeBackSuccessCount = traces.filter(trace => {
      return trace.action === 'writeBack' && trace.status === 'success'
    }).length
    const fieldCoverageRate = fieldDiagnostics.length
      ? Math.round((coveredFieldCount / fieldDiagnostics.length) * 100)
      : 0

    return {
      id: createId('his-acceptance-report'),
      title: args.title || 'HIS 接入验收报告',
      hospitalId: args.hospitalId,
      connectorId: args.connectorId,
      createdAt: Date.now(),
      summary: {
        connectorCount: connectors.length,
        sessionCount: sessions.length,
        traceCount: traces.length,
        failedTraceCount,
        fieldDiagnosticCount: fieldDiagnostics.length,
        coveredFieldCount,
        fieldCoverageRate,
        writeBackSuccessCount
      },
      sections: [
        {
          title: '上下文透传',
          status: sessions.length ? 'success' : 'warning',
          detail: sessions.length ? `已建立 ${sessions.length} 个上下文会话` : '暂无上下文会话'
        },
        {
          title: '字段映射命中率',
          status: fieldCoverageRate === 100 ? 'success' : 'warning',
          detail: `字段命中 ${coveredFieldCount}/${fieldDiagnostics.length}，覆盖率 ${fieldCoverageRate}%`
        },
        {
          title: '状态回写',
          status: writeBackSuccessCount ? 'success' : 'warning',
          detail: writeBackSuccessCount
            ? `成功回写 ${writeBackSuccessCount} 次`
            : '暂无成功回写记录'
        },
        {
          title: '错误与耗时',
          status: failedTraceCount ? 'warning' : 'success',
          detail: failedTraceCount ? `失败记录 ${failedTraceCount} 条` : '暂无失败记录'
        }
      ]
    }
  }

  private getConnector(connectorId: string): IHisConnector {
    const connector = this.connectors.get(connectorId)
    if (!connector) {
      throw new Error(`HisConnector not found: ${connectorId}`)
    }
    return connector
  }

  private createDocumentStatusWriteBack(
    sessionId: string,
    input: IHisDocumentStatusSyncInput
  ): { payload: IHisWriteBackPayload; idempotencyKey: string } {
    const rule = this.getWorkflowStatusRule(input.status)
    if (!rule) {
      throw new Error(`HisWorkflowDocumentStatus not found: ${input.status}`)
    }
    return {
      payload: {
        documentId: input.documentId,
        status: rule.hisStatusCode,
        platformStatus: input.status,
        statusText: rule.label,
        structuredValues: input.structuredValues,
        qualityConclusion: input.qualityConclusion,
        archiveSnapshotId: input.archiveSnapshotId,
        revisionConclusion: input.revisionConclusion
      },
      idempotencyKey: `${sessionId}:${input.documentId}:${input.status}`
    }
  }

  private async writeBackWithRetry(
    sessionId: string,
    payload: IHisWriteBackPayload,
    idempotencyKey: string,
    options: IHisWriteBackRetryOptions
  ): Promise<IHisWriteBackResult> {
    let attempts = 0
    let latestResult: IHisWriteBackResult = {
      accepted: false,
      retryable: true,
      message: '尚未执行回写'
    }

    while (attempts < Math.max(options.maxAttempts, 1)) {
      attempts += 1
      latestResult = await this.writeBack(sessionId, payload, idempotencyKey)
      if (latestResult.accepted || latestResult.retryable === false) {
        return latestResult
      }
    }

    this.recordReplay({
      sessionId,
      payload,
      idempotencyKey,
      attempts,
      message: latestResult.message
    })
    return latestResult
  }

  private recordReplay(args: {
    sessionId: string
    payload: IHisWriteBackPayload
    idempotencyKey: string
    attempts: number
    message?: string
  }) {
    const session = this.getSession(args.sessionId)
    const now = Date.now()
    const record: IHisWriteBackReplayRecord = {
      id: createId('his-replay'),
      connectorId: session.connectorId,
      sessionId: session.id,
      action: 'writeBack',
      status: 'failed',
      attempts: args.attempts,
      payload: cloneWriteBackPayload(args.payload),
      idempotencyKey: args.idempotencyKey,
      message: args.message,
      sampleContext: session.context,
      createdAt: now,
      updatedAt: now
    }
    this.replayRecords.set(record.id, record)
  }

  private getSession(sessionId: string): IHisIntegrationSession {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`HisIntegrationSession not found: ${sessionId}`)
    }
    return cloneSession(session)
  }

  private recordTrace(input: Omit<IHisIntegrationTraceRecord, 'id' | 'createdAt'>) {
    this.traces.push({
      id: createId('his-trace'),
      createdAt: Date.now(),
      ...input
    })
  }

  private recordAuditEvent(
    input: Omit<IHisOperationAuditEvent, 'id' | 'createdAt'>
  ) {
    this.auditEvents.push({
      id: createId('his-audit'),
      createdAt: Date.now(),
      ...input
    })
  }

  private buildOperationAlerts(args: {
    failedInterfaceLogCount: number
    threshold: number
  }): IHisOperationAlert[] {
    if (args.failedInterfaceLogCount < args.threshold) return []
    return [
      {
        id: createId('his-alert'),
        level: 'warning',
        code: 'writeback.failed.threshold',
        message: `失败接口调用达到 ${args.failedInterfaceLogCount} 次`,
        count: args.failedInterfaceLogCount,
        threshold: args.threshold,
        createdAt: Date.now()
      }
    ]
  }

  private updateFieldDiagnostics(
    session: IHisIntegrationSession,
    fields: IHisConnectorFieldRequest[],
    result: IHisConnectorReadResult
  ) {
    const valuesByFieldId = new Map(
      result.values.map(value => [value.fieldId, value])
    )
    const updatedAt = Date.now()
    const nextDiagnostics = fields.map(field => {
      const resolved = valuesByFieldId.get(field.fieldId)
      return {
        sessionId: session.id,
        connectorId: session.connectorId,
        fieldId: field.fieldId,
        businessCode: field.businessCode,
        dataSource: field.dataSource,
        exportPath: field.exportPath,
        value: resolved?.value ?? null,
        note: resolved?.note,
        updatedAt
      }
    })
    const nextKeys = new Set(
      nextDiagnostics.map(item => `${item.sessionId}:${item.fieldId}`)
    )
    this.fieldDiagnostics = this.fieldDiagnostics.filter(item => {
      return !nextKeys.has(`${item.sessionId}:${item.fieldId}`)
    }).concat(nextDiagnostics)
  }
}

function cloneSession(session: IHisIntegrationSession): IHisIntegrationSession {
  return {
    ...session,
    context: {
      ...session.context,
      roleCodes: session.context.roleCodes ? [...session.context.roleCodes] : undefined
    }
  }
}

function cloneFieldDiagnostic(
  diagnostic: IHisIntegrationFieldDiagnostic
): IHisIntegrationFieldDiagnostic {
  return {
    ...diagnostic,
    value: Array.isArray(diagnostic.value)
      ? [...diagnostic.value]
      : diagnostic.value
  }
}

function cloneReplayRecord(
  record: IHisWriteBackReplayRecord
): IHisWriteBackReplayRecord {
  return {
    ...record,
    payload: cloneWriteBackPayload(record.payload),
    sampleContext: {
      ...record.sampleContext,
      roleCodes: record.sampleContext.roleCodes
        ? [...record.sampleContext.roleCodes]
        : undefined
    }
  }
}

function createHospitalPackageId(hospitalId: string, campusId?: string): string {
  return `${hospitalId}:${campusId || 'default'}`
}

function createHospitalIntegrationPackage(
  input: IHisHospitalIntegrationPackageInput & {
    id: string
    createdAt: number
    updatedAt: number
  }
): IHisHospitalIntegrationPackage {
  return {
    ...input,
    connectorConfig: cloneConnectorConfig(input.connectorConfig),
    contextMappings: input.contextMappings.map(item => ({ ...item })),
    fieldMappings: input.fieldMappings.map(item => ({ ...item })),
    dictionaryMappings: input.dictionaryMappings.map(item => ({ ...item })),
    strategySwitches: cloneStrategySwitches(input.strategySwitches),
    acceptanceBaseline: cloneAcceptanceBaseline(input.acceptanceBaseline),
    summary: {
      contextMappingCount: input.contextMappings.length,
      fieldMappingCount: input.fieldMappings.length,
      dictionaryMappingCount: input.dictionaryMappings.length,
      enabledStrategyCount: countEnabledStrategies(input.strategySwitches),
      requiredCapabilityCount: input.acceptanceBaseline.requiredCapabilities.length
    }
  }
}

function cloneHospitalIntegrationPackage(
  integrationPackage: IHisHospitalIntegrationPackage
): IHisHospitalIntegrationPackage {
  return createHospitalIntegrationPackage(integrationPackage)
}

function cloneConnectorConfig(
  config: IHisIntegrationPackageConnectorConfig
): IHisIntegrationPackageConnectorConfig {
  return {
    ...config,
    launchModes: [...config.launchModes],
    dataSources: [...config.dataSources],
    capabilities: [...config.capabilities]
  }
}

function cloneStrategySwitches(
  switches: IHisIntegrationPackageStrategySwitches
): IHisIntegrationPackageStrategySwitches {
  return {
    ...switches,
    deliveryModes: switches.deliveryModes ? { ...switches.deliveryModes } : undefined
  }
}

function cloneAcceptanceBaseline(
  baseline: IHisIntegrationPackageAcceptanceBaseline
): IHisIntegrationPackageAcceptanceBaseline {
  return {
    ...baseline,
    requiredCapabilities: [...baseline.requiredCapabilities]
  }
}

function countEnabledStrategies(
  switches: IHisIntegrationPackageStrategySwitches
): number {
  return [
    switches.enableRetry,
    switches.enableReplay,
    switches.enableAudit
  ].filter(Boolean).length
}

function cloneWriteBackPayload(payload: IHisWriteBackPayload): IHisWriteBackPayload {
  return {
    ...payload,
    structuredValues: payload.structuredValues
      ? { ...payload.structuredValues }
      : undefined
  }
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function hasDiagnosticValue(value: string | string[] | null): boolean {
  if (Array.isArray(value)) return value.length > 0
  return value !== null && value !== ''
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
