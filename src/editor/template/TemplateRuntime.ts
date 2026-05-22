import type Editor from '../index'
import type { IControlContentChangeResult, ISetControlValueOption } from '../interface/Control'
import type { IElement } from '../interface/Element'
import type {
  ITemplateBlock,
  ITemplateField,
  ITemplateFieldMetadata,
  ITemplateSchema
} from './index'
import {
  extractTemplateValues,
  type ITemplateExtractResult
} from './TemplateValueExtractor'
import {
  templateDataAdapterRegistry,
  type ITemplateDataAdapter,
  type ITemplateDataAdapterContext,
  type ITemplateDataAdapterRequestField,
  type ITemplateDataAdapterResolution,
  type TemplateDataAdapterRegistry
} from './TemplateDataAdapter'

export interface ITemplateFieldRuntimeNode {
  field: ITemplateField
  metadata?: ITemplateFieldMetadata
  zone: 'header' | 'main' | 'footer'
  containerBlockIds: string[]
  sectionId?: string
  groupId?: string
  tableId?: string
  tableColumnHeader?: string
  exportPath?: string
}

export interface ITemplateFieldRuntimeIndex {
  all: ITemplateFieldRuntimeNode[]
  byId: Map<string, ITemplateFieldRuntimeNode>
  byBlockId: Map<string, ITemplateFieldRuntimeNode[]>
  bySectionId: Map<string, ITemplateFieldRuntimeNode[]>
  byGroup: Map<string, ITemplateFieldRuntimeNode[]>
  byTableId: Map<string, ITemplateFieldRuntimeNode[]>
  byBusinessCode: Map<string, ITemplateFieldRuntimeNode[]>
  byPermission: Map<string, ITemplateFieldRuntimeNode[]>
  byDataSource: Map<string, ITemplateFieldRuntimeNode[]>
  byListener: Map<string, ITemplateFieldRuntimeNode[]>
  byTag: Map<string, ITemplateFieldRuntimeNode[]>
  byExportPath: Map<string, ITemplateFieldRuntimeNode[]>
}

export interface ITemplateFieldSelector {
  fieldIds?: string[]
  blockId?: string
  sectionId?: string
  group?: string
  businessCode?: string
  permission?: string
  dataSource?: string
  listener?: string
  tag?: string
}

export interface ITemplateRuntimeValuePatch {
  fieldId?: string
  businessCode?: string
  value: string | IElement[] | null
  isSubmitHistory?: boolean
}

export interface ITemplateRuntimeWriteResult {
  appliedFieldIds: string[]
  skippedKeys: string[]
}

export interface ITemplateRuntimeAdapterApplyOptions {
  /**
   * 指定 adapter id；缺省时按字段的 dataSource 在注册表中查找。
   */
  adapterId?: string
  /**
   * 仅注入这些 dataSource 对应的字段；缺省时使用模板内全部已绑定 dataSource 的字段。
   */
  dataSources?: string[]
  /**
   * 业务上下文，例如 patientId / visitId，会传给 adapter 用于解析。
   */
  context?: ITemplateDataAdapterContext
  /**
   * 当某字段 adapter 返回了空值/未提供值时，是否跳过写入，默认 true。
   */
  skipEmpty?: boolean
  /**
   * 是否把本次注入记录到撤销历史，默认 false（业务回填通常不入历史）。
   */
  isSubmitHistory?: boolean
  /**
   * 允许传入自定义注册表，方便单测和多租户场景下隔离。
   */
  registry?: TemplateDataAdapterRegistry
}

export interface ITemplateRuntimeAdapterApplyResult {
  adapterId: string
  appliedFieldIds: string[]
  skippedKeys: string[]
  unresolvedFieldIds: string[]
  diagnostics: string[]
}

export interface ITemplateRuntimeInspectOptions {
  adapterId?: string
  dataSources?: string[]
  registry?: TemplateDataAdapterRegistry
}

export interface ITemplateRuntimeDataSourceSummary {
  dataSource: string
  fieldCount: number
  requiredCount: number
  adapterId?: string
  adapterLabel?: string
  unresolvedFieldIds: string[]
}

