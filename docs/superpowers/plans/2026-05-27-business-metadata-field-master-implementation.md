# 字段主数据管理台实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将现有业务字段中心升级为字段主数据管理台，建立业务元数据主记录、模板字段绑定关系和模板侧绑定入口。

**架构：** 平台层新增字段主数据 domain service 作为业务元数据唯一主源；编辑器模板层仅新增 `metadataFieldId` 和元数据解析 helper，通过可注入快照解析主数据；管理台和模板设计器分别消费同一套主数据快照与绑定能力，形成“主数据维护 + 模板绑定 + 运行时兼容”的闭环。

**技术栈：** TypeScript、Vitest、现有 platform module/view model 模式、现有 template runtime/index 结构

---

## 文件结构

### 新建文件

- `src/platform/emr-workbench/domain/business-metadata-domain-service.ts`
  - 字段主数据实体、绑定实体、冲突检测、候选生成、绑定/解绑 API
- `src/editor/template/TemplateFieldMetadataResolver.ts`
  - 基于 `metadataFieldId` + 主数据快照解析字段元数据，封装兼容回退逻辑
- `tests/platform/businessMetadataDomainService.test.ts`
  - 字段主数据 service 的 CRUD、绑定、候选生成、冲突检测测试
- `tests/platform/businessFieldCenterMasterViewModel.test.ts`
  - 字段主数据管理台 view model 的摘要、筛选、风险和关联视图测试
- `tests/template/templateFieldMetadataResolver.test.ts`
  - 主数据优先解析、失效绑定回退、监听事件与标签保留测试
- `tests/components/propertiesPanelMetadataBinding.test.ts`
  - 属性栏在未绑定、已绑定、失效绑定状态下的渲染与交互测试

### 修改文件

- `src/platform/emr-workbench/domain/index.ts`
  - 导出字段主数据 domain service 与相关类型
- `src/platform/emr-workbench/modules/business-field-center/service.ts`
  - 从“字段资产聚合”升级为“主数据 + 绑定关系 + 候选字段”视图模型
- `src/platform/emr-workbench/modules/business-field-center/view.ts`
  - 改为字段主数据管理台 UI，展示主数据列表、详情/风险、绑定候选
- `src/platform/emr-workbench/modules/business-field-center/index.ts`
  - 调整 module 输入，接入主数据 service 快照和绑定动作
- `src/editor/template/index.ts`
  - 为 `ITemplateFieldMetadata` 增加 `metadataFieldId`
- `src/editor/template/TemplateRuntime.ts`
  - 使用元数据解析 helper 构建运行时索引，并支持可注入主数据快照
- `src/editor/index.ts`
  - 导出新解析 helper 或相关类型（若测试和外层模块需要）
- `src/components/template-designer/TemplateDesigner.ts`
  - 给 `PropertiesPanel` 注入主数据查询/绑定上下文
- `src/components/template-designer/PropertiesPanel.ts`
  - 将“业务元数据”区改为“主数据绑定 + 兼容元数据提示”模式
- `src/components/template-designer/TemplateManager.ts`
  - 实例化字段主数据 service、打开管理台时同步模板资产、在设计器与管理台之间复用绑定能力
- `tests/template/runtime.test.ts`
  - 补运行时主数据快照优先解析的回归测试
- `tests/platform/businessFieldQuickPreset.test.ts`
  - 调整字段快配到“绑定优先 / 生成主数据候选次之”的断言
- `docs/下一阶段迭代工作Todolist.md`
  - 在功能实现完成后同步本阶段进展

## 任务 1：建立字段主数据 domain service

