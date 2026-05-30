import type {
  IQualityRulePackage,
  QualityRuleStage
} from '../../domain/quality-standard-domain-service'

export interface IQualityStandardCenterViewModel {
  summary: {
    packageCount: number
    enabledCount: number
    disabledCount: number
    blockerRuleCount: number
  }
  packages: Array<{
    id: string
    name: string
    version: string
    stage: QualityRuleStage
    enabled: boolean
    statusText: string
    ruleCount: number
    blockerRuleCount: number
    scoringPolicyText: string
  }>
}

function getBlockerRuleCount(rulePackage: IQualityRulePackage) {
  return rulePackage.rules.filter(rule => rule.level === 'blocker' || rule.veto)
    .length
}

export function buildQualityStandardCenterViewModel(args: {
  packages: IQualityRulePackage[]
}): IQualityStandardCenterViewModel {
  const packages = args.packages.map(rulePackage => ({
    id: rulePackage.id,
    name: rulePackage.name,
    version: rulePackage.version,
    stage: rulePackage.stage,
    enabled: rulePackage.enabled,
    statusText: rulePackage.enabled ? '已启用' : '已停用',
    ruleCount: rulePackage.rules.length,
    blockerRuleCount: getBlockerRuleCount(rulePackage),
    scoringPolicyText: rulePackage.scoringPolicyId || '默认评分策略'
  }))

  return {
    summary: {
      packageCount: packages.length,
      enabledCount: packages.filter(item => item.enabled).length,
      disabledCount: packages.filter(item => !item.enabled).length,
      blockerRuleCount: packages.reduce(
        (sum, item) => sum + item.blockerRuleCount,
        0
      )
    },
    packages
  }
}