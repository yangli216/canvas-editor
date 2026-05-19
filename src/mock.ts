import { RowFlex, type IEditorData, type IEditorOption, type IElement } from './editor'
import { compileTemplate } from './editor'
import { admissionRecordTemplate } from './editor/template/examples/admissionRecord'

export const documentData: IEditorData = compileTemplate(admissionRecordTemplate, {
  headerRowFlex: RowFlex.CENTER
})

export const data: IElement[] = documentData.main

interface IComment {
  id: string
  content: string
  userName: string
  rangeText: string
  createdDate: string
}

export const commentList: IComment[] = [
  {
    id: '1',
    content: '模板字段规则已经沉淀到 extension.template，可继续接设计器属性面板。',
    userName: 'Copilot',
    rangeText: '主诉',
    createdDate: '2026-05-19 16:38:18'
  }
]

export const options: IEditorOption = {
  margins: [100, 120, 100, 120],
  watermark: {
    data: 'CANVAS-EDITOR',
    size: 120
  },
  pageNumber: {
    format: '第{pageNo}页/共{pageCount}页'
  },
  placeholder: {
    data: '请输入正文'
  },
  zone: {
    tipDisabled: false
  },
  maskMargin: [60, 0, 30, 0]
}
