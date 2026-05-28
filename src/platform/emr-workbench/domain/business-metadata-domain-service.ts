import type { ITemplateFieldMetadata } from '../../../editor/template'

export type BusinessMetadataFieldStatus = 'active' | 'inactive'

export interface IBusinessMetadataField {
  id: string
  code: string
  name: string
  group: string
  dataSource: string
  permission: string
  exportPath: string
  tags?: string[]
  status: BusinessMetadataFieldStatus
  description?: string
  createdAt: number
  updatedAt: number
}

export interface IBusinessMetadataFieldInput {
  code: string
  name: string
  group: string
  dataSource: string
  permission: string
  exportPath: string
  tags?: string[]
  description?: string
}

export type IBusinessMetadataFieldPatch = Partial<IBusinessMetadataFieldInput> & {
  status?: BusinessMetadataFieldStatus
}

export interface IBusinessMetadataTemplateBinding {
  templateId: string
  templateName: string
  templateCategory: string
  fieldId: string
  fieldLabel: string
  metadataFieldId: string
  bindMode: 'reference'
  boundAt: number
}

export interface IBusinessMetadataTemplateBindingInput {
  templateId: string
  templateName: string
  templateCategory: string
  fieldId: string
  fieldLabel: string
  metadataFieldId: string
}

export interface IBusinessMetadataTemplateFieldAsset {
  templateId: string
  templateName: string
  templateCategory: string
  fieldId: string
  fieldLabel: string
  metadata?: ITemplateFieldMetadata
}

export interface IBusinessMetadataFieldCandidate {
  code: string
  name: string
  group: string
  dataSource: string
  permission: string
  exportPath: string
  usageCount: number
  templateIds: string[]
  fieldIds: string[]
  tags?: string[]
}

export type BusinessMetadataConflictReason =
  | 'dataSourceMismatch'
  | 'permissionMismatch'
  | 'groupMismatch'
  | 'exportPathMismatch'

export interface IBusinessMetadataConflict {
  code: string
  reason: BusinessMetadataConflictReason
  templateIds: string[]
  fieldIds: string[]
}

export interface IBusinessMetadataFieldCandidateSnapshot {
  candidates: IBusinessMetadataFieldCandidate[]
  conflicts: IBusinessMetadataConflict[]
}

export interface IBusinessMetadataHospitalFieldMapping {
  id: string
  hospitalId: string
  departmentId?: string
  documentType?: string
  metadataFieldId: string
  vendorId: string
  dataSource: string
  interfaceField: string
  contextKey?: string
  dictionaryCode?: string
  defaultValue?: string
  createdAt: number
  updatedAt: number
}

export interface IBusinessMetadataHospitalFieldMappingInput {
  hospitalId: string
  departmentId?: string
  documentType?: string
  metadataFieldId: string
  vendorId: string
  dataSource: string
  interfaceField: string
  contextKey?: string
  dictionaryCode?: string
  defaultValue?: string
}

export interface IBusinessMetadataDictionaryMapping {
  id: string
  hospitalId: string
  dictionaryCode: string
  sourceValue: string
  targetValue: string
  label?: string
  createdAt: number
  updatedAt: number
}

export interface IBusinessMetadataDictionaryMappingInput {
  hospitalId: string
  dictionaryCode: string
  sourceValue: string
  targetValue: string
  label?: string
}

export interface IBusinessMetadataHospitalMappingSnapshot {
  id: string
  hospitalId: string
  version: string
  note?: string
  mappings: IBusinessMetadataHospitalFieldMapping[]
  dictionaryMappings: IBusinessMetadataDictionaryMapping[]
  createdAt: number
}

export interface IBusinessMetadataHospitalMappingPrecheck {
  status: 'success' | 'warning'
  mappedFieldCount: number
  missingFieldIds: string[]
  missingDictionaryCodes: string[]
}

export interface IBusinessMetadataHospitalMappingDiffItem {
  metadataFieldId: string
  beforeInterfaceField?: string
  afterInterfaceField?: string
  beforeDataSource?: string
  afterDataSource?: string
}

