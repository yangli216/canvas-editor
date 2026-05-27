import type {
  ITemplateDocumentMigrationPreview,
  ITemplateDocumentRecord
} from '../../../../editor/template/TemplateDocumentStore'
import type { ITemplateSchema } from '../../../../editor/template'
import { buildTemplateFieldRuntimeIndex } from '../../../../editor/template/TemplateRuntime'

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

function summarize(values: string[], emptyText = '无') {
  if (!values.length) return emptyText
  const limited = values.slice(0, 3)
  return values.length > 3
    ? `${limited.join('、')} 等 ${values.length} 项`
    : limited.join('、')
}

export interface IMigrationPreviewCenterViewModel {
  summary: {
    documentCount: number
    outdatedDocumentCount: number
    autoApplyCount: number
    manualConfirmCount: number
    blockedCount: number
  }
  hintText?: string
  items: Array<{
    title: string
    meta: string
    status: {
      badgeClass: string
      badgeText: string
    }
    rows: Array<{
      name: string
      detail: string
      badgeText: string
      badgeClass: string
    }>
  }>
}

export function buildMigrationPreviewCenterViewModel(args: {
  currentSchema: ITemplateSchema
  documents: ITemplateDocumentRecord[]
  previewMigration: (id: string, schema: ITemplateSchema) =>
    ITemplateDocumentMigrationPreview | undefined
}): IMigrationPreviewCenterViewModel {
  const outdatedDocuments = args.documents.filter(
    record => record.template.version !== args.currentSchema.version
  )
  const targetDocuments = outdatedDocuments.length ? outdatedDocuments : args.documents

  const items = targetDocuments
    .map(record => {
      const preview = args.previewMigration(record.id, args.currentSchema)
      if (!preview) return null

      const sourceIndex = buildTemplateFieldRuntimeIndex(record.template.snapshot)
      const targetIndex = buildTemplateFieldRuntimeIndex(args.currentSchema)
      const previousRuleCount = countRules(record.template.snapshot.blocks)
      const nextRuleCount = countRules(args.currentSchema.blocks)
      const requiredIssues = preview.unresolvedFields.filter(
        field => field.reason === 'required'
      )
      const ambiguousIssues = preview.unresolvedFields.filter(
        field => field.reason === 'ambiguous'
      )

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
        title: `${record.title || record.id} · v${record.template.version} -> v${args.currentSchema.version}`,
        meta: `病历状态 ${record.status} / 最近更新 ${new Date(record.updatedAt).toLocaleDateString()}`,
        status,
        preview,
        rows: [
          {
            name: `保留字段 ${preview.mappings.length} 项`,
            detail: mappingText,
            badgeText: preview.mappings.length ? '已映射' : '无映射',
            badgeClass: 'tm-center-badge tm-center-badge--success'
          },
          {
            name: `新增必填字段 ${requiredIssues.length} 项`,
            detail: requiredText,
            badgeText: requiredIssues.length ? '需补录' : '无阻断',
            badgeClass: requiredIssues.length
              ? 'tm-center-badge tm-center-badge--danger'
              : 'tm-center-badge tm-center-badge--success'
          },
          {
            name: `丢失字段 ${preview.droppedFields.length} 项`,
            detail: droppedText,
            badgeText: preview.droppedFields.length ? '需复核' : '无丢失',
            badgeClass: preview.droppedFields.length
              ? 'tm-center-badge tm-center-badge--warning'
              : 'tm-center-badge tm-center-badge--success'
          },
          {
            name: `规则变化风险 ${previousRuleCount} -> ${nextRuleCount}`,
            detail: previousRuleCount === nextRuleCount
              ? `规则数量无变化${ambiguousText !== '无' ? ` / 歧义字段：${ambiguousText}` : ''}`
              : `规则数量发生变化，建议复核触发条件与联动影响${ambiguousText !== '无' ? ` / 歧义字段：${ambiguousText}` : ''}`,
            badgeText: previousRuleCount === nextRuleCount
              ? '稳定'
              : '需复核',
            badgeClass: previousRuleCount === nextRuleCount
              ? 'tm-center-badge tm-center-badge--success'
              : 'tm-center-badge tm-center-badge--warning'
          }
        ]
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  return {
    summary: {
      documentCount: args.documents.length,
      outdatedDocumentCount: outdatedDocuments.length,
      autoApplyCount: items.filter(
        item => item.preview.canAutoApply && !item.preview.requiresManualConfirmation
      ).length,
      manualConfirmCount: items.filter(
        item => item.preview.canAutoApply && item.preview.requiresManualConfirmation
      ).length,
      blockedCount: items.filter(item => !item.preview.canAutoApply).length
    },
    hintText: args.documents.length
      ? outdatedDocuments.length
        ? `当前优先展示 ${outdatedDocuments.length} 份非最新模板版本病历的迁移预览；规则变化风险按病历快照模板与当前模板对比计算。`
        : '当前所有引用病历都已处于最新模板版本，以下展示的是同版本迁移预览，用于确认新增规则和字段影响。'
      : undefined,
    items: items.map(item => ({
      title: item.title,
      meta: item.meta,
      status: item.status,
      rows: item.rows
    }))
  }
}