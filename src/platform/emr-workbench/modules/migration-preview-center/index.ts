import type {
  ITemplateDocumentMigrationPreview,
  ITemplateDocumentRecord
} from '../../../../editor/template/TemplateDocumentStore'
import type { ITemplateSchema } from '../../../../editor/template'
import { buildMigrationPreviewCenterViewModel } from './service'
import { createMigrationPreviewCenterView } from './view'

export class MigrationPreviewCenterModule {
  createDialogContent(args: {
    currentSchema: ITemplateSchema
    documents: ITemplateDocumentRecord[]
    previewMigration: (id: string, schema: ITemplateSchema) =>
      ITemplateDocumentMigrationPreview | undefined
  }) {
    return createMigrationPreviewCenterView(
      buildMigrationPreviewCenterViewModel(args)
    )
  }
}

export {
  buildMigrationPreviewCenterViewModel
} from './service'
export type {
  IMigrationPreviewCenterViewModel
} from './service'
export {
  createMigrationPreviewCenterView
} from './view'