export interface ITemplateRuntimeDataBindingIssue {
  type:
    | 'missingBusinessCode'
    | 'missingDataSource'
    | 'missingAdapter'
    | 'requiredEmpty'
  fieldId: string
  label?: string
  dataSource?: string
  businessCode?: string
  message: string
}

export interface ITemplateRuntimeDataBindingInspection {
  totalFieldCount: number
  businessFieldCount: number
  boundDataSourceCount: number
  adapterCoveredFieldCount: number
  requiredFieldCount: number
  requiredEmptyFieldCount: number
  dataSources: ITemplateRuntimeDataSourceSummary[]
  issues: ITemplateRuntimeDataBindingIssue[]
}

export interface ITemplateStructuredExtractResult extends ITemplateExtractResult {
  flat: Record<string, string | null>
  structured: Record<string, unknown>
  bySection: Record<string, Record<string, string | null>>
  byGroup: Record<string, Record<string, string | null>>
  byTable: Record<string, Array<Record<string, string | null>>>
  byBusinessCode: Record<string, string | null>
  byPermission: Record<string, Record<string, string | null>>
  byDataSource: Record<string, Record<string, string | null>>
  byListener: Record<string, Record<string, string | null>>
  byTag: Record<string, Record<string, string | null>>
  structuredByPermission: Record<string, Record<string, unknown>>
  structuredByDataSource: Record<string, Record<string, unknown>>
  structuredByListener: Record<string, Record<string, unknown>>
  structuredByTag: Record<string, Record<string, unknown>>
  structuredByPermissionAndTag: Record<string, Record<string, Record<string, unknown>>>
  document: Record<'header' | 'main' | 'footer', ITemplateStructuredBlockNode[]>
}

export interface ITemplateStructuredBlockNode {
  key: string
  type: ITemplateBlock['type']
  zone: 'header' | 'main' | 'footer'
  title?: string
  fields?: Record<string, string | null>
  rows?: Array<Record<string, string | null>>
  children?: ITemplateStructuredBlockNode[]
  text?: string
}

export interface ITemplateFieldChangeEvent {
  fieldId: string
  metadata?: ITemplateFieldMetadata
  oldValue: string | null
  value: string | null
  node: ITemplateFieldRuntimeNode
}

function appendMapValue<T>(map: Map<string, T[]>, key: string | undefined, value: T) {
  if (!key) return
  const list = map.get(key)
  if (list) {
    list.push(value)
  } else {
    map.set(key, [value])
  }
}

function appendMapValues<T>(map: Map<string, T[]>, keys: string[] | undefined, value: T) {
  keys?.forEach(key => appendMapValue(map, key, value))
}

function setDeepValue(target: Record<string, unknown>, path: string, value: unknown) {
  const segments = path.split('.').map(part => part.trim()).filter(Boolean)
  if (!segments.length) return
  let current: Record<string, unknown> = target
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      current[segment] = value
      return
    }
    const existing = current[segment]
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      current[segment] = {}
    }
    current = current[segment] as Record<string, unknown>
  })
}

function appendStructuredBucket(
  target: Record<string, Record<string, unknown>>,
  key: string | undefined,
  path: string,
  value: unknown
) {
  if (!key) return
  target[key] = target[key] ?? {}
  setDeepValue(target[key], path, value)
}

function appendStructuredBuckets(
  target: Record<string, Record<string, unknown>>,
  keys: string[] | undefined,
  path: string,
  value: unknown
) {
  keys?.forEach(key => appendStructuredBucket(target, key, path, value))
}

function addFieldNode(
  index: ITemplateFieldRuntimeIndex,
  field: ITemplateField,
  zone: 'header' | 'main' | 'footer',
  containerBlockIds: string[],
  sectionId?: string,
  groupId?: string,
  tableId?: string,
  tableColumnHeader?: string
) {
  const node: ITemplateFieldRuntimeNode = {
    field,
    metadata: field.metadata,
    zone,
    containerBlockIds,
    sectionId,
    groupId,
    tableId,
    tableColumnHeader,
    exportPath: field.metadata?.exportPath
  }
  index.all.push(node)
  index.byId.set(field.id, node)
  containerBlockIds.forEach(id => appendMapValue(index.byBlockId, id, node))
  appendMapValue(index.bySectionId, sectionId, node)
  appendMapValue(index.byGroup, field.metadata?.group, node)
  appendMapValue(index.byTableId, tableId, node)
  appendMapValue(index.byBusinessCode, field.metadata?.businessCode, node)
  appendMapValue(index.byPermission, field.metadata?.permission, node)
  appendMapValue(index.byDataSource, field.metadata?.dataSource, node)
  appendMapValues(index.byListener, field.metadata?.listeners, node)
  appendMapValues(index.byTag, field.metadata?.tags, node)
  appendMapValue(index.byExportPath, field.metadata?.exportPath, node)
}