export interface IBusinessMetadataHospitalMappingDiff {
  baselineId: string
  nextId: string
  addedCount: number
  changedCount: number
  removedCount: number
  added: IBusinessMetadataHospitalFieldMapping[]
  changed: IBusinessMetadataHospitalMappingDiffItem[]
  removed: IBusinessMetadataHospitalFieldMapping[]
}

export interface IBusinessMetadataDomainServiceOptions {
  includeDefaultFields?: boolean
}

const DEFAULT_EMR_METADATA_FIELDS: IBusinessMetadataFieldInput[] = [
  {
    code: 'patient.name',
    name: '患者姓名',
    group: '基本信息',
    dataSource: 'his.patient',
    permission: 'patient.read.basic',
    exportPath: 'patient.name',
    tags: ['patient', 'identity']
  },
  {
    code: 'patient.gender',
    name: '性别',
    group: '基本信息',
    dataSource: 'his.patient',
    permission: 'patient.read.basic',
    exportPath: 'patient.gender',
    tags: ['patient', 'identity']
  },
  {
    code: 'patient.age',
    name: '年龄',
    group: '基本信息',
    dataSource: 'his.patient',
    permission: 'patient.read.basic',
    exportPath: 'patient.age',
    tags: ['patient', 'identity']
  },
  {
    code: 'patient.birthDate',
    name: '出生日期',
    group: '基本信息',
    dataSource: 'his.patient',
    permission: 'patient.read.basic',
    exportPath: 'patient.birthDate',
    tags: ['patient']
  },
  {
    code: 'patient.idCard',
    name: '身份证号',
    group: '基本信息',
    dataSource: 'his.patient',
    permission: 'patient.read.privacy',
    exportPath: 'patient.idCard',
    tags: ['patient', 'privacy']
  },
  {
    code: 'patient.phone',
    name: '联系电话',
    group: '基本信息',
    dataSource: 'his.patient',
    permission: 'patient.read.contact',
    exportPath: 'patient.phone',
    tags: ['patient', 'contact']
  },
  {
    code: 'encounter.admissionNo',
    name: '住院号',
    group: '就诊信息',
    dataSource: 'his.encounter',
    permission: 'encounter.read.basic',
    exportPath: 'encounter.admissionNo',
    tags: ['encounter']
  },
  {
    code: 'encounter.bedNo',
    name: '床号',
    group: '就诊信息',
    dataSource: 'his.encounter',
    permission: 'encounter.read.basic',
    exportPath: 'encounter.bedNo',
    tags: ['encounter']
  },
  {
    code: 'encounter.department',
    name: '就诊科室',
    group: '就诊信息',
    dataSource: 'his.encounter',
    permission: 'encounter.read.basic',
    exportPath: 'encounter.department',
    tags: ['encounter']
  },
  {
    code: 'encounter.admissionTime',
    name: '入院时间',
    group: '就诊信息',
    dataSource: 'his.encounter',
    permission: 'encounter.read.timeline',
    exportPath: 'encounter.admissionTime',
    tags: ['encounter', 'timeline']
  },
  {
    code: 'notes.chiefComplaint',
    name: '主诉',
    group: '病程记录',
    dataSource: 'emr.notes',
    permission: 'emr.read.note',
    exportPath: 'notes.chiefComplaint',
    tags: ['note']
  },
  {
    code: 'notes.presentIllness',
    name: '现病史',
    group: '病程记录',
    dataSource: 'emr.notes',
    permission: 'emr.read.note',
    exportPath: 'notes.presentIllness',
    tags: ['note']
  },
  {
    code: 'diagnosis.primary',
    name: '主要诊断',
    group: '诊断信息',
    dataSource: 'emr.diagnosis',
    permission: 'emr.read.diagnosis',
    exportPath: 'diagnosis.primary',
    tags: ['diagnosis']
  },
  {
    code: 'diagnosis.secondary',
    name: '次要诊断',
    group: '诊断信息',
    dataSource: 'emr.diagnosis',
    permission: 'emr.read.diagnosis',
    exportPath: 'diagnosis.secondary',
    tags: ['diagnosis']
  },
  {
    code: 'vitals.temperature',
    name: '体温',
    group: '生命体征',
    dataSource: 'emr.vitals',
    permission: 'emr.read.vitals',
    exportPath: 'vitals.temperature',
    tags: ['vitals']
  },
  {
    code: 'vitals.bloodPressure',
    name: '血压',
    group: '生命体征',
    dataSource: 'emr.vitals',
    permission: 'emr.read.vitals',
    exportPath: 'vitals.bloodPressure',
    tags: ['vitals']
  },
  {
    code: 'signature.doctor',
    name: '医师签名',
    group: '签名信息',
    dataSource: 'emr.signature',
    permission: 'emr.read.signature',
    exportPath: 'signature.doctor',
    tags: ['signature']
  }
]

