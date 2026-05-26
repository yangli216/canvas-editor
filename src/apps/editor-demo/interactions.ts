import type Editor from '../../editor'
import { setupEditorDemoContextMenu } from './context-menu'
import { setupEditorDemoListeners } from './listener'
import { setupEditorDemoShortcuts } from './shortcut'
import { setupEditorDemoToolbar } from './toolbar'

export function setupEditorDemoInteractions(
  instance: Editor,
  isApple: boolean
) {
  const toolbarContext = setupEditorDemoToolbar(instance, isApple)
  setupEditorDemoListeners(instance, toolbarContext)
  setupEditorDemoContextMenu(instance)
  setupEditorDemoShortcuts(instance, toolbarContext)
}