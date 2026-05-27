import type { IMigrationPreviewCenterViewModel } from './service'

export function createMigrationPreviewCenterView(
  model: IMigrationPreviewCenterViewModel
): HTMLDivElement {
  const content = document.createElement('div')
  content.className = 'tm-version-center'

  const summary = document.createElement('div')
  summary.className = 'tm-version-center__summary'
  summary.innerHTML = `
    <div><span>引用病历</span><strong>${model.summary.documentCount}</strong></div>
    <div><span>待升级病历</span><strong>${model.summary.outdatedDocumentCount}</strong></div>
    <div><span>可直接迁移</span><strong>${model.summary.autoApplyCount}</strong></div>
    <div><span>需确认 / 阻断</span><strong>${model.summary.manualConfirmCount}/${model.summary.blockedCount}</strong></div>
  `
  content.append(summary)

  if (!model.summary.documentCount) {
    const empty = document.createElement('div')
    empty.className = 'tm-empty'
    const title = document.createElement('strong')
    title.className = 'tm-empty__title'
    title.textContent = '当前模板还没有引用病历'
    const detail = document.createElement('p')
    detail.className = 'tm-empty__detail'
    detail.textContent = '待生成病历实例后，即可在这里查看迁移预览并评估升级风险。'
    empty.append(title, detail)
    content.append(empty)
    return content
  }

  if (model.hintText) {
    const tip = document.createElement('div')
    tip.className = `tm-release-flow__check${model.summary.blockedCount ? ' tm-release-flow__check--warn' : ''}`
    tip.textContent = model.hintText
    content.append(tip)
  }

  model.items.forEach(itemPreview => {
    const group = document.createElement('div')
    group.className = 'tm-trace-group'

    const header = document.createElement('div')
    header.className = 'tm-center-inline'
    const title = document.createElement('div')
    title.className = 'tm-trace-group__title'
    title.textContent = itemPreview.title
    const badge = document.createElement('span')
    badge.className = itemPreview.status.badgeClass
    badge.textContent = itemPreview.status.badgeText
    header.append(title, badge)
    group.append(header)

    const meta = document.createElement('div')
    meta.className = 'tm-adapter-card__sources'
    meta.textContent = itemPreview.meta
    group.append(meta)

    const list = document.createElement('div')
    list.className = 'tm-center-list'
    itemPreview.rows.forEach(row => {
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

  return content
}