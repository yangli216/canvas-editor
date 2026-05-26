import type Editor from '../../editor'
import { setupEditorDemoFormatToolbar } from './format-toolbar'
import { setupEditorDemoInsertToolbar } from './insert-toolbar'
import { type IEditorDemoToolbarContext } from './toolbar-context'
import { setupEditorDemoViewToolbar } from './view-toolbar'

export type { IEditorDemoToolbarContext } from './toolbar-context'

export function setupEditorDemoToolbar(
  instance: Editor,
  isApple: boolean
): IEditorDemoToolbarContext {
  return {
    ...setupEditorDemoFormatToolbar(instance, isApple),
    ...setupEditorDemoInsertToolbar(instance),
    ...setupEditorDemoViewToolbar(instance, isApple)
  }
}