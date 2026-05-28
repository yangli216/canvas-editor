import {
  buildHisIntegrationCenterViewModel,
  type IHisIntegrationCenterConnector,
  type IHisIntegrationCenterFieldDiagnostic,
  type IHisIntegrationCenterOperationsSnapshot,
  type IHisIntegrationCenterSession,
  type IHisIntegrationCenterTraceRecord
} from './service'
import { createHisIntegrationCenterView } from './view'

export class HisIntegrationCenterModule {
  createDialogContent(args: {
    getConnectors: () => IHisIntegrationCenterConnector[]
    getSessions: () => IHisIntegrationCenterSession[]
    getTraces: () => IHisIntegrationCenterTraceRecord[]
    getFieldDiagnostics?: () => IHisIntegrationCenterFieldDiagnostic[]
    getOperationsSnapshot?: () => IHisIntegrationCenterOperationsSnapshot
  }) {
    return createHisIntegrationCenterView({
      getModel: () => buildHisIntegrationCenterViewModel({
        connectors: args.getConnectors(),
        sessions: args.getSessions(),
        traces: args.getTraces(),
        fieldDiagnostics: args.getFieldDiagnostics?.() ?? [],
        operationsSnapshot: args.getOperationsSnapshot?.()
      })
    })
  }
}

export {
  buildHisIntegrationCenterViewModel,
  type IHisIntegrationCenterConnector,
  type IHisIntegrationCenterFieldDiagnostic,
  type IHisIntegrationCenterOperationsSnapshot,
  type IHisIntegrationCenterSession,
  type IHisIntegrationCenterTraceRecord,
  type IHisIntegrationCenterViewModel
} from './service'
export {
  createHisIntegrationCenterView,
  type IHisIntegrationCenterViewOptions
} from './view'
