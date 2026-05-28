import type {
  HisConnectorAuthType,
  HisConnectorCapability,
  HisConnectorMode,
  HisIntegrationTraceAction,
  HisIntegrationTraceStatus,
  HisLaunchMode,
  IHisOperationsSnapshot,
  IHisUnifiedContext
} from '../../domain/his-integration-domain-service'

export type IHisIntegrationCenterOperationsSnapshot = IHisOperationsSnapshot

export interface IHisIntegrationCenterConnector {
  id: string
  label: string
  mode: HisConnectorMode
  authType: HisConnectorAuthType
  dataSources: string[]
  capabilities: HisConnectorCapability[]
  description?: string
}

export interface IHisIntegrationCenterSession {
  id: string
  connectorId: string
  launchMode: HisLaunchMode
  status: 'active' | 'expired' | 'failed'
  context: IHisUnifiedContext
  createdAt: number
  updatedAt: number
}

export interface IHisIntegrationCenterTraceRecord {
  id: string
  connectorId: string
  sessionId?: string
  action: HisIntegrationTraceAction
  status: HisIntegrationTraceStatus
  message: string
  durationMs: number
  createdAt: number
}

export interface IHisIntegrationCenterFieldDiagnostic {
  fieldId: string
  label?: string
  businessCode: string
  dataSource: string
  value: string | string[] | null
  note?: string
}

export interface IHisIntegrationCenterViewModel {
  summary: {
    connectorCount: number
    activeSessionCount: number
    traceCount: number
    failedTraceCount: number
    averageDurationMs: number
    fieldDiagnosticCount: number
    coveredFieldCount: number
    fieldCoverageRate: number
    packageCount: number
    operationAlertCount: number
    compensationEntryCount: number
  }
  connectors: Array<IHisIntegrationCenterConnector & {
    modeText: string
    authText: string
    statusText: string
    dataSourceText: string
    capabilityText: string
  }>
  sessions: Array<IHisIntegrationCenterSession & {
    launchModeText: string
    statusText: string
    contextText: string
  }>
  traces: Array<IHisIntegrationCenterTraceRecord & {
    actionText: string
    statusText: string
  }>
  fieldDiagnostics: Array<IHisIntegrationCenterFieldDiagnostic & {
    statusText: string
    valueText: string
    mappingText: string
  }>
  operations: {
    alerts: Array<IHisOperationsSnapshot['alerts'][number] & {
      statusText: string
      detailText: string
    }>
    compensationEntries: Array<
      IHisOperationsSnapshot['compensationEntries'][number] & {
        actionText: string
        statusText: string
        detailText: string
      }
    >
  }
}

const MODE_TEXT: Record<HisConnectorMode, string> = {
  mock: '本地 Mock',
  sandbox: '医院沙箱',
  production: '生产连接'
}

const AUTH_TEXT: Record<HisConnectorAuthType, string> = {
  none: '无需认证',
  trustedTicket: '可信票据',
  ssoToken: '单点令牌'
}

const CAPABILITY_TEXT: Record<HisConnectorCapability, string> = {
  context: '上下文',
  read: '读取',
  writeback: '回写',
  callback: '回调'
}

const LAUNCH_MODE_TEXT: Record<HisLaunchMode, string> = {
  embedded: 'HIS 内嵌',
  redirect: '单点跳转',
  callback: '回调接入'
}

const ACTION_TEXT: Record<HisIntegrationTraceAction, string> = {
  launch: '上下文会话',
  read: '字段读取',
  writeBack: '状态回写',
  callback: 'HIS 回调'
}

const TRACE_STATUS_TEXT: Record<HisIntegrationTraceStatus, string> = {
  success: '成功',
  failed: '失败'
}

const ALERT_LEVEL_TEXT: Record<string, string> = {
  warning: '预警',
  danger: '严重'
}

const COMPENSATION_STATUS_TEXT: Record<string, string> = {
  pending: '待处理',
  completed: '已处理'
}

