import { EDITOR_COMPONENT, EditorComponent } from '../../editor'
import { templateRegistry } from '../../editor/template/TemplateRegistry'
import type { ITemplateSchema } from '../../editor/template/index'
import type { ITemplateListItem, ITemplateRegistryEntry } from '../../editor/template/TemplateRegistry'
import { TemplateDesigner } from './TemplateDesigner'

export interface ITemplateManagerOptions {
  onApply: (schema: ITemplateSchema) => void
}

export class TemplateManager {
  private mask: HTMLDivElement
  private container: HTMLDivElement
  private options: ITemplateManagerOptions
  private activeCategory = '全部'
  private bodyEl!: HTMLDivElement

  constructor(options: ITemplateManagerOptions) {
    this.options = options
    templateRegistry.loadFromStorage()
    const { mask, container } = this._render()
    this.mask = mask
    this.container = container
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
    dialog.className = 'tm-dialog'
    dialog.append(this._renderHeader(), this._renderTabs(), this._renderFooter())

    // Insert body before footer
    const body = document.createElement('div')
    body.className = 'tm-body'
    this.bodyEl = body
    dialog.insertBefore(body, dialog.lastElementChild)
    this._renderGrid()

    overlay.append(dialog)
    document.body.append(overlay)
    return { mask, container: overlay }
  }

  private _renderHeader(): HTMLDivElement {
    const header = document.createElement('div')
    header.className = 'tm-header'

    const title = document.createElement('span')
    title.className = 'tm-header__title'
    title.textContent = '模板管理'

    const actions = document.createElement('div')
    actions.className = 'tm-header__actions'

    const newBtn = document.createElement('button')
    newBtn.className = 'td-designer__btn td-designer__btn--primary'
    newBtn.textContent = '+ 新建模板'
    newBtn.type = 'button'
    newBtn.addEventListener('click', () => this._openDesigner())

    const closeBtn = document.createElement('div')
    closeBtn.className = 'tm-header__close'
    closeBtn.textContent = '×'
    closeBtn.addEventListener('click', () => this._dispose())

    actions.append(newBtn, closeBtn)
    header.append(title, actions)
    return header
  }

  private _renderTabs(): HTMLDivElement {
    const tabsEl = document.createElement('div')
    tabsEl.className = 'tm-tabs'

    const categories = ['全部', ...templateRegistry.getCategories()]
    categories.forEach(cat => {
      const tab = document.createElement('div')
      tab.className = `tm-tab${this.activeCategory === cat ? ' tm-tab--active' : ''}`
      tab.textContent = cat
      tab.addEventListener('click', () => {
        this.activeCategory = cat
        tabsEl.querySelectorAll('.tm-tab').forEach(t => t.classList.remove('tm-tab--active'))
        tab.classList.add('tm-tab--active')
        this._renderGrid()
      })
      tabsEl.append(tab)
    })
    return tabsEl
  }

  private _renderGrid() {
    this.bodyEl.innerHTML = ''

    const items =
      this.activeCategory === '全部'
        ? templateRegistry.getAll()
        : templateRegistry.getByCategory(this.activeCategory)

    if (items.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'tm-empty'
      empty.textContent = '暂无模板，点击"新建模板"创建'
      this.bodyEl.append(empty)
      return
    }

    const grid = document.createElement('div')
    grid.className = 'tm-grid'
    items.forEach(item => grid.append(this._renderCard(item)))
    this.bodyEl.append(grid)
  }

  private _renderCard(item: ITemplateListItem): HTMLDivElement {
    const card = document.createElement('div')
    card.className = 'tm-card'

    const name = document.createElement('div')
    name.className = 'tm-card__name'
    name.textContent = item.name
    name.title = item.name

    const desc = document.createElement('div')
    desc.className = 'tm-card__desc'
    desc.textContent = item.description || '暂无描述'

    const footer = document.createElement('div')
    footer.className = 'tm-card__footer'

    const tag = document.createElement('span')
    tag.className = `tm-card__tag${item.builtIn ? ' tm-card__tag--builtin' : ''}`
    tag.textContent = item.builtIn ? `${item.category} · 内置` : item.category

    const actionsEl = document.createElement('div')
    actionsEl.className = 'tm-card__actions'

    const applyBtn = document.createElement('button')
    applyBtn.className = 'tm-card__btn tm-card__btn--primary'
    applyBtn.textContent = '使用'
    applyBtn.type = 'button'
    applyBtn.addEventListener('click', e => {
      e.stopPropagation()
      const schema = templateRegistry.get(item.id)
      if (schema) {
        this.options.onApply(schema)
        this._dispose()
      }
    })

    const editBtn = document.createElement('button')
    editBtn.className = 'tm-card__btn'
    editBtn.textContent = '编辑'
    editBtn.type = 'button'
    editBtn.addEventListener('click', e => {
      e.stopPropagation()
      const entry = templateRegistry.getEntry(item.id)
      if (entry) this._openDesigner(entry)
    })

    actionsEl.append(applyBtn, editBtn)

    if (!item.builtIn) {
      const delBtn = document.createElement('button')
      delBtn.className = 'tm-card__btn'
      delBtn.textContent = '删除'
      delBtn.type = 'button'
      delBtn.style.color = '#cc0000'
      delBtn.addEventListener('click', e => {
        e.stopPropagation()
        if (confirm(`确认删除模板"${item.name}"？`)) {
          templateRegistry.delete(item.id)
          this._renderGrid()
        }
      })
      actionsEl.append(delBtn)
    }

    footer.append(tag, actionsEl)
    card.append(name, desc, footer)
    return card
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

    footer.append(importBtn, exportBtn)
    return footer
  }

  private _openDesigner(entry?: ITemplateRegistryEntry) {
    new TemplateDesigner(
      {
        onSave: (saved, category) => {
          templateRegistry.register(
            saved,
            category || (this.activeCategory === '全部' ? '自定义' : this.activeCategory),
            false
          )
          this._renderGrid()
        },
        onClose: () => {}
      },
      entry
    )
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
          const schema = templateRegistry.importSchema(json, '自定义')
          alert(`导入成功：${schema.name}`)
          this._renderGrid()
        } catch (err) {
          alert(`导入失败：${(err as Error).message}`)
        }
      }
      reader.readAsText(file)
    })
    input.click()
  }

  private _exportJSON() {
    const items =
      this.activeCategory === '全部'
        ? templateRegistry.getAll()
        : templateRegistry.getByCategory(this.activeCategory)

    if (items.length === 0) {
      alert('当前分类没有可导出的模板')
      return
    }

    const schemas = items.map(item => templateRegistry.get(item.id)).filter(Boolean)
    const json = JSON.stringify(schemas, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const label = this.activeCategory === '全部' ? 'all' : this.activeCategory
    a.download = `templates-${label}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  private _dispose() {
    this.mask.remove()
    this.container.remove()
  }
}