function walkTemplateBlocks(
  blocks: ITemplateBlock[],
  zone: 'header' | 'main' | 'footer',
  index: ITemplateFieldRuntimeIndex,
  context: {
    containerBlockIds: string[]
    sectionId?: string
    groupId?: string
    path: string
  }
) {
  blocks.forEach((block, blockIndex) => {
    if (block.type === 'fieldRow') {
      block.fields.forEach(field => {
        addFieldNode(index, field, zone, context.containerBlockIds, context.sectionId, context.groupId)
      })
      return
    }

    if (block.type === 'paragraph') {
      block.segments.forEach(segment => {
        if (segment.type === 'field') {
          addFieldNode(index, segment.field, zone, context.containerBlockIds, context.sectionId, context.groupId)
        }
      })
      return
    }

    if (block.type === 'table') {
      const tableId = block.id ?? `${context.path}.table.${blockIndex}`
      block.columns.forEach(column => {
        if (column.field) {
          addFieldNode(
            index,
            column.field,
            zone,
            context.containerBlockIds,
            context.sectionId,
            context.groupId,
            tableId,
            column.header
          )
        }
      })
      return
    }

    if (block.type === 'section') {
      const sectionPath = block.id ?? `${context.path}.section.${blockIndex}`
      const containerBlockIds = block.id
        ? [...context.containerBlockIds, block.id]
        : context.containerBlockIds
      walkTemplateBlocks(block.blocks, zone, index, {
        containerBlockIds,
        sectionId: block.id ?? context.sectionId,
        groupId: context.groupId,
        path: sectionPath
      })
      return
    }

    if (block.type === 'group') {
      const groupPath = block.id ?? `${context.path}.group.${blockIndex}`
      const containerBlockIds = block.id
        ? [...context.containerBlockIds, block.id]
        : context.containerBlockIds
      walkTemplateBlocks(block.blocks, zone, index, {
        containerBlockIds,
        sectionId: context.sectionId,
        groupId: block.id ?? context.groupId,
        path: groupPath
      })
    }
  })
}

export function buildTemplateFieldRuntimeIndex(
  schema: ITemplateSchema
): ITemplateFieldRuntimeIndex {
  const index: ITemplateFieldRuntimeIndex = {
    all: [],
    byId: new Map(),
    byBlockId: new Map(),
    bySectionId: new Map(),
    byGroup: new Map(),
    byTableId: new Map(),
    byBusinessCode: new Map(),
    byPermission: new Map(),
    byDataSource: new Map(),
    byListener: new Map(),
    byTag: new Map(),
    byExportPath: new Map()
  }

  walkTemplateBlocks(schema.header ?? [], 'header', index, { containerBlockIds: [], path: 'header' })
  walkTemplateBlocks(schema.blocks, 'main', index, { containerBlockIds: [], path: 'main' })
  walkTemplateBlocks(schema.footer ?? [], 'footer', index, { containerBlockIds: [], path: 'footer' })

  return index
}

function readControlValue(editor: Editor, fieldId: string): string | null {
  return editor.command.getControlValue({ conceptId: fieldId })?.[0]?.value ?? null
}

function readControlValues(editor: Editor, fieldId: string): Array<string | null> {
  return (editor.command.getControlValue({ conceptId: fieldId }) ?? []).map(item => item.value ?? null)
}

function getFieldExportKey(field: ITemplateField): string {
  return field.metadata?.businessCode || field.id
}

function isRequiredField(field: ITemplateField): boolean {
  return Boolean(field.required || field.rules?.some(rule => rule.type === 'required'))
}

