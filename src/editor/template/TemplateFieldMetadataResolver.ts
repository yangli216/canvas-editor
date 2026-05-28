import type {
  ITemplateFieldMetadata,
  ITemplateMetadataFieldSnapshotMap
} from './index'

export function resolveTemplateFieldMetadata(
  metadata: ITemplateFieldMetadata | undefined,
  metadataFieldsById?: ITemplateMetadataFieldSnapshotMap
): ITemplateFieldMetadata | undefined {
  if (!metadata) return metadata

  const metadataFieldId = metadata.metadataFieldId
  if (!metadataFieldId) return metadata

  const masterField = metadataFieldsById?.[metadataFieldId]
  if (!masterField) return metadata

  return {
    ...metadata,
    metadataFieldId,
    businessCode: masterField.code,
    group: masterField.group,
    exportPath: masterField.exportPath,
    permission: masterField.permission,
    dataSource: masterField.dataSource,
    tags: masterField.tags ? [...masterField.tags] : metadata.tags
  }
}