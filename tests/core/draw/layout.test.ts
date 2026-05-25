import { afterEach, describe, expect, it, vi } from 'vitest'
import { Draw } from '@/editor/core/draw/Draw'
import { EventBus } from '@/editor/core/event/eventbus/EventBus'
import { Listener } from '@/editor/core/listener/Listener'
import { Override } from '@/editor/core/override/Override'
import { ElementType } from '@/editor/dataset/enum/Element'
import type { IEditorData } from '@/editor/interface/Editor'
import type { IElement } from '@/editor/interface/Element'
import { compileTemplate } from '@/editor/template'
import { formatElementList } from '@/editor/utils/element'
import { mergeOption } from '@/editor/utils/option'
import { createOptions } from '../../factories/options'

vi.mock('@/editor/core/worker/WorkerManager', () => {
  return {
    WorkerManager: class MockWorkerManager {
      destroy(): void {}
    }
  }
})

function createTestDraw(main: IElement[]) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const options = mergeOption(createOptions())
  const header: IElement[] = []
  const footer: IElement[] = []

  formatElementList(header, {
    editorOptions: options,
    isForceCompensation: true
  })
  formatElementList(main, {
    editorOptions: options,
    isForceCompensation: true
  })
  formatElementList(footer, {
    editorOptions: options,
    isForceCompensation: true
  })

  const data: IEditorData = {
    header,
    main,
    footer,
    graffiti: []
  }

  const draw = new Draw(
    container,
    options,
    data,
    new Listener(),
    new EventBus<any>(),
    new Override()
  )

  return {
    draw,
    destroy() {
      draw.destroy()
      if (container.parentNode) {
        container.parentNode.removeChild(container)
      }
    }
  }
}

describe('Draw 排版', () => {
  let ctx: ReturnType<typeof createTestDraw> | undefined

  afterEach(() => ctx?.destroy())

  it('模板分割线前不再保留额外空白行', () => {
    const result = compileTemplate({
      id: 'separator-layout',
      version: '1.0.0',
      name: '分割线布局测试',
      blocks: [
        {
          type: 'paragraph',
          segments: [{ type: 'text', value: '标题' }]
        },
        {
          type: 'separator'
        }
      ]
    })

    ctx = createTestDraw(result.main)

    const rowList = ctx.draw.getOriginalRowList()
    const firstRowText = rowList[0].elementList
      .map(element => element.value)
      .join('')

    expect(rowList).toHaveLength(2)
    expect(firstRowText).toContain('标题')
    expect(rowList[1].elementList[0]?.type).toBe(ElementType.SEPARATOR)
  })
})