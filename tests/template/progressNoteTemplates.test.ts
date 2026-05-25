import { describe, expect, it } from 'vitest'
import type { ITemplateBlock, ITemplateField, ITemplateSchema } from '@/editor'
import { templateRegistry } from '@/editor/template/TemplateRegistry'
import {
  attendingWardRoundTemplate,
  dailyProgressNoteTemplate,
  firstProgressNoteTemplate,
  progressNoteTemplate,
  registerBuiltInTemplates
} from '@/editor/template/examples'

function collectFields(blocks: ITemplateBlock[]): ITemplateField[] {
  const fields: ITemplateField[] = []

  for (const block of blocks) {
    if (block.type === 'fieldRow') {
      fields.push(...block.fields)
      continue
    }

    if (block.type === 'paragraph') {
      for (const segment of block.segments) {
        if (segment.type === 'field') {
          fields.push(segment.field)
        }
      }
      continue
    }

    if (block.type === 'section' || block.type === 'group') {
      fields.push(...collectFields(block.blocks))
      continue
    }

    if (block.type === 'table') {
      for (const column of block.columns) {
        if (column.field) {
          fields.push(column.field)
        }
      }
    }
  }

  return fields
}

function collectFieldIds(schema: ITemplateSchema): string[] {
  return collectFields(schema.blocks).map(field => field.id)
}

describe('progress note template family', () => {
  it('内置模板注册包含病程模板族', () => {
    registerBuiltInTemplates()

    expect(templateRegistry.getEntry(progressNoteTemplate.id)?.category).toBe('病程记录')
    expect(templateRegistry.getEntry(firstProgressNoteTemplate.id)?.category).toBe('病程记录')
    expect(templateRegistry.getEntry(dailyProgressNoteTemplate.id)?.category).toBe('病程记录')
    expect(templateRegistry.getEntry(attendingWardRoundTemplate.id)?.category).toBe('病程记录')
  })

  it('首次病程、日常病程和上级查房模板带有各自关键字段', () => {
    const firstFields = collectFieldIds(firstProgressNoteTemplate)
    const dailyFields = collectFieldIds(dailyProgressNoteTemplate)
    const roundFields = collectFieldIds(attendingWardRoundTemplate)
    const genericFields = collectFieldIds(progressNoteTemplate)

    expect(firstFields).toEqual(
      expect.arrayContaining(['chiefComplaint', 'diagnosticBasis', 'initialPlan'])
    )
    expect(dailyFields).toEqual(
      expect.arrayContaining(['illnessChange', 'examReview', 'dailyPlan'])
    )
    expect(roundFields).toEqual(
      expect.arrayContaining(['roundLevel', 'roundPhysician', 'superiorOpinion'])
    )
    expect(genericFields).toContain('noteType')
  })
})