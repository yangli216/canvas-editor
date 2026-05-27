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

const TEMPLATE_MANAGER_HASH = '#template-manager'

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

  const templateManagerHost = document.createElement('div')
  templateManagerHost.className = 'tm-page-host'
  document.body.append(templateManagerHost)

  let templateManager: TemplateManager | null = null

  const closeTemplateWorkbench = () => {
    templateManager?.dispose()
  }

  const openTemplateWorkbench = () => {
    if (templateManager) return
    document.body.classList.add('app--template-manager')
    templateManager = new TemplateManager({
      documentStore,
      onApply: applyTemplate,
      mode: 'page',
      host: templateManagerHost,
      onClose: () => {
        templateManager = null
        templateManagerHost.innerHTML = ''
        document.body.classList.remove('app--template-manager')
        if (window.location.hash === TEMPLATE_MANAGER_HASH) {
          window.history.replaceState(
            window.history.state,
            document.title,
            `${window.location.pathname}${window.location.search}`
          )
        }
      }
    })
  }

  const syncTemplateWorkbenchRoute = () => {
    if (window.location.hash === TEMPLATE_MANAGER_HASH) {
      openTemplateWorkbench()
    } else {
      closeTemplateWorkbench()
    }
  }

  const templateManagerBtn = document.querySelector<HTMLButtonElement>('.btn-template-manager')
  if (templateManagerBtn) {
    templateManagerBtn.onclick = () => {
      if (window.location.hash !== TEMPLATE_MANAGER_HASH) {
        window.location.hash = TEMPLATE_MANAGER_HASH
      }
    }
  }

  window.addEventListener('hashchange', syncTemplateWorkbenchRoute)
  syncTemplateWorkbenchRoute()

  return {
    documentStore,
    openTemplateWorkbench
  }
}