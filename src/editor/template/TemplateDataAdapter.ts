import type { ITemplateField, ITemplateFieldMetadata } from './index'

/**
 * 业务数据适配器：把外部业务系统（HIS/EHR/LIS 等）按当前模板字段
 * 的元数据解析成可写入运行时的值映射，是平台从“能画模板”推进到
 * “能承载病历业务”的接入层。
 */
export interface ITemplateDataAdapterContext {
  /** 触发本次注入的业务上下文（病人 id、就诊 id 等任意业务键） */
  scope?: Record<string, string | number | undefined | null>
  /** 由调用方注入的实时业务变量，覆盖 scope 中的默认值 */
  variables?: Record<string, string | number | undefined | null>
}

export interface ITemplateDataAdapterRequestField {
  fieldId: string
  metadata?: ITemplateFieldMetadata
  field: ITemplateField
  /** 字段对应的导出路径，便于 adapter 直接按业务结构取值 */
  exportPath?: string
}

export interface ITemplateDataAdapterRequest {
  /** 当前匹配到的字段（按 dataSource 已过滤） */
  fields: ITemplateDataAdapterRequestField[]
  context: ITemplateDataAdapterContext
}

export interface ITemplateDataAdapterFieldResolution {
  fieldId: string
  value: string | string[] | null
  /** 若 adapter 想说明该字段为何为空（找不到病人、字典缺失等），可填 */
  note?: string
}

export interface ITemplateDataAdapterResolution {
  values: ITemplateDataAdapterFieldResolution[]
  /** 全局诊断信息（连接失败、上下文不全等），不阻断流程 */
  diagnostics?: string[]
}

export interface ITemplateDataAdapter {
  id: string
  label: string
  description?: string
  /**
   * 适用的数据源标识列表。当字段的 `metadata.dataSource` 命中其中之一时，
   * Runtime 会把该字段交给本 adapter 解析。
   */
  dataSources: string[]
  resolve(
    request: ITemplateDataAdapterRequest
  ): Promise<ITemplateDataAdapterResolution> | ITemplateDataAdapterResolution
}

/**
 * 适配器注册表：默认单例，业务集成方也可创建独立实例避免污染全局。
 */
export class TemplateDataAdapterRegistry {
  private adapters = new Map<string, ITemplateDataAdapter>()
  private dataSourceIndex = new Map<string, ITemplateDataAdapter>()

  register(adapter: ITemplateDataAdapter): void {
    if (!adapter.id) {
      throw new Error('TemplateDataAdapter.id is required')
    }
    this.adapters.set(adapter.id, adapter)
    adapter.dataSources.forEach(dataSource => {
      this.dataSourceIndex.set(dataSource, adapter)
    })
  }

  unregister(id: string): void {
    const adapter = this.adapters.get(id)
    if (!adapter) return
    this.adapters.delete(id)
    adapter.dataSources.forEach(dataSource => {
      if (this.dataSourceIndex.get(dataSource) === adapter) {
        this.dataSourceIndex.delete(dataSource)
      }
    })
  }

  get(id: string): ITemplateDataAdapter | undefined {
    return this.adapters.get(id)
  }

  getByDataSource(dataSource: string): ITemplateDataAdapter | undefined {
    return this.dataSourceIndex.get(dataSource)
  }

  list(): ITemplateDataAdapter[] {
    return Array.from(this.adapters.values())
  }

  reset(): void {
    this.adapters.clear()
    this.dataSourceIndex.clear()
  }
}

export const templateDataAdapterRegistry = new TemplateDataAdapterRegistry()

/* -------------------------------------------------------------------------- */
/* Mock HIS / EHR adapter                                                     */
/* -------------------------------------------------------------------------- */

export interface IMockHisPatient {
  id: string
  name: string
  gender: '男' | '女'
  age: number
  idNo: string
  visit: {
    no: string
    department: string
    ward: string
    bedNo: string
  }
  diagnosis: {
    primary: string
    secondary?: string
    icdCode?: string
  }
  vitals?: {
    temperature?: string
    pulse?: string
    breathing?: string
    bloodPressure?: string
  }
  orders?: Array<{
    name: string
    dose: string
    frequency: string
    route: string
  }>
  labs?: Array<{
    item: string
    result: string
    reportTime: string
  }>
  exam?: {
    finding?: string
    reportTime?: string
  }
  notes?: {
    chiefComplaint?: string
    historyOfPresentIllness?: string
    pastHistory?: string
    [key: string]: string | undefined
  }
}

