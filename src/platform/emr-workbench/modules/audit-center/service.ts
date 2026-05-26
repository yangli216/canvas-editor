export interface IAuditCenterTemplateItem {
  id: string
  name: string
}

export interface IAuditCenterSource {
  listTemplateAudits(templateId: string): Array<{
    action: string
    timestamp: number
    note?: string
    detail?: string
  }>
  listTemplateDocumentTraces(templateId: string): Array<{
    title?: string
    status: string
    traceTimeline: Array<{
      action: string
      timestamp: number
    }>
  }>
}

export interface IAuditCenterViewModel {
  summary: {
    auditCount: number
    traceCount: number
    signedCount: number
    pendingReviewCount: number
  }
  templateAudits: Array<{
    kind: 'template'
    templateName: string
    action: string
    detail: string
    timeText: string
    timestamp: number
  }>
  documentTraces: Array<{
    kind: 'document'
    templateName: string
    action: string
    detail: string
    timeText: string
    timestamp: number
  }>
}

export function buildAuditCenterViewModel(
  source: IAuditCenterSource,
  items: IAuditCenterTemplateItem[]
): IAuditCenterViewModel {
  const templateAudits = items
    .flatMap(item =>
      source.listTemplateAudits(item.id).map(record => ({
        templateName: item.name,
        action: record.action,
        detail: record.detail || record.note || '无补充说明',
        timestamp: record.timestamp
      }))
    )
    .sort((a, b) => b.timestamp - a.timestamp)

  const documentTraces = items
    .flatMap(item =>
      source.listTemplateDocumentTraces(item.id).map(record => {
        const latestEvent = record.traceTimeline.at(-1)
        return {
          templateName: item.name,
          action: latestEvent?.action || record.status,
          detail: `${record.title || '未命名病历'} / ${record.traceTimeline.length} 条留痕`,
          timestamp: latestEvent?.timestamp || 0,
          status: record.status,
          hasReview: record.traceTimeline.some(event => event.action === 'review')
        }
      })
    )
    .sort((a, b) => b.timestamp - a.timestamp)

  return {
    summary: {
      auditCount: templateAudits.length,
      traceCount: documentTraces.length,
      signedCount: documentTraces.filter(record => record.status === 'signed')
        .length,
      pendingReviewCount: documentTraces.filter(record => !record.hasReview)
        .length
    },
    templateAudits: templateAudits.slice(0, 8).map(record => ({
      kind: 'template',
      templateName: record.templateName,
      action: record.action,
      detail: record.detail,
      timeText: new Date(record.timestamp).toLocaleString(),
      timestamp: record.timestamp
    })),
    documentTraces: documentTraces.slice(0, 8).map(record => ({
      kind: 'document',
      templateName: record.templateName,
      action: record.action,
      detail: record.detail,
      timeText: record.timestamp
        ? new Date(record.timestamp).toLocaleString()
        : '暂无记录',
      timestamp: record.timestamp
    }))
  }
}