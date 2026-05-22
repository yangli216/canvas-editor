import { templateRegistry } from '../TemplateRegistry'
import { admissionRecordTemplate } from './admissionRecord'
import { dischargeRecordTemplate } from './dischargeRecord'
import { progressNoteTemplate } from './progressNote'
import { surgicalRecordTemplate } from './surgicalRecord'
import { nursingRecordTemplate } from './nursingRecord'
import { informedConsentTemplate } from './informedConsent'

export function registerBuiltInTemplates() {
  templateRegistry.register(admissionRecordTemplate, '住院记录', true)
  templateRegistry.register(dischargeRecordTemplate, '住院记录', true)
  templateRegistry.register(progressNoteTemplate, '住院记录', true)
  templateRegistry.register(surgicalRecordTemplate, '手术记录', true)
  templateRegistry.register(nursingRecordTemplate, '护理记录', true)
  templateRegistry.register(informedConsentTemplate, '知情同意', true)
}

export {
  admissionRecordTemplate,
  dischargeRecordTemplate,
  progressNoteTemplate,
  surgicalRecordTemplate,
  nursingRecordTemplate,
  informedConsentTemplate
}
