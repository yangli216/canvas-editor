import { ControlType } from '../../src/editor/dataset/enum/Control'
import { compileTemplate } from '../../src/editor/template'

const demoUrl =
  Cypress.env('E2E_URL') || 'http://localhost:3000/canvas-editor/'

describe('模板预览回归', () => {
  beforeEach(() => {
    cy.visit(demoUrl)

    cy.get('canvas').first().as('canvas').should('have.length', 1)
  })

  it('长选项下拉弹层展示与字段宽度策略保持稳定', () => {
    const schema = {
      version: '1.0.0',
      id: 'template-preview-regression',
      name: '模板预览宽度回归',
      layout: {
        defaultFontSize: 14
      },
      blocks: [
        {
          type: 'fieldRow',
          fields: [
            {
              id: 'adaptiveSelect',
              type: 'select',
              label: '超长下拉',
              prefix: '术前',
              postfix: '评估',
              style: { size: 18 },
              options: [
                {
                  label: '超长选项文本用于验证弹层不再固定卡在一百六十像素并支持两行换行展示'
                }
              ]
            },
            {
              id: 'fixedSelect',
              type: 'select',
              label: '固定下拉',
              width: 180,
              options: [
                { label: '固定宽度选项A' },
                { label: '固定宽度选项B' }
              ]
            },
            {
              id: 'adaptiveText',
              type: 'text',
              label: '自适应文本',
              placeholder: '请输入'
            }
          ]
        }
      ]
    }

    const compiled = compileTemplate(schema as any)
    const adaptiveSelect = compiled.main.find(
      element =>
        element.type === 'control' &&
        element.control?.conceptId === 'adaptiveSelect'
    )
    const fixedSelect = compiled.main.find(
      element =>
        element.type === 'control' &&
        element.control?.conceptId === 'fixedSelect'
    )
    const adaptiveText = compiled.main.find(
      element =>
        element.type === 'control' &&
        element.control?.conceptId === 'adaptiveText'
    )

    expect(adaptiveSelect?.control?.type).to.eq(ControlType.SELECT)
    expect(adaptiveSelect?.control?.minWidth).to.be.a('number')
    expect(adaptiveSelect?.control?.minWidth).to.be.greaterThan(180)
    expect(fixedSelect?.control?.minWidth).to.eq(180)
    expect(adaptiveText?.control?.minWidth).to.be.undefined

    cy.getEditor().then((editor: any) => {
      editor.command.executeSetValue(compiled)

      const controlList = editor.command.getControlList()
      const selectControl = controlList.find(
        element => element.control?.conceptId === 'adaptiveSelect'
      )

      expect(selectControl?.controlId).to.be.a('string')
      editor.command.executeLocationControl(selectControl!.controlId!)
    })

    cy.get('.ce-select-control-popup')
      .should('be.visible')
      .then($popup => {
        const popupWidth = $popup.outerWidth() ?? 0
        expect(popupWidth).to.be.greaterThan(160)
        expect(popupWidth).to.be.at.most(320)
      })

    cy.get('.ce-select-control-popup li')
      .first()
      .should('have.attr', 'title')
      .and('include', '超长选项文本')

    cy.window().then(win => {
      cy.get('.ce-select-control-popup li')
        .first()
        .then($li => {
          const style = win.getComputedStyle($li[0])
          const lineHeight = parseFloat(style.lineHeight)
          const itemHeight = $li.outerHeight() ?? 0

          expect(style.whiteSpace).to.eq('normal')
          expect(style.getPropertyValue('-webkit-line-clamp').trim()).to.eq('2')
          expect(style.overflowWrap).to.eq('anywhere')
          expect(itemHeight).to.be.greaterThan(lineHeight * 1.5)
        })
    })
  })
})