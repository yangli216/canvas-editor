import type { ITemplateAdmissionReport } from '../../../../editor/template/TemplateGovernance'

export interface IAdmissionCenterViewModel {
  summary: {
    statusText: string
    blockerCount: number
    warningCount: number
    dataBindingCoverage: number
    boundDocumentCount: number
  }
  issues: Array<{
    level: 'blocker' | 'warning' | 'info'
    levelText: string
    message: string
    category: string
  }>
}

export function buildAdmissionCenterViewModel(
  report: ITemplateAdmissionReport
): IAdmissionCenterViewModel {
  return {
    summary: {
      statusText: report.status === 'passed'
        ? '通过'
        : report.status === 'blocked'
          ? '阻断'
          : '待确认',
      blockerCount: report.blockerCount,
      warningCount: report.warningCount,
      dataBindingCoverage: report.dataBindingCoverage,
      boundDocumentCount: report.clinicalImpact.boundDocumentCount
    },
    issues: report.issues.map(issue => ({
      level: issue.level,
      levelText: issue.level === 'blocker'
        ? '阻断'
        : issue.level === 'warning'
          ? '警告'
          : '提示',
      message: issue.message,
      category: issue.category
    }))
  }
}