**文件：**
- 创建：`src/platform/emr-workbench/domain/business-metadata-domain-service.ts`
- 修改：`src/platform/emr-workbench/domain/index.ts`
- 测试：`tests/platform/businessMetadataDomainService.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
import { describe, expect, it } from 'vitest'
import {
  BusinessMetadataDomainService,
  type IBusinessMetadataFieldInput
} from '@/platform/emr-workbench/domain'

describe('BusinessMetadataDomainService', () => {
  it('会创建字段主数据并允许模板字段绑定和解绑', () => {
    const service = new BusinessMetadataDomainService()
    const field = service.createField({
      code: 'patient.name',
      name: '患者姓名',
      group: '基本信息',
      dataSource: 'his.patient',
      permission: 'patient.read.basic',
      exportPath: 'patient.name'
    } satisfies IBusinessMetadataFieldInput)

    service.bindTemplateField({
      templateId: 'tpl-1',
      fieldId: 'field-1',
      metadataFieldId: field.id
    })

    expect(service.getFieldUsage(field.id).map(item => item.fieldId)).toEqual(['field-1'])

    service.unbindTemplateField({ templateId: 'tpl-1', fieldId: 'field-1' })
    expect(service.getFieldUsage(field.id)).toEqual([])
  })

  it('会从模板字段资产生成候选并识别同码冲突', () => {
    const service = new BusinessMetadataDomainService()

    const snapshot = service.buildFieldCandidatesFromTemplates([
      {
        templateId: 'tpl-1',
        templateName: '入院记录',
        fieldId: 'field-a',
        label: '患者姓名',
        metadata: {
          businessCode: 'patient.name',
          group: '基本信息',
          dataSource: 'his.patient',
          permission: 'patient.read.basic',
          exportPath: 'patient.name'
        }
      },
      {
        templateId: 'tpl-2',
        templateName: '病程记录',
        fieldId: 'field-b',
        label: '患者姓名',
        metadata: {
          businessCode: 'patient.name',
          group: '基本信息',
          dataSource: 'emr.patient',
          permission: 'patient.read.basic',
          exportPath: 'patient.name'
        }
      }
    ])

    expect(snapshot.candidates).toHaveLength(1)
    expect(snapshot.conflicts[0]).toMatchObject({
      code: 'patient.name',
      reason: 'dataSourceMismatch'
    })
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/platform/businessMetadataDomainService.test.ts --threads=false`
预期：FAIL，报错找不到 `BusinessMetadataDomainService` 或相关导出。

- [ ] **步骤 3：编写最少实现代码**

```ts
export interface IBusinessMetadataField {
  id: string
  code: string
  name: string
  group: string
  dataSource: string
  permission: string
  exportPath: string
  tags?: string[]
  status: 'active' | 'inactive'
  description?: string
  createdAt: number
  updatedAt: number
}

export class BusinessMetadataDomainService {
  private readonly fields = new Map<string, IBusinessMetadataField>()
  private readonly bindings = new Map<string, ITemplateFieldBinding>()

  createField(input: IBusinessMetadataFieldInput) {
    const now = Date.now()
    const field: IBusinessMetadataField = {
      id: `metadata:${input.code}:${now}`,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ...input
    }
    this.fields.set(field.id, field)
    return field
  }

  bindTemplateField(input: ITemplateFieldBindingInput) {
    this.bindings.set(`${input.templateId}:${input.fieldId}`, {
      ...input,
      bindMode: 'reference',
      boundAt: Date.now()
    })
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/platform/businessMetadataDomainService.test.ts --threads=false`
预期：PASS，`2 passed`。

- [ ] **步骤 5：Commit**

```bash
git add tests/platform/businessMetadataDomainService.test.ts src/platform/emr-workbench/domain/business-metadata-domain-service.ts src/platform/emr-workbench/domain/index.ts
git commit -m "feat: add business metadata domain service"
```

## 任务 2：补齐模板字段主数据引用与解析 helper

