import { describe, expect, it } from 'vitest'
import { templateRegistry } from '@/editor/template/TemplateRegistry'
import type { ITemplateSchema } from '@/editor'

function createSchema(id: string): ITemplateSchema {
  return {
    version: '1.0.0',
    id,
    name: '发布流程模板',
    blocks: [
      {
        type: 'fieldRow',
        fields: [
          {
            id: `${id}_name`,
            type: 'text',
            label: '姓名'
          }
        ]
      }
    ]
  }
}

describe('template registry lifecycle', () => {
  it('自定义模板默认进入草稿，并可送审发布撤回', () => {
    const id = `registry-lifecycle-${Date.now()}`
    templateRegistry.register(createSchema(id), '住院记录', false)

    expect(templateRegistry.getEntry(id)?.status).toBe('draft')

    expect(templateRegistry.submitForReview(id)).toEqual([])
    expect(templateRegistry.getEntry(id)?.status).toBe('review')

    expect(templateRegistry.publish(id)).toEqual([])
    expect(templateRegistry.getEntry(id)?.status).toBe('published')
    expect(templateRegistry.getPublished().some(item => item.id === id)).toBe(true)

    expect(templateRegistry.withdraw(id)).toEqual([])
    expect(templateRegistry.getEntry(id)?.status).toBe('archived')
  })

  it('发布前会拦截引用不存在字段的规则', () => {
    const id = `registry-invalid-${Date.now()}`
    const schema = createSchema(id)
    const block = schema.blocks[0]
    if (block.type === 'fieldRow') {
      block.fields[0].rules = [
        {
          type: 'visibility',
          condition: {
            field: 'missingField',
            operator: 'equals',
            value: '1'
          }
        }
      ]
    }

    templateRegistry.register(schema, '住院记录', false)
    const errors = templateRegistry.publish(id)

    expect(errors).toHaveLength(1)
    expect(templateRegistry.getEntry(id)?.status).toBe('draft')
  })

  it('已发布模板再次保存后回到草稿', () => {
    const id = `registry-edit-${Date.now()}`
    const schema = createSchema(id)
    templateRegistry.register(schema, '住院记录', false)
    templateRegistry.publish(id)

    templateRegistry.register(
      {
        ...schema,
        description: '重新编辑后的说明'
      },
      '住院记录',
      false
    )

    expect(templateRegistry.getEntry(id)?.status).toBe('draft')
  })

  it('可以复制为草稿新版本', () => {
    const id = `registry-clone-${Date.now()}`
    const schema = createSchema(id)
    templateRegistry.register(schema, '住院记录', false)

    const cloned = templateRegistry.cloneAsDraft(id)

    expect(cloned?.id).not.toBe(id)
    expect(cloned?.name).toContain('副本')
    expect(templateRegistry.getEntry(cloned!.id)?.status).toBe('draft')
  })

  it('可以回滚到历史快照并生成新的草稿版本', () => {
    const id = `registry-rollback-${Date.now()}`
    const schema = createSchema(id)
    templateRegistry.register(schema, '住院记录', false)
    templateRegistry.publish(id)
    templateRegistry.addTrialRun(id, {
      scenario: '线上版本验证',
      status: 'passed',
      summary: '历史版本已验证'
    })

    templateRegistry.register(
      {
        ...schema,
        description: '第二版'
      },
      '住院记录',
      false
    )

    const entry = templateRegistry.getEntry(id)!
    const rolledBack = templateRegistry.rollbackToVersion(id, 0)

    expect(rolledBack?.description).toBeUndefined()
    expect(templateRegistry.getEntry(id)?.status).toBe('draft')
    expect(templateRegistry.getTrialRuns(id)).toHaveLength(0)
    expect(templateRegistry.getEntry(id)!.versionHistory.length).toBeGreaterThan(
      entry.versionHistory.length
    )
  })

  it('发布流程会记录说明，并保留最近已发布版本快照', () => {
    const id = `registry-release-note-${Date.now()}`
    const schema = createSchema(id)
    templateRegistry.register(schema, '住院记录', false)

    expect(templateRegistry.submitForReview(id, '提交科室审核')).toEqual([])
    expect(templateRegistry.publish(id, '首版上线')).toEqual([])

    templateRegistry.register(
      {
        ...schema,
        version: '1.1.0',
        description: '待发布新版本'
      },
      '住院记录',
      false,
      {
        note: '调整病程段落结构'
      }
    )

    const entry = templateRegistry.getEntry(id)!
    const latestPublished = templateRegistry.getLatestPublishedRecord(id)

    expect(entry.status).toBe('draft')
    expect(entry.versionHistory.some(record => record.note === '提交科室审核')).toBe(true)
    expect(entry.versionHistory.some(record => record.note === '首版上线')).toBe(true)
    expect(latestPublished?.version).toBe('1.0.0')
    expect(latestPublished?.note).toBe('首版上线')
    expect(latestPublished?.schemaSnapshot?.version).toBe('1.0.0')
  })

  it('可以从线上版本生成修订草稿并要求重新试运行', () => {
    const id = `registry-revision-${Date.now()}`
    const schema = createSchema(id)
    templateRegistry.register(schema, '住院记录', false)
    templateRegistry.addTrialRun(id, {
      scenario: '首版验证',
      status: 'passed',
      summary: '首版已通过'
    })
    templateRegistry.publish(id, '首版上线')

    templateRegistry.register(
      {
        ...schema,
        description: '存在临时改坏的工作版本'
      },
      '住院记录',
      false,
      {
        note: '错误改动'
      }
    )

    const revision = templateRegistry.createRevisionDraftFromPublished(id, {
      note: '基于线上版本生成修订草稿',
      operator: '模板管理员'
    })

    expect(revision?.description).toBeUndefined()
    expect(templateRegistry.getEntry(id)?.status).toBe('draft')
    expect(templateRegistry.getTrialRuns(id)).toHaveLength(0)
    expect(templateRegistry.getAuditLogs(id)[0]?.action).toBe('revision_draft')
  })

  it('会维护资产信息、试运行记录和操作日志', () => {
    const id = `registry-governance-${Date.now()}`
    const schema = createSchema(id)
    templateRegistry.register(schema, '住院记录', false, {
      asset: {
        department: '心内科',
        documentType: '入院记录',
        owner: '张医生'
      }
    })

    templateRegistry.updateAssetMetadata(id, {
      owner: '李医生',
      applicableRoles: ['医生']
    }, '模板管理员')
    const trialRun = templateRegistry.addTrialRun(id, {
      scenario: '住院入院记录',
      patientId: 'P-1001',
      department: '心内科',
      status: 'passed',
      summary: 'mock 患者回填通过'
    }, '模板管理员')
    templateRegistry.publish(id, {
      reason: '首版上线',
      impactScope: '心内科住院病历',
      verifier: '质控员',
      note: '验证通过后发布'
    })

    const entry = templateRegistry.getEntry(id)!
    expect(entry.asset?.owner).toBe('李医生')
    expect(trialRun?.scenario).toBe('住院入院记录')
    expect(templateRegistry.getTrialRuns(id)).toHaveLength(1)
    expect(templateRegistry.getLatestPublishedRecord(id)?.releaseNote?.verifier).toBe('质控员')
    expect(templateRegistry.getAuditLogs(id).some(record => record.action === 'asset_update')).toBe(true)
    expect(templateRegistry.getAuditLogs(id).some(record => record.action === 'trial_run')).toBe(true)
    expect(templateRegistry.getAuditLogs(id).some(record => record.action === 'publish')).toBe(true)
  })

  it('刷新后本地保存的同 id 模板可以覆盖内置模板', () => {
    const id = `registry-storage-override-${Date.now()}`
    const builtInSchema = createSchema(id)
    const customSchema = {
      ...createSchema(id),
      name: '本地覆盖后的模板',
      description: '刷新后应保留'
    }
    const now = Date.now()

    templateRegistry.register(builtInSchema, '住院记录', true)
    localStorage.setItem('canvas-editor:templates', JSON.stringify([
      {
        schema: customSchema,
        category: '自定义住院记录',
        builtIn: false,
        createdAt: now,
        updatedAt: now,
        status: 'draft',
        versionHistory: []
      }
    ]))

    templateRegistry.loadFromStorage()

    expect(templateRegistry.getEntry(id)?.builtIn).toBe(false)
    expect(templateRegistry.getEntry(id)?.category).toBe('自定义住院记录')
    expect(templateRegistry.getEntry(id)?.schema.name).toBe('本地覆盖后的模板')

    localStorage.removeItem('canvas-editor:templates')
  })

  it('支持批量导入并保留失败项结果', () => {
    const firstId = `registry-import-batch-${Date.now()}-1`
    const secondId = `registry-import-batch-${Date.now()}-2`
    const result = templateRegistry.importSchemas(
      JSON.stringify([
        createSchema(firstId),
        {
          ...createSchema(secondId),
          name: '第二个导入模板'
        },
        {
          id: 'invalid-template'
        }
      ]),
      '批量导入'
    )

    expect(result.imported).toHaveLength(2)
    expect(result.imported.map(item => item.mode)).toEqual([
      'created',
      'created'
    ])
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].message).toContain('缺少必填字段')
    expect(templateRegistry.getEntry(firstId)?.category).toBe('批量导入')
    expect(templateRegistry.getEntry(secondId)?.schema.name).toBe('第二个导入模板')
  })
})