function isEmptyRuntimeValue(value: string | null): boolean {
  return value == null || value.trim().length === 0
}

function buildTableRows(editor: Editor, block: Extract<ITemplateBlock, { type: 'table' }>): Array<Record<string, string | null>> {
  const columnValues = block.columns.map(column =>
    column.field ? readControlValues(editor, column.field.id) : []
  )
  const rowCount = Math.max(block.rows ?? 0, ...columnValues.map(values => values.length), 0)

  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const row: Record<string, string | null> = {}
    block.columns.forEach((column, columnIndex) => {
      const key = column.field ? getFieldExportKey(column.field) : column.header || `column_${columnIndex + 1}`
      row[key] = column.field ? (columnValues[columnIndex]?.[rowIndex] ?? null) : null
    })
    return row
  })
}

function buildStructuredDocument(
  editor: Editor,
  blocks: ITemplateBlock[],
  zone: 'header' | 'main' | 'footer',
  basePath: string,
  byTable: Record<string, Array<Record<string, string | null>>>
): ITemplateStructuredBlockNode[] {
  return blocks.map((block, blockIndex) => {
    const key = 'id' in block && block.id
      ? block.id
      : `${basePath}.${block.type}.${blockIndex}`

    if (block.type === 'section') {
      return {
        key,
        type: block.type,
        zone,
        title: block.title,
        children: buildStructuredDocument(editor, block.blocks, zone, key, byTable)
      }
    }

    if (block.type === 'group') {
      return {
        key,
        type: block.type,
        zone,
        children: buildStructuredDocument(editor, block.blocks, zone, key, byTable)
      }
    }

    if (block.type === 'table') {
      const rows = buildTableRows(editor, block)
      byTable[key] = rows
      return {
        key,
        type: block.type,
        zone,
        rows
      }
    }

    if (block.type === 'fieldRow') {
      return {
        key,
        type: block.type,
        zone,
        fields: Object.fromEntries(
          block.fields.map(field => [getFieldExportKey(field), readControlValue(editor, field.id)])
        )
      }
    }

    if (block.type === 'paragraph') {
      const fields = block.segments
        .filter(segment => segment.type === 'field')
        .map(segment => [getFieldExportKey(segment.field), readControlValue(editor, segment.field.id)] as const)
      return {
        key,
        type: block.type,
        zone,
        ...(fields.length ? { fields: Object.fromEntries(fields) } : {}),
        text: block.segments
          .filter(segment => segment.type === 'text')
          .map(segment => segment.value)
          .join('') || undefined
      }
    }

    if (block.type === 'staticText') {
      return {
        key,
        type: block.type,
        zone,
        text: block.text
      }
    }

    return {
      key,
      type: block.type,
      zone
    }
  })
}

export class TemplateRuntime {
  private editor: Editor
  private schema: ITemplateSchema
  private index: ITemplateFieldRuntimeIndex
  private valueSnapshot = new Map<string, string | null>()

  constructor(editor: Editor, schema: ITemplateSchema) {
    this.editor = editor
    this.schema = schema
    this.index = buildTemplateFieldRuntimeIndex(schema)
    this._refreshSnapshot()
  }

  getIndex(): ITemplateFieldRuntimeIndex {
    return this.index
  }

  selectFields(selector: ITemplateFieldSelector = {}): ITemplateFieldRuntimeNode[] {
    return this.index.all.filter(node => {
      if (selector.fieldIds?.length && !selector.fieldIds.includes(node.field.id)) return false
      if (selector.blockId && !node.containerBlockIds.includes(selector.blockId)) return false
      if (selector.sectionId && node.sectionId !== selector.sectionId) return false
      if (selector.group && node.metadata?.group !== selector.group) return false
      if (selector.businessCode && node.metadata?.businessCode !== selector.businessCode) return false
      if (selector.permission && node.metadata?.permission !== selector.permission) return false
      if (selector.dataSource && node.metadata?.dataSource !== selector.dataSource) return false
      if (selector.listener && !node.metadata?.listeners?.includes(selector.listener)) return false
      if (selector.tag && !node.metadata?.tags?.includes(selector.tag)) return false
      return true
    })
  }

