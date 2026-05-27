import type { ITemplateTrialRunRecord } from '../../domain'

export interface ITrialRunCenterViewModel {
  summary: {
    total: number
    passedCount: number
    failedCount: number
    latestStatusText: string
    latestTimeText: string
  }
  history: Array<{
    id: string
    statusText: string
    scenario: string
    note: string
    timeText: string
  }>
}

export function buildTrialRunCenterViewModel(
  records: ITemplateTrialRunRecord[]
): ITrialRunCenterViewModel {
  const latest = records.at(-1)
  return {
    summary: {
      total: records.length,
      passedCount: records.filter(record => record.status === 'passed').length,
      failedCount: records.filter(record => record.status === 'failed').length,
      latestStatusText: latest
        ? latest.status === 'passed'
          ? '最近一次通过'
          : '最近一次失败'
        : '尚未验证',
      latestTimeText: latest
        ? new Date(latest.timestamp).toLocaleString()
        : '暂无记录'
    },
    history: records.slice(0, 6).map(record => ({
      id: record.id,
      statusText: record.status === 'passed' ? '通过' : '失败',
      scenario: record.scenario,
      note: record.summary || '无验证说明',
      timeText: new Date(record.timestamp).toLocaleString()
    }))
  }
}