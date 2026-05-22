import { EDITOR_COMPONENT, EditorComponent } from '../../editor'
import {
  templateRegistry,
  type TemplatePublishStatus
} from '../../editor/template/TemplateRegistry'
import type { ITemplateSchema } from '../../editor/template/index'
import {
  validateSchema
} from '../../editor/template/index'
import {
  buildTemplateFieldRuntimeIndex
} from '../../editor/template/TemplateRuntime'
import { templateDataAdapterRegistry } from '../../editor/template/TemplateDataAdapter'
import type {
  ITemplateListItem,
  ITemplateRegistryEntry,
  ITemplateVersionRecord
} from '../../editor/template/TemplateRegistry'
import { TemplateDesigner } from './TemplateDesigner'
import { TemplateFeedback } from './TemplateFeedback'
import { TemplatePreviewDialog } from './TemplatePreviewDialog'

export interface ITemplateManagerOptions {
  onApply: (schema: ITemplateSchema) => void
}

type TemplateStatusFilter = TemplatePublishStatus | 'all' | 'problem'
type TemplateViewMode = 'card' | 'list'
type TemplateSortMode = 'updatedDesc' | 'updatedAsc' | 'nameAsc'

interface ITemplateWorkbenchItem extends ITemplateListItem {
  entry: ITemplateRegistryEntry
  blockCount: number
  fieldCount: number
  ruleCount: number
  businessFieldCount: number
  dataSourceCount: number
  issueCount: number
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
  const allBlocks = [
    ...(schema.header ?? []),
    ...schema.blocks,
    ...(schema.footer ?? [])
  ]
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

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

export class TemplateManager {
  private mask: HTMLDivElement
  private container: HTMLDivElement
  private options: ITemplateManagerOptions
  private activeCategory = '全部'
  private statusFilter: TemplateStatusFilter = 'all'
  private viewMode: TemplateViewMode = 'card'
  private sortMode: TemplateSortMode = 'updatedDesc'
  private searchKeyword = ''
  private sidebarEl!: HTMLDivElement
  private statsEl!: HTMLDivElement
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

    const view = document.createElement('div')
    view.className = 'tm-view-toggle'

    const cardBtn = this._createViewButton('卡片', 'card')
    const listBtn = this._createViewButton('列表', 'list')
    view.append(cardBtn, listBtn)