function createFieldId(code: string) {
  return `metadata:${code}`
}

function cloneField(field: IBusinessMetadataField): IBusinessMetadataField {
  return {
    ...field,
    tags: field.tags ? [...field.tags] : undefined
  }
}

function cloneBinding(
  binding: IBusinessMetadataTemplateBinding
): IBusinessMetadataTemplateBinding {
  return { ...binding }
}

function cloneHospitalFieldMapping(
  mapping: IBusinessMetadataHospitalFieldMapping
): IBusinessMetadataHospitalFieldMapping {
  return { ...mapping }
}

function cloneDictionaryMapping(
  mapping: IBusinessMetadataDictionaryMapping
): IBusinessMetadataDictionaryMapping {
  return { ...mapping }
}

function cloneHospitalMappingSnapshot(
  snapshot: IBusinessMetadataHospitalMappingSnapshot
): IBusinessMetadataHospitalMappingSnapshot {
  return {
    ...snapshot,
    mappings: snapshot.mappings.map(cloneHospitalFieldMapping),
    dictionaryMappings: snapshot.dictionaryMappings.map(cloneDictionaryMapping)
  }
}

function createHospitalMappingId(input: {
  hospitalId: string
  departmentId?: string
  documentType?: string
  metadataFieldId: string
}) {
  return [
    input.hospitalId,
    input.departmentId || '*',
    input.documentType || '*',
    input.metadataFieldId
  ].join(':')
}

function createDictionaryMappingId(input: {
  hospitalId: string
  dictionaryCode: string
  sourceValue: string
}) {
  return [input.hospitalId, input.dictionaryCode, input.sourceValue].join(':')
}

function getMappingScopeScore(
  mapping: IBusinessMetadataHospitalFieldMapping,
  args: { departmentId?: string; documentType?: string }
): number {
  if (mapping.departmentId && mapping.departmentId !== args.departmentId) return -1
  if (mapping.documentType && mapping.documentType !== args.documentType) return -1
  return Number(Boolean(mapping.departmentId)) + Number(Boolean(mapping.documentType))
}

function getAssetCode(asset: IBusinessMetadataTemplateFieldAsset): string {
  return asset.metadata?.businessCode || asset.metadata?.exportPath || ''
}

function getConflictReason(
  assets: IBusinessMetadataTemplateFieldAsset[]
): BusinessMetadataConflictReason | undefined {
  const dataSources = new Set(assets.map(item => item.metadata?.dataSource || ''))
  if (dataSources.size > 1) return 'dataSourceMismatch'

  const permissions = new Set(assets.map(item => item.metadata?.permission || ''))
  if (permissions.size > 1) return 'permissionMismatch'

  const groups = new Set(assets.map(item => item.metadata?.group || ''))
  if (groups.size > 1) return 'groupMismatch'

  const exportPaths = new Set(assets.map(item => item.metadata?.exportPath || ''))
  if (exportPaths.size > 1) return 'exportPathMismatch'

  return undefined
}

export class BusinessMetadataDomainService {
  private readonly fields = new Map<string, IBusinessMetadataField>()
  private readonly bindings = new Map<string, IBusinessMetadataTemplateBinding>()
  private readonly hospitalFieldMappings = new Map<string, IBusinessMetadataHospitalFieldMapping>()
  private readonly dictionaryMappings = new Map<string, IBusinessMetadataDictionaryMapping>()
  private readonly mappingSnapshots = new Map<string, IBusinessMetadataHospitalMappingSnapshot>()

