import { EDITOR_COMPONENT, EditorComponent } from '../../editor'
import {
  MedicalRecordDomainService,
  TemplateDomainService,
  type ITemplateAssetMetadata,
  type ITemplateListItem,
  type ITemplateRegistryEntry,
  type ITemplateReleaseNote,
  type ITemplateTrialRunRecord,
  type ITemplateVersionRecord,
  type TemplatePublishStatus
} from '../../platform/emr-workbench/domain'
import {
  applyBusinessFieldQuickPreset,
  AuditCenterModule,
  BusinessFieldCenterModule,
  getBusinessFieldQuickPresets,
  recommendBusinessFieldQuickPresets,
  type IBusinessFieldCenterFieldAsset,
  type IBusinessFieldQuickPreset,
  PermissionCenterModule,
  QualityCenterModule
} from '../../platform/emr-workbench/modules'
import {
  TemplateDocumentStore,
  type ITemplateDocumentRecord
} from '../../editor/template/TemplateDocumentStore'
import type {
  ITemplateBlock,
  ITemplateField,
  ITemplateSchema
} from '../../editor/template/index'
import type { ITemplateFieldMetadata } from '../../editor/template/index'
import {
  getResolvedTemplateBlocks,
  validateSchema
} from '../../editor/template/index'
import { type ITemplateAdmissionReport } from '../../editor/template/TemplateGovernance'
import {
  TEMPLATE_PAGE_DECORATION_VARIABLES,
  getTemplatePageDecorationPreset,
  getTemplatePageDecorationPresets,
  type ITemplatePageDecorationPreset,
  type ITemplatePageDecorationVariableDefinition,
  type TemplatePageDecorationMode,
  type TemplatePageDecorationVariableKey
} from '../../editor/template/TemplatePageDecoration'
import {
  buildTemplateFieldRuntimeIndex
} from '../../editor/template/TemplateRuntime'
import { TemplateDesigner } from './TemplateDesigner'
import { TemplateFeedback } from './TemplateFeedback'
import { TemplatePreviewDialog } from './TemplatePreviewDialog'

export interface ITemplateManagerOptions {
  onApply: (schema: ITemplateSchema, record?: ITemplateDocumentRecord) => void
  documentStore?: TemplateDocumentStore
}

type TemplateStatusFilter = TemplatePublishStatus | 'all' | 'problem'
type TemplateViewMode = 'card' | 'list'
type TemplateSortMode = 'updatedDesc' | 'updatedAsc' | 'nameAsc'
type TemplateOperationView = 'all' | 'mine' | 'recent' | 'risk' | 'todo'
type TemplateRiskFilter = 'all' | ITemplateAdmissionReport['status']
type TemplateRecentUsageFilter = 'all' | 'recent30d' | 'used' | 'unused'

interface ITemplateWorkbenchItem extends ITemplateListItem {
  entry: ITemplateRegistryEntry
  blockCount: number
  fieldCount: number
  ruleCount: number
  businessFieldCount: number
  dataSourceCount: number
  issueCount: number
  admissionReport: ITemplateAdmissionReport
  latestUsedAt?: number
}

interface ITemplateActionReportSummaryItem {
  label: string
  value: string | number
}

interface ITemplateActionReportRow {
  name: string
  detail: string
  status: 'success' | 'warning' | 'danger'
  statusText: string
}

interface ITemplateVersionImpactItem {
  label: string
  detail: string
  badge: string
  tone: 'success' | 'warning' | 'muted'
}

interface ITemplateVersionImpactSummary {
  baselineText: string
  items: ITemplateVersionImpactItem[]
}

function normalizePageDecorationConfig(
  pageDecorations?: ITemplateSchema['layout'] extends infer L
    ? L extends { pageDecorations?: infer P }
      ? P
      : never
    : never
) {
  const header = pageDecorations?.header?.id
    ? {
        id: pageDecorations.header.id,
        mode: pageDecorations.header.mode ?? 'replace'
      }
    : undefined
  const footer = pageDecorations?.footer?.id
    ? {
        id: pageDecorations.footer.id,
        mode: pageDecorations.footer.mode ?? 'replace'
      }
    : undefined
  const variables = Object.fromEntries(
    Object.entries(pageDecorations?.variables ?? {}).filter(([, value]) =>
      typeof value === 'string' && value.trim().length > 0
    )
  ) as Partial<Record<TemplatePageDecorationVariableKey, string>>

  if (!header && !footer && !Object.keys(variables).length) {
    return undefined
  }

  return {
    ...(header ? { header } : {}),
    ...(footer ? { footer } : {}),
    ...(Object.keys(variables).length ? { variables } : {})
  }
}

const PAGE_DECORATION_MODE_LABEL: Record<TemplatePageDecorationMode, string> = {
  replace: '替换当前区块',
  prepend: '前置合并',
  append: '后置合并'
}

const PAGE_DECORATION_BLOCK_LABEL: Record<string, string> = {
  paragraph: '段落',
  staticText: '静态文本',
  separator: '分隔线',
  section: '章节',
  group: '分组',
  spacer: '留白',
  fieldRow: '字段行',
  table: '表格'
}