**文件：**
- 创建：`src/editor/template/TemplateFieldMetadataResolver.ts`
- 修改：`src/editor/template/index.ts`
- 修改：`src/editor/template/TemplateRuntime.ts`
- 修改：`src/editor/index.ts`
- 测试：`tests/template/templateFieldMetadataResolver.test.ts`
- 测试：`tests/template/runtime.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
import { describe, expect, it } from 'vitest'
import {
  resolveTemplateFieldMetadata,
  buildTemplateFieldRuntimeIndex,
  type ITemplateSchema
} from '@/editor'

describe('resolveTemplateFieldMetadata', () => {
  it('优先返回 metadataFieldId 对应的主数据记录，并保留监听事件和标签', () => {
    const resolved = resolveTemplateFieldMetadata(
      {
        metadataFieldId: 'meta-1',
        businessCode: 'legacy.patient.name',
        listeners: ['syncPatient'],
        tags: ['legacy-tag']
      },
      {
        'meta-1': {
          id: 'meta-1',
          code: 'patient.name',
          name: '患者姓名',
          group: '基本信息',
          dataSource: 'his.patient',
          permission: 'patient.read.basic',
          exportPath: 'patient.name',
          tags: ['master-tag']
        }
      }
    )

    expect(resolved).toMatchObject({
      metadataFieldId: 'meta-1',
      businessCode: 'patient.name',
      group: '基本信息',
      dataSource: 'his.patient',
      permission: 'patient.read.basic',
      exportPath: 'patient.name',
      listeners: ['syncPatient'],
      tags: ['master-tag']
    })
  })
})

describe('buildTemplateFieldRuntimeIndex', () => {
  it('在传入主数据快照时按主数据业务编码建索引', () => {
    const schema: ITemplateSchema = {
      version: '1.0.0',
      id: 'tpl-runtime',
      name: '运行时模板',
      blocks: [{
        type: 'fieldRow',
        fields: [{
          id: 'field-1',
          type: 'text',
          metadata: { metadataFieldId: 'meta-1', businessCode: 'legacy.patient.name' }
        }]
      }]
    }

    const index = buildTemplateFieldRuntimeIndex(schema, {
      metadataFieldsById: {
        'meta-1': {
          id: 'meta-1',
          code: 'patient.name',
          name: '患者姓名',
          group: '基本信息',
          dataSource: 'his.patient',
          permission: 'patient.read.basic',
          exportPath: 'patient.name'
        }
      }
    })

    expect(index.byBusinessCode.get('patient.name')?.[0].field.id).toBe('field-1')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/template/templateFieldMetadataResolver.test.ts tests/template/runtime.test.ts --threads=false`
预期：FAIL，报错缺少 `resolveTemplateFieldMetadata` 或 `buildTemplateFieldRuntimeIndex` 新签名。

- [ ] **步骤 3：编写最少实现代码**

```ts
export interface ITemplateMetadataFieldSnapshot {
  id: string
  code: string
  name: string
  group: string
  dataSource: string
  permission: string
  exportPath: string
  tags?: string[]
}

export function resolveTemplateFieldMetadata(
  metadata: ITemplateFieldMetadata | undefined,
  metadataFieldsById?: Record<string, ITemplateMetadataFieldSnapshot>
): ITemplateFieldMetadata | undefined {
  if (!metadata) return metadata
  const master = metadata.metadataFieldId
    ? metadataFieldsById?.[metadata.metadataFieldId]
    : undefined
  if (!master) return metadata

  return {
    ...metadata,
    businessCode: master.code,
    group: master.group,
    dataSource: master.dataSource,
    permission: master.permission,
    exportPath: master.exportPath,
    tags: master.tags ?? metadata.tags
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/template/templateFieldMetadataResolver.test.ts tests/template/runtime.test.ts --threads=false`
预期：PASS，新增主数据解析相关断言全部通过。

- [ ] **步骤 5：Commit**

```bash
git add tests/template/templateFieldMetadataResolver.test.ts tests/template/runtime.test.ts src/editor/template/index.ts src/editor/template/TemplateFieldMetadataResolver.ts src/editor/template/TemplateRuntime.ts src/editor/index.ts
git commit -m "feat: resolve template metadata from master fields"
```

## 任务 3：升级字段主数据管理台 view model 与视图

**文件：**
- 修改：`src/platform/emr-workbench/modules/business-field-center/service.ts`
- 修改：`src/platform/emr-workbench/modules/business-field-center/view.ts`
- 修改：`src/platform/emr-workbench/modules/business-field-center/index.ts`
- 测试：`tests/platform/businessFieldCenterMasterViewModel.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
import { describe, expect, it } from 'vitest'
import { buildBusinessFieldCenterViewModel } from '@/platform/emr-workbench/modules/business-field-center'

describe('buildBusinessFieldCenterViewModel', () => {
  it('会输出主数据摘要、绑定字段和冲突风险', () => {
    const model = buildBusinessFieldCenterViewModel({
      metadataFields: [{
        id: 'meta-1',
        code: 'patient.name',
        name: '患者姓名',
        group: '基本信息',
        dataSource: 'his.patient',
        permission: 'patient.read.basic',
        exportPath: 'patient.name',
        status: 'active',
        createdAt: 1,
        updatedAt: 1
      }],
      bindings: [{
        templateId: 'tpl-1',
        templateName: '入院记录',
        templateCategory: '住院',
        fieldId: 'field-1',
        fieldLabel: '患者姓名',
        metadataFieldId: 'meta-1'
      }],
      candidates: [],
      conflicts: [{ code: 'patient.name', reason: 'dataSourceMismatch', templateIds: ['tpl-1', 'tpl-2'] }],
      filters: {
        keyword: '',
        group: '',
        dataSource: '',
        permission: '',
        scope: 'all'
      }
    })

    expect(model.summary.masterFieldText).toBe('1/1')
    expect(model.fields[0]).toMatchObject({
      name: '患者姓名',
      bindingCount: 1
    })
    expect(model.risks[0]).toMatchObject({ code: 'patient.name' })
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/platform/businessFieldCenterMasterViewModel.test.ts --threads=false`
预期：FAIL，现有 `buildBusinessFieldCenterViewModel` 还不接受主数据输入。