  constructor(options: IBusinessMetadataDomainServiceOptions = {}) {
    if (options.includeDefaultFields !== false) {
      DEFAULT_EMR_METADATA_FIELDS.forEach(field => this.createField(field))
    }
  }

  listFields(): IBusinessMetadataField[] {
    return Array.from(this.fields.values()).map(cloneField)
  }

  getField(id: string): IBusinessMetadataField | undefined {
    const field = this.fields.get(id)
    return field ? cloneField(field) : undefined
  }

  createField(input: IBusinessMetadataFieldInput): IBusinessMetadataField {
    const now = Date.now()
    const field: IBusinessMetadataField = {
      id: createFieldId(input.code),
      ...input,
      tags: input.tags ? [...input.tags] : undefined,
      status: 'active',
      createdAt: now,
      updatedAt: now
    }
    this.fields.set(field.id, field)
    return cloneField(field)
  }

  updateField(
    id: string,
    patch: IBusinessMetadataFieldPatch
  ): IBusinessMetadataField | undefined {
    const current = this.fields.get(id)
    if (!current) return undefined
    const next: IBusinessMetadataField = {
      ...current,
      ...patch,
      tags: patch.tags ? [...patch.tags] : current.tags,
      updatedAt: Date.now()
    }
    this.fields.set(id, next)
    return cloneField(next)
  }

  bindTemplateField(input: IBusinessMetadataTemplateBindingInput) {
    const binding: IBusinessMetadataTemplateBinding = {
      ...input,
      bindMode: 'reference',
      boundAt: Date.now()
    }
    this.bindings.set(`${input.templateId}:${input.fieldId}`, binding)
    return cloneBinding(binding)
  }

  unbindTemplateField(input: { templateId: string; fieldId: string }) {
    this.bindings.delete(`${input.templateId}:${input.fieldId}`)
  }

  listBindings(): IBusinessMetadataTemplateBinding[] {
    return Array.from(this.bindings.values()).map(cloneBinding)
  }

  getFieldUsage(metadataFieldId: string): IBusinessMetadataTemplateBinding[] {
    return this.listBindings().filter(item => item.metadataFieldId === metadataFieldId)
  }

  upsertHospitalFieldMapping(
    input: IBusinessMetadataHospitalFieldMappingInput
  ): IBusinessMetadataHospitalFieldMapping {
    const id = createHospitalMappingId(input)
    const current = this.hospitalFieldMappings.get(id)
    const now = Date.now()
    const mapping: IBusinessMetadataHospitalFieldMapping = {
      id,
      ...input,
      createdAt: current?.createdAt ?? now,
      updatedAt: now
    }
    this.hospitalFieldMappings.set(id, mapping)
    return cloneHospitalFieldMapping(mapping)
  }

  listHospitalFieldMappings(filter: {
    hospitalId?: string
    metadataFieldId?: string
  } = {}): IBusinessMetadataHospitalFieldMapping[] {
    return Array.from(this.hospitalFieldMappings.values())
      .filter(mapping => {
        if (filter.hospitalId && mapping.hospitalId !== filter.hospitalId) return false
        if (
          filter.metadataFieldId &&
          mapping.metadataFieldId !== filter.metadataFieldId
        ) {
          return false
        }
        return true
      })
      .map(cloneHospitalFieldMapping)
  }

  resolveHospitalFieldMappings(args: {
    hospitalId: string
    departmentId?: string
    documentType?: string
    metadataFieldIds?: string[]
  }): IBusinessMetadataHospitalFieldMapping[] {
    const metadataFieldIds = args.metadataFieldIds ?? this.listFields().map(field => field.id)
    return metadataFieldIds.flatMap(metadataFieldId => {
      const candidates = this.listHospitalFieldMappings({
        hospitalId: args.hospitalId,
        metadataFieldId
      })
        .map(mapping => ({
          mapping,
          score: getMappingScopeScore(mapping, args)
        }))
        .filter(item => item.score >= 0)
        .sort((left, right) => right.score - left.score)
      return candidates[0] ? [candidates[0].mapping] : []
    })
  }