export const MOCK_HIS_DATA_SOURCES = [
  'his',
  'his.patient',
  'his.visit',
  'his.diagnosis',
  'his.order',
  'emr',
  'emr.notes',
  'lis',
  'pacs',
  'vitalsDevice'
]

const DEFAULT_MOCK_PATIENTS: IMockHisPatient[] = [
  {
    id: 'P-1001',
    name: '张三',
    gender: '男',
    age: 58,
    idNo: '110101196610100011',
    visit: { no: 'V-20260520-001', department: '心内科', ward: '心内一病区', bedNo: '12-3' },
    diagnosis: { primary: '冠状动脉粥样硬化性心脏病', secondary: '2 型糖尿病', icdCode: 'I25.103' },
    vitals: { temperature: '36.8', pulse: '78', breathing: '18', bloodPressure: '132/82' },
    orders: [
      { name: '阿司匹林肠溶片', dose: '100mg', frequency: 'qd', route: '口服' },
      { name: '阿托伐他汀钙片', dose: '20mg', frequency: 'qn', route: '口服' }
    ],
    labs: [
      { item: '空腹血糖', result: '7.6 mmol/L', reportTime: '2026-05-20 08:12' },
      { item: '低密度脂蛋白', result: '3.4 mmol/L', reportTime: '2026-05-20 08:12' }
    ],
    exam: { finding: '冠脉 CTA 提示前降支中段重度狭窄', reportTime: '2026-05-19 15:30' },
    notes: {
      chiefComplaint: '反复胸闷、胸痛 3 月，加重 1 周',
      historyOfPresentIllness: '患者 3 月前活动后出现胸骨后压榨样疼痛，休息后可缓解，近 1 周症状频繁。',
      pastHistory: '糖尿病史 6 年，规律口服降糖药。'
    }
  },
  {
    id: 'P-1002',
    name: '李娜',
    gender: '女',
    age: 34,
    idNo: '110101199201020022',
    visit: { no: 'V-20260520-002', department: '呼吸内科', ward: '呼吸二病区', bedNo: '07-1' },
    diagnosis: { primary: '社区获得性肺炎', secondary: '过敏性鼻炎', icdCode: 'J18.901' },
    vitals: { temperature: '38.4', pulse: '96', breathing: '22', bloodPressure: '118/74' },
    orders: [
      { name: '注射用头孢呋辛钠', dose: '1.5g', frequency: 'q8h', route: '静脉滴注' },
      { name: '盐酸氨溴索口服液', dose: '10ml', frequency: 'tid', route: '口服' }
    ],
    labs: [
      { item: '白细胞计数', result: '12.4 ×10^9/L', reportTime: '2026-05-20 09:50' },
      { item: 'C 反应蛋白', result: '48 mg/L', reportTime: '2026-05-20 09:50' }
    ],
    exam: { finding: '胸部 CT 提示右下肺斑片影', reportTime: '2026-05-20 10:30' },
    notes: {
      chiefComplaint: '咳嗽、咳痰伴发热 5 天',
      historyOfPresentIllness: '患者 5 天前受凉后出现咳嗽，咳黄痰，伴体温升高至 38.5℃。',
      pastHistory: '既往体健，否认重大疾病史。'
    }
  }
]

const MOCK_FIELD_RESOLVERS: Record<
  string,
  (patient: IMockHisPatient) => string | string[] | undefined | null