export function buildHisIntegrationCenterViewModel(args: {
  connectors: IHisIntegrationCenterConnector[]
  sessions: IHisIntegrationCenterSession[]
  traces: IHisIntegrationCenterTraceRecord[]
  fieldDiagnostics?: IHisIntegrationCenterFieldDiagnostic[]
  operationsSnapshot?: IHisOperationsSnapshot
}): IHisIntegrationCenterViewModel {
  const failedTraceCount = args.traces.filter(trace => trace.status === 'failed').length
  const fieldDiagnostics = args.fieldDiagnostics ?? []
  const operationsSnapshot = args.operationsSnapshot
  const coveredFieldCount = fieldDiagnostics.filter(item => hasFieldValue(item.value)).length
  const averageDurationMs = args.traces.length
    ? Math.round(
        args.traces.reduce((sum, trace) => sum + trace.durationMs, 0) /
          args.traces.length
      )
    : 0

  return {
    summary: {
      connectorCount: args.connectors.length,
      activeSessionCount: args.sessions.filter(session => session.status === 'active').length,
      traceCount: args.traces.length,
      failedTraceCount,
      averageDurationMs,
      fieldDiagnosticCount: fieldDiagnostics.length,
      coveredFieldCount,
      fieldCoverageRate: fieldDiagnostics.length
        ? Math.round((coveredFieldCount / fieldDiagnostics.length) * 100)
        : 0,
      packageCount: operationsSnapshot?.summary.packageCount ?? 0,
      operationAlertCount: operationsSnapshot?.summary.alertCount ?? 0,
      compensationEntryCount: operationsSnapshot?.summary.compensationEntryCount ?? 0
    },
    connectors: args.connectors.map(connector => ({
      ...connector,
      modeText: MODE_TEXT[connector.mode],
      authText: AUTH_TEXT[connector.authType],
      statusText: connector.capabilities.includes('context') ? '可联调' : '待配置',
      dataSourceText: connector.dataSources.join(' / ') || '未配置数据源',
      capabilityText: connector.capabilities.map(item => CAPABILITY_TEXT[item]).join(' / ')
    })),
    sessions: args.sessions
      .slice()
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map(session => ({
        ...session,
        launchModeText: LAUNCH_MODE_TEXT[session.launchMode],
        statusText: session.status === 'active' ? '有效' : session.status === 'expired' ? '已过期' : '失败',
        contextText: buildContextText(session.context)
      })),
    traces: args.traces
      .slice()
      .sort((left, right) => right.createdAt - left.createdAt)
      .map(trace => ({
        ...trace,
        actionText: ACTION_TEXT[trace.action],
        statusText: TRACE_STATUS_TEXT[trace.status]
      })),
    fieldDiagnostics: fieldDiagnostics.map(item => ({
      ...item,
      statusText: hasFieldValue(item.value) ? '已命中' : '缺失',
      valueText: formatFieldValue(item.value),
      mappingText: `${item.dataSource} / ${item.businessCode}`
      })),
    operations: {
      alerts: (operationsSnapshot?.alerts ?? []).map(alert => ({
        ...alert,
        statusText: ALERT_LEVEL_TEXT[alert.level] ?? alert.level,
        detailText: alert.message
      })),
      compensationEntries: (operationsSnapshot?.compensationEntries ?? [])
        .map(entry => ({
          ...entry,
          actionText: entry.action === 'manualReplay' ? '人工重放' : entry.action,
          statusText: COMPENSATION_STATUS_TEXT[entry.status] ?? entry.status,
          detailText: `${entry.connectorId} / ${entry.replayRecordId}`
        }))
    }
  }
}

function buildContextText(context: IHisUnifiedContext): string {
  return [
    `患者 ${context.patientId}`,
    `就诊 ${context.encounterId}`,
    `操作员 ${context.operatorName || context.operatorId || '未知'}`
  ].join(' / ')
}

function hasFieldValue(value: string | string[] | null): boolean {
  if (Array.isArray(value)) return value.length > 0
  return value !== null && value !== ''
}

function formatFieldValue(value: string | string[] | null): string {
  if (Array.isArray(value)) return value.length ? value.join('、') : '空值'
  return value || '空值'
}
