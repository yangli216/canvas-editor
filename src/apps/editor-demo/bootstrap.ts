import { documentData, options } from '../../mock'
import Editor from '../../editor'
import { bootstrapEmrWorkbench } from '../../platform/emr-workbench'

export interface IEditorDemoAppContext {
  editor: Editor
  isApple: boolean
}

export function bootstrapEditorDemoApp(): IEditorDemoAppContext {
  const isApple =
    typeof navigator !== 'undefined' && /Mac OS X/.test(navigator.userAgent)

  const container = document.querySelector<HTMLDivElement>('.editor')!
  const editor = new Editor(
    container,
    documentData,
    options
  )

  Reflect.set(window, 'editor', editor)
  Reflect.set(window, '__CANVAS_EDITOR_INSTANCE__', editor)

  bootstrapEmrWorkbench(editor)

  return {
    editor,
    isApple
  }
}