  getValue(fieldId: string): string | null {
    return readControlValue(this.editor, fieldId)
  }

  getValues(selector: ITemplateFieldSelector = {}): Record<string, string | null> {
    return Object.fromEntries(
      this.selectFields(selector).map(node => [node.field.id, readControlValue(this.editor, node.field.id)])
    )
  }

  getValuesByBusinessCode(): Record<string, string | null> {
    const result: Record<string, string | null> = {}
    this.index.byBusinessCode.forEach((nodes, businessCode) => {
      const node = nodes[0]
      if (node.tableId) return
      result[businessCode] = readControlValue(this.editor, node.field.id)
    })
    return result
  }

  getValuesBySelector(selector: ITemplateFieldSelector = {}): Record<string, string | null> {
    return Object.fromEntries(
      this.selectFields(selector).map(node => [node.field.id, readControlValue(this.editor, node.field.id)])
    )
  }

  /**
   * 收集模板内所有具备业务数据来源的字段（按 dataSource 分组）。
   * 业务集成层可以基于这份摘要决定要加载哪些数据源。
   */
  getDataSourceFieldMap(): Record<string, ITemplateFieldRuntimeNode[]> {
    const result: Record<string, ITemplateFieldRuntimeNode[]> = {}
    this.index.byDataSource.forEach((nodes, dataSource) => {
      result[dataSource] = nodes.slice()
    })
    return result
  }

  inspectDataBinding(
    options: ITemplateRuntimeInspectOptions = {}
  ): ITemplateRuntimeDataBindingInspection {
    const registry = options.registry ?? templateDataAdapterRegistry
    const explicitAdapter = options.adapterId ? registry.get(options.adapterId) : undefined
    const dataSourceAllowList = options.dataSources?.length
      ? new Set(options.dataSources)
      : null
    const issues: ITemplateRuntimeDataBindingIssue[] = []
    const coveredFieldIds = new Set<string>()
    let businessFieldCount = 0
    let requiredFieldCount = 0
    let requiredEmptyFieldCount = 0

    const dataSources = Array.from(this.index.byDataSource.entries())
      .filter(([dataSource]) => !dataSourceAllowList || dataSourceAllowList.has(dataSource))
      .map(([dataSource, nodes]) => {
        const adapter = explicitAdapter ?? registry.getByDataSource(dataSource)
        const unresolvedFieldIds: string[] = []
        nodes.forEach(node => {
          if (adapter) {
            coveredFieldIds.add(node.field.id)
          } else {
            unresolvedFieldIds.push(node.field.id)
          }
        })
        return {
          dataSource,
          fieldCount: nodes.length,
          requiredCount: nodes.filter(node => isRequiredField(node.field)).length,
          adapterId: adapter?.id,
          adapterLabel: adapter?.label,
          unresolvedFieldIds
        }
      })

    this.index.all.forEach(node => {
      const { field, metadata } = node
      const isRequired = isRequiredField(field)
      if (metadata?.businessCode || metadata?.exportPath) {
        businessFieldCount += 1
      }
      if (isRequired) {
        requiredFieldCount += 1
        const value = readControlValue(this.editor, field.id)
        if (isEmptyRuntimeValue(value)) {
          requiredEmptyFieldCount += 1
          issues.push({
            type: 'requiredEmpty',
            fieldId: field.id,
            label: field.label,
            dataSource: metadata?.dataSource,
            businessCode: metadata?.businessCode,
            message: `必填字段 ${field.label || field.id} 当前为空`
          })
        }
      }
      if (!metadata?.businessCode && !metadata?.exportPath) {
        issues.push({
          type: 'missingBusinessCode',
          fieldId: field.id,
          label: field.label,
          dataSource: metadata?.dataSource,
          message: `字段 ${field.label || field.id} 未配置业务编码或导出路径`
        })
      }
      if (!metadata?.dataSource) {
        issues.push({
          type: 'missingDataSource',
          fieldId: field.id,
          label: field.label,
          businessCode: metadata?.businessCode,
          message: `字段 ${field.label || field.id} 未绑定数据源`
        })
        return
      }
      const adapter = explicitAdapter ?? registry.getByDataSource(metadata.dataSource)
      if (!adapter) {
        issues.push({
          type: 'missingAdapter',
          fieldId: field.id,
          label: field.label,
          dataSource: metadata.dataSource,
          businessCode: metadata.businessCode,
          message: `字段 ${field.label || field.id} 的数据源 ${metadata.dataSource} 没有适配器`
        })
      }
    })

    return {
      totalFieldCount: this.index.all.length,
      businessFieldCount,
      boundDataSourceCount: dataSources.length,
      adapterCoveredFieldCount: coveredFieldIds.size,
      requiredFieldCount,
      requiredEmptyFieldCount,
      dataSources,
      issues
    }
  }