function truncateDecorationSummary(text: string, max = 44): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}...`
}

function resolveDecorationPreviewText(
  text: string,
  variables: Partial<Record<TemplatePageDecorationVariableKey, string>>,
  schemaName: string
): string {
  const replacements: Record<string, string> = {
    [TEMPLATE_PAGE_DECORATION_VARIABLES.HOSPITALNAME]: variables.hospitalName?.trim() || '医院名称',
    [TEMPLATE_PAGE_DECORATION_VARIABLES.DOCUMENTTITLE]: variables.documentTitle?.trim() || schemaName || '文书标题',
    [TEMPLATE_PAGE_DECORATION_VARIABLES.DEPARTMENTNAME]: variables.departmentName?.trim() || '科室名称',
    [TEMPLATE_PAGE_DECORATION_VARIABLES.DOCUMENTCODE]: variables.documentCode?.trim() || '文书编号',
    [TEMPLATE_PAGE_DECORATION_VARIABLES.FOOTERNOTE]: variables.footerNote?.trim() || '页脚附注'
  }

  return Object.entries(replacements).reduce((result, [token, value]) => {
    return result.split(token).join(value)
  }, text)
}

function getDecorationBlockSummary(
  block: ITemplateBlock,
  variables: Partial<Record<TemplatePageDecorationVariableKey, string>>,
  schemaName: string
): string {
  switch (block.type) {
    case 'staticText':
      return truncateDecorationSummary(
        resolveDecorationPreviewText(block.text, variables, schemaName) || '（空文本）'
      )
    case 'paragraph': {
      const text = block.segments.map(segment => {
        if (segment.type === 'text') {
          return resolveDecorationPreviewText(segment.value, variables, schemaName)
        }
        return `[${segment.field.label || segment.field.id}]`
      }).join('')
      return truncateDecorationSummary(text || '（空段落）')
    }
    case 'separator':
      return '水平分隔线'
    case 'section': {
      const title = resolveDecorationPreviewText(block.title || '未命名章节', variables, schemaName)
      return truncateDecorationSummary(`${title} · ${block.blocks.length} 个子块`)
    }
    case 'group':
      return `分组容器 · ${block.blocks.length} 个子块`
    case 'table':
      return truncateDecorationSummary(`表格：${block.columns.map(column => column.header).join('、')}`)
    case 'fieldRow':
      return truncateDecorationSummary(`字段：${block.fields.map(field => field.label || field.id).join('、')}`)
    case 'spacer':
      return `留白 ${block.lines || 1} 行`
    default:
      return '未知区块'
  }
}

function createPageDecorationPreview(
  zoneLabel: string,
  preset: ITemplatePageDecorationPreset | undefined,
  mode: TemplatePageDecorationMode,
  variables: Partial<Record<TemplatePageDecorationVariableKey, string>>,
  schemaName: string
): HTMLDivElement {
  const preview = document.createElement('div')
  preview.className = 'tm-decoration-preview'

  const header = document.createElement('div')
  header.className = 'tm-decoration-preview__header'
  const title = document.createElement('div')
  title.className = 'tm-decoration-preview__title'
  title.textContent = `${zoneLabel}预览`
  const meta = document.createElement('div')
  meta.className = 'tm-decoration-preview__meta'
  meta.textContent = preset
    ? `${PAGE_DECORATION_MODE_LABEL[mode]} · ${preset.blocks.length} 个区块`
    : '未选择预定义方案'
  header.append(title, meta)
  preview.append(header)

  if (!preset) {
    const empty = document.createElement('div')
    empty.className = 'tm-decoration-preview__empty'
    empty.textContent = `当前保留模板原有${zoneLabel}内容。`
    preview.append(empty)
    return preview
  }

  const counts = preset.blocks.reduce<Record<string, number>>((accumulator, block) => {
    const label = PAGE_DECORATION_BLOCK_LABEL[block.type] ?? block.type
    accumulator[label] = (accumulator[label] ?? 0) + 1
    return accumulator
  }, {})
  const chips = document.createElement('div')
  chips.className = 'tm-decoration-preview__chips'
  Object.entries(counts).forEach(([label, count]) => {
    const chip = document.createElement('span')
    chip.className = 'tm-decoration-preview__chip'
    chip.textContent = `${label} ${count}`
    chips.append(chip)
  })
  preview.append(chips)

  const list = document.createElement('div')
  list.className = 'tm-decoration-preview__list'
  preset.blocks.forEach(block => {
    const item = document.createElement('div')
    item.className = 'tm-decoration-preview__item'
    const badge = document.createElement('span')
    badge.className = 'tm-decoration-preview__badge'
    badge.textContent = PAGE_DECORATION_BLOCK_LABEL[block.type] ?? block.type
    const summary = document.createElement('span')
    summary.className = 'tm-decoration-preview__summary'
    summary.textContent = getDecorationBlockSummary(block, variables, schemaName)
    item.append(badge, summary)
    list.append(item)
  })
  preview.append(list)

  return preview
}

function countBlocks(blocks: ITemplateSchema['blocks']): number {
  return blocks.reduce((count, block) => {
    if (block.type === 'section' || block.type === 'group') {
      return count + 1 + countBlocks(block.blocks)
    }
    return count + 1
  }, 0)
}

function countRules(blocks: ITemplateSchema['blocks']): number {
  return blocks.reduce((count, block) => {
    let next = count
    if (block.type === 'section' || block.type === 'group') {
      next += block.rules?.length ?? 0
      next += countRules(block.blocks)
    } else if (block.type === 'fieldRow') {
      next += block.fields.reduce((sum, field) => sum + (field.rules?.length ?? 0), 0)
    } else if (block.type === 'paragraph') {
      next += block.segments.reduce((sum, segment) => {
        return segment.type === 'field'
          ? sum + (segment.field.rules?.length ?? 0)
          : sum
      }, 0)
    } else if (block.type === 'table') {
      next += block.columns.reduce((sum, column) => sum + (column.field?.rules?.length ?? 0), 0)
    }
    return next
  }, 0)
}

const STATUS_LABEL: Record<TemplatePublishStatus, string> = {
  draft: '未发布',
  review: '待审核',
  published: '已发布',
  archived: '已撤回'
}

const STATUS_FILTERS: Array<{ value: TemplateStatusFilter; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'draft', label: '未发布' },
  { value: 'review', label: '待审核' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已撤回' },
  { value: 'problem', label: '有问题' }
]

function getTemplateMetrics(schema: ITemplateSchema) {
  const index = buildTemplateFieldRuntimeIndex(schema)
  const dataSources = new Set<string>()
  const allBlocks = getResolvedTemplateBlocks(schema).all
  let businessFieldCount = 0
  index.all.forEach(node => {
    if (node.metadata?.businessCode || node.metadata?.exportPath) {
      businessFieldCount += 1
    }
    if (node.metadata?.dataSource) {
      dataSources.add(node.metadata.dataSource)
    }
  })
  return {
    blockCount: countBlocks(allBlocks),
    fieldCount: index.all.length,
    ruleCount: countRules(allBlocks),
    businessFieldCount,
    dataSourceCount: dataSources.size,
    issueCount: validateSchema(schema).length
  }
}

function getFieldImpactSignature(field: ITemplateField): string {
  return JSON.stringify({
    type: field.type,
    label: field.label ?? '',
    required: field.required ?? false,
    placeholder: field.placeholder ?? '',
    prefix: field.prefix ?? '',
    postfix: field.postfix ?? '',
    width: field.width ?? null,
    options: field.options?.map(option => ({
      label: option.label,
      value: option.value
    })) ?? [],
    metadata: normalizeTemplateFieldMetadata(field.metadata ?? {}) ?? null
  })
}

function getDecorationDescriptor(
  decoration: { id?: string; mode?: TemplatePageDecorationMode } | undefined
): string {
  if (!decoration?.id) return '未设置'
  const preset = getTemplatePageDecorationPreset(decoration.id)
  return `${preset?.name ?? decoration.id} / ${PAGE_DECORATION_MODE_LABEL[decoration.mode ?? 'replace']}`
}

function getTemplateVersionImpactSummary(
  currentSchema: ITemplateSchema,
  baselineRecord?: ITemplateVersionRecord
): ITemplateVersionImpactSummary {
  const baselineSchema = baselineRecord?.schemaSnapshot
  const currentIndex = buildTemplateFieldRuntimeIndex(currentSchema)
  const baselineIndex = baselineSchema
    ? buildTemplateFieldRuntimeIndex(baselineSchema)
    : undefined
  const currentRuleCount = countRules(getResolvedTemplateBlocks(currentSchema).all)
  const baselineRuleCount = baselineSchema
    ? countRules(getResolvedTemplateBlocks(baselineSchema).all)
    : 0

  const currentFieldIds = new Set(currentIndex.all.map(node => node.field.id))
  const baselineFieldIds = new Set(
    baselineIndex?.all.map(node => node.field.id) ?? []
  )
  const addedFieldCount = Array.from(currentFieldIds).filter(
    fieldId => !baselineFieldIds.has(fieldId)
  ).length
  const removedFieldCount = Array.from(baselineFieldIds).filter(
    fieldId => !currentFieldIds.has(fieldId)
  ).length
  const changedFieldCount = baselineIndex
    ? currentIndex.all.reduce((count, node) => {
        const previous = baselineIndex.byId.get(node.field.id)
        if (!previous) return count
        return count + Number(
          getFieldImpactSignature(node.field) !==
            getFieldImpactSignature(previous.field)
        )
      }, 0)
    : 0

  const currentDecorations = normalizePageDecorationConfig(
    currentSchema.layout?.pageDecorations
  )
  const baselineDecorations = normalizePageDecorationConfig(
    baselineSchema?.layout?.pageDecorations
  )
  const decorationVariableKeys = Array.from(
    new Set([
      ...Object.keys(currentDecorations?.variables ?? {}),
      ...Object.keys(baselineDecorations?.variables ?? {})
    ])
  ) as TemplatePageDecorationVariableKey[]
  const changedDecorationVariableCount = decorationVariableKeys.filter(key => {
    return (currentDecorations?.variables?.[key] ?? '').trim() !==
      (baselineDecorations?.variables?.[key] ?? '').trim()
  }).length
  const decorationParts: string[] = []
  if (!baselineSchema) {
    if (currentDecorations?.header?.id) {
      decorationParts.push(
        `首次发布包含页眉 ${getDecorationDescriptor(currentDecorations.header)}`
      )
    }
    if (currentDecorations?.footer?.id) {
      decorationParts.push(
        `首次发布包含页脚 ${getDecorationDescriptor(currentDecorations.footer)}`
      )
    }
    if (changedDecorationVariableCount) {
      decorationParts.push(`页眉页脚变量配置 ${changedDecorationVariableCount} 项`)
    }
  } else {
    const previousHeader = getDecorationDescriptor(
      baselineDecorations?.header
    )
    const nextHeader = getDecorationDescriptor(currentDecorations?.header)
    if (previousHeader !== nextHeader) {
      decorationParts.push(`页眉 ${previousHeader} -> ${nextHeader}`)
    }
    const previousFooter = getDecorationDescriptor(
      baselineDecorations?.footer
    )
    const nextFooter = getDecorationDescriptor(currentDecorations?.footer)
    if (previousFooter !== nextFooter) {
      decorationParts.push(`页脚 ${previousFooter} -> ${nextFooter}`)
    }
    if (changedDecorationVariableCount) {
      decorationParts.push(`变量调整 ${changedDecorationVariableCount} 项`)
    }
  }

  const currentSources = Array.from(
    new Set(
      currentIndex.all
        .map(node => node.metadata?.dataSource)
        .filter((value): value is string => Boolean(value))
    )
  ).sort((left, right) => left.localeCompare(right))
  const baselineSources = Array.from(
    new Set(
      baselineIndex?.all
        .map(node => node.metadata?.dataSource)
        .filter((value): value is string => Boolean(value)) ?? []
    )
  ).sort((left, right) => left.localeCompare(right))
  const addedSources = currentSources.filter(value => !baselineSources.includes(value))
  const removedSources = baselineSources.filter(value => !currentSources.includes(value))
  const changedDataSourceBindings = baselineIndex
    ? currentIndex.all.reduce((count, node) => {
        const previous = baselineIndex.byId.get(node.field.id)
        if (!previous) return count
        return count + Number(
          (node.metadata?.dataSource ?? '') !==
            (previous.metadata?.dataSource ?? '')
        )
      }, 0)
    : 0

  const fieldChangeCount = addedFieldCount + removedFieldCount + changedFieldCount
  const ruleDelta = currentRuleCount - baselineRuleCount
  const decorationChangeCount = decorationParts.length
  const dataSourceChangeCount =
    addedSources.length + removedSources.length + changedDataSourceBindings

  return {
    baselineText: baselineRecord?.schemaSnapshot
      ? `对比线上版本 v${baselineRecord.version}`
      : '当前模板尚无线上版本，以下按首次发布范围展示',
    items: [
      {
        label: '字段变化',
        detail: baselineSchema
          ? fieldChangeCount
            ? `当前 ${currentIndex.all.length} 个字段，新增 ${addedFieldCount} 个、删除 ${removedFieldCount} 个、调整 ${changedFieldCount} 个。`
            : `当前 ${currentIndex.all.length} 个字段，与线上版本保持一致。`
          : `首次发布共 ${currentIndex.all.length} 个字段，新增字段 ${addedFieldCount} 个。`,
        badge: fieldChangeCount ? `${fieldChangeCount} 项变化` : '无变化',
        tone: removedFieldCount ? 'warning' : fieldChangeCount ? 'success' : 'muted'
      },
      {
        label: '规则变化',
        detail: baselineSchema
          ? ruleDelta
            ? `规则总数 ${baselineRuleCount} -> ${currentRuleCount}。${ruleDelta > 0 ? '新增' : '减少'} ${Math.abs(ruleDelta)} 条。`
            : `规则总数维持 ${currentRuleCount} 条。`
          : `首次发布共纳入 ${currentRuleCount} 条规则。`,
        badge: ruleDelta ? `${ruleDelta > 0 ? '+' : ''}${ruleDelta}` : '无变化',
        tone: ruleDelta < 0 ? 'warning' : ruleDelta ? 'success' : 'muted'
      },
      {
        label: '页眉页脚变化',
        detail: decorationParts.length
          ? decorationParts.join('；')
          : baselineSchema
            ? '页眉页脚方案与线上版本保持一致。'
            : '首次发布沿用模板当前页眉页脚配置。',
        badge: decorationChangeCount ? `${decorationChangeCount} 项变化` : '无变化',
        tone: decorationChangeCount ? 'success' : 'muted'
      },
      {
        label: '数据源变化',
        detail: baselineSchema
          ? dataSourceChangeCount
            ? [
                addedSources.length
                  ? `新增数据源 ${addedSources.join('、')}`
                  : undefined,
                removedSources.length
                  ? `移除数据源 ${removedSources.join('、')}`
                  : undefined,
                changedDataSourceBindings
                  ? `字段绑定调整 ${changedDataSourceBindings} 项`
                  : undefined
              ].filter(Boolean).join('；')
            : `当前共 ${currentSources.length} 个数据源绑定，与线上版本一致。`
          : currentSources.length
            ? `首次发布接入 ${currentSources.length} 个数据源：${currentSources.join('、')}`
            : '首次发布暂未配置数据源绑定。',
        badge: dataSourceChangeCount
          ? `${dataSourceChangeCount} 项变化`
          : currentSources.length
            ? `${currentSources.length} 个数据源`
            : '无变化',
        tone: removedSources.length ? 'warning' : dataSourceChangeCount ? 'success' : 'muted'
      }
    ]
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

function normalizeTemplateFieldMetadata(
  metadata: Partial<ITemplateFieldMetadata>
): ITemplateFieldMetadata | undefined {
  const nextMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0
      return typeof value === 'string' ? value.trim().length > 0 : value != null
    })
  ) as ITemplateFieldMetadata
  return Object.keys(nextMetadata).length ? nextMetadata : undefined
}

function updateTemplateField(
  schema: ITemplateSchema,
  fieldId: string,
  updater: (field: ITemplateField) => ITemplateField
): ITemplateSchema {
  const updateBlocks = (blocks: ITemplateSchema['blocks']): ITemplateSchema['blocks'] => {
    return blocks.map(block => {
      if (block.type === 'fieldRow') {
        return {
          ...block,
          fields: block.fields.map(field => {
            return field.id === fieldId ? updater(field) : field
          })
        }
      }
      if (block.type === 'paragraph') {
        return {
          ...block,
          segments: block.segments.map(segment => {
            if (segment.type !== 'field' || segment.field.id !== fieldId) return segment
            return {
              ...segment,
              field: updater(segment.field)
            }
          })
        }
      }
      if (block.type === 'table') {
        return {
          ...block,
          columns: block.columns.map(column => {
            if (!column.field || column.field.id !== fieldId) return column
            return {
              ...column,
              field: updater(column.field)
            }
          })
        }
      }
      if (block.type === 'section' || block.type === 'group') {
        return {
          ...block,
          blocks: updateBlocks(block.blocks)
        }
      }
      return block
    })
  }

  return {
    ...schema,
    blocks: updateBlocks(schema.blocks)
  }
}

function updateTemplateFieldMetadata(
  schema: ITemplateSchema,
  fieldId: string,
  metadata: Partial<ITemplateFieldMetadata>
): ITemplateSchema {
  const nextMetadata = normalizeTemplateFieldMetadata(metadata)
  return updateTemplateField(schema, fieldId, field => ({
    ...field,
    metadata: nextMetadata
  }))
}

export class TemplateManager {
  private mask: HTMLDivElement
  private container: HTMLDivElement
  private options: ITemplateManagerOptions
  private previousBodyOverflow = ''
  private previousHtmlOverflow = ''
  private activeCategory = '全部'
  private statusFilter: TemplateStatusFilter = 'all'
  private viewMode: TemplateViewMode = 'card'
  private sortMode: TemplateSortMode = 'updatedDesc'
  private operationView: TemplateOperationView = 'all'
  private searchKeyword = ''
  private departmentFilter = ''
  private documentTypeFilter = ''
  private ownerFilter = ''
  private riskFilter: TemplateRiskFilter = 'all'
  private recentUsageFilter: TemplateRecentUsageFilter = 'all'
  private sidebarEl!: HTMLDivElement
  private statsEl!: HTMLDivElement
  private bodyEl!: HTMLDivElement
  private readonly templateDomain: TemplateDomainService
  private readonly medicalRecordDomain: MedicalRecordDomainService
  private readonly businessFieldCenter = new BusinessFieldCenterModule()
  private readonly permissionCenter = new PermissionCenterModule()
  private readonly qualityCenter = new QualityCenterModule()
  private readonly auditCenter: AuditCenterModule

  constructor(options: ITemplateManagerOptions) {
    this.options = options
    const documentStore = options.documentStore ?? new TemplateDocumentStore()
    this.medicalRecordDomain = new MedicalRecordDomainService(documentStore)
    this.templateDomain = new TemplateDomainService(documentStore)
    this.auditCenter = new AuditCenterModule(
      this.templateDomain,
      this.medicalRecordDomain
    )
    this.templateDomain.loadFromStorage()
    this._lockRootScroll()
    const { mask, container } = this._render()
    this.mask = mask
    this.container = container
  }

  private _lockRootScroll() {
    this.previousBodyOverflow = document.body.style.overflow
    this.previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  }

  private _unlockRootScroll() {
    document.body.style.overflow = this.previousBodyOverflow
    document.documentElement.style.overflow = this.previousHtmlOverflow
  }

  private _render() {
    const mask = document.createElement('div')
    mask.className = 'td-mask'
    mask.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)
    document.body.append(mask)

    const overlay = document.createElement('div')
    overlay.className = 'tm-overlay'
    overlay.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)

    const dialog = document.createElement('div')
    dialog.className = 'tm-dialog tm-dialog--workbench'
    dialog.append(this._renderHeader(), this._renderWorkbench(), this._renderFooter())

    overlay.append(dialog)
    document.body.append(overlay)
    this._refreshWorkbench()
    return { mask, container: overlay }
  }

  private _renderHeader(): HTMLDivElement {
    const header = document.createElement('div')
    header.className = 'tm-header tm-header--workbench'

    const titleWrap = document.createElement('div')
    titleWrap.className = 'tm-header__title-wrap'

    const title = document.createElement('span')
    title.className = 'tm-header__title'
    title.textContent = '模板管理工作台'

    const subtitle = document.createElement('span')
    subtitle.className = 'tm-header__subtitle'
    subtitle.textContent = '设计、测试、发布和维护医院病历文书模板'

    titleWrap.append(title, subtitle)

    const actions = document.createElement('div')
    actions.className = 'tm-header__actions'

    const newBtn = document.createElement('button')
    newBtn.className = 'td-designer__btn td-designer__btn--primary'
    newBtn.textContent = '+ 新建模板'
    newBtn.type = 'button'
    newBtn.addEventListener('click', () => this._openDesigner())

    const closeBtn = document.createElement('button')
    closeBtn.className = 'tm-header__close'
    closeBtn.textContent = '×'
    closeBtn.type = 'button'
    closeBtn.addEventListener('click', () => this._dispose())

    actions.append(newBtn, closeBtn)
    header.append(titleWrap, actions)
    return header
  }

  private _renderWorkbench(): HTMLDivElement {
    const workbench = document.createElement('div')
    workbench.className = 'tm-workbench'

    this.sidebarEl = document.createElement('div')
    this.sidebarEl.className = 'tm-sidebar'

    const main = document.createElement('div')
    main.className = 'tm-main'

    this.statsEl = document.createElement('div')
    this.statsEl.className = 'tm-stats'

    main.append(this.statsEl, this._renderToolbar())

    this.bodyEl = document.createElement('div')
    this.bodyEl.className = 'tm-body'
    main.append(this.bodyEl)

    workbench.append(this.sidebarEl, main)
    return workbench
  }

  private _renderToolbar(): HTMLDivElement {
    const toolbar = document.createElement('div')
    toolbar.className = 'tm-toolbar'

    const search = document.createElement('input')
    search.className = 'tm-search'
    search.type = 'search'
    search.placeholder = '搜索模板名称、分类、描述、版本'
    search.addEventListener('input', () => {
      this.searchKeyword = search.value.trim().toLowerCase()
      this._renderBody()
    })

    const department = document.createElement('input')
    department.className = 'tm-toolbar__input'
    department.type = 'search'
    department.placeholder = '科室筛选'
    department.addEventListener('input', () => {
      this.departmentFilter = department.value.trim().toLowerCase()
      this._renderBody()
    })

    const documentType = document.createElement('input')
    documentType.className = 'tm-toolbar__input'
    documentType.type = 'search'
    documentType.placeholder = '文书类型'
    documentType.addEventListener('input', () => {
      this.documentTypeFilter = documentType.value.trim().toLowerCase()
      this._renderBody()
    })

    const owner = document.createElement('input')
    owner.className = 'tm-toolbar__input'
    owner.type = 'search'
    owner.placeholder = '负责人'
    owner.addEventListener('input', () => {
      this.ownerFilter = owner.value.trim().toLowerCase()
      this._renderBody()
    })

    const status = document.createElement('select')
    status.className = 'tm-select'
    STATUS_FILTERS.forEach(item => {
      const option = document.createElement('option')
      option.value = item.value
      option.textContent = item.label
      status.append(option)
    })
    status.addEventListener('change', () => {
      this.statusFilter = status.value as TemplateStatusFilter
      this._renderBody()
    })

    const sort = document.createElement('select')
    sort.className = 'tm-select'
    const sortOptions = [
      { value: 'updatedDesc', label: '最近更新优先' },
      { value: 'updatedAsc', label: '最早更新优先' },
      { value: 'nameAsc', label: '按名称排序' }
    ]
    sortOptions.forEach(item => {
      const option = document.createElement('option')
      option.value = item.value
      option.textContent = item.label
      sort.append(option)
    })
    sort.addEventListener('change', () => {
      this.sortMode = sort.value as TemplateSortMode
      this._renderBody()
    })

    const risk = document.createElement('select')
    risk.className = 'tm-select'
    ;([
      { value: 'all', label: '风险状态' },
      { value: 'passed', label: '准入通过' },
      { value: 'warning', label: '待确认' },
      { value: 'blocked', label: '准入阻断' }
    ]).forEach(item => {
      const option = document.createElement('option')
      option.value = item.value
      option.textContent = item.label
      risk.append(option)
    })
    risk.addEventListener('change', () => {
      this.riskFilter = risk.value as TemplateRiskFilter
      this._renderBody()
    })

    const recentUsage = document.createElement('select')
    recentUsage.className = 'tm-select'
    ;([
      { value: 'all', label: '最近使用' },
      { value: 'recent30d', label: '30 天内使用' },
      { value: 'used', label: '曾被使用' },
      { value: 'unused', label: '尚未使用' }
    ]).forEach(item => {
      const option = document.createElement('option')
      option.value = item.value
      option.textContent = item.label
      recentUsage.append(option)
    })
    recentUsage.addEventListener('change', () => {
      this.recentUsageFilter = recentUsage.value as TemplateRecentUsageFilter
      this._renderBody()
    })

    const view = document.createElement('div')
    view.className = 'tm-view-toggle'

    const cardBtn = this._createViewButton('卡片', 'card')
    const listBtn = this._createViewButton('列表', 'list')
    view.append(cardBtn, listBtn)

    toolbar.append(
      search,
      department,
      documentType,
      owner,
      status,
      risk,
      recentUsage,
      sort,
      view
    )
    return toolbar
  }

  private _createViewButton(label: string, mode: TemplateViewMode): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `tm-view-toggle__btn${this.viewMode === mode ? ' tm-view-toggle__btn--active' : ''}`
    btn.textContent = label
    btn.addEventListener('click', () => {
      this.viewMode = mode
      document.querySelectorAll('.tm-view-toggle__btn')
        .forEach(item => item.classList.remove('tm-view-toggle__btn--active'))
      btn.classList.add('tm-view-toggle__btn--active')
      this._renderBody()
    })
    return btn
  }

  private _refreshWorkbench() {
    this._renderSidebar()
    this._renderStats()
    this._renderBody()
  }

  private _renderSidebar() {
    this.sidebarEl.innerHTML = ''
    const allItems = this._getWorkbenchItems(false)
    const categories = ['全部', ...this.templateDomain.getCategories()]
    this.sidebarEl.append(
      this._createSidebarSection(
        '分类',
        categories.map(category => ({
          label: category,
          count: category === '全部'
            ? allItems.length
            : allItems.filter(item => item.category === category).length,
          active: this.activeCategory === category,
          onClick: () => {
            this.activeCategory = category
            this._refreshWorkbench()
          }
        }))
      ),
      this._createSidebarSection(
        '状态',
        [
          { value: 'all', label: '全部状态', count: allItems.length },
          {
            value: 'draft',
            label: '草稿',
            count: allItems.filter(item => item.entry.status === 'draft').length
          },
          {
            value: 'review',
            label: '待审核',
            count: allItems.filter(item => item.entry.status === 'review').length
          },
          {
            value: 'published',
            label: '已发布',
            count: allItems.filter(item => item.entry.status === 'published').length
          },
          {
            value: 'archived',
            label: '已撤回',
            count: allItems.filter(item => item.entry.status === 'archived').length
          }
        ].map(item => ({
          label: item.label,
          count: item.count,
          active: this.statusFilter === item.value,
          onClick: () => {
            this.statusFilter = item.value as TemplateStatusFilter
            this._refreshWorkbench()
          }
        }))
      ),
      this._createSidebarSection(
        '视角',
        [
          { value: 'all', label: '全部模板', count: allItems.length },
          {
            value: 'mine',
            label: '我负责的',
            count: allItems.filter(item => this._matchesOperationView(item, 'mine')).length
          },
          {
            value: 'recent',
            label: '最近使用',
            count: allItems.filter(item => this._matchesOperationView(item, 'recent')).length
          },
          {
            value: 'risk',
            label: '有风险',
            count: allItems.filter(item => this._matchesOperationView(item, 'risk')).length
          },
          {
            value: 'todo',
            label: '待我处理',
            count: allItems.filter(item => this._matchesOperationView(item, 'todo')).length
          }
        ].map(item => ({
          label: item.label,
          count: item.count,
          active: this.operationView === item.value,
          onClick: () => {
            this.operationView = item.value as TemplateOperationView
            this._refreshWorkbench()
          }
        }))
      )
    )
  }

  private _matchesOperationView(
    item: ITemplateWorkbenchItem,
    view: TemplateOperationView = this.operationView
  ): boolean {
    if (view === 'all') return true
    if (view === 'mine') return (item.entry.asset?.owner ?? '模板管理员') === '模板管理员'
    if (view === 'recent') return this._matchesRecentUsageFilter(item, 'recent30d')
    if (view === 'risk') return item.admissionReport.status !== 'passed'
    return item.entry.status !== 'published' || item.admissionReport.status === 'blocked'
  }

  private _matchesRecentUsageFilter(
    item: ITemplateWorkbenchItem,
    filter: TemplateRecentUsageFilter = this.recentUsageFilter
  ): boolean {
    const latestUsedAt = item.latestUsedAt
    if (filter === 'all') return true
    if (filter === 'unused') return !latestUsedAt
    if (filter === 'used') return Boolean(latestUsedAt)
    return Boolean(latestUsedAt && Date.now() - latestUsedAt <= 1000 * 60 * 60 * 24 * 30)
  }

  private _createSidebarSection(
    title: string,
    items: Array<{
      label: string
      count: number
      active: boolean
      onClick: () => void
    }>
  ): HTMLDivElement {
    const section = document.createElement('div')
    section.className = 'tm-sidebar__section'

    const sectionTitle = document.createElement('div')
    sectionTitle.className = 'tm-sidebar__title'
    sectionTitle.textContent = title
    section.append(sectionTitle)

    items.forEach(item => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `tm-sidebar__item${item.active ? ' tm-sidebar__item--active' : ''}`
      const label = document.createElement('span')
      label.textContent = item.label
      const badge = document.createElement('b')
      badge.textContent = String(item.count)
      btn.append(label, badge)
      btn.addEventListener('click', item.onClick)
      section.append(btn)
    })

    return section
  }

  private _renderStats() {
    this.statsEl.innerHTML = ''
    const allItems = this._getWorkbenchItems(false)
    const visibleItems = this._getWorkbenchItems()
    const stats = [
      { label: '模板总数', value: allItems.length, tone: 'neutral' },
      { label: '当前结果', value: visibleItems.length, tone: 'neutral' },
      {
        label: '已发布',
        value: allItems.filter(item => item.entry.status === 'published').length,
        tone: 'success'
      },
      {
        label: '待发布',
        value: allItems.filter(item => item.entry.status !== 'published').length,
        tone: 'warning'
      },
      {
        label: '准入阻断',
        value: allItems.filter(item => item.admissionReport.status === 'blocked').length,
        tone: 'danger'
      }
    ]
    stats.forEach(stat => {
      const card = document.createElement('div')
      card.className = `tm-stat tm-stat--${stat.tone}`
      const value = document.createElement('strong')
      value.textContent = String(stat.value)
      const label = document.createElement('span')
      label.textContent = stat.label
      card.append(value, label)
      this.statsEl.append(card)
    })
  }

  private _renderBody() {
    this.bodyEl.innerHTML = ''
    const items = this._getWorkbenchItems()

    if (items.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'tm-empty'
      empty.textContent = '没有匹配的模板，可调整筛选条件或新建模板'
      this.bodyEl.append(empty)
      return
    }

    const grid = document.createElement('div')
    grid.className = this.viewMode === 'card' ? 'tm-grid' : 'tm-list'
    items.forEach(item => grid.append(this._renderCard(item)))
    this.bodyEl.append(grid)
  }

  private _getWorkbenchItems(applyFilter = true): ITemplateWorkbenchItem[] {
    let items = this.templateDomain.getAll()
      .map(item => {
        const entry = this.templateDomain.getEntry(item.id)
        if (!entry) return null
        const latestUsedAt = this.medicalRecordDomain.listByTemplate(item.id)
          .reduce<number | undefined>((latest, record) => {
            if (latest == null || record.updatedAt > latest) {
              return record.updatedAt
            }
            return latest
          }, undefined)
        return {
          ...item,
          entry,
          ...getTemplateMetrics(entry.schema),
          admissionReport: this.templateDomain.buildAdmissionReport(entry),
          latestUsedAt
        }
      })
      .filter(Boolean) as ITemplateWorkbenchItem[]

    if (applyFilter) {
      items = items.filter(item => {
        if (this.activeCategory !== '全部' && item.category !== this.activeCategory) {
          return false
        }
        if (this.statusFilter === 'problem') {
          if (item.issueCount === 0) return false
        } else if (this.statusFilter !== 'all' && item.entry.status !== this.statusFilter) {
          return false
        }
        if (!this._matchesOperationView(item)) return false
        const asset = item.entry.asset ?? {}
        if (
          this.departmentFilter &&
          !(asset.department ?? '').toLowerCase().includes(this.departmentFilter)
        ) {
          return false
        }
        if (
          this.documentTypeFilter &&
          !(asset.documentType ?? '').toLowerCase().includes(this.documentTypeFilter)
        ) {
          return false
        }
        if (
          this.ownerFilter &&
          !(asset.owner ?? '').toLowerCase().includes(this.ownerFilter)
        ) {
          return false
        }
        if (this.riskFilter !== 'all' && item.admissionReport.status !== this.riskFilter) {
          return false
        }
        if (!this._matchesRecentUsageFilter(item)) return false
        if (this.searchKeyword) {
          const haystack = [
            item.name,
            item.description,
            item.category,
            asset.department,
            asset.documentType,
            asset.owner,
            asset.scenario
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          if (!haystack.includes(this.searchKeyword)) return false
        }
        return true
      })
    }

    return items.sort((a, b) => {
      if (this.sortMode === 'updatedAsc') return a.updatedAt - b.updatedAt
      if (this.sortMode === 'nameAsc') return a.name.localeCompare(b.name)
      return b.updatedAt - a.updatedAt
    })
  }

  private _renderCard(item: ITemplateWorkbenchItem): HTMLDivElement {
    const card = document.createElement('div')
    card.className = `tm-card tm-card--${this.viewMode} tm-card--${item.entry.status}`
    const asset = item.entry.asset ?? {}
    const admission = item.admissionReport

    const top = document.createElement('div')
    top.className = 'tm-card__top'

    const nameWrap = document.createElement('div')
    nameWrap.className = 'tm-card__name-wrap'

    const name = document.createElement('div')
    name.className = 'tm-card__name'
    name.textContent = item.name
    name.title = item.name

    const desc = document.createElement('div')
    desc.className = 'tm-card__desc'
    desc.textContent = item.description || '暂无描述'
    nameWrap.append(name, desc)

    const status = document.createElement('span')
    status.className = `tm-card__status tm-card__status--${admission.status === 'passed' ? 'published' : 'archived'}`
    status.textContent = admission.status === 'blocked'
      ? '准入阻断'
      : admission.status === 'warning'
        ? '待确认'
        : '可发布'
    top.append(nameWrap, status)

    const meta = document.createElement('div')
    meta.className = 'tm-card__meta'
    const metaItems = [
      STATUS_LABEL[item.entry.status],
      `v${item.entry.schema.version}`,
      `${item.category}${item.builtIn ? ' · 内置' : ''}`,
      asset.department,
      asset.documentType,
      asset.owner ? `负责人 ${asset.owner}` : undefined
    ]
    metaItems.filter((text): text is string => Boolean(text)).forEach(text => {
      const tag = document.createElement('span')
      tag.textContent = text
      meta.append(tag)
    })

    const metrics = document.createElement('div')
    metrics.className = 'tm-card__metrics'
    ;([
      { label: '结构块', value: item.blockCount },
      { label: '字段', value: item.fieldCount },
      { label: '准入项', value: admission.issueCount }
    ]).forEach(metric => {
      const cell = document.createElement('div')
      cell.className = 'tm-card__metric'
      const value = document.createElement('strong')
      value.textContent = String(metric.value)
      const label = document.createElement('span')
      label.textContent = metric.label
      cell.append(value, label)
      metrics.append(cell)
    })

    const ops = document.createElement('div')
    ops.className = 'tm-card__ops'
    ;([
      `数据覆盖 ${admission.dataBindingCoverage}%`,
      `试运行 ${admission.latestTrialRun ? (admission.latestTrialRun.status === 'passed' ? '通过' : '失败') : '未验证'}`,
      `病历引用 ${admission.clinicalImpact.boundDocumentCount}`
    ]).forEach(text => {
      const chip = document.createElement('span')
      chip.textContent = text
      ops.append(chip)
    })

    const footer = document.createElement('div')
    footer.className = 'tm-card__footer'

    const updated = document.createElement('span')
    updated.className = 'tm-card__updated'
    updated.textContent = `更新 ${formatTime(item.updatedAt)}`

    const actionsEl = document.createElement('div')
    actionsEl.className = 'tm-card__actions'
    actionsEl.append(
      this._createPrimaryAction(item),
      this._createDecorationAction(item),
      this._createEditAction(item),
      this._createMoreAction(item)
    )

    footer.append(updated, actionsEl)
    card.append(top, meta, metrics, ops, footer)
    return card
  }

  private _createPrimaryAction(item: ITemplateWorkbenchItem): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.className = 'tm-card__btn tm-card__btn--primary'
    btn.textContent = item.entry.status === 'published' ? '使用' : '测试'
    btn.type = 'button'
    btn.addEventListener('click', e => {
      e.stopPropagation()
      if (item.entry.status === 'published') {
        const record = this.medicalRecordDomain.createFromTemplate(item.entry.schema, {
          templateStatus: item.entry.status,
          title: item.entry.schema.name,
          flatValues: {},
          trace: {
            operator: '模板管理员',
            source: 'templateManager',
            summary: `从模板中心使用 ${item.entry.schema.name} v${item.entry.schema.version}`
          }
        })
        this.options.onApply(item.entry.schema, record)
        TemplateFeedback.toast('已创建绑定当前模板版本快照的病历实例', 'success')
        this._dispose()
        return
      }
      new TemplatePreviewDialog(item.entry.schema)
      TemplateFeedback.toast('未发布模板已进入预览测试中心', 'info')
    })
    return btn
  }

  private _createEditAction(item: ITemplateWorkbenchItem): HTMLButtonElement {
    const editBtn = document.createElement('button')
    editBtn.className = 'tm-card__btn'
    editBtn.textContent = '编辑'
    editBtn.type = 'button'
    editBtn.addEventListener('click', e => {
      e.stopPropagation()
      this._openDesigner(item.entry)
    })
    return editBtn
  }

  private _createDecorationAction(item: ITemplateWorkbenchItem): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.className = 'tm-card__btn'
    btn.textContent = '页眉页脚'
    btn.type = 'button'
    btn.addEventListener('click', e => {
      e.stopPropagation()
      this._openPageDecorationDialog(item)
    })
    return btn
  }

  private _createMoreAction(item: ITemplateWorkbenchItem): HTMLButtonElement {
    const moreBtn = document.createElement('button')
    moreBtn.className = 'tm-card__btn tm-card__btn--more'
    moreBtn.textContent = '更多'
    moreBtn.type = 'button'
    moreBtn.addEventListener('click', e => {
      e.stopPropagation()
      this._openMoreMenu(moreBtn, item)
    })
    return moreBtn
  }

  private _openMoreMenu(anchor: HTMLElement, item: ITemplateWorkbenchItem) {
    document.querySelectorAll('.tm-more-menu').forEach(el => el.remove())
    const menu = document.createElement('div')
    menu.className = 'tm-more-menu'
    const actions = [
      { label: '资产信息', handler: () => this._openAssetDialog(item) },
      { label: '准入报告', handler: () => this._openAdmissionReport(item) },
      { label: '试运行验证', handler: () => this._openTrialRun(item) },
      { label: '迁移预览', handler: () => this._openMigrationPreview(item) },
      { label: '影响范围', handler: () => this._openClinicalImpact(item) },
      { label: '引用病历追溯', handler: () => this._openDocumentTrace(item) },
      { label: '版本管理', handler: () => this._openVersionCenter(item) },
      { label: '发版流程', handler: () => this._openReleaseFlow(item) },
      { label: '操作日志', handler: () => this._openAuditLog(item) },
      { label: '删除', danger: true, handler: () => this._deleteTemplate(item) }
    ]
    actions.forEach(action => {
      if (action.label === '删除' && item.builtIn) return
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `tm-more-menu__item${action.danger ? ' tm-more-menu__item--danger' : ''}`
      btn.textContent = action.label
      btn.addEventListener('click', () => {
        menu.remove()
        action.handler()
      })
      menu.append(btn)
    })
    const rect = anchor.getBoundingClientRect()
    menu.style.top = `${rect.bottom + 6}px`
    menu.style.left = `${rect.right - 126}px`
    document.body.append(menu)
    const close = (evt: MouseEvent) => {
      if (!menu.contains(evt.target as Node)) {
        menu.remove()
        document.removeEventListener('mousedown', close)
      }
    }
    window.setTimeout(() => document.addEventListener('mousedown', close), 0)
  }

  private _createTextInput(value = '', placeholder = ''): HTMLInputElement {
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'td-props__input tm-governance-form__input'
    input.value = value
    input.placeholder = placeholder
    return input
  }

  private _createGovernanceRow(label: string, control: HTMLElement): HTMLDivElement {
    const row = document.createElement('div')
    row.className = 'tm-governance-form__row'
    const title = document.createElement('label')
    title.textContent = label
    row.append(title, control)
    return row
  }

  private _renderAdmissionReport(report: ITemplateAdmissionReport): HTMLDivElement {
    const content = document.createElement('div')
    content.className = 'tm-admission-report'
    const summary = document.createElement('div')
    summary.className = 'tm-version-center__summary'
    summary.innerHTML = `
      <div><span>准入状态</span><strong>${report.status === 'passed' ? '通过' : report.status === 'blocked' ? '阻断' : '待确认'}</strong></div>
      <div><span>阻断项</span><strong>${report.blockerCount}</strong></div>
      <div><span>数据覆盖</span><strong>${report.dataBindingCoverage}%</strong></div>
      <div><span>病历引用</span><strong>${report.clinicalImpact.boundDocumentCount}</strong></div>
    `
    content.append(summary)

    const list = document.createElement('div')
    list.className = 'tm-admission-report__list'
    if (!report.issues.length) {
      const empty = document.createElement('div')
      empty.className = 'tm-empty'
      empty.textContent = '当前模板已通过发布准入检查'
      list.append(empty)
    }
    report.issues.forEach(issue => {
      const row = document.createElement('div')
      row.className = `tm-admission-report__item tm-admission-report__item--${issue.level}`
      const badge = document.createElement('span')
      badge.textContent = issue.level === 'blocker'
        ? '阻断'
        : issue.level === 'warning'
          ? '警告'
          : '提示'
      const message = document.createElement('strong')
      message.textContent = issue.message
      const category = document.createElement('small')
      category.textContent = issue.category
      row.append(badge, message, category)
      list.append(row)
    })
    content.append(list)
    return content
  }

  private _openAdmissionReport(item: ITemplateWorkbenchItem) {
    TemplateFeedback.openDialog({
      title: `${item.name} · 发布准入报告`,
      content: this._renderAdmissionReport(item.admissionReport),
      width: 760,
      actions: [
        {
          label: '进入设计器修复',
          onClick: () => this._openDesigner(item.entry)
        },
        { label: '关闭', variant: 'primary' }
      ]
    })
  }

  private _openAssetDialog(item: ITemplateWorkbenchItem) {
    if (item.builtIn) {
      TemplateFeedback.toast('内置模板资产信息不可直接编辑，可复制为草稿后维护', 'info')
      return
    }
    const asset = item.entry.asset ?? {}
    const content = document.createElement('div')
    content.className = 'tm-governance-form'
    const hospitalArea = this._createTextInput(asset.hospitalArea, '默认院区')
    const department = this._createTextInput(asset.department, '所属科室')
    const documentType = this._createTextInput(asset.documentType, '文书类型')
    const owner = this._createTextInput(asset.owner, '负责人')
    const roles = this._createTextInput((asset.applicableRoles ?? []).join('、'), '医生、护士')
    const scenario = this._createTextInput(asset.scenario, '适用场景')
    content.append(
      this._createGovernanceRow('院区', hospitalArea),
      this._createGovernanceRow('科室', department),
      this._createGovernanceRow('文书类型', documentType),
      this._createGovernanceRow('负责人', owner),
      this._createGovernanceRow('适用角色', roles),
      this._createGovernanceRow('适用场景', scenario)
    )

    TemplateFeedback.openDialog({
      title: `${item.name} · 资产信息`,
      content,
      width: 560,
      actions: [
        {
          label: '保存资产信息',
          variant: 'primary',
          onClick: () => {
            const nextAsset: Partial<ITemplateAssetMetadata> = {
              hospitalArea: hospitalArea.value.trim(),
              department: department.value.trim(),
              documentType: documentType.value.trim(),
              owner: owner.value.trim(),
              applicableRoles: roles.value.split(/[、,，]/).map(role => role.trim()).filter(Boolean),
              scenario: scenario.value.trim()
            }
            this.templateDomain.updateAssetMetadata(item.id, nextAsset, '模板管理员')
            this._refreshWorkbench()
            TemplateFeedback.toast('资产信息已保存', 'success')
          }
        }
      ]
    })
  }

  private _openTrialRun(item: ITemplateWorkbenchItem) {
    const content = document.createElement('div')
    content.className = 'tm-governance-form'
    const scenario = document.createElement('select')
    scenario.className = 'tm-select tm-governance-form__input'
    ;['住院入院记录', '门诊病历', '手术记录', '护理记录', '知情同意'].forEach(label => {
      const option = document.createElement('option')
      option.value = label
      option.textContent = label
      scenario.append(option)
    })
    const patientId = this._createTextInput('P-1001', '测试患者 ID')
    const department = this._createTextInput(item.entry.asset?.department, '测试科室')
    const status = document.createElement('select')
    status.className = 'tm-select tm-governance-form__input'
    ;([
      { label: '通过', value: 'passed' },
      { label: '失败', value: 'failed' }
    ]).forEach(item => {
      const option = document.createElement('option')
      option.value = item.value
      option.textContent = item.label
      status.append(option)
    })
    const summary = document.createElement('textarea')
    summary.className = 'tm-release-flow__note'
    summary.placeholder = '记录本次试运行的输入、规则触发、导出结果或待修复问题'
    content.append(
      this._createGovernanceRow('测试场景', scenario),
      this._createGovernanceRow('测试患者', patientId),
      this._createGovernanceRow('测试科室', department),
      this._createGovernanceRow('验证结果', status),
      this._createGovernanceRow('验证说明', summary)
    )

    const history = document.createElement('div')
    history.className = 'tm-trial-history'
    this._renderTrialRuns(this.templateDomain.getTrialRuns(item.id)).forEach(row => history.append(row))
    content.append(history)

    TemplateFeedback.openDialog({
      title: `${item.name} · 试运行验证`,
      content,
      width: 640,
      actions: [
        {
          label: '打开预览',
          closeOnClick: false,
          onClick: () => new TemplatePreviewDialog(item.entry.schema)
        },
        {
          label: '保存验证结果',
          variant: 'primary',
          onClick: () => {
            this.templateDomain.addTrialRun(item.id, {
              scenario: scenario.value,
              patientId: patientId.value.trim(),
              department: department.value.trim(),
              status: status.value as ITemplateTrialRunRecord['status'],
              summary: summary.value.trim() || '试运行验证已完成'
            }, '模板管理员')
            this._refreshWorkbench()
            TemplateFeedback.toast('试运行结果已保存', 'success')
          }
        }
      ]
    })
  }

  private _renderTrialRuns(records: ITemplateTrialRunRecord[]): HTMLDivElement[] {
    if (!records.length) {
      const empty = document.createElement('div')
      empty.className = 'tm-empty'
      empty.textContent = '暂无试运行记录'
      return [empty]
    }
    return records.slice(0, 4).map(record => {
      const row = document.createElement('div')
      row.className = 'tm-version-center__record'
      const status = document.createElement('span')
      status.textContent = record.status === 'passed' ? '通过' : '失败'
      const scenario = document.createElement('strong')
      scenario.textContent = record.scenario
      const note = document.createElement('em')
      note.textContent = record.summary || '无验证说明'
      const time = document.createElement('small')
      time.textContent = formatTime(record.timestamp)
      row.append(status, scenario, note, time)
      return row
    })
  }

  private _openClinicalImpact(item: ITemplateWorkbenchItem) {
    const documents = this.medicalRecordDomain.listByTemplate(item.id)
    const content = document.createElement('div')
    content.className = 'tm-version-center'
    const summary = document.createElement('div')
    summary.className = 'tm-version-center__summary'
    summary.innerHTML = `
      <div><span>引用病历</span><strong>${documents.length}</strong></div>
      <div><span>当前版本</span><strong>${item.admissionReport.clinicalImpact.currentVersionDocumentCount}</strong></div>
      <div><span>历史版本</span><strong>${item.admissionReport.clinicalImpact.outdatedVersionDocumentCount}</strong></div>
    `
    content.append(summary)
    if (!documents.length) {
      const empty = document.createElement('div')
      empty.className = 'tm-empty'
      empty.textContent = '当前还没有病历实例引用该模板'
      content.append(empty)
    }
    documents.slice(0, 6).forEach(record => {
      const row = document.createElement('div')
      row.className = 'tm-version-center__record'
      const status = document.createElement('span')
      status.textContent = record.status
      const title = document.createElement('strong')
      title.textContent = record.title || record.id
      const version = document.createElement('em')
      version.textContent = `模板 v${record.template.version}`
      const time = document.createElement('small')
      time.textContent = formatTime(record.updatedAt)
      row.append(status, title, version, time)
      content.append(row)
    })
    TemplateFeedback.openDialog({
      title: `${item.name} · 临床影响范围`,
      content,
      width: 640,
      actions: [{ label: '关闭', variant: 'primary' }]
    })
  }

  private _openMigrationPreview(item: ITemplateWorkbenchItem) {
    type IMigrationPreviewReportItem = {
      record: ReturnType<MedicalRecordDomainService['listByTemplate']>[number]
      preview: NonNullable<ReturnType<MedicalRecordDomainService['previewMigration']>>
      previousRuleCount: number
      nextRuleCount: number
      mappingText: string
      requiredText: string
      droppedText: string
      ambiguousText: string
      status: {
        badgeClass: string
        badgeText: string
      }
    }

    const documents = this.medicalRecordDomain.listByTemplate(item.id)
    const outdatedDocuments = documents.filter(
      record => record.template.version !== item.entry.schema.version
    )
    const targetDocuments = outdatedDocuments.length ? outdatedDocuments : documents
    const content = document.createElement('div')
    content.className = 'tm-version-center'

    const previews: IMigrationPreviewReportItem[] = targetDocuments
      .map(record => {
        const preview = this.medicalRecordDomain.previewMigration(
          record.id,
          item.entry.schema
        )
        if (!preview) return null

        const sourceIndex = buildTemplateFieldRuntimeIndex(record.template.snapshot)
        const targetIndex = buildTemplateFieldRuntimeIndex(item.entry.schema)
        const previousRuleCount = countRules(record.template.snapshot.blocks)
        const nextRuleCount = countRules(item.entry.schema.blocks)
        const requiredIssues = preview.unresolvedFields.filter(
          field => field.reason === 'required'
        )
        const ambiguousIssues = preview.unresolvedFields.filter(
          field => field.reason === 'ambiguous'
        )

        const summarize = (values: string[], emptyText = '无') => {
          if (!values.length) return emptyText
          const limited = values.slice(0, 3)
          return values.length > 3
            ? `${limited.join('、')} 等 ${values.length} 项`
            : limited.join('、')
        }

        const mappingText = summarize(
          preview.mappings.map(mapping => {
            const sourceLabel =
              sourceIndex.byId.get(mapping.fromFieldId)?.field.label
              || mapping.fromFieldId
            const targetLabel =
              targetIndex.byId.get(mapping.toFieldId)?.field.label
              || mapping.toFieldId
            return `${sourceLabel}→${targetLabel}`
          })
        )

        const requiredText = summarize(
          requiredIssues.map(field => field.label || field.fieldId)
        )
        const droppedText = summarize(
          preview.droppedFields.map(field => field.label || field.fieldId)
        )
        const ambiguousText = summarize(
          ambiguousIssues.map(field => field.label || field.fieldId)
        )

        const status = !preview.canAutoApply
          ? {
              badgeClass: 'tm-center-badge tm-center-badge--danger',
              badgeText: '新增必填阻断'
            }
          : preview.requiresManualConfirmation
            ? {
                badgeClass: 'tm-center-badge tm-center-badge--warning',
                badgeText: '需人工确认'
              }
            : {
                badgeClass: 'tm-center-badge tm-center-badge--success',
                badgeText: '可直接迁移'
              }

        return {
          record,
          preview,
          previousRuleCount,
          nextRuleCount,
          mappingText,
          requiredText,
          droppedText,
          ambiguousText,
          status
        }
      })
      .filter(
        (
          previewItem
        ): previewItem is IMigrationPreviewReportItem => previewItem !== null
      )

    const autoApplyCount = previews.filter(
      item => item.preview.canAutoApply && !item.preview.requiresManualConfirmation
    ).length
    const manualConfirmCount = previews.filter(
      item => item.preview.canAutoApply && item.preview.requiresManualConfirmation
    ).length
    const blockedCount = previews.filter(item => !item.preview.canAutoApply).length

    const summary = document.createElement('div')
    summary.className = 'tm-version-center__summary'
    summary.innerHTML = `
      <div><span>引用病历</span><strong>${documents.length}</strong></div>
      <div><span>待升级病历</span><strong>${outdatedDocuments.length}</strong></div>
      <div><span>可直接迁移</span><strong>${autoApplyCount}</strong></div>
      <div><span>需确认 / 阻断</span><strong>${manualConfirmCount}/${blockedCount}</strong></div>
    `
    content.append(summary)

    if (!documents.length) {
      const empty = document.createElement('div')
      empty.className = 'tm-empty'
      empty.textContent = '当前模板还没有引用病历，待生成病历实例后即可查看迁移预览。'
      content.append(empty)
    } else {
      const tip = document.createElement('div')
      tip.className = `tm-release-flow__check${blockedCount ? ' tm-release-flow__check--warn' : ''}`
      tip.textContent = outdatedDocuments.length
        ? `当前优先展示 ${outdatedDocuments.length} 份非最新模板版本病历的迁移预览；规则变化风险按病历快照模板与当前模板对比计算。`
        : '当前所有引用病历都已处于最新模板版本，以下展示的是同版本迁移预览，用于确认新增规则和字段影响。'
      content.append(tip)
    }

    previews.forEach(itemPreview => {
      const group = document.createElement('div')
      group.className = 'tm-trace-group'

      const header = document.createElement('div')
      header.className = 'tm-center-inline'
      const title = document.createElement('div')
      title.className = 'tm-trace-group__title'
      title.textContent = `${itemPreview.record.title || itemPreview.record.id} · v${itemPreview.record.template.version} -> v${item.entry.schema.version}`
      const badge = document.createElement('span')
      badge.className = itemPreview.status.badgeClass
      badge.textContent = itemPreview.status.badgeText
      header.append(title, badge)
      group.append(header)

      const meta = document.createElement('div')
      meta.className = 'tm-adapter-card__sources'
      meta.textContent = `病历状态 ${itemPreview.record.status} / 最近更新 ${formatTime(itemPreview.record.updatedAt)}`
      group.append(meta)

      const list = document.createElement('div')
      list.className = 'tm-center-list'

      const rows = [
        {
          name: `保留字段 ${itemPreview.preview.mappings.length} 项`,
          detail: itemPreview.mappingText,
          badgeText: itemPreview.preview.mappings.length ? '已映射' : '无映射',
          badgeClass: 'tm-center-badge tm-center-badge--success'
        },
        {
          name: `新增必填字段 ${itemPreview.preview.unresolvedFields.filter(field => field.reason === 'required').length} 项`,
          detail: itemPreview.requiredText,
          badgeText: itemPreview.preview.unresolvedFields.some(field => field.reason === 'required')
            ? '需补录'
            : '无阻断',
          badgeClass: itemPreview.preview.unresolvedFields.some(field => field.reason === 'required')
            ? 'tm-center-badge tm-center-badge--danger'
            : 'tm-center-badge tm-center-badge--success'
        },
        {
          name: `丢失字段 ${itemPreview.preview.droppedFields.length} 项`,
          detail: itemPreview.droppedText,
          badgeText: itemPreview.preview.droppedFields.length ? '需复核' : '无丢失',
          badgeClass: itemPreview.preview.droppedFields.length
            ? 'tm-center-badge tm-center-badge--warning'
            : 'tm-center-badge tm-center-badge--success'
        },
        {
          name: `规则变化风险 ${itemPreview.previousRuleCount} -> ${itemPreview.nextRuleCount}`,
          detail: itemPreview.previousRuleCount === itemPreview.nextRuleCount
            ? `规则数量无变化${itemPreview.ambiguousText !== '无' ? ` / 歧义字段：${itemPreview.ambiguousText}` : ''}`
            : `规则数量发生变化，建议复核触发条件与联动影响${itemPreview.ambiguousText !== '无' ? ` / 歧义字段：${itemPreview.ambiguousText}` : ''}`,
          badgeText: itemPreview.previousRuleCount === itemPreview.nextRuleCount
            ? '稳定'
            : '需复核',
          badgeClass: itemPreview.previousRuleCount === itemPreview.nextRuleCount
            ? 'tm-center-badge tm-center-badge--success'
            : 'tm-center-badge tm-center-badge--warning'
        }
      ]

      rows.forEach(row => {
        const item = document.createElement('div')
        item.className = 'tm-center-list__row'
        const info = document.createElement('div')
        info.className = 'tm-center-list__info'
        const name = document.createElement('strong')
        name.textContent = row.name
        const detail = document.createElement('small')
        detail.textContent = row.detail
        info.append(name, detail)
        const rowBadge = document.createElement('span')
        rowBadge.className = row.badgeClass
        rowBadge.textContent = row.badgeText
        item.append(info, rowBadge)
        list.append(item)
      })

      group.append(list)
      content.append(group)
    })

    TemplateFeedback.openDialog({
      title: `${item.name} · 模板迁移预览`,
      content,
      width: 760,
      actions: [{ label: '关闭', variant: 'primary' }]
    })
  }

  private _openDocumentTrace(item: ITemplateWorkbenchItem) {
    const documents = this.medicalRecordDomain.listByTemplate(item.id)
    const content = document.createElement('div')
    content.className = 'tm-version-center'
    const summary = document.createElement('div')
    summary.className = 'tm-version-center__summary'
    const traceCount = documents.reduce((sum, record) => sum + record.traceEvents.length, 0)
    summary.innerHTML = `
      <div><span>病历实例</span><strong>${documents.length}</strong></div>
      <div><span>引用追溯</span><strong>${traceCount}</strong></div>
      <div><span>最近更新</span><strong>${documents[0] ? formatTime(documents[0].updatedAt) : '暂无'}</strong></div>
    `
    content.append(summary)
    if (!documents.length) {
      const empty = document.createElement('div')
      empty.className = 'tm-empty'
      empty.textContent = '当前模板暂无引用病历，使用已发布模板后会自动生成实例追溯信息。'
      content.append(empty)
    }
    documents.slice(0, 4).forEach(record => {
      const group = document.createElement('div')
      group.className = 'tm-trace-group'
      const title = document.createElement('div')
      title.className = 'tm-trace-group__title'
      title.textContent = `${record.title || record.id} · v${record.template.version}`
      group.append(title)
      this.medicalRecordDomain.getTraceTimeline(record.id).slice(0, 6).forEach(event => {
        const row = document.createElement('div')
        row.className = 'tm-version-center__record'
        const action = document.createElement('span')
        action.textContent = event.title
        const operator = document.createElement('strong')
        operator.textContent = event.operator || '系统'
        const summary = document.createElement('em')
        summary.textContent = event.summary || `${event.changedFields?.length ?? 0} 个字段变更`
        const time = document.createElement('small')
        time.textContent = formatTime(event.timestamp)
        row.append(action, operator, summary, time)
        group.append(row)
      })
      content.append(group)
    })
    TemplateFeedback.openDialog({
      title: `${item.name} · 引用病历追溯`,
      content,
      width: 720,
      actions: [{ label: '关闭', variant: 'primary' }]
    })
  }

  private _openAuditLog(item: ITemplateWorkbenchItem) {
    const content = document.createElement('div')
    content.className = 'tm-version-center'
    const records = this.templateDomain.getAuditLogs(item.id)
    if (!records.length) {
      const empty = document.createElement('div')
      empty.className = 'tm-empty'
      empty.textContent = '暂无操作日志'
      content.append(empty)
    }
    records.slice(0, 10).forEach(record => {
      const row = document.createElement('div')
      row.className = 'tm-version-center__record'
      const action = document.createElement('span')
      action.textContent = record.action
      const operator = document.createElement('strong')
      operator.textContent = record.operator || '系统'
      const detail = document.createElement('em')
      detail.textContent = record.note || record.detail || '无说明'
      const time = document.createElement('small')
      time.textContent = formatTime(record.timestamp)
      row.append(action, operator, detail, time)
      content.append(row)
    })
    TemplateFeedback.openDialog({
      title: `${item.name} · 操作日志`,
      content,
      width: 680,
      actions: [{ label: '关闭', variant: 'primary' }]
    })
  }

  private _openVersionCenter(item: ITemplateWorkbenchItem) {
    const content = document.createElement('div')
    content.className = 'tm-version-center'
    const summary = document.createElement('div')
    summary.className = 'tm-version-center__summary'
    summary.innerHTML = `
      <div><span>工作版本</span><strong>v${item.entry.schema.version}</strong></div>
      <div><span>线上版本</span><strong>${this._getPublishedVersion(item.entry) || '暂无'}</strong></div>
      <div><span>发布检查</span><strong>${item.issueCount ? `${item.issueCount} 个问题` : '通过'}</strong></div>
    `
    const history = document.createElement('div')
    history.className = 'tm-version-center__history'
    const records = item.entry.versionHistory.length
      ? item.entry.versionHistory
      : [{ status: item.entry.status, version: item.entry.schema.version, timestamp: item.updatedAt }]
    const historyTitle = document.createElement('div')
    historyTitle.className = 'tm-version-center__section-title'
    historyTitle.textContent = '版本记录'
    records.slice().reverse().forEach(record => {
      history.append(this._renderVersionRecord(record))
    })
    content.append(summary, this._renderVersionImpactSummary(item), historyTitle, history)
    TemplateFeedback.openDialog({
      title: `${item.name} · 版本中心`,
      content,
      width: 640,
      actions: [
        ...(!item.builtIn && this.templateDomain.getLatestPublishedRecord(item.id)?.schemaSnapshot
          ? [{
              label: '复制线上版本为修订草稿',
              onClick: () => this._createRevisionDraftFromPublished(item)
            }]
          : []),
        { label: '关闭', variant: 'primary' }
      ]
    })
  }

  private async _createRevisionDraftFromPublished(item: ITemplateWorkbenchItem) {
    const published = this.templateDomain.getLatestPublishedRecord(item.id)
    if (!published?.schemaSnapshot) {
      TemplateFeedback.toast('当前模板还没有线上版本，无法生成修订草稿', 'info')
      return
    }
    const confirmed = await TemplateFeedback.confirm({
      title: '生成修订草稿',
      message: `确认基于线上版本 v${published.version} 生成修订草稿？当前工作版本会被线上快照覆盖，试运行记录需要重新补录。`,
      confirmText: '生成草稿'
    })
    if (!confirmed) return
    const draft = this.templateDomain.createRevisionDraftFromPublished(
      item.id,
      '模板管理员'
    )
    if (!draft) {
      TemplateFeedback.alert({
        title: '生成失败',
        message: '未找到可用的线上版本快照',
        tone: 'warning'
      })
      return
    }
    this._refreshWorkbench()
    const nextEntry = this.templateDomain.getEntry(item.id)
    if (nextEntry) {
      this._openDesigner(nextEntry)
    }
    TemplateFeedback.toast('已生成修订草稿，请重新试运行并走发布准入', 'success')
  }

  private _getPublishedVersion(entry: ITemplateRegistryEntry): string {
    return this.templateDomain.getPublishedVersion(entry)
  }

  private _renderVersionImpactSummary(
    item: ITemplateWorkbenchItem
  ): HTMLDivElement {
    const latestPublished = this.templateDomain.getLatestPublishedRecord(item.id)
    const summary = getTemplateVersionImpactSummary(
      item.entry.schema,
      latestPublished
    )
    const section = document.createElement('div')

    const title = document.createElement('div')
    title.className = 'tm-version-center__section-title'
    title.textContent = '本次变更影响摘要'

    const helper = document.createElement('div')
    helper.className = 'tm-adapter-card__sources'
    helper.textContent = summary.baselineText

    const list = document.createElement('div')
    list.className = 'tm-center-list'
    summary.items.forEach(itemSummary => {
      const row = document.createElement('div')
      row.className = 'tm-center-list__row'
      const info = document.createElement('div')
      info.className = 'tm-center-list__info'
      const label = document.createElement('strong')
      label.textContent = itemSummary.label
      const detail = document.createElement('small')
      detail.textContent = itemSummary.detail
      info.append(label, detail)

      const badge = document.createElement('span')
      badge.className = `tm-center-badge tm-center-badge--${itemSummary.tone}`
      badge.textContent = itemSummary.badge
      row.append(info, badge)
      list.append(row)
    })

    section.append(title, helper, list)
    return section
  }

  private _renderVersionRecord(record: ITemplateVersionRecord): HTMLDivElement {
    const row = document.createElement('div')
    row.className = 'tm-version-center__record'
    const status = document.createElement('span')
    status.textContent = STATUS_LABEL[record.status]
    const version = document.createElement('strong')
    version.textContent = `v${record.version}`
    const note = document.createElement('em')
    note.textContent = record.note || '无版本说明'
    const time = document.createElement('small')
    time.textContent = formatTime(record.timestamp)
    row.append(status, version, note, time)
    return row
  }

  private _openReleaseFlow(item: ITemplateWorkbenchItem) {
    if (item.builtIn) {
      TemplateFeedback.toast('内置模板默认视为已发布，无需发版', 'info')
      return
    }
    const content = document.createElement('div')
    content.className = 'tm-release-flow'
    content.append(this._renderAdmissionReport(item.admissionReport))

    const reason = this._createTextInput('', '例如：护理记录结构调整')
    const impactScope = this._createTextInput('', '例如：心内科住院病历')
    const verifier = this._createTextInput('', '验证人')
    const plannedAt = this._createTextInput('', '计划上线时间')
    const note = document.createElement('textarea')
    note.className = 'tm-release-flow__note'
    note.placeholder = '填写本次送审、发布或撤回说明'
    const check = document.createElement('div')
    check.className = `tm-release-flow__check${item.admissionReport.status !== 'passed' ? ' tm-release-flow__check--warn' : ''}`
    check.textContent = item.admissionReport.blockerCount
      ? `发布准入存在 ${item.admissionReport.blockerCount} 个阻断项，送审/发布会被拦截`
      : item.admissionReport.warningCount
        ? `发布准入存在 ${item.admissionReport.warningCount} 个警告项，请确认后继续`
        : '发布准入通过，可进入送审或发布'
    content.append(
      check,
      this._createGovernanceRow('变更原因', reason),
      this._createGovernanceRow('影响范围', impactScope),
      this._createGovernanceRow('验证人', verifier),
      this._createGovernanceRow('计划上线', plannedAt),
      this._createGovernanceRow('版本说明', note)
    )

    TemplateFeedback.openDialog({
      title: `${item.name} · 发版流程`,
      content,
      width: 520,
      actions: [
        {
          label: '送审',
          onClick: () => this._runReleaseAction('review', item, {
            note: note.value.trim(),
            reason: reason.value.trim(),
            impactScope: impactScope.value.trim(),
            verifier: verifier.value.trim(),
            plannedAt: plannedAt.value.trim()
          })
        },
        {
          label: '发布',
          variant: 'primary',
          onClick: () => this._runReleaseAction('published', item, {
            note: note.value.trim(),
            reason: reason.value.trim(),
            impactScope: impactScope.value.trim(),
            verifier: verifier.value.trim(),
            plannedAt: plannedAt.value.trim()
          })
        },
        {
          label: '撤回',
          variant: 'danger',
          onClick: () => this._runReleaseAction('archived', item, {
            note: note.value.trim(),
            reason: reason.value.trim(),
            impactScope: impactScope.value.trim(),
            verifier: verifier.value.trim(),
            plannedAt: plannedAt.value.trim()
          })
        }
      ]
    })
  }

  private _runReleaseAction(
    status: Extract<TemplatePublishStatus, 'review' | 'published' | 'archived'>,
    item: ITemplateWorkbenchItem,
    releaseNote: ITemplateReleaseNote
  ) {
    const result = this.templateDomain.runReleaseAction(
      status,
      item.id,
      item.admissionReport,
      releaseNote
    )
    if (!result.applied) {
      TemplateFeedback.alert({
        title: item.admissionReport.blockerCount && status !== 'archived'
          ? '发布准入未通过'
          : '发版检查未通过',
        message: result.errors.join('；'),
        tone: 'warning'
      })
      return
    }
    TemplateFeedback.toast('发版状态已更新', 'success')
    this._refreshWorkbench()
  }

  private async _deleteTemplate(item: ITemplateWorkbenchItem) {
    const boundDocumentCount = this.medicalRecordDomain.getBoundDocumentCount(item.id)
    const confirmed = await TemplateFeedback.confirm({
      title: '删除模板',
      message: boundDocumentCount
        ? `确认删除模板“${item.name}”？当前已有 ${boundDocumentCount} 份病历引用该模板版本，删除后不影响历史快照回显，但模板资产不可恢复。`
        : `确认删除模板“${item.name}”？该操作不可恢复。`,
      tone: 'danger',
      confirmText: '删除'
    })
    if (!confirmed) return
    this.templateDomain.delete(item.id)
    TemplateFeedback.toast('模板已删除', 'success')
    this._refreshWorkbench()
  }

  private _renderFooter(): HTMLDivElement {
    const footer = document.createElement('div')
    footer.className = 'tm-footer'

    const importBtn = document.createElement('button')
    importBtn.className = 'td-designer__btn'
    importBtn.textContent = '导入 JSON'
    importBtn.type = 'button'
    importBtn.addEventListener('click', () => this._importJSON())

    const exportBtn = document.createElement('button')
    exportBtn.className = 'td-designer__btn'
    exportBtn.textContent = '导出当前分类'
    exportBtn.type = 'button'
    exportBtn.addEventListener('click', () => this._exportJSON())

    const batchReviewBtn = document.createElement('button')
    batchReviewBtn.className = 'td-designer__btn td-designer__btn--ghost'
    batchReviewBtn.textContent = '批量送审当前视图'
    batchReviewBtn.type = 'button'
    batchReviewBtn.addEventListener('click', () => this._batchSubmitForReview())

    const businessBtn = document.createElement('button')
    businessBtn.className = 'td-designer__btn'
    businessBtn.textContent = '业务字段中心'
    businessBtn.type = 'button'
    businessBtn.addEventListener('click', () => this._openBusinessFieldCenter())

    const permissionBtn = document.createElement('button')
    permissionBtn.className = 'td-designer__btn'
    permissionBtn.textContent = '权限中心'
    permissionBtn.type = 'button'
    permissionBtn.addEventListener('click', () => this._openPermissionCenter())

    const qualityBtn = document.createElement('button')
    qualityBtn.className = 'td-designer__btn'
    qualityBtn.textContent = '质控中心'
    qualityBtn.type = 'button'
    qualityBtn.addEventListener('click', () => this._openQualityCenter())

    const auditBtn = document.createElement('button')
    auditBtn.className = 'td-designer__btn'
    auditBtn.textContent = '审计中心'
    auditBtn.type = 'button'
    auditBtn.addEventListener('click', () => this._openAuditCenter())

    footer.append(
      importBtn,
      exportBtn,
      batchReviewBtn,
      businessBtn,
      permissionBtn,
      qualityBtn,
      auditBtn
    )
    return footer
  }

  private _openPermissionCenter() {
    const content = this.permissionCenter.createDialogContent()
    TemplateFeedback.openDialog({
      title: '权限中心',
      content,
      width: 640,
      actions: [{ label: '关闭', variant: 'primary' }]
    })
  }

  private _openQualityCenter() {
    const content = this.qualityCenter.createDialogContent({
      items: this._getWorkbenchItems(false),
      medicalRecordDomain: this.medicalRecordDomain
    })
    TemplateFeedback.openDialog({
      title: '质控中心',
      content,
      width: 680,
      actions: [{ label: '关闭', variant: 'primary' }]
    })
  }

  private _openBusinessFieldCenter() {
    const content = this.businessFieldCenter.createDialogContent({
      getItems: () => this._getWorkbenchItems(false),
      getAdapters: () => this.templateDomain.listDataAdapters(),
      onQuickApplyField: (field, rerender) =>
        this._openBusinessFieldQuickApplyDialog(field, rerender),
      onMaintainField: (field, rerender) => this._openBusinessFieldAssetDialog(field, rerender),
      onOpenTemplate: templateId => {
        const entry = this.templateDomain.getEntry(templateId)
        if (entry) {
          this._openDesigner(entry)
        }
      }
    })

    TemplateFeedback.openDialog({
      title: '业务字段中心',
      content,
      width: 860,
      actions: [{ label: '关闭', variant: 'primary' }]
    })
  }

  private _openBusinessFieldQuickApplyDialog(
    field: IBusinessFieldCenterFieldAsset,
    rerender: () => void
  ) {
    const recommended = recommendBusinessFieldQuickPresets({
      id: field.fieldId,
      label: field.label,
      metadata: {
        businessCode: field.businessCode || undefined,
        group: field.group || undefined,
        dataSource: field.dataSource || undefined,
        permission: field.permission || undefined,
        exportPath: field.exportPath || undefined
      }
    })
    const recommendedIds = new Set(recommended.map(item => item.id))
    const allPresets = getBusinessFieldQuickPresets()
    const fallbackPresets = allPresets.filter(item => !recommendedIds.has(item.id))
    const content = document.createElement('div')
    content.className = 'tm-governance-form'

    const hint = document.createElement('div')
    hint.className = 'tm-adapter-card__sources'
    hint.textContent = '点击下方任一快配后，会立即把控件类型、占位文案、业务编码、导出路径、数据源和权限标签一起回写到模板字段。'

    const appendPresetGrid = (
      titleText: string,
      presets: IBusinessFieldQuickPreset[],
      helperText?: string
    ) => {
      const title = document.createElement('div')
      title.className = 'tm-version-center__section-title'
      title.textContent = titleText
      content.append(title)
      if (helperText) {
        const helper = document.createElement('div')
        helper.className = 'tm-adapter-card__sources'
        helper.textContent = helperText
        content.append(helper)
      }
      const grid = document.createElement('div')
      grid.className = 'td-props__preset-grid'
      presets.forEach(preset => {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'td-props__preset-card'
        const label = document.createElement('strong')
        label.textContent = preset.label
        const desc = document.createElement('span')
        desc.textContent = preset.description
        btn.append(label, desc)
        btn.onclick = () => this._quickApplyBusinessFieldPreset(field, preset, rerender)
        grid.append(btn)
      })
      content.append(grid)
    }

    content.append(hint)
    if (recommended.length) {
      appendPresetGrid(
        '智能推荐',
        recommended,
        `已根据字段名、标签和现有绑定推断出更可能命中的快配：${recommended.map(item => item.label).join('、')}`
      )
    }
    appendPresetGrid(
      recommended.length ? '全部业务快配' : '业务快配',
      recommended.length ? fallbackPresets : allPresets
    )

    TemplateFeedback.openDialog({
      title: `${field.label} · 字段快配`,
      content,
      width: 640,
      actions: [{ label: '关闭', variant: 'primary' }]
    })
  }

  private _openBusinessFieldAssetDialog(
    field: IBusinessFieldCenterFieldAsset,
    rerender: () => void
  ) {
    const entry = this.templateDomain.getEntry(field.templateId)
    if (!entry || entry.builtIn) {
      TemplateFeedback.toast('内置模板字段暂不支持直接维护，可先生成草稿后再编辑', 'info')
      return
    }

    const content = document.createElement('div')
    content.className = 'tm-governance-form'
    const businessCode = this._createTextInput(field.businessCode, 'patient.name')
    const group = this._createTextInput(field.group, '基本信息')
    const dataSource = this._createTextInput(field.dataSource, 'patient')
    const permission = this._createTextInput(field.permission, 'doctor.read')
    const exportPath = this._createTextInput(field.exportPath, 'patient.name')
    content.append(
      this._createGovernanceRow('业务编码', businessCode),
      this._createGovernanceRow('字段分组', group),
      this._createGovernanceRow('数据源', dataSource),
      this._createGovernanceRow('权限标签', permission),
      this._createGovernanceRow('导出路径', exportPath)
    )

    TemplateFeedback.openDialog({
      title: `${field.label} · 字段资产维护`,
      content,
      width: 560,
      actions: [
        {
          label: '保存字段资产',
          variant: 'primary',
          onClick: () => {
            const nextSchema = updateTemplateFieldMetadata(
              entry.schema,
              field.fieldId,
              {
                ...(entry.schema ? buildTemplateFieldRuntimeIndex(entry.schema).byId.get(field.fieldId)?.field.metadata : {}),
                businessCode: businessCode.value.trim(),
                group: group.value.trim(),
                dataSource: dataSource.value.trim(),
                permission: permission.value.trim(),
                exportPath: exportPath.value.trim()
              }
            )
            this.templateDomain.register(nextSchema, entry.category, false, {
              note: `维护字段资产 ${field.label}`,
              operator: '模板管理员'
            })
            this._refreshWorkbench()
            rerender()
            TemplateFeedback.toast('字段资产已保存', 'success')
          }
        }
      ]
    })
  }

  private _quickApplyBusinessFieldPreset(
    field: IBusinessFieldCenterFieldAsset,
    preset: IBusinessFieldQuickPreset,
    rerender: () => void
  ) {
    const entry = this.templateDomain.getEntry(field.templateId)
    if (!entry || entry.builtIn) {
      TemplateFeedback.toast('内置模板字段暂不支持字段快配，可先生成草稿后再编辑', 'info')
      return
    }

    const nextSchema = updateTemplateField(entry.schema, field.fieldId, currentField => {
      return applyBusinessFieldQuickPreset(currentField, preset)
    })

    this.templateDomain.register(nextSchema, entry.category, false, {
      note: `字段快配 ${preset.label} -> ${field.label}`,
      operator: '模板管理员'
    })
    this._refreshWorkbench()
    rerender()
    TemplateFeedback.toast(`已套用字段快配：${preset.label}`, 'success')
  }

  private _openAuditCenter() {
    const content = this.auditCenter.createDialogContent(
      this._getWorkbenchItems(false)
    )

    TemplateFeedback.openDialog({
      title: '审计中心',
      content,
      width: 720,
      actions: [{ label: '关闭', variant: 'primary' }]
    })
  }

  private _openPageDecorationDialog(item: ITemplateWorkbenchItem) {
    const schema = JSON.parse(JSON.stringify(item.entry.schema)) as ITemplateSchema
    const current = schema.layout?.pageDecorations
    const state: {
      headerId: string
      headerMode: TemplatePageDecorationMode
      footerId: string
      footerMode: TemplatePageDecorationMode
      variables: Partial<Record<TemplatePageDecorationVariableKey, string>>
    } = {
      headerId: current?.header?.id ?? '',
      headerMode: current?.header?.mode ?? 'replace',
      footerId: current?.footer?.id ?? '',
      footerMode: current?.footer?.mode ?? 'replace',
      variables: { ...(current?.variables ?? {}) }
    }
    const content = document.createElement('div')
    content.className = 'tm-decoration-form'

    const createRow = (
      label: string,
      input: HTMLElement,
      hint?: string
    ) => {
      const row = document.createElement('div')
      row.className = 'tm-decoration-form__row'
      const title = document.createElement('label')
      title.textContent = label
      row.append(title, input)
      if (hint) {
        const note = document.createElement('small')
        note.className = 'tm-decoration-form__note'
        note.textContent = hint
        row.append(note)
      }
      return row
    }

    const createSelect = (
      options: Array<{ label: string; value: string }>,
      value: string,
      onChange: (value: string) => void
    ) => {
      const select = document.createElement('select')
      select.className = 'tm-select tm-decoration-form__select'
      options.forEach(option => {
        const el = document.createElement('option')
        el.value = option.value
        el.textContent = option.label
        if (option.value === value) el.selected = true
        select.append(el)
      })
      select.addEventListener('change', () => onChange(select.value))
      return select
    }

    const render = () => {
      content.innerHTML = ''
      const headerPreset = getTemplatePageDecorationPreset(state.headerId)
      const footerPreset = getTemplatePageDecorationPreset(state.footerId)
      const hint = document.createElement('div')
      hint.className = 'tm-decoration-form__hint'
      hint.textContent = item.builtIn
        ? '内置模板套用页眉页脚方案后会生成当前模板的可编辑草稿。'
        : '可直接为当前模板切换或追加页眉页脚方案，无需进入字段级属性面板。'
      content.append(hint)

      const grid = document.createElement('div')
      grid.className = 'tm-decoration-form__grid'

      const modeOptions = [
        { label: '替换当前区块', value: 'replace' },
        { label: '前置合并', value: 'prepend' },
        { label: '后置合并', value: 'append' }
      ]

      const headerSection = document.createElement('div')
      headerSection.className = 'tm-decoration-form__section'
      const headerTitle = document.createElement('div')
      headerTitle.className = 'tm-decoration-form__title'
      headerTitle.textContent = '页眉方案'
      headerSection.append(headerTitle)
      headerSection.append(
        createRow(
          '预定义页眉',
          createSelect(
            [
              { label: '不使用预定义页眉', value: '' },
              ...getTemplatePageDecorationPresets('header').map(preset => ({
                label: preset.name,
                value: preset.id
              }))
            ],
            state.headerId,
            value => {
              state.headerId = value
              render()
            }
          ),
          headerPreset?.description
        )
      )
      headerSection.append(
        createRow(
          '合并模式',
          createSelect(modeOptions, state.headerMode, value => {
            state.headerMode = value as TemplatePageDecorationMode
            render()
          })
        )
      )
      headerSection.append(
        createPageDecorationPreview(
          '页眉',
          headerPreset,
          state.headerMode,
          state.variables,
          schema.name
        )
      )

      const footerSection = document.createElement('div')
      footerSection.className = 'tm-decoration-form__section'
      const footerTitle = document.createElement('div')
      footerTitle.className = 'tm-decoration-form__title'
      footerTitle.textContent = '页脚方案'
      footerSection.append(footerTitle)
      footerSection.append(
        createRow(
          '预定义页脚',
          createSelect(
            [
              { label: '不使用预定义页脚', value: '' },
              ...getTemplatePageDecorationPresets('footer').map(preset => ({
                label: preset.name,
                value: preset.id
              }))
            ],
            state.footerId,
            value => {
              state.footerId = value
              render()
            }
          ),
          footerPreset?.description
        )
      )
      footerSection.append(
        createRow(
          '合并模式',
          createSelect(modeOptions, state.footerMode, value => {
            state.footerMode = value as TemplatePageDecorationMode
            render()
          })
        )
      )
      footerSection.append(
        createPageDecorationPreview(
          '页脚',
          footerPreset,
          state.footerMode,
          state.variables,
          schema.name
        )
      )

      grid.append(headerSection, footerSection)
      content.append(grid)

      const variableDefs = Array.from(
        new Map(
          [
            ...(getTemplatePageDecorationPreset(state.headerId)?.variables ?? []),
            ...(getTemplatePageDecorationPreset(state.footerId)?.variables ?? [])
          ].map((item: ITemplatePageDecorationVariableDefinition) => [item.key, item])
        ).values()
      )

      if (variableDefs.length) {
        const variableSection = document.createElement('div')
        variableSection.className = 'tm-decoration-form__section'
        const variableTitle = document.createElement('div')
        variableTitle.className = 'tm-decoration-form__title'
        variableTitle.textContent = '方案变量'
        variableSection.append(variableTitle)
        variableDefs.forEach(def => {
          const input = document.createElement('input')
          input.type = 'text'
          input.className = 'td-props__input tm-decoration-form__input'
          input.value = state.variables[def.key] ?? ''
          if (def.placeholder) input.placeholder = def.placeholder
          input.addEventListener('input', () => {
            state.variables[def.key] = input.value
          })
          input.addEventListener('change', () => render())
          variableSection.append(createRow(def.label, input, def.description))
        })
        content.append(variableSection)
      }
    }

    render()

    TemplateFeedback.openDialog({
      title: `${item.name} · 套用页眉页脚方案`,
      content,
      width: 720,
      actions: [
        {
          label: '深度编辑',
          onClick: () => this._openDesigner(item.entry, 'decorations')
        },
        {
          label: '保存方案',
          variant: 'primary',
          onClick: () => {
            const pageDecorations = normalizePageDecorationConfig({
              header: state.headerId
                ? { id: state.headerId, mode: state.headerMode }
                : undefined,
              footer: state.footerId
                ? { id: state.footerId, mode: state.footerMode }
                : undefined,
              variables: state.variables
            })
            const layout = { ...(schema.layout ?? {}) }
            if (pageDecorations) {
              layout.pageDecorations = pageDecorations
            } else {
              delete layout.pageDecorations
            }
            const nextSchema: ITemplateSchema = {
              ...schema,
              layout
            }
            this.templateDomain.register(
              nextSchema,
              item.entry.category,
              false,
              { note: '套用页眉页脚方案' }
            )
            this._refreshWorkbench()
            TemplateFeedback.toast(
              item.builtIn
                ? '已生成包含页眉页脚方案的可编辑草稿'
                : '页眉页脚方案已保存',
              'success'
            )
          }
        }
      ]
    })
  }

  private _openDesigner(
    entry?: ITemplateRegistryEntry,
    focusLayoutSection?: 'paper' | 'margins' | 'decorations'
  ) {
    const designer = new TemplateDesigner(
      {
        onSave: (saved, category) => {
          this.templateDomain.register(
            saved,
            category || (this.activeCategory === '全部' ? '自定义' : this.activeCategory),
            false
          )
          this._refreshWorkbench()
        },
        onClose: () => {}
      },
      entry
    )
    if (focusLayoutSection) {
      requestAnimationFrame(() => designer.focusLayoutSection(focusLayoutSection))
    }
  }

  private _openActionReport(options: {
    title: string
    summary: ITemplateActionReportSummaryItem[]
    rows: ITemplateActionReportRow[]
    emptyText: string
    width?: number
  }) {
    const content = document.createElement('div')
    content.className = 'tm-version-center'

    const summary = document.createElement('div')
    summary.className = 'tm-version-center__summary'
    options.summary.forEach(item => {
      const box = document.createElement('div')
      box.innerHTML = `<span>${item.label}</span><strong>${item.value}</strong>`
      summary.append(box)
    })
    content.append(summary)

    if (!options.rows.length) {
      const empty = document.createElement('div')
      empty.className = 'tm-empty'
      empty.textContent = options.emptyText
      content.append(empty)
    } else {
      const list = document.createElement('div')
      list.className = 'tm-center-list'
      options.rows.forEach(row => {
        const item = document.createElement('div')
        item.className = 'tm-center-list__row'
        const info = document.createElement('div')
        info.className = 'tm-center-list__info'
        const name = document.createElement('strong')
        name.textContent = row.name
        const detail = document.createElement('small')
        detail.textContent = row.detail
        info.append(name, detail)

        const badge = document.createElement('span')
        badge.className =
          row.status === 'success'
            ? 'tm-center-badge tm-center-badge--success'
            : row.status === 'warning'
              ? 'tm-center-badge tm-center-badge--warning'
              : 'tm-center-badge tm-center-badge--danger'
        badge.textContent = row.statusText
        item.append(info, badge)
        list.append(item)
      })
      content.append(list)
    }

    TemplateFeedback.openDialog({
      title: options.title,
      content,
      width: options.width ?? 720,
      actions: [{ label: '关闭', variant: 'primary' }]
    })
  }

  private _importJSON() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const json = e.target?.result as string
          const result = this.templateDomain.importSchemas(json, '自定义')
          const createdCount = result.imported.filter(item => item.mode === 'created').length
          const updatedCount = result.imported.filter(item => item.mode === 'updated').length
          const rows: ITemplateActionReportRow[] = [
            ...result.imported.map(item => {
              const metrics = getTemplateMetrics(item.schema)
              return {
                name: item.schema.name,
                detail: `${item.mode === 'created' ? '新增导入' : '覆盖更新'} / 字段 ${metrics.fieldCount} / 规则 ${metrics.ruleCount}`,
                status: 'success' as const,
                statusText: item.mode === 'created' ? '已导入' : '已更新'
              }
            }),
            ...result.failed.map(item => ({
              name: item.name,
              detail: item.message,
              status: 'danger' as const,
              statusText: '失败'
            }))
          ]

          if (result.imported.length) {
            this._refreshWorkbench()
          }

          this._openActionReport({
            title: `导入结果 · ${file.name}`,
            summary: [
              { label: '成功导入', value: result.imported.length },
              { label: '新增模板', value: createdCount },
              { label: '覆盖更新', value: updatedCount },
              { label: '失败项', value: result.failed.length }
            ],
            rows,
            emptyText: '当前文件没有可导入的模板。'
          })
        } catch (err) {
          TemplateFeedback.alert({
            title: '导入失败',
            message: (err as Error).message,
            tone: 'danger'
          })
        }
      }
      reader.readAsText(file)
    })
    input.click()
  }

  private _exportJSON() {
    const items = this._getWorkbenchItems()
    if (items.length === 0) {
      TemplateFeedback.alert({
        title: '无法导出',
        message: '当前视图没有可导出的模板',
        tone: 'warning'
      })
      return
    }

    const schemas = items.map(item => item.entry.schema)
    const json = JSON.stringify(schemas, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const label = this.activeCategory === '全部' ? 'all' : this.activeCategory
    const fileName = `templates-${label}.json`
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)

    this._openActionReport({
      title: '导出结果',
      summary: [
        { label: '导出模板', value: items.length },
        { label: '导出分类', value: this.activeCategory },
        { label: '导出文件', value: fileName },
        { label: '文件大小', value: `${Math.max(1, Math.round(blob.size / 1024))} KB` }
      ],
      rows: items.slice(0, 12).map(item => ({
        name: item.name,
        detail: `${STATUS_LABEL[item.entry.status]} / v${item.entry.schema.version} / ${item.category}`,
        status: 'success' as const,
        statusText: '已导出'
      })),
      emptyText: '当前视图没有可导出的模板。'
    })
  }

  private async _batchSubmitForReview() {
    const items = this._getWorkbenchItems()
    if (!items.length) {
      await TemplateFeedback.alert({
        title: '无法批量送审',
        message: '当前视图没有可处理的模板。',
        tone: 'warning'
      })
      return
    }

    const eligibleItems = items.filter(item => {
      return !item.builtIn && item.entry.status !== 'review' && item.entry.status !== 'published'
    })
    const skippedItems = items.filter(item => !eligibleItems.includes(item))

    if (!eligibleItems.length) {
      await TemplateFeedback.alert({
        title: '无法批量送审',
        message: '当前视图中的模板均为内置模板、已送审或已发布状态。',
        tone: 'warning'
      })
      return
    }

    const confirmed = await TemplateFeedback.confirm({
      title: '批量送审当前视图',
      message: skippedItems.length
        ? `确认将 ${eligibleItems.length} 个模板批量送审？另外会跳过 ${skippedItems.length} 个内置模板或已进入流程的模板。`
        : `确认将当前视图中的 ${eligibleItems.length} 个模板批量送审？`,
      confirmText: '开始送审'
    })
    if (!confirmed) return

    const successRows: ITemplateActionReportRow[] = []
    const failedRows: ITemplateActionReportRow[] = []
    const skippedRows: ITemplateActionReportRow[] = skippedItems.map(item => ({
      name: item.name,
      detail: item.builtIn
        ? '内置模板默认视为平台资产，不参与批量送审。'
        : item.entry.status === 'review'
          ? '模板已处于待审核状态。'
          : '模板已发布，无需再次送审。',
      status: 'warning',
      statusText: '跳过'
    }))

    eligibleItems.forEach(item => {
      const result = this.templateDomain.runReleaseAction(
        'review',
        item.id,
        item.admissionReport,
        {
          note: '工作台批量送审',
          reason: '按当前筛选结果批量送审'
        }
      )

      if (result.applied) {
        successRows.push({
          name: item.name,
          detail: `已送审 / ${item.category} / v${item.entry.schema.version}`,
          status: 'success',
          statusText: '成功'
        })
      } else {
        failedRows.push({
          name: item.name,
          detail: result.errors.join('；') || '送审失败',
          status: 'danger',
          statusText: '失败'
        })
      }
    })

    if (successRows.length) {
      this._refreshWorkbench()
    }

    this._openActionReport({
      title: '批量送审结果',
      summary: [
        { label: '送审成功', value: successRows.length },
        { label: '送审失败', value: failedRows.length },
        { label: '已跳过', value: skippedRows.length },
        { label: '当前视图', value: items.length }
      ],
      rows: [...successRows, ...failedRows, ...skippedRows],
      emptyText: '当前没有生成任何批量送审记录。'
    })
  }

  private _dispose() {
    document.querySelectorAll('.tm-more-menu').forEach(el => el.remove())
    this.mask.remove()
    this.container.remove()
    this._unlockRootScroll()
  }
}