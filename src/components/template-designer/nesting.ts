import type {
  ITemplateBlock,
  ITemplateGroupBlock,
  ITemplateSectionBlock
} from '../../editor/template/index'

type NestedParent = ITemplateSectionBlock | ITemplateGroupBlock

export const MAIN_BLOCK_TYPES: Array<ITemplateBlock['type']> = [
  'section',
  'group',
  'staticText',
  'paragraph',
  'fieldRow',
  'separator',
  'table'
]

const NESTED_BLOCK_TYPES: Array<ITemplateBlock['type']> = [
  'group',
  'staticText',
  'paragraph',
  'fieldRow',
  'separator',
  'table'
]

export function getAllowedNestedBlockTypes(
  parent: NestedParent
): Array<ITemplateBlock['type']> {
  void parent
  return [...NESTED_BLOCK_TYPES]
}

export function canNestBlock(
  parent: NestedParent,
  childType: ITemplateBlock['type']
): boolean {
  return getAllowedNestedBlockTypes(parent).includes(childType)
}

export function filterNestableBlocks(
  parent: NestedParent,
  blocks: ITemplateBlock[]
): ITemplateBlock[] {
  return blocks.filter(block => canNestBlock(parent, block.type))
}