  /**
   * 通过注册的业务数据 adapter 拉取业务数据，并写入对应字段。
   * 这是 P0 阶段“模板字段绑定 -> 测试数据注入 -> 结构化导出 -> 回填预览”的核心入口。
   */
  async applyAdapterValues(
    options: ITemplateRuntimeAdapterApplyOptions = {}
  ): Promise<ITemplateRuntimeAdapterApplyResult> {
    const registry = options.registry ?? templateDataAdapterRegistry
    const requestedDataSources = options.dataSources?.length
      ? options.dataSources
      : Array.from(this.index.byDataSource.keys())

    const allowed = new Set(requestedDataSources)
    const candidateNodes = this.index.all.filter(node => {
      const dataSource = node.metadata?.dataSource
      return Boolean(dataSource) && allowed.has(dataSource as string)
    })

    if (!candidateNodes.length) {
      return {
        adapterId: options.adapterId ?? '',
        appliedFieldIds: [],
        skippedKeys: [],
        unresolvedFieldIds: [],
        diagnostics: ['当前模板没有匹配的业务字段']
      }
    }

    const buckets = new Map<ITemplateDataAdapter, ITemplateDataAdapterRequestField[]>()
    const unresolvedFieldIds: string[] = []
    const diagnostics: string[] = []

    const explicitAdapter = options.adapterId ? registry.get(options.adapterId) : undefined
    if (options.adapterId && !explicitAdapter) {
      diagnostics.push(`未找到适配器 ${options.adapterId}`)
    }

    candidateNodes.forEach(node => {
      const dataSource = node.metadata?.dataSource
      if (!dataSource) return
      const adapter = explicitAdapter ?? registry.getByDataSource(dataSource)
      if (!adapter) {
        unresolvedFieldIds.push(node.field.id)
        diagnostics.push(`字段 ${node.field.id} 的数据源 ${dataSource} 没有适配器接入`)
        return
      }
      const list = buckets.get(adapter) ?? []
      list.push({
        fieldId: node.field.id,
        metadata: node.metadata,
        field: node.field,
        exportPath: node.exportPath
      })
      buckets.set(adapter, list)
    })

    const appliedFieldIds = new Set<string>()
    const skippedKeys: string[] = []
    const skipEmpty = options.skipEmpty ?? true
    const payload: ISetControlValueOption[] = []
    const resolutions: ITemplateDataAdapterResolution[] = []

    for (const [adapter, fields] of buckets) {
      const resolution = await adapter.resolve({
        fields,
        context: options.context ?? {}
      })
      resolutions.push(resolution)
      resolution.diagnostics?.forEach(message => diagnostics.push(`[${adapter.id}] ${message}`))

      const resolvedIds = new Set<string>()
      resolution.values.forEach(item => {
        resolvedIds.add(item.fieldId)
        const node = this.index.byId.get(item.fieldId)
        if (!node) {
          skippedKeys.push(item.fieldId)
          return
        }
        const value = item.value
        if (
          skipEmpty &&
          (value == null || (typeof value === 'string' && value.length === 0))
        ) {
          skippedKeys.push(item.fieldId)
          return
        }
        const flatValue = Array.isArray(value) ? value.join('、') : value
        payload.push({
          conceptId: node.field.id,
          value: flatValue,
          isSubmitHistory: options.isSubmitHistory ?? false
        })
        appliedFieldIds.add(node.field.id)
      })

      fields.forEach(field => {
        if (!resolvedIds.has(field.fieldId)) {
          unresolvedFieldIds.push(field.fieldId)
        }
      })
    }

    if (payload.length) {
      this.editor.command.executeSetControlValueList(payload)
      this._refreshSnapshot(Array.from(appliedFieldIds))
    }

    return {
      adapterId: options.adapterId ?? Array.from(buckets.keys()).map(adapter => adapter.id).join(','),
      appliedFieldIds: Array.from(appliedFieldIds),
      skippedKeys,
      unresolvedFieldIds,
      diagnostics
    }
  }

