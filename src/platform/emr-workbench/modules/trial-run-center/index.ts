import type { ITemplateTrialRunRecord } from '../../domain'
import {
  createTrialRunCenterView,
  type ITrialRunCenterDraft
} from './view'

export class TrialRunCenterModule {
  createDialogContent(args: {
    defaultDepartment?: string
    getRecords: () => ITemplateTrialRunRecord[]
    onOpenPreview: () => void
    onSave: (draft: ITrialRunCenterDraft) => void
  }) {
    return createTrialRunCenterView(args)
  }
}

export {
  buildTrialRunCenterViewModel
} from './service'
export type {
  ITrialRunCenterViewModel
} from './service'
export {
  createTrialRunCenterView
} from './view'
export type {
  ITrialRunCenterDraft
} from './view'