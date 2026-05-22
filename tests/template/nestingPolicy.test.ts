import { describe, expect, it } from 'vitest'
import {
  canNestBlock,
  filterNestableBlocks,
  getAllowedNestedBlockTypes
} from '@/components/template-designer/nesting'
import type {
  ITemplateGroupBlock,
  ITemplateSectionBlock
} from '@/editor/template'

describe('template designer nesting policy', () => {
  it('分节允许组合和叶子块，但不允许继续嵌套分节', () => {
    const section: ITemplateSectionBlock = {
      type: 'section',
      title: '基础信息',
      blocks: []
    }

    expect(getAllowedNestedBlockTypes(section)).toEqual([
      'group',
      'staticText',
      'paragraph',
      'fieldRow',
      'separator',
      'table'
    ])
    expect(canNestBlock(section, 'group')).toBe(true)
    expect(canNestBlock(section, 'section')).toBe(false)
  })

  it('组合过滤掉非法的分节子块，只保留布局与内容块', () => {
    const group: ITemplateGroupBlock = {
      type: 'group',
      direction: 'column',
      blocks: []
    }

    const filtered = filterNestableBlocks(group, [
      { type: 'section', title: '不应插入', blocks: [] },
      { type: 'group', direction: 'row', blocks: [] },
      { type: 'fieldRow', fields: [] }
    ])

    expect(filtered.map(block => block.type)).toEqual(['group', 'fieldRow'])
  })
})