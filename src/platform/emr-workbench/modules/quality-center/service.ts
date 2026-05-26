export interface IQualityCenterRule {
  id: string
  label: string
  category: 'schema' | 'dataBinding' | 'release' | 'documentTrace'
  description: string
}

export interface IQualityCenterTemplateItem {
  id: string
  name: string
  admissionReport: {
    blockerCount: number
    warningCount: number
    issues: Array<{
      category: string
    }>
  }
}

export interface IQualityCenterTraceDomain {
  listByTemplate(templateId: string): Array<{
    id: string
  }>
  getTraceTimeline(id: string): Array<{
    action: string
  }>
}

export interface IQualityCenterViewModel {
  summary: {
    templateCount: number
    ruleStateText: string
    blockerCount: number
    incompleteTraceCount: number
  }
  rules: Array<{
    id: string
    label: string
    description: string
    hitCount: number
    enabled: boolean
    statusText: string
    actionLabel: string
  }>
  risks: Array<{
    name: string
    badgeText: string
    detail: string
    level: 'blocker' | 'warning'
  }>
}

export function buildQualityCenterViewModel(args: {
  rules: IQualityCenterRule[]
  disabledRuleIds: string[]
  items: IQualityCenterTemplateItem[]
  medicalRecordDomain: IQualityCenterTraceDomain
}): IQualityCenterViewModel {
  const { rules, disabledRuleIds, items, medicalRecordDomain } = args
  const disabledRuleIdSet = new Set(disabledRuleIds)
  const traceGapByTemplate = new Map<string, number>()
  let incompleteTraceCount = 0

  items.forEach(item => {
    const gapCount = medicalRecordDomain
      .listByTemplate(item.id)
      .filter(record => {
        const actions = new Set(
          medicalRecordDomain
            .getTraceTimeline(record.id)
            .map(event => event.action)
        )
        return (
          !actions.has('writing_start') ||
          !actions.has('sign') ||
          !actions.has('review')
        )
      }).length
    traceGapByTemplate.set(item.id, gapCount)
    incompleteTraceCount += gapCount
  })

  return {
    summary: {
      templateCount: items.length,
      ruleStateText: `${rules.length - disabledRuleIds.length} / ${disabledRuleIds.length}`,
      blockerCount: items.reduce(
        (sum, item) => sum + item.admissionReport.blockerCount,
        0
      ),
      incompleteTraceCount
    },
    rules: rules.map(rule => {
      const hitCount =
        rule.category === 'schema'
          ? items.filter(item =>
              item.admissionReport.issues.some(
                issue => issue.category === 'schema'
              )
            ).length
          : rule.category === 'dataBinding'
            ? items.filter(item =>
                item.admissionReport.issues.some(
                  issue => issue.category === 'dataBinding'
                )
              ).length
            : rule.category === 'release'
              ? items.filter(item => item.admissionReport.blockerCount > 0)
                  .length
              : incompleteTraceCount
      return {
        id: rule.id,
        label: rule.label,
        description: rule.description,
        hitCount,
        enabled: !disabledRuleIdSet.has(rule.id),
        statusText: disabledRuleIdSet.has(rule.id) ? '已停用' : '已启用',
        actionLabel: disabledRuleIdSet.has(rule.id) ? '启用规则' : '停用规则'
      }
    }),
    risks: items
      .map(item => ({
        name: item.name,
        blockerCount: item.admissionReport.blockerCount,
        warningCount: item.admissionReport.warningCount,
        gapCount: traceGapByTemplate.get(item.id) || 0,
        riskCount:
          item.admissionReport.blockerCount +
          item.admissionReport.warningCount +
          (traceGapByTemplate.get(item.id) || 0)
      }))
      .filter(item => item.riskCount > 0)
      .sort((a, b) => b.riskCount - a.riskCount)
      .slice(0, 8)
      .map(item => ({
        name: item.name,
        badgeText: `${item.blockerCount}/${item.warningCount}/${item.gapCount}`,
        detail: '阻断 / 警告 / 留痕缺口',
        level: item.blockerCount ? 'blocker' : 'warning'
      }))
  }
}