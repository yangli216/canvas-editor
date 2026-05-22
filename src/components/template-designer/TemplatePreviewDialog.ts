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
import { TemplateRuleEngine } from '../../editor/template/TemplateRuleEngine'

export class TemplatePreviewDialog {
  private overlay: HTMLDivElement
  private editorInstance: InstanceType<typeof Editor> | null = null
  private ruleEngine: TemplateRuleEngine | null = null

  constructor(schema: ITemplateSchema) {
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

    // Editor container
    const editorWrap = document.createElement('div')
    editorWrap.className = 'td-preview-editor'
    dialog.append(editorWrap)

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
    })

    return overlay
  }

  private _dispose() {
    this.ruleEngine?.dispose()
    this.editorInstance?.destroy()
    this.overlay.remove()
  }
}
