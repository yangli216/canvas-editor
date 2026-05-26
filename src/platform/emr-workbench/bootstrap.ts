import Editor from '../../editor'
import { MedicalRecordTracePanel } from '../../components/medical-record/MedicalRecordTracePanel'
import { TemplateManager } from '../../components/template-designer/TemplateManager'
import { registerBuiltInTemplates } from '../../editor/template/examples/index'
import {
  compileTemplate,
  getTemplatePageNumberOptions,
  type ITemplateSchema
} from '../../editor/template/index'
import {
  TemplateDocumentStore,
  type ITemplateDocumentRecord
} from '../../editor/template/TemplateDocumentStore'

export interface IEmrWorkbenchBootstrapResult {
  documentStore: TemplateDocumentStore
  openTemplateWorkbench: () => void
}

export function bootstrapEmrWorkbench(
  editor: Editor
): IEmrWorkbenchBootstrapResult {
  registerBuiltInTemplates()

  const documentStore = new TemplateDocumentStore()
  const tracePanelContainer = document.querySelector<HTMLElement>('.medical-record-trace')
  const tracePanel = tracePanelContainer
    ? new MedicalRecordTracePanel(tracePanelContainer, documentStore)
    : null

  const applyTemplate = (
    schema: ITemplateSchema,
    record?: ITemplateDocumentRecord
  ) => {
    const data = compileTemplate(schema)
    editor.command.executeSetValue(data)
    editor.command.executeUpdateOptions({
      pageNumber: getTemplatePageNumberOptions(schema)
    })
    if (record && tracePanel) {
      tracePanel.bindDocument(record, schema)
    }
  }

  const openTemplateWorkbench = () => {
    new TemplateManager({
      documentStore,
      onApply: applyTemplate
    })
  }

  const templateManagerBtn = document.querySelector<HTMLButtonElement>('.btn-template-manager')
  if (templateManagerBtn) {
    templateManagerBtn.onclick = openTemplateWorkbench
  }

  return {
    documentStore,
    openTemplateWorkbench
  }
}