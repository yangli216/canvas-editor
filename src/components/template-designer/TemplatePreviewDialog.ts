import { EDITOR_COMPONENT, EditorComponent } from '../../editor'
import Editor from '../../editor'
import { PaperDirection } from '../../editor/dataset/enum/Editor'
import type { ITemplateSchema } from '../../editor/template/index'
import {
  compileTemplate,
  getPageConfig,
  getTemplatePageNumberOptions,
  validateSchema
} from '../../editor/template/index'
import {
  buildTemplateFieldRuntimeIndex,
  createTemplateRuntime,
  type ITemplateStructuredExtractResult
} from '../../editor/template/TemplateRuntime'
import { TemplateRuleEngine } from '../../editor/template/TemplateRuleEngine'
import { TemplateFeedback } from './TemplateFeedback'

type TemplatePreviewExportView =
  | 'structured'
  | 'flat'
  | 'byBusinessCode'
  | 'structuredByDataSource'
  | 'document'

interface ITemplateFieldPathCheckItem {
  fieldId: string
  label: string
  effectivePath: string
  source: 'exportPath' | 'businessCode' | 'fieldId'
  duplicateCount: number
  dataSource?: string
}

function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }
  return new Promise<void>((resolve, reject) => {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.append(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    if (copied) {
      resolve()
      return
    }
    reject(new Error('copy failed'))
  })
}

