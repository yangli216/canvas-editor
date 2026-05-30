import type { TemplateDocumentStatus } from '../../../editor/template/TemplateDocumentStore'

export type QualityRuleStage =
  | 'writing'
  | 'department'
  | 'terminal'
  | 'archive'
  | 'special'

export type QualityRuleLevel = 'blocker' | 'serious' | 'normal' | 'info'

export type QualityRuleCheckType =
  | 'field'
  | 'content'
  | 'timeliness'
  | 'consistency'
  | 'homepage'
  | 'coding'
  | 'attachment'

export interface IQualityRuleTarget {
  departments?: string[]
  documentTypes?: string[]
  templateIds?: string[]
  statuses?: TemplateDocumentStatus[]
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
  status?: TemplateDocumentStatus
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function bumpPatchVersion(version: string) {
  const [major = 1, minor = 0, patch = 0] = version
    .split('.')
    .map(part => Number(part))

  return `${major}.${minor}.${patch + 1}`
}

function matchesTargetValue(values: string[] | undefined, value?: string) {
  if (!values?.length) return true
  return Boolean(value && values.includes(value))
}

function matchesTarget(
  target: IQualityRuleTarget | undefined,
  context: IQualityRuleMatchContext
) {
  if (!target) return true
  return matchesTargetValue(target.departments, context.department) &&
    matchesTargetValue(target.documentTypes, context.documentType) &&
    matchesTargetValue(target.templateIds, context.templateId) &&
    matchesTargetValue(target.statuses, context.status)
}

export class QualityStandardDomainService {
  private readonly rulePackages = new Map<string, IQualityRulePackage>()
  private readonly snapshots = new Map<string, IQualityRulePackage[]>()

  createRulePackage(
    input: IQualityRulePackageInput,
    operator = '质控管理员'
  ) {
    const now = Date.now()
    const rulePackage: IQualityRulePackage = {
      ...clone(input),
      version: '1.0.0',
      enabled: true,
      createdAt: now,
      updatedAt: now,
      createdBy: operator,
      updatedBy: operator
    }

    this.rulePackages.set(rulePackage.id, rulePackage)
    this._addSnapshot(rulePackage)

    return clone(rulePackage)
  }

  setRulePackageEnabled(
    id: string,
    enabled: boolean,
    operator = '质控管理员'
  ) {
    const current = this.rulePackages.get(id)
    if (!current) throw new Error(`质控规则包不存在：${id}`)

    const rulePackage: IQualityRulePackage = {
      ...current,
      enabled,
      version: bumpPatchVersion(current.version),
      updatedAt: Date.now(),
      updatedBy: operator
    }

    this.rulePackages.set(id, rulePackage)
    this._addSnapshot(rulePackage)

    return clone(rulePackage)
  }

  matchRulePackages(context: IQualityRuleMatchContext) {
    return Array.from(this.rulePackages.values())
      .filter(rulePackage => rulePackage.enabled)
      .filter(rulePackage => rulePackage.stage === context.stage)
      .filter(rulePackage => matchesTarget(rulePackage.target, context))
      .map(clone)
  }

  getRulePackageSnapshots(id: string) {
    return (this.snapshots.get(id) ?? []).map(clone)
  }

  listRulePackages() {
    return Array.from(this.rulePackages.values()).map(clone)
  }

  private _addSnapshot(rulePackage: IQualityRulePackage) {
    const snapshots = this.snapshots.get(rulePackage.id) ?? []
    this.snapshots.set(rulePackage.id, [...snapshots, clone(rulePackage)])
  }
}