- [ ] **步骤 3：编写最少实现代码**

```ts
export interface IBusinessFieldCenterMasterFieldItem {
  id: string
  code: string
  name: string
  group: string
  dataSource: string
  permission: string
  exportPath: string
  bindingCount: number
  statusText: string
}

export function buildBusinessFieldCenterViewModel(args: {
  metadataFields: IBusinessMetadataField[]
  bindings: IBusinessMetadataTemplateBindingView[]
  candidates: IBusinessMetadataFieldCandidate[]
  conflicts: IBusinessMetadataConflict[]
  filters: IBusinessFieldCenterFilters
}) {
  // 基于主数据字段构建摘要、筛选结果与风险列表
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/platform/businessFieldCenterMasterViewModel.test.ts --threads=false`
预期：PASS，管理台摘要和风险清单断言通过。

- [ ] **步骤 5：Commit**

```bash
git add tests/platform/businessFieldCenterMasterViewModel.test.ts src/platform/emr-workbench/modules/business-field-center/service.ts src/platform/emr-workbench/modules/business-field-center/view.ts src/platform/emr-workbench/modules/business-field-center/index.ts
git commit -m "feat: upgrade business field center to master data view"
```

## 任务 4：接入 TemplateManager 与属性栏绑定入口

**文件：**
- 修改：`src/components/template-designer/TemplateManager.ts`
- 修改：`src/components/template-designer/TemplateDesigner.ts`
- 修改：`src/components/template-designer/PropertiesPanel.ts`
- 测试：`tests/components/propertiesPanelMetadataBinding.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
import { describe, expect, it } from 'vitest'
import { PropertiesPanel } from '@/components/template-designer/PropertiesPanel'

describe('PropertiesPanel metadata binding', () => {
  it('字段已绑定主数据时显示继承摘要并隐藏核心业务元数据输入框', () => {
    const panel = new PropertiesPanel({
      onBlockChange: () => undefined,
      onFieldChange: () => undefined,
      onAddField: () => undefined,
      getMetadataFields: () => [{
        id: 'meta-1',
        code: 'patient.name',
        name: '患者姓名',
        group: '基本信息',
        dataSource: 'his.patient',
        permission: 'patient.read.basic',
        exportPath: 'patient.name',
        status: 'active',
        createdAt: 1,
        updatedAt: 1
      }]
    })

    panel.update([
      { type: 'fieldRow', fields: [{
        id: 'field-1',
        type: 'text',
        label: '患者姓名',
        metadata: { metadataFieldId: 'meta-1' }
      }] }
    ], { kind: 'field', blockIndex: 0, fieldId: 'field-1' })

    expect(panel.element.textContent).toContain('已绑定主数据')
    expect(panel.element.textContent).toContain('patient.name')
    expect(panel.element.textContent).not.toContain('业务编码')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/components/propertiesPanelMetadataBinding.test.ts --threads=false`
预期：FAIL，`PropertiesPanel` 暂无主数据绑定能力。

- [ ] **步骤 3：编写最少实现代码**