  upsertDictionaryMapping(
    input: IBusinessMetadataDictionaryMappingInput
  ): IBusinessMetadataDictionaryMapping {
    const id = createDictionaryMappingId(input)
    const current = this.dictionaryMappings.get(id)
    const now = Date.now()
    const mapping: IBusinessMetadataDictionaryMapping = {
      id,
      ...input,
      createdAt: current?.createdAt ?? now,
      updatedAt: now
    }
    this.dictionaryMappings.set(id, mapping)
    return cloneDictionaryMapping(mapping)
  }

  listDictionaryMappings(filter: {
    hospitalId?: string
    dictionaryCode?: string
  } = {}): IBusinessMetadataDictionaryMapping[] {
    return Array.from(this.dictionaryMappings.values())
      .filter(mapping => {
        if (filter.hospitalId && mapping.hospitalId !== filter.hospitalId) return false
        if (
          filter.dictionaryCode &&
          mapping.dictionaryCode !== filter.dictionaryCode
        ) {
          return false
        }
        return true
      })
      .map(cloneDictionaryMapping)
  }

  translateDictionaryValue(args: {
    hospitalId: string
    dictionaryCode: string
    value: string
  }): string {
    const mapping = this.dictionaryMappings.get(createDictionaryMappingId({
      hospitalId: args.hospitalId,
      dictionaryCode: args.dictionaryCode,
      sourceValue: args.value
    }))
    return mapping?.targetValue ?? args.value
  }

  createHospitalMappingSnapshot(args: {
    hospitalId: string
    version: string
    note?: string
  }): IBusinessMetadataHospitalMappingSnapshot {
    const now = Date.now()
    const snapshot: IBusinessMetadataHospitalMappingSnapshot = {
      id: `${args.hospitalId}:${args.version}`,
      hospitalId: args.hospitalId,
      version: args.version,
      note: args.note,
      mappings: this.listHospitalFieldMappings({ hospitalId: args.hospitalId }),
      dictionaryMappings: this.listDictionaryMappings({ hospitalId: args.hospitalId }),
      createdAt: now
    }
    this.mappingSnapshots.set(snapshot.id, snapshot)
    return cloneHospitalMappingSnapshot(snapshot)
  }

  getHospitalMappingSnapshot(
    id: string
  ): IBusinessMetadataHospitalMappingSnapshot | undefined {
    const snapshot = this.mappingSnapshots.get(id)
    return snapshot ? cloneHospitalMappingSnapshot(snapshot) : undefined
  }

  precheckHospitalMappings(args: {
    hospitalId: string
    requiredMetadataFieldIds: string[]
    requiredDictionaryCodes?: string[]
  }): IBusinessMetadataHospitalMappingPrecheck {
    const mappings = this.listHospitalFieldMappings({ hospitalId: args.hospitalId })
    const mappedFieldIds = new Set(mappings.map(item => item.metadataFieldId))
    const dictionaryCodes = new Set(
      this.listDictionaryMappings({ hospitalId: args.hospitalId })
        .map(item => item.dictionaryCode)
    )
    const missingFieldIds = args.requiredMetadataFieldIds.filter(id => {
      return !mappedFieldIds.has(id)
    })
    const missingDictionaryCodes = (args.requiredDictionaryCodes ?? []).filter(code => {
      return !dictionaryCodes.has(code)
    })

    return {
      status: missingFieldIds.length || missingDictionaryCodes.length
        ? 'warning'
        : 'success',
      mappedFieldCount: args.requiredMetadataFieldIds.length - missingFieldIds.length,
      missingFieldIds,
      missingDictionaryCodes
    }
  }

