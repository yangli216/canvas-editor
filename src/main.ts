import './style.css'
import {
  bootstrapEditorDemoApp,
  setupEditorDemoInteractions
} from './apps/editor-demo'

window.onload = function () {
  const { editor, isApple } = bootstrapEditorDemoApp()
  console.log('实例: ', editor)
  setupEditorDemoInteractions(editor, isApple)
}