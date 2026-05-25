import { templateDataAdapterRegistry } from './TemplateDataAdapter'
import type { ITemplateDocumentRecord } from './TemplateDocumentStore'
import {
  type ITemplateRegistryEntry,
  type ITemplateTrialRunRecord
} from './TemplateRegistry'
import { buildTemplateFieldRuntimeIndex } from './TemplateRuntime'
import { validateSchema } from './index'

export type TemplateAdmissionIssueLevel = 'blocker' | 'warning' | 'info'
export type TemplateAdmissionIssueCategory =
  | 'asset'
  | 'schema'
  | 'dataBinding'
  | 'pageDecoration'
  | 'trial'
  | 'clinicalImpact'

export interface ITemplateAdmissionIssue {
  level: TemplateAdmissionIssueLevel
  category: TemplateAdmissionIssueCategory
  message: string
  targetId?: string
}

export interface ITemplateClinicalImpactSummary {
  boundDocumentCount: number
  currentVersionDocumentCount: number
  outdatedVersionDocumentCount: number
}

export interface ITemplateAdmissionReport {
  status: 'passed' | 'blocked' | 'warning'
  blockerCount: number
  warningCount: number
  infoCount: number
  issueCount: number
  dataBindingCoverage: number
  latestTrialRun?: ITemplateTrialRunRecord
  clinicalImpact: ITemplateClinicalImpactSummary
  issues: ITemplateAdmissionIssue[]
}

export interface IBuildTemplateAdmissionReportOptions {
  documents?: ITemplateDocumentRecord[]
}

function getIssueCounts(issues: ITemplateAdmissionIssue[]) {
  return {
    blockerCount: issues.filter(item => item.level === 'blocker').length,
    warningCount: issues.filter(item => item.level === 'warning').length,
    infoCount: issues.filter(item => item.level === 'info').length
  }
}

function createClinicalImpact(
  entry: ITemplateRegistryEntry,
  documents: ITemplateDocumentRecord[] = []
): ITemplateClinicalImpactSummary {
  const boundDocuments = documents.filter(item => item.template.id === entry.schema.id)
  return {
    boundDocumentCount: boundDocuments.length,
    currentVersionDocumentCount: boundDocuments.filter(item =>
      item.template.version === entry.schema.version
    ).length,
    outdatedVersionDocumentCount: boundDocuments.filter(item =>
      item.template.version !== entry.schema.version
    ).length
  }
}

export function buildTemplateAdmissionReport(
  entry: ITemplateRegistryEntry,
  options: IBuildTemplateAdmissionReportOptions = {}
): ITemplateAdmissionReport {
  const issues: ITemplateAdmissionIssue[] = []
  const schemaErrors = validateSchema(entry.schema)
  schemaErrors.forEach(error => {
    issues.push({
      level: 'blocker',
      category: 'schema',
      message: error.message,
      targetId: error.fieldId
    })
  })

  const asset = entry.asset ?? {}
  ;([
    ['department', '未配置所属科室'],
    ['documentType', '未配置文书类型'],
    ['owner', '未配置模板负责人']
  ] as Array<[keyof typeof asset, string]>).forEach(([key, message]) => {
    if (!asset[key]) {
      issues.push({ level: 'warning', category: 'asset', message })
    }
  })

  const fieldIndex = buildTemplateFieldRuntimeIndex(entry.schema)
  let coveredBindingCount = 0
  fieldIndex.all.forEach(node => {
    const { field, metadata } = node
    if (!metadata?.businessCode && !metadata?.exportPath) {
      issues.push({
        level: 'warning',
        category: 'dataBinding',
        message: `字段 ${field.label || field.id} 未配置业务编码或导出路径`,
        targetId: field.id
      })
    }
    if (!metadata?.dataSource) {
      issues.push({
        level: 'warning',
        category: 'dataBinding',
        message: `字段 ${field.label || field.id} 未绑定数据源`,
        targetId: field.id
      })
      return
    }
    const adapter = templateDataAdapterRegistry.getByDataSource(metadata.dataSource)
    if (!adapter) {
      issues.push({
        level: 'warning',
        category: 'dataBinding',
        message: `数据源 ${metadata.dataSource} 暂无适配器覆盖`,
        targetId: field.id
      })
      return
    }
    coveredBindingCount += 1
  })

  const pageDecorations = entry.schema.layout?.pageDecorations
  if (!pageDecorations?.header && !pageDecorations?.footer) {
    issues.push({
      level: 'info',
      category: 'pageDecoration',
      message: '未套用预定义页眉页脚方案，可按院内规范确认是否需要配置'
    })
  }

  const trialRuns = entry.trialRuns ?? []
  const latestTrialRun = trialRuns.slice().sort((a, b) => b.timestamp - a.timestamp)[0]
  if (!latestTrialRun) {
    issues.push({
      level: 'warning',
      category: 'trial',
      message: '尚未保存试运行验证结果'
    })
  } else if (latestTrialRun.status === 'failed') {
    issues.push({
      level: 'blocker',
      category: 'trial',
      message: `最近一次试运行未通过：${latestTrialRun.summary || latestTrialRun.scenario}`
    })
  }

  const clinicalImpact = createClinicalImpact(entry, options.documents)
  if (clinicalImpact.outdatedVersionDocumentCount > 0) {
    issues.push({
      level: 'info',
      category: 'clinicalImpact',
      message: `${clinicalImpact.outdatedVersionDocumentCount} 份病历仍绑定历史模板版本`
    })
  }

  const counts = getIssueCounts(issues)
  const dataBindingCoverage = fieldIndex.all.length
    ? Math.round((coveredBindingCount / fieldIndex.all.length) * 100)
    : 100
  const status = counts.blockerCount
    ? 'blocked'
    : counts.warningCount
      ? 'warning'
      : 'passed'

  return {
    status,
    ...counts,
    issueCount: issues.length,
    dataBindingCoverage,
    latestTrialRun,
    clinicalImpact,
    issues
  }
}