```ts
export interface IPropertiesPanelOptions {
  onBlockChange: ...
  onFieldChange: ...
  onAddField: ...
  getMetadataFields?: () => IBusinessMetadataField[]
  onBindMetadataField?: (fieldId: string, metadataFieldId: string) => void
  onUnbindMetadataField?: (fieldId: string) => void
}

private _renderMetadataEditor(field: ITemplateField, onChange: (f: ITemplateField) => void) {
  const metadata = field.metadata ?? {}
  const metadataFields = this.options.getMetadataFields?.() ?? []
  const bound = metadata.metadataFieldId
    ? metadataFields.find(item => item.id === metadata.metadataFieldId)
    : undefined
  if (bound) {
    return card('主数据绑定', [
      row('已绑定主数据', readonlyText(`${bound.name} / ${bound.code}`)),
      row('继承信息', readonlyText(`${bound.group} / ${bound.dataSource} / ${bound.permission}`))
    ])
  }
  // 未绑定时渲染搜索与绑定入口
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/components/propertiesPanelMetadataBinding.test.ts --threads=false`
预期：PASS，属性栏已绑定和未绑定状态断言通过。

- [ ] **步骤 5：Commit**

```bash
git add tests/components/propertiesPanelMetadataBinding.test.ts src/components/template-designer/TemplateManager.ts src/components/template-designer/TemplateDesigner.ts src/components/template-designer/PropertiesPanel.ts
git commit -m "feat: add metadata field binding in template designer"
```

## 任务 5：把字段快配调整为绑定优先并收口验证

**文件：**
- 修改：`src/editor/template/TemplateFieldQuickPreset.ts`
- 修改：`src/platform/emr-workbench/modules/business-field-center/presets.ts`
- 修改：`tests/platform/businessFieldQuickPreset.test.ts`
- 修改：`docs/下一阶段迭代工作Todolist.md`

- [ ] **步骤 1：编写失败的测试**

```ts
import { describe, expect, it } from 'vitest'
import {
  recommendBusinessFieldQuickPresets,
  type IBusinessFieldQuickPresetTarget
} from '@/platform/emr-workbench/modules'

describe('business field quick presets', () => {
  it('命中主数据时优先返回绑定建议而不是直接覆盖业务编码', () => {
    const target: IBusinessFieldQuickPresetTarget = {
      id: 'patientName',
      label: '患者姓名',
      metadata: { metadataFieldId: 'meta-1' }
    }

    const recommendations = recommendBusinessFieldQuickPresets(target)
    expect(recommendations[0]?.id).toBe('patient-name')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/platform/businessFieldQuickPreset.test.ts --threads=false`
预期：FAIL，当前快配逻辑不了解 `metadataFieldId`。

- [ ] **步骤 3：编写最少实现代码**

```ts
function getPresetScore(target: IBusinessFieldQuickPresetTarget, preset: IBusinessFieldQuickPresetDefinition): number {
  let score = 0
  if (target.metadata?.metadataFieldId) {
    score += 32
  }
  // 保留现有 businessCode / exportPath / label 命中逻辑
  return score
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/platform/businessFieldQuickPreset.test.ts --threads=false`
预期：PASS，快配推荐继续工作，并兼容主数据绑定场景。

- [ ] **步骤 5：运行整体验证并同步进展文档**

运行：`npx vitest run tests/platform/businessMetadataDomainService.test.ts tests/platform/businessFieldCenterMasterViewModel.test.ts tests/platform/businessFieldQuickPreset.test.ts tests/template/templateFieldMetadataResolver.test.ts tests/template/runtime.test.ts tests/components/propertiesPanelMetadataBinding.test.ts --threads=false`
预期：PASS，所有新增和回归测试通过。

然后更新：`docs/下一阶段迭代工作Todolist.md`

```bash
git add tests/platform/businessFieldQuickPreset.test.ts src/editor/template/TemplateFieldQuickPreset.ts src/platform/emr-workbench/modules/business-field-center/presets.ts docs/下一阶段迭代工作Todolist.md
git commit -m "feat: complete field master data management flow"
```

## 自检结果

- 规格覆盖度：主数据实体、模板字段绑定、管理台升级、模板设计器绑定、兼容运行时、冲突检测、测试和进展同步均有对应任务。
- 占位符扫描：计划内未使用 TODO、待定、后续实现、类似任务 N 等占位描述。
- 类型一致性：统一使用 `metadataFieldId` 表示模板字段到主数据字段的引用，统一使用 `BusinessMetadataDomainService` 作为领域服务名。

## 执行交接

计划已完成并保存到 `docs/superpowers/plans/2026-05-27-business-metadata-field-master-implementation.md`。

当前会话直接按内联执行推进，从任务 1 开始，严格走 TDD：先写失败测试，再写最少实现，再跑通过验证。