  setValuesBySelector(
    selector: ITemplateFieldSelector,
    value: string | IElement[] | null,
    isSubmitHistory?: boolean
  ): ITemplateRuntimeWriteResult {
    const nodes = this.selectFields(selector)
    if (!nodes.length) {
      return {
        appliedFieldIds: [],
        skippedKeys: [JSON.stringify(selector)]
      }
    }

    const payload = nodes.map(node => ({
      conceptId: node.field.id,
      value,
      isSubmitHistory
    }))

    this.editor.command.executeSetControlValueList(payload)
    const appliedFieldIds = nodes.map(node => node.field.id)
    this._refreshSnapshot(appliedFieldIds)

    return {
      appliedFieldIds,
      skippedKeys: []
    }
  }

  setValues(patches: ITemplateRuntimeValuePatch[]): ITemplateRuntimeWriteResult {
    const payload: ISetControlValueOption[] = []
    const appliedFieldIds = new Set<string>()
    const skippedKeys: string[] = []

    patches.forEach(patch => {
      const nodes = patch.fieldId
        ? [this.index.byId.get(patch.fieldId)].filter(Boolean) as ITemplateFieldRuntimeNode[]
        : patch.businessCode
          ? this.index.byBusinessCode.get(patch.businessCode) ?? []
          : []

      if (!nodes.length) {
        skippedKeys.push(patch.fieldId ?? patch.businessCode ?? 'unknown')
        return
      }

      nodes.forEach(node => {
        payload.push({
          conceptId: node.field.id,
          value: patch.value,
          isSubmitHistory: patch.isSubmitHistory
        })
        appliedFieldIds.add(node.field.id)
      })
    })

    if (payload.length) {
      this.editor.command.executeSetControlValueList(payload)
      this._refreshSnapshot(Array.from(appliedFieldIds))
    }

    return {
      appliedFieldIds: Array.from(appliedFieldIds),
      skippedKeys
    }
  }

  extract(): ITemplateStructuredExtractResult {
    const extracted = extractTemplateValues(this.editor, this.schema)
    const flat = extracted.toRecord()
    const structured: Record<string, unknown> = {}
    const bySection: Record<string, Record<string, string | null>> = {}
    const byGroup: Record<string, Record<string, string | null>> = {}
    const byTable: Record<string, Array<Record<string, string | null>>> = {}
    const byBusinessCode: Record<string, string | null> = {}
    const byPermission: Record<string, Record<string, string | null>> = {}
    const byDataSource: Record<string, Record<string, string | null>> = {}
    const byListener: Record<string, Record<string, string | null>> = {}
    const byTag: Record<string, Record<string, string | null>> = {}
    const structuredByPermission: Record<string, Record<string, unknown>> = {}
    const structuredByDataSource: Record<string, Record<string, unknown>> = {}
    const structuredByListener: Record<string, Record<string, unknown>> = {}
    const structuredByTag: Record<string, Record<string, unknown>> = {}
    const structuredByPermissionAndTag: Record<string, Record<string, Record<string, unknown>>> = {}
    const document = {
      header: buildStructuredDocument(this.editor, this.schema.header ?? [], 'header', 'header', byTable),
      main: buildStructuredDocument(this.editor, this.schema.blocks, 'main', 'main', byTable),
      footer: buildStructuredDocument(this.editor, this.schema.footer ?? [], 'footer', 'footer', byTable)
    }

    this.index.all.forEach(node => {
      const value = flat[node.field.id] ?? null
      if (node.sectionId) {
        bySection[node.sectionId] = bySection[node.sectionId] ?? {}
        bySection[node.sectionId][node.field.id] = value
      }
      if (node.metadata?.group) {
        byGroup[node.metadata.group] = byGroup[node.metadata.group] ?? {}
        byGroup[node.metadata.group][node.field.id] = value
      }
      if (node.metadata?.businessCode) {
        byBusinessCode[node.metadata.businessCode] = value
      }
      if (node.metadata?.permission) {
        byPermission[node.metadata.permission] = byPermission[node.metadata.permission] ?? {}
        byPermission[node.metadata.permission][node.field.id] = value
      }
      if (node.metadata?.dataSource) {
        byDataSource[node.metadata.dataSource] = byDataSource[node.metadata.dataSource] ?? {}
        byDataSource[node.metadata.dataSource][node.field.id] = value
      }
      node.metadata?.listeners?.forEach(listener => {
        byListener[listener] = byListener[listener] ?? {}
        byListener[listener][node.field.id] = value
      })

      const exportPath = node.exportPath || node.metadata?.businessCode || node.field.id
      node.metadata?.tags?.forEach(tag => {
        byTag[tag] = byTag[tag] ?? {}
        byTag[tag][node.field.id] = value
      })
      appendStructuredBucket(structuredByPermission, node.metadata?.permission, exportPath, value)
      appendStructuredBucket(structuredByDataSource, node.metadata?.dataSource, exportPath, value)
      appendStructuredBuckets(structuredByListener, node.metadata?.listeners, exportPath, value)
      appendStructuredBuckets(structuredByTag, node.metadata?.tags, exportPath, value)
      if (node.metadata?.permission && node.metadata?.tags?.length) {
        structuredByPermissionAndTag[node.metadata.permission] =
          structuredByPermissionAndTag[node.metadata.permission] ?? {}
        node.metadata.tags.forEach(tag => {
          structuredByPermissionAndTag[node.metadata!.permission!][tag] =
            structuredByPermissionAndTag[node.metadata!.permission!][tag] ?? {}
          setDeepValue(
            structuredByPermissionAndTag[node.metadata!.permission!][tag],
            exportPath,
            value
          )
        })
      }
      setDeepValue(structured, exportPath, value)
    })

    return {
      ...extracted,
      flat,
      structured,
      bySection,
      byGroup,
      byTable,
      byBusinessCode,
      byPermission,
      byDataSource,
      byListener,
      byTag,
      structuredByPermission,
      structuredByDataSource,
      structuredByListener,
      structuredByTag,
      structuredByPermissionAndTag,
      document
    }
  }

  observeField(
    fieldId: string,
    callback: (event: ITemplateFieldChangeEvent) => void
  ): () => void {
    const handler = (payload: IControlContentChangeResult) => {
      if (payload.control.conceptId !== fieldId) return
      this._emitFieldChange(fieldId, callback)
    }
    this.editor.eventBus.on('controlContentChange', handler)
    return () => this.editor.eventBus.off('controlContentChange', handler)
  }

  observeGroup(
    group: string,
    callback: (event: ITemplateFieldChangeEvent) => void
  ): () => void {
    const handler = (payload: IControlContentChangeResult) => {
      const fieldId = payload.control.conceptId
      if (!fieldId) return
      const node = this.index.byId.get(fieldId)
      if (!node || node.metadata?.group !== group) return
      this._emitFieldChange(fieldId, callback)
    }
    this.editor.eventBus.on('controlContentChange', handler)
    return () => this.editor.eventBus.off('controlContentChange', handler)
  }

  private _emitFieldChange(
    fieldId: string,
    callback: (event: ITemplateFieldChangeEvent) => void
  ) {
    const node = this.index.byId.get(fieldId)
    if (!node) return
    const oldValue = this.valueSnapshot.get(fieldId) ?? null
    const value = readControlValue(this.editor, fieldId)
    if (oldValue === value) return
    this.valueSnapshot.set(fieldId, value)
    callback({
      fieldId,
      metadata: node.metadata,
      oldValue,
      value,
      node
    })
  }

  private _refreshSnapshot(fieldIds?: string[]) {
    const ids = fieldIds ?? this.index.all.map(node => node.field.id)
    ids.forEach(fieldId => {
      this.valueSnapshot.set(fieldId, readControlValue(this.editor, fieldId))
    })
  }
}

export function createTemplateRuntime(editor: Editor, schema: ITemplateSchema) {
  return new TemplateRuntime(editor, schema)
}