    toolbar.append(search, status, sort, view)
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
    const categories = ['全部', ...templateRegistry.getCategories()]
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
        '流程',
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
      )
    )
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
        label: '需修正',
        value: allItems.filter(item => item.issueCount > 0).length,
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
    let items = templateRegistry.getAll()
      .map(item => {
        const entry = templateRegistry.getEntry(item.id)
        if (!entry) return null
        return {
          ...item,
          entry,
          ...getTemplateMetrics(entry.schema)
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
        if (this.searchKeyword) {
          const haystack = [item.name, item.description, item.category]
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
    status.className = `tm-card__status tm-card__status--${item.issueCount ? 'archived' : 'published'}`
    status.textContent = item.issueCount ? '需修正' : '可发布'
    top.append(nameWrap, status)

    const meta = document.createElement('div')
    meta.className = 'tm-card__meta'
    const metaItems = [
      STATUS_LABEL[item.entry.status],
      `v${item.entry.schema.version}`,
      `${item.category}${item.builtIn ? ' · 内置' : ''}`
    ]
    metaItems.forEach(text => {
      const tag = document.createElement('span')
      tag.textContent = text
      meta.append(tag)
    })

    const metrics = document.createElement('div')
    metrics.className = 'tm-card__metrics'
    ;([
      { label: '结构块', value: item.blockCount },
      { label: '字段', value: item.fieldCount },
      { label: '规则', value: item.ruleCount }
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

    const footer = document.createElement('div')
    footer.className = 'tm-card__footer'

    const updated = document.createElement('span')
    updated.className = 'tm-card__updated'
    updated.textContent = `更新 ${formatTime(item.updatedAt)}`

    const actionsEl = document.createElement('div')
    actionsEl.className = 'tm-card__actions'
    actionsEl.append(
      this._createPrimaryAction(item),
      this._createEditAction(item),
      this._createMoreAction(item)
    )

    footer.append(updated, actionsEl)
    card.append(top, meta, metrics, footer)
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
        this.options.onApply(item.entry.schema)
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
      { label: '版本管理', handler: () => this._openVersionCenter(item) },
      { label: '发版流程', handler: () => this._openReleaseFlow(item) },
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
    records.slice().reverse().forEach(record => {
      history.append(this._renderVersionRecord(record))
    })
    content.append(summary, history)
    TemplateFeedback.openDialog({
      title: `${item.name} · 版本中心`,
      content,
      width: 640,
      actions: [{ label: '关闭', variant: 'primary' }]
    })
  }

  private _getPublishedVersion(entry: ITemplateRegistryEntry): string {
    const record = entry.versionHistory
      .filter(item => item.status === 'published')
      .at(-1)
    return record ? `v${record.version}` : ''
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
    const note = document.createElement('textarea')
    note.className = 'tm-release-flow__note'
    note.placeholder = '填写本次送审、发布或撤回说明'
    const check = document.createElement('div')
    check.className = `tm-release-flow__check${item.issueCount ? ' tm-release-flow__check--warn' : ''}`
    check.textContent = item.issueCount
      ? `发布检查发现 ${item.issueCount} 个配置问题，送审/发布会被拦截`
      : '发布检查通过，可进入送审或发布'
    content.append(check, note)

    TemplateFeedback.openDialog({
      title: `${item.name} · 发版流程`,
      content,
      width: 520,
      actions: [
        {
          label: '送审',
          onClick: () => this._runReleaseAction('review', item, note.value)
        },
        {
          label: '发布',
          variant: 'primary',
          onClick: () => this._runReleaseAction('published', item, note.value)
        },
        {
          label: '撤回',
          variant: 'danger',
          onClick: () => this._runReleaseAction('archived', item, note.value)
        }
      ]
    })
  }

  private _runReleaseAction(
    status: Extract<TemplatePublishStatus, 'review' | 'published' | 'archived'>,
    item: ITemplateWorkbenchItem,
    note: string
  ) {
    const errors = status === 'review'
      ? templateRegistry.submitForReview(item.id, note.trim() || undefined)
      : status === 'published'
        ? templateRegistry.publish(item.id, note.trim() || undefined)
        : templateRegistry.withdraw(item.id)
    if (errors.length) {
      TemplateFeedback.alert({
        title: '发版检查未通过',
        message: errors.join('；'),
        tone: 'warning'
      })
      return
    }
    TemplateFeedback.toast('发版状态已更新', 'success')
    this._refreshWorkbench()
  }

  private async _deleteTemplate(item: ITemplateWorkbenchItem) {
    const confirmed = await TemplateFeedback.confirm({
      title: '删除模板',
      message: `确认删除模板“${item.name}”？该操作不可恢复。`,
      tone: 'danger',
      confirmText: '删除'
    })
    if (!confirmed) return
    templateRegistry.delete(item.id)
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

    const ruleBtn = document.createElement('button')
    ruleBtn.className = 'td-designer__btn'
    ruleBtn.textContent = '规则中心'
    ruleBtn.type = 'button'
    ruleBtn.addEventListener('click', () => this._openRuleCenter())

    const businessBtn = document.createElement('button')
    businessBtn.className = 'td-designer__btn'
    businessBtn.textContent = '业务字段中心'
    businessBtn.type = 'button'
    businessBtn.addEventListener('click', () => this._openBusinessFieldCenter())

    footer.append(importBtn, exportBtn, ruleBtn, businessBtn)
    return footer
  }

  private _openRuleCenter() {
    const items = this._getWorkbenchItems()
    const content = document.createElement('div')
    content.className = 'tm-version-center'
    const summary = document.createElement('div')
    summary.className = 'tm-version-center__summary'
    summary.innerHTML = `
      <div><span>当前模板</span><strong>${items.length}</strong></div>
      <div><span>规则总数</span><strong>${items.reduce((sum, item) => sum + item.ruleCount, 0)}</strong></div>
      <div><span>待修正模板</span><strong>${items.filter(item => item.issueCount > 0).length}</strong></div>
    `
    content.append(summary)
    TemplateFeedback.openDialog({
      title: '规则中心',
      content,
      width: 560,
      actions: [{ label: '关闭', variant: 'primary' }]
    })
  }

  private _openBusinessFieldCenter() {
    const content = document.createElement('div')
    content.className = 'tm-version-center'
    const summary = document.createElement('div')
    summary.className = 'tm-version-center__summary'
    summary.innerHTML = `
      <div><span>适配器</span><strong>${templateDataAdapterRegistry.list().length}</strong></div>
      <div><span>业务字段</span><strong>${this._getWorkbenchItems(false).reduce((sum, item) => sum + item.businessFieldCount, 0)}</strong></div>
      <div><span>数据源</span><strong>${this._getWorkbenchItems(false).reduce((sum, item) => sum + item.dataSourceCount, 0)}</strong></div>
    `
    content.append(summary)
    templateDataAdapterRegistry.list().forEach(adapter => {
      const item = document.createElement('div')
      item.className = 'tm-adapter-card'
      const name = document.createElement('div')
      name.className = 'tm-adapter-card__name'
      name.textContent = adapter.label
      const sources = document.createElement('div')
      sources.className = 'tm-adapter-card__sources'
      sources.textContent = adapter.dataSources.join(' / ')
      item.append(name, sources)
      content.append(item)
    })
    TemplateFeedback.openDialog({
      title: '业务字段中心',
      content,
      width: 620,
      actions: [{ label: '关闭', variant: 'primary' }]
    })
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
          this._refreshWorkbench()
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
          TemplateFeedback.toast(`导入成功：${schema.name}`, 'success')
          this._refreshWorkbench()
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
    a.download = `templates-${label}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  private _dispose() {
    document.querySelectorAll('.tm-more-menu').forEach(el => el.remove())
    this.mask.remove()
    this.container.remove()
  }
}