import type { IHisIntegrationCenterViewModel } from './service'

export interface IHisIntegrationCenterViewOptions {
  getModel: () => IHisIntegrationCenterViewModel
}

export function createHisIntegrationCenterView(
  options: IHisIntegrationCenterViewOptions
): HTMLDivElement {
  const content = document.createElement('div')
  content.className = 'tm-version-center'

  const render = () => {
    const model = options.getModel()
    content.innerHTML = ''

    const summary = document.createElement('div')
    summary.className = 'tm-version-center__summary'
    summary.innerHTML = `
      <div><span>连接器</span><strong>${model.summary.connectorCount}</strong></div>
      <div><span>有效会话</span><strong>${model.summary.activeSessionCount}</strong></div>
      <div><span>追踪记录</span><strong>${model.summary.traceCount}</strong></div>
      <div><span>失败 / 平均耗时</span><strong>${model.summary.failedTraceCount}/${model.summary.averageDurationMs}ms</strong></div>
      <div><span>字段覆盖</span><strong>${model.summary.coveredFieldCount}/${model.summary.fieldDiagnosticCount} · ${model.summary.fieldCoverageRate}%</strong></div>
      <div><span>交付包 / 告警</span><strong>${model.summary.packageCount}/${model.summary.operationAlertCount}</strong></div>
      <div><span>人工补偿</span><strong>${model.summary.compensationEntryCount}</strong></div>
    `
    content.append(summary)

    appendSection(content, '连接器状态')
    const connectorList = document.createElement('div')
    connectorList.className = 'tm-center-list'
    model.connectors.forEach(connector => {
      const row = createInfoRow(
        connector.label,
        `${connector.modeText} / ${connector.authText} / ${connector.dataSourceText}`,
        connector.capabilityText,
        connector.statusText,
        connector.statusText === '可联调' ? 'success' : 'warning'
      )
      connectorList.append(row)
    })
    content.append(connectorList)

    appendSection(content, '上下文会话')
    const sessionList = document.createElement('div')
    sessionList.className = 'tm-center-list'
    if (!model.sessions.length) {
      sessionList.append(createEmpty('暂无 HIS 上下文会话。'))
    } else {
      model.sessions.forEach(session => {
        sessionList.append(createInfoRow(
          session.launchModeText,
          session.contextText,
          `连接器 ${session.connectorId}`,
          session.statusText,
          session.status === 'active' ? 'success' : 'warning'
        ))
      })
    }
    content.append(sessionList)

    appendSection(content, '字段回填诊断')
    const fieldList = document.createElement('div')
    fieldList.className = 'tm-center-list'
    if (!model.fieldDiagnostics.length) {
      fieldList.append(createEmpty('暂无字段回填诊断。'))
    } else {
      model.fieldDiagnostics.forEach(field => {
        fieldList.append(createInfoRow(
          field.label || field.fieldId,
          field.mappingText,
          field.note || field.valueText,
          field.statusText,
          field.statusText === '已命中' ? 'success' : 'warning'
        ))
      })
    }
    content.append(fieldList)

    appendSection(content, '运维交付与补偿')
    const operationList = document.createElement('div')
    operationList.className = 'tm-center-list'
    if (
      !model.operations.alerts.length &&
      !model.operations.compensationEntries.length
    ) {
      operationList.append(createEmpty('暂无运维告警和人工补偿任务。'))
    } else {
      model.operations.alerts.forEach(alert => {
        operationList.append(createInfoRow(
          alert.statusText,
          alert.detailText,
          `${alert.code} / 阈值 ${alert.threshold}`,
          alert.statusText,
          alert.level === 'danger' ? 'danger' : 'warning'
        ))
      })
      model.operations.compensationEntries.forEach(entry => {
        operationList.append(createInfoRow(
          entry.actionText,
          entry.detailText,
          entry.message || `会话 ${entry.sessionId}`,
          entry.statusText,
          entry.status === 'pending' ? 'warning' : 'success'
        ))
      })
    }
    content.append(operationList)

    appendSection(content, '联调追踪')
    const traceList = document.createElement('div')
    traceList.className = 'tm-center-list'
    if (!model.traces.length) {
      traceList.append(createEmpty('暂无联调追踪记录。'))
    } else {
      model.traces.slice(0, 12).forEach(trace => {
        traceList.append(createInfoRow(
          trace.actionText,
          trace.message,
          `${trace.connectorId} / ${trace.durationMs}ms`,
          trace.statusText,
          trace.status === 'success' ? 'success' : 'danger'
        ))
      })
    }
    content.append(traceList)
  }

  render()
  return content
}

function appendSection(content: HTMLElement, titleText: string) {
  const title = document.createElement('div')
  title.className = 'tm-version-center__section-title'
  title.textContent = titleText
  content.append(title)
}

function createInfoRow(
  nameText: string,
  detailText: string,
  subText: string,
  badgeText: string,
  badgeTone: 'success' | 'warning' | 'danger'
): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'tm-center-list__row'
  const info = document.createElement('div')
  info.className = 'tm-center-list__info'
  const name = document.createElement('strong')
  name.textContent = nameText
  const detail = document.createElement('small')
  detail.textContent = detailText
  const sub = document.createElement('small')
  sub.textContent = subText
  info.append(name, detail, sub)
  const badge = document.createElement('span')
  badge.className = `tm-center-badge tm-center-badge--${badgeTone}`
  badge.textContent = badgeText
  row.append(info, badge)
  return row
}

function createEmpty(text: string): HTMLDivElement {
  const empty = document.createElement('div')
  empty.className = 'tm-center-empty'
  empty.textContent = text
  return empty
}