> = {
  'patient.name': patient => patient.name,
  'patient.gender': patient => patient.gender,
  'patient.age': patient => String(patient.age),
  'patient.idNo': patient => patient.idNo,
  'visit.no': patient => patient.visit.no,
  'visit.department': patient => patient.visit.department,
  'visit.ward': patient => patient.visit.ward,
  'visit.bedNo': patient => patient.visit.bedNo,
  'diagnosis.primary': patient => patient.diagnosis.primary,
  'diagnosis.secondary': patient => patient.diagnosis.secondary ?? '',
  'diagnosis.icdCode': patient => patient.diagnosis.icdCode ?? '',
  'vitals.temperature': patient => patient.vitals?.temperature ?? '',
  'vitals.pulse': patient => patient.vitals?.pulse ?? '',
  'vitals.breathing': patient => patient.vitals?.breathing ?? '',
  'vitals.bloodPressure': patient => patient.vitals?.bloodPressure ?? '',
  'lab.item': patient => patient.labs?.map(item => item.item) ?? [],
  'lab.result': patient => patient.labs?.map(item => item.result) ?? [],
  'exam.finding': patient => patient.exam?.finding ?? '',
  'exam.reportTime': patient => patient.exam?.reportTime ?? '',
  'order.name': patient => patient.orders?.map(order => order.name) ?? [],
  'order.dose': patient => patient.orders?.map(order => order.dose) ?? [],
  'order.frequency': patient => patient.orders?.map(order => order.frequency) ?? [],
  'order.route': patient => patient.orders?.map(order => order.route) ?? [],
  'notes.chiefComplaint': patient => patient.notes?.chiefComplaint ?? '',
  'notes.historyOfPresentIllness': patient => patient.notes?.historyOfPresentIllness ?? '',
  'notes.pastHistory': patient => patient.notes?.pastHistory ?? ''
}

function resolveFieldFromPatient(
  field: ITemplateDataAdapterRequestField,
  patient: IMockHisPatient
): string | string[] | null | undefined {
  const businessCode = field.metadata?.businessCode
  if (businessCode && MOCK_FIELD_RESOLVERS[businessCode]) {
    return MOCK_FIELD_RESOLVERS[businessCode](patient)
  }
  const exportPath = field.exportPath
  if (exportPath && MOCK_FIELD_RESOLVERS[exportPath]) {
    return MOCK_FIELD_RESOLVERS[exportPath](patient)
  }
  // notes 字典通过 fieldId 兜底匹配，便于模板作者用业务命名直接关联
  if (patient.notes?.[field.fieldId] != null) {
    return patient.notes[field.fieldId]
  }
  return undefined
}

export interface ICreateMockHisAdapterOptions {
  id?: string
  label?: string
  patients?: IMockHisPatient[]
  dataSources?: string[]
  /** 模拟延迟毫秒数，便于在 UI 上观察异步链路 */
  latencyMs?: number
}

export function createMockHisAdapter(
  options: ICreateMockHisAdapterOptions = {}
): ITemplateDataAdapter & { listPatients(): IMockHisPatient[]; getPatient(id: string): IMockHisPatient | undefined } {
  const patients = options.patients?.length ? options.patients : DEFAULT_MOCK_PATIENTS

  const adapter: ITemplateDataAdapter & {
    listPatients(): IMockHisPatient[]
    getPatient(id: string): IMockHisPatient | undefined
  } = {
    id: options.id ?? 'mock-his',
    label: options.label ?? '模拟 HIS/EHR',
    description: '内置 mock HIS/EHR 业务数据，按字段 businessCode / exportPath 解析',
    dataSources: options.dataSources?.length ? options.dataSources : MOCK_HIS_DATA_SOURCES,
    listPatients() {
      return patients.slice()
    },
    getPatient(id: string) {
      return patients.find(patient => patient.id === id)
    },
    async resolve(request) {
      if (options.latencyMs && options.latencyMs > 0) {
        await new Promise(resolve => setTimeout(resolve, options.latencyMs))
      }
      const patientId =
        (request.context.variables?.patientId as string | undefined) ??
        (request.context.scope?.patientId as string | undefined)
      const diagnostics: string[] = []

      if (!patientId) {
        diagnostics.push('未指定 patientId，无法定位测试病历')
        return { values: [], diagnostics }
      }

      const patient = patients.find(item => item.id === patientId)
      if (!patient) {
        diagnostics.push(`未找到病人 ${patientId}`)
        return { values: [], diagnostics }
      }

      const values: ITemplateDataAdapterFieldResolution[] = []
      request.fields.forEach(field => {
        const resolved = resolveFieldFromPatient(field, patient)
        if (resolved === undefined) {
          diagnostics.push(`字段 ${field.fieldId} 未在 mock 数据中找到对应映射`)
          return
        }
        values.push({
          fieldId: field.fieldId,
          value:
            Array.isArray(resolved)
              ? resolved.map(item => (item == null ? '' : String(item)))
              : resolved == null
                ? null
                : String(resolved)
        })
      })

      return { values, diagnostics }
    }
  }

  return adapter
}

/** 模板平台默认注册一个 mock HIS adapter，方便业务集成方在控制台立刻看到效果 */
templateDataAdapterRegistry.register(createMockHisAdapter())