  compareHospitalMappingSnapshots(
    baselineId: string,
    nextId: string
  ): IBusinessMetadataHospitalMappingDiff {
    const baseline = this.mappingSnapshots.get(baselineId)
    const next = this.mappingSnapshots.get(nextId)
    if (!baseline || !next) {
      throw new Error('Hospital mapping snapshot not found')
    }

    const baselineByField = new Map(
      baseline.mappings.map(item => [item.metadataFieldId, item])
    )
    const nextByField = new Map(
      next.mappings.map(item => [item.metadataFieldId, item])
    )
    const added = next.mappings.filter(item => !baselineByField.has(item.metadataFieldId))
    const removed = baseline.mappings.filter(item => !nextByField.has(item.metadataFieldId))
    const changed: IBusinessMetadataHospitalMappingDiffItem[] = []

    baseline.mappings.forEach(before => {
      const after = nextByField.get(before.metadataFieldId)
      if (!after) return
      if (
        before.interfaceField !== after.interfaceField ||
        before.dataSource !== after.dataSource
      ) {
        changed.push({
          metadataFieldId: before.metadataFieldId,
          beforeInterfaceField: before.interfaceField,
          afterInterfaceField: after.interfaceField,
          beforeDataSource: before.dataSource,
          afterDataSource: after.dataSource
        })
      }
    })

    return {
      baselineId,
      nextId,
      addedCount: added.length,
      changedCount: changed.length,
      removedCount: removed.length,
      added: added.map(cloneHospitalFieldMapping),
      changed,
      removed: removed.map(cloneHospitalFieldMapping)
    }
  }

  buildFieldCandidatesFromTemplates(
    assets: IBusinessMetadataTemplateFieldAsset[]
  ): IBusinessMetadataFieldCandidateSnapshot {
    const grouped = new Map<string, IBusinessMetadataTemplateFieldAsset[]>()

    assets.forEach(asset => {
      const code = getAssetCode(asset)
      if (!code) return
      const list = grouped.get(code) ?? []
      list.push(asset)
      grouped.set(code, list)
    })

    const candidates: IBusinessMetadataFieldCandidate[] = []
    const conflicts: IBusinessMetadataConflict[] = []

    grouped.forEach((items, code) => {
      const first = items[0]
      const metadata = first.metadata ?? {}
      candidates.push({
        code,
        name: first.fieldLabel,
        group: metadata.group || '',
        dataSource: metadata.dataSource || '',
        permission: metadata.permission || '',
        exportPath: metadata.exportPath || '',
        usageCount: items.length,
        templateIds: Array.from(new Set(items.map(item => item.templateId))),
        fieldIds: items.map(item => item.fieldId),
        tags: metadata.tags ? [...metadata.tags] : undefined
      })

      const reason = getConflictReason(items)
      if (reason) {
        conflicts.push({
          code,
          reason,
          templateIds: Array.from(new Set(items.map(item => item.templateId))),
          fieldIds: items.map(item => item.fieldId)
        })
      }
    })

    return { candidates, conflicts }
  }

  syncFieldsFromTemplateAssets(assets: IBusinessMetadataTemplateFieldAsset[]) {
    const nextBindings = new Map<string, IBusinessMetadataTemplateBinding>()

    assets.forEach(asset => {
      const metadata = asset.metadata
      if (!metadata) return

      if (metadata.metadataFieldId) {
        const binding: IBusinessMetadataTemplateBinding = {
          templateId: asset.templateId,
          templateName: asset.templateName,
          templateCategory: asset.templateCategory,
          fieldId: asset.fieldId,
          fieldLabel: asset.fieldLabel,
          metadataFieldId: metadata.metadataFieldId,
          bindMode: 'reference',
          boundAt: Date.now()
        }
        nextBindings.set(`${asset.templateId}:${asset.fieldId}`, binding)
      }

      const code = getAssetCode(asset)
      if (!code) return

      const fieldId = metadata.metadataFieldId || createFieldId(code)
      if (this.fields.has(fieldId)) return

      const field: IBusinessMetadataField = {
        id: fieldId,
        code,
        name: asset.fieldLabel,
        group: metadata.group || '',
        dataSource: metadata.dataSource || '',
        permission: metadata.permission || '',
        exportPath: metadata.exportPath || '',
        tags: metadata.tags ? [...metadata.tags] : undefined,
        status: 'active',
        description: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      this.fields.set(field.id, field)

    })

    this.bindings.clear()
    nextBindings.forEach((binding, key) => {
      this.bindings.set(key, binding)
    })
  }
}