function downloadJson(payload: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function getEffectiveExportPath(item: ITemplateFieldPathCheckItem) {
  return item.effectivePath || item.fieldId
}

function buildFieldPathChecks(schema: ITemplateSchema) {
  const index = buildTemplateFieldRuntimeIndex(schema)
  const pathCountMap = new Map<string, number>()
  const items: ITemplateFieldPathCheckItem[] = index.all.map(node => {
    const effectivePath = node.exportPath || node.metadata?.businessCode || node.field.id
    const source: ITemplateFieldPathCheckItem['source'] = node.exportPath
      ? 'exportPath'
      : node.metadata?.businessCode
        ? 'businessCode'
        : 'fieldId'
    pathCountMap.set(effectivePath, (pathCountMap.get(effectivePath) ?? 0) + 1)
    return {
      fieldId: node.field.id,
      label: node.field.label || node.field.id,
      effectivePath,
      source,
      dataSource: node.metadata?.dataSource,
      duplicateCount: 0
    }
  }).map(item => ({
    ...item,
    duplicateCount: pathCountMap.get(item.effectivePath) ?? 1
  }))

  items.sort((left, right) => {
    const leftScore = Number(left.duplicateCount > 1) * 10 + Number(left.source !== 'exportPath')
    const rightScore = Number(right.duplicateCount > 1) * 10 + Number(right.source !== 'exportPath')
    if (leftScore !== rightScore) return rightScore - leftScore
    return getEffectiveExportPath(left).localeCompare(getEffectiveExportPath(right), 'zh-CN')
  })

  return {
    total: items.length,
    explicitCount: items.filter(item => item.source === 'exportPath').length,
    fallbackCount: items.filter(item => item.source !== 'exportPath').length,
    duplicateCount: items.filter(item => item.duplicateCount > 1).length,
    items
  }
}

export class TemplatePreviewDialog {
  private overlay: HTMLDivElement
  private readonly schema: ITemplateSchema
  private editorInstance: InstanceType<typeof Editor> | null = null
  private ruleEngine: TemplateRuleEngine | null = null
  private runtime: ReturnType<typeof createTemplateRuntime> | null = null
  private latestExtract: ITemplateStructuredExtractResult | null = null
  private exportView: TemplatePreviewExportView = 'structured'
  private exportMetaEl!: HTMLDivElement
  private exportJsonEl!: HTMLPreElement
  private pathSummaryEl!: HTMLDivElement
  private pathListEl!: HTMLDivElement

  constructor(schema: ITemplateSchema) {
    this.schema = schema
    this.overlay = this._render(schema)
  }

  private _render(schema: ITemplateSchema): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.className = 'td-preview-overlay'
    overlay.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)

    const dialog = document.createElement('div')
    dialog.className = 'td-preview-dialog'

    // Header
    const header = document.createElement('div')
    header.className = 'td-preview-header'

    const title = document.createElement('span')
    title.className = 'td-preview-title'
    title.textContent = `模拟预览: ${schema.name}`

    const closeBtn = document.createElement('button')
    closeBtn.className = 'td-designer__btn'
    closeBtn.textContent = '关闭'
    closeBtn.type = 'button'
    closeBtn.addEventListener('click', () => this._dispose())

    header.append(title, closeBtn)
    dialog.append(header)

    // Validation warnings
    const errors = validateSchema(schema)
    if (errors.length > 0) {
      const warn = document.createElement('div')
      warn.className = 'td-preview-warn'
      warn.textContent = `⚠ 模板有 ${errors.length} 个问题: ${errors.map(e => e.message).join('; ')}`
      dialog.append(warn)
    }

    const body = document.createElement('div')
    body.className = 'td-preview-body'

    // Editor container
    const editorWrap = document.createElement('div')
    editorWrap.className = 'td-preview-editor'
    body.append(editorWrap, this._renderExportPanel())
    dialog.append(body)

    overlay.append(dialog)
    document.body.append(overlay)

    // Init editor after DOM is attached
    requestAnimationFrame(() => {
      const pageConfig = getPageConfig(schema)
      const data = compileTemplate(schema)
      this.editorInstance = new Editor(
        editorWrap,
        data,
        {
          width: pageConfig.width,
          height: pageConfig.height,
          margins: pageConfig.margins,
          pageNumber: getTemplatePageNumberOptions(schema),
          paperDirection: pageConfig.orientation === 'landscape'
            ? PaperDirection.HORIZONTAL
            : PaperDirection.VERTICAL
        }
      )
      this.ruleEngine = new TemplateRuleEngine(this.editorInstance, schema)
      this.runtime = createTemplateRuntime(this.editorInstance, schema)
      this._refreshExportPanel()
    })

    return overlay
  }

  private _renderExportPanel(): HTMLDivElement {
    const panel = document.createElement('div')
    panel.className = 'td-preview-side'

    const header = document.createElement('div')
    header.className = 'td-preview-side__header'

    const titleWrap = document.createElement('div')
    titleWrap.className = 'td-preview-side__title-wrap'
    const title = document.createElement('strong')
    title.textContent = '结构化导出结果'
    const hint = document.createElement('span')
    hint.textContent = '用于接口联调、字段路径核对和导出调试。'
    titleWrap.append(title, hint)

    const controls = document.createElement('div')
    controls.className = 'td-preview-side__controls'

    const view = document.createElement('select')
    view.className = 'tm-select'
    ;([
      { value: 'structured', label: '结构化 JSON' },
      { value: 'flat', label: '字段平铺值' },
      { value: 'byBusinessCode', label: '按业务编码' },
      { value: 'structuredByDataSource', label: '按数据源分桶' },
      { value: 'document', label: '按文档树结构' }
    ] as Array<{ value: TemplatePreviewExportView; label: string }>).forEach(item => {
      const option = document.createElement('option')
      option.value = item.value
      option.textContent = item.label
      view.append(option)
    })
    view.addEventListener('change', () => {
      this.exportView = view.value as TemplatePreviewExportView
      this._syncExportPayloadView()
    })

    const refreshBtn = document.createElement('button')
    refreshBtn.className = 'td-designer__btn'
    refreshBtn.type = 'button'
    refreshBtn.textContent = '刷新导出'
    refreshBtn.addEventListener('click', () => this._refreshExportPanel())

    const copyBtn = document.createElement('button')
    copyBtn.className = 'td-designer__btn'
    copyBtn.type = 'button'
    copyBtn.textContent = '复制 JSON'
    copyBtn.addEventListener('click', () => this._copyExportPayload())

    const downloadBtn = document.createElement('button')
    downloadBtn.className = 'td-designer__btn'
    downloadBtn.type = 'button'
    downloadBtn.textContent = '下载 JSON'
    downloadBtn.addEventListener('click', () => this._downloadExportPayload())

    controls.append(view, refreshBtn, copyBtn, downloadBtn)
    header.append(titleWrap, controls)

    this.exportMetaEl = document.createElement('div')
    this.exportMetaEl.className = 'td-preview-export__meta'
    this.exportMetaEl.textContent = '预览初始化后会生成当前导出结果。'

    this.exportJsonEl = document.createElement('pre')
    this.exportJsonEl.className = 'td-preview-export__json'
    this.exportJsonEl.textContent = '等待预览初始化...'

    const pathHeader = document.createElement('div')
    pathHeader.className = 'td-preview-side__subheader'
    pathHeader.textContent = '字段路径检查'

    this.pathSummaryEl = document.createElement('div')
    this.pathSummaryEl.className = 'td-preview-path__summary'

    this.pathListEl = document.createElement('div')
    this.pathListEl.className = 'td-preview-path__list'

    panel.append(
      header,
      this.exportMetaEl,
      this.exportJsonEl,
      pathHeader,
      this.pathSummaryEl,
      this.pathListEl
    )
    return panel
  }

  private _refreshExportPanel() {
    if (!this.runtime) {
      this.exportMetaEl.textContent = '预览尚未初始化完成，请稍后刷新。'
      return
    }
    this.latestExtract = this.runtime.extract()
    this.exportMetaEl.textContent = `当前视图包含 ${Object.keys(this._getCurrentPayload()).length} 个顶层键，字段改动后可再次刷新导出结果。`
    this._syncExportPayloadView()
    this._renderPathCheckPanel()
  }

  private _getCurrentPayload(): Record<string, unknown> | unknown[] {
    if (!this.latestExtract) return {}
    switch (this.exportView) {
      case 'flat':
        return this.latestExtract.flat
      case 'byBusinessCode':
        return this.latestExtract.byBusinessCode
      case 'structuredByDataSource':
        return this.latestExtract.structuredByDataSource
      case 'document':
        return this.latestExtract.document
      case 'structured':
      default:
        return this.latestExtract.structured
    }
  }

  private _syncExportPayloadView() {
    this.exportJsonEl.textContent = JSON.stringify(this._getCurrentPayload(), null, 2)
  }

  private async _copyExportPayload() {
    if (!this.latestExtract) {
      TemplateFeedback.toast('预览尚未初始化完成，暂时无法复制导出结果', 'info')
      return
    }
    try {
      await copyText(JSON.stringify(this._getCurrentPayload(), null, 2))
      TemplateFeedback.toast('结构化导出结果已复制', 'success')
    } catch {
      TemplateFeedback.toast('复制失败，请稍后重试', 'warning')
    }
  }

  private _downloadExportPayload() {
    if (!this.latestExtract) {
      TemplateFeedback.toast('预览尚未初始化完成，暂时无法下载导出结果', 'info')
      return
    }
    downloadJson(
      this._getCurrentPayload(),
      `${this.schema.id || 'template'}-${this.exportView}.json`
    )
    TemplateFeedback.toast('结构化导出结果已下载', 'success')
  }

  private _renderPathCheckPanel() {
    const checks = buildFieldPathChecks(this.schema)
    this.pathSummaryEl.innerHTML = ''
    ;([
      `字段 ${checks.total} 个`,
      `显式路径 ${checks.explicitCount} 个`,
      `兜底路径 ${checks.fallbackCount} 个`,
      `重复路径 ${checks.duplicateCount} 个`
    ]).forEach(text => {
      const badge = document.createElement('span')
      badge.className = 'td-preview-path__badge'
      badge.textContent = text
      this.pathSummaryEl.append(badge)
    })

    this.pathListEl.innerHTML = ''
    checks.items.forEach(item => {
      const row = document.createElement('div')
      row.className = 'td-preview-path__row'
      const info = document.createElement('div')
      info.className = 'td-preview-path__info'
      const name = document.createElement('strong')
      name.textContent = `${item.label} · ${item.fieldId}`
      const meta = document.createElement('small')
      meta.textContent = `${item.effectivePath}${item.dataSource ? ` / 数据源 ${item.dataSource}` : ''}`
      info.append(name, meta)

      const badge = document.createElement('span')
      const tone = item.duplicateCount > 1
        ? 'danger'
        : item.source === 'exportPath'
          ? 'success'
          : 'warning'
      badge.className = `tm-center-badge tm-center-badge--${tone}`
      badge.textContent = item.duplicateCount > 1
        ? `路径重复 ×${item.duplicateCount}`
        : item.source === 'exportPath'
          ? '已显式配置'
          : item.source === 'businessCode'
            ? '业务编码兜底'
            : 'fieldId 兜底'
      row.append(info, badge)
      this.pathListEl.append(row)
    })
  }

  private _dispose() {
    this.ruleEngine?.dispose()
    this.editorInstance?.destroy()
    this.overlay.remove()
  }
}
