import { describe, expect, it } from 'vitest'
import {
  HisIntegrationDomainService,
  type IHisConnector
} from '@/platform/emr-workbench/domain'

describe('HisIntegrationDomainService', () => {
  it('会通过标准连接器创建 HIS 上下文会话并记录读写追踪', async () => {
    const service = new HisIntegrationDomainService()
    const connector: IHisConnector = {
      id: 'his-sandbox',
      label: 'HIS 沙箱连接器',
      mode: 'sandbox',
      authType: 'trustedTicket',
      dataSources: ['his.patient'],
      capabilities: ['context', 'read', 'writeback'],
      async resolveContext(request) {
        return {
          patientId: String(request.launchContext.scope.patientId),
          encounterId: String(request.launchContext.scope.encounterId),
          departmentId: 'cardiology',
          operatorId: 'doctor-1',
          operatorName: '张医生',
          roleCodes: ['doctor'],
          taskId: 'task-1'
        }
      },
      async read(request) {
        return {
          values: request.fields.map(field => ({
            fieldId: field.fieldId,
            value: field.businessCode === 'patient.name' ? '张三' : null
          })),
          diagnostics: ['命中 HIS 沙箱患者上下文']
        }
      },
      async writeBack(request) {
        return {
          accepted: true,
          externalRecordId: `HIS-${request.payload.documentId}`,
          message: '已回写 HIS 沙箱'
        }
      }
    }

    service.registerConnector(connector)

    const session = await service.createLaunchSession({
      connectorId: 'his-sandbox',
      launchMode: 'embedded',
      trustedTicket: 'ticket-1',
      scope: {
        patientId: 'P-1001',
        encounterId: 'V-1'
      }
    })

    expect(session).toMatchObject({
      connectorId: 'his-sandbox',
      launchMode: 'embedded',
      status: 'active',
      context: {
        patientId: 'P-1001',
        encounterId: 'V-1',
        operatorName: '张医生'
      }
    })

    const readResult = await service.readFields(session.id, [
      {
        fieldId: 'field-1',
        businessCode: 'patient.name',
        dataSource: 'his.patient'
      }
    ])

    expect(readResult.values).toEqual([
      {
        fieldId: 'field-1',
        value: '张三'
      }
    ])
    expect(service.listFieldDiagnostics()).toEqual([
      expect.objectContaining({
        sessionId: session.id,
        fieldId: 'field-1',
        businessCode: 'patient.name',
        dataSource: 'his.patient',
        value: '张三'
      })
    ])

    const writeBackResult = await service.writeBack(session.id, {
      documentId: 'doc-1',
      status: 'archived',
      structuredValues: {
        patient: {
          name: '张三'
        }
      }
    })

    expect(writeBackResult).toMatchObject({
      accepted: true,
      externalRecordId: 'HIS-doc-1'
    })
    expect(service.listTraceRecords().map(item => item.action)).toEqual([
      'launch',
      'read',
      'writeBack'
    ])
  })

  it('会将平台协同状态转换为 HIS 状态编码并执行幂等回写', async () => {
    const service = new HisIntegrationDomainService()
    const writeBackPayloads: Array<{ status: string; idempotencyKey: string }> = []
    const connector: IHisConnector = {
      id: 'his-sandbox',
      label: 'HIS 沙箱连接器',
      mode: 'sandbox',
      authType: 'trustedTicket',
      dataSources: ['his.document'],
      capabilities: ['context', 'writeback'],
      resolveContext() {
        return {
          patientId: 'P-1001',
          encounterId: 'V-1',
          operatorName: '张医生'
        }
      },
      read() {
        return { values: [] }
      },
      writeBack(request) {
        writeBackPayloads.push({
          status: request.payload.status,
          idempotencyKey: request.idempotencyKey
        })
        return {
          accepted: true,
          externalRecordId: `HIS-${request.payload.documentId}`,
          message: `已回写 ${request.payload.status}`
        }
      }
    }

    service.registerConnector(connector)
    const session = await service.createLaunchSession({
      connectorId: 'his-sandbox',
      launchMode: 'embedded',
      trustedTicket: 'ticket-1',
      scope: {
        patientId: 'P-1001',
        encounterId: 'V-1'
      }
    })

    const rule = service.getWorkflowStatusRule('pendingArchive')
    const result = await service.syncDocumentStatus(session.id, {
      documentId: 'doc-1',
      status: 'pendingArchive',
      structuredValues: {
        patientName: '张三'
      },
      qualityConclusion: '质控通过，待归档',
      archiveSnapshotId: 'archive-snapshot-1'
    })

    expect(rule).toMatchObject({
      status: 'pendingArchive',
      hisStatusCode: 'PENDING_ARCHIVE',
      label: '待归档'
    })
    expect(result).toMatchObject({
      accepted: true,
      externalRecordId: 'HIS-doc-1'
    })
    expect(writeBackPayloads).toEqual([
      {
        status: 'PENDING_ARCHIVE',
        idempotencyKey: `${session.id}:doc-1:pendingArchive`
      }
    ])
    expect(service.listTraceRecords().map(item => item.action)).toEqual([
      'launch',
      'writeBack'
    ])
  })

  it('会按医院映射执行字段读取并生成对接验收报告', async () => {
    const service = new HisIntegrationDomainService()
    const connector: IHisConnector = {
      id: 'his-sandbox',
      label: 'HIS 沙箱连接器',
      mode: 'sandbox',
      authType: 'trustedTicket',
      dataSources: ['his.patient'],
      capabilities: ['context', 'read', 'writeback'],
      resolveContext() {
        return {
          patientId: 'P-1001',
          encounterId: 'V-1',
          operatorName: '张医生'
        }
      },
      read(request) {
        return {
          values: request.fields.map(field => ({
            fieldId: field.fieldId,
            value: field.businessCode === 'PAT_NAME' ? '张三' : null,
            note: field.businessCode === 'PAT_NAME' ? undefined : '沙箱未返回'
          }))
        }
      },
      writeBack() {
        return {
          accepted: true,
          externalRecordId: 'HIS-doc-1'
        }
      }
    }

    service.registerConnector(connector)
    const session = await service.createLaunchSession({
      connectorId: 'his-sandbox',
      launchMode: 'embedded',
      trustedTicket: 'ticket-1',
      scope: {
        patientId: 'P-1001',
        encounterId: 'V-1'
      }
    })

    await service.readMappedFields(session.id, [
      {
        metadataFieldId: 'metadata:patient.name',
        fieldId: 'field-name',
        label: '患者姓名',
        dataSource: 'his.patient',
        interfaceField: 'PAT_NAME',
        exportPath: 'patient.name'
      },
      {
        metadataFieldId: 'metadata:patient.gender',
        fieldId: 'field-gender',
        label: '性别',
        dataSource: 'his.patient',
        interfaceField: 'PAT_SEX',
        exportPath: 'patient.gender'
      }
    ])
    const report = service.buildAcceptanceReport({
      hospitalId: 'hospital-a',
      connectorId: 'his-sandbox',
      title: 'HIS 沙箱接入验收'
    })

    expect(service.listFieldDiagnostics()).toEqual([
      expect.objectContaining({
        fieldId: 'field-name',
        businessCode: 'PAT_NAME',
        value: '张三'
      }),
      expect.objectContaining({
        fieldId: 'field-gender',
        businessCode: 'PAT_SEX',
        value: null,
        note: '沙箱未返回'
      })
    ])
    expect(report.summary).toMatchObject({
      connectorCount: 1,
      sessionCount: 1,
      fieldDiagnosticCount: 2,
      coveredFieldCount: 1,
      fieldCoverageRate: 50,
      writeBackSuccessCount: 0
    })
    expect(report.sections.map(item => item.title)).toEqual([
      '上下文透传',
      '字段映射命中率',
      '状态回写',
      '错误与耗时'
    ])
  })

  it('会按回写策略重试失败请求并导出可重放样例数据', async () => {
    const service = new HisIntegrationDomainService()
    let acceptWriteBack = false
    let writeBackAttempts = 0
    const connector: IHisConnector = {
      id: 'his-sandbox',
      label: 'HIS 沙箱连接器',
      mode: 'sandbox',
      authType: 'trustedTicket',
      dataSources: ['his.document'],
      capabilities: ['context', 'writeback'],
      resolveContext() {
        return {
          patientId: 'P-1001',
          encounterId: 'V-1',
          operatorName: '张医生'
        }
      },
      read() {
        return { values: [] }
      },
      writeBack(request) {
        writeBackAttempts += 1
        if (!acceptWriteBack) {
          return {
            accepted: false,
            message: 'HIS 回写接口繁忙',
            retryable: true
          }
        }
        return {
          accepted: true,
          externalRecordId: `HIS-${request.payload.documentId}`,
          message: '人工重放成功'
        }
      }
    }

    service.registerConnector(connector)
    const session = await service.createLaunchSession({
      connectorId: 'his-sandbox',
      launchMode: 'embedded',
      trustedTicket: 'ticket-1',
      scope: {
        patientId: 'P-1001',
        encounterId: 'V-1'
      }
    })

    const failed = await service.syncDocumentStatusWithRetry(
      session.id,
      {
        documentId: 'doc-1',
        status: 'pendingArchive',
        qualityConclusion: '质控通过，待归档'
      },
      { maxAttempts: 2 }
    )
    const replayRecord = service.listReplayRecords()[0]

    expect(service.getWorkflowStatusRule('writing')).toMatchObject({
      deliveryMode: 'auditOnly'
    })
    expect(service.getWorkflowStatusRule('pendingArchive')).toMatchObject({
      deliveryMode: 'realtime'
    })
    expect(service.getWorkflowStatusRule('archived')).toMatchObject({
      deliveryMode: 'async'
    })
    expect(failed).toMatchObject({
      accepted: false,
      retryable: true
    })
    expect(writeBackAttempts).toBe(2)
    expect(replayRecord).toMatchObject({
      connectorId: 'his-sandbox',
      sessionId: session.id,
      status: 'failed',
      action: 'writeBack',
      attempts: 2,
      payload: {
        documentId: 'doc-1',
        status: 'PENDING_ARCHIVE',
        platformStatus: 'pendingArchive'
      }
    })

    acceptWriteBack = true
    const replayResult = await service.replayWriteBack(replayRecord.id)
    const replayBundle = service.exportReplayBundle({ connectorId: 'his-sandbox' })

    expect(replayResult).toMatchObject({
      accepted: true,
      externalRecordId: 'HIS-doc-1'
    })
    expect(service.listReplayRecords()[0]).toMatchObject({
      id: replayRecord.id,
      status: 'replayed',
      attempts: 3
    })
    expect(replayBundle.summary).toMatchObject({
      recordCount: 1,
      failedRecordCount: 0,
      replayedRecordCount: 1
    })
    expect(replayBundle.records[0]).toMatchObject({
      id: replayRecord.id,
      sampleContext: {
        patientId: 'P-1001',
        encounterId: 'V-1'
      }
    })
  })

  it('会生成医院级接入配置包并输出运维补偿快照', async () => {
    const service = new HisIntegrationDomainService()
    const connector: IHisConnector = {
      id: 'his-sandbox',
      label: 'HIS 沙箱连接器',
      mode: 'sandbox',
      authType: 'trustedTicket',
      dataSources: ['his.patient', 'his.document'],
      capabilities: ['context', 'read', 'writeback'],
      resolveContext(request) {
        return {
          patientId: String(request.launchContext.scope.patientId),
          encounterId: String(request.launchContext.scope.encounterId),
          departmentId: 'cardiology',
          operatorName: '张医生'
        }
      },
      read() {
        return { values: [] }
      },
      writeBack() {
        return {
          accepted: false,
          message: 'HIS 回写接口超时',
          retryable: true
        }
      }
    }

    service.registerConnector(connector)

    const hospitalPackage = service.upsertHospitalIntegrationPackage({
      hospitalId: 'hospital-a',
      packageName: 'A 院 HIS 标准接入包',
      connectorId: 'his-sandbox',
      connectorConfig: {
        mode: 'sandbox',
        authType: 'trustedTicket',
        launchModes: ['embedded', 'redirect'],
        dataSources: ['his.patient', 'his.document'],
        capabilities: ['context', 'read', 'writeback']
      },
      contextMappings: [
        { sourceKey: 'PAT_ID', targetKey: 'patientId', required: true },
        { sourceKey: 'VISIT_ID', targetKey: 'encounterId', required: true }
      ],
      fieldMappings: [
        {
          metadataFieldId: 'metadata:patient.name',
          dataSource: 'his.patient',
          interfaceField: 'PAT_NAME',
          exportPath: 'patient.name'
        }
      ],
      dictionaryMappings: [
        {
          dictionaryCode: 'gender',
          sourceValue: '1',
          targetValue: '男'
        }
      ],
      strategySwitches: {
        enableRetry: true,
        enableReplay: true,
        enableAudit: true
      },
      acceptanceBaseline: {
        minFieldCoverageRate: 90,
        maxFailedTraceCount: 0,
        requiredCapabilities: ['context', 'read', 'writeback']
      }
    })
    const campusPackage = service.upsertHospitalIntegrationPackage({
      ...hospitalPackage,
      campusId: 'east',
      packageName: 'A 院东区 HIS 接入包',
      fieldMappings: [
        ...hospitalPackage.fieldMappings,
        {
          metadataFieldId: 'metadata:encounter.department',
          dataSource: 'his.encounter',
          interfaceField: 'DEPT_NAME',
          exportPath: 'encounter.department'
        }
      ]
    })

    expect(campusPackage).toMatchObject({
      id: 'hospital-a:east',
      hospitalId: 'hospital-a',
      campusId: 'east',
      connectorId: 'his-sandbox',
      summary: {
        contextMappingCount: 2,
        fieldMappingCount: 2,
        dictionaryMappingCount: 1,
        enabledStrategyCount: 3,
        requiredCapabilityCount: 3
      }
    })
    expect(service.resolveHospitalIntegrationPackage({
      hospitalId: 'hospital-a',
      campusId: 'east'
    })?.id).toBe(campusPackage.id)
    expect(service.resolveHospitalIntegrationPackage({
      hospitalId: 'hospital-a',
      campusId: 'west'
    })?.id).toBe(hospitalPackage.id)
    expect(service.listHospitalIntegrationPackages({
      hospitalId: 'hospital-a'
    })).toHaveLength(2)

    const session = await service.createLaunchSession({
      connectorId: 'his-sandbox',
      launchMode: 'embedded',
      trustedTicket: 'ticket-1',
      scope: {
        patientId: 'P-1001',
        encounterId: 'V-1'
      }
    })
    await service.syncDocumentStatusWithRetry(
      session.id,
      {
        documentId: 'doc-1',
        status: 'pendingArchive'
      },
      { maxAttempts: 1 }
    )
    const replayRecord = service.listReplayRecords()[0]
    const snapshot = service.buildOperationsSnapshot({
      hospitalId: 'hospital-a',
      campusId: 'east',
      connectorId: 'his-sandbox',
      failedTraceAlertThreshold: 1
    })

    expect(snapshot.summary).toMatchObject({
      packageCount: 1,
      interfaceLogCount: 2,
      failedInterfaceLogCount: 1,
      auditEventCount: 2,
      alertCount: 1,
      compensationEntryCount: 1
    })
    expect(snapshot.interfaceLogs.map(log => log.action)).toEqual([
      'launch',
      'writeBack'
    ])
    expect(snapshot.auditEvents.map(event => event.action)).toEqual([
      'packageUpsert',
      'packageUpsert'
    ])
    expect(snapshot.alerts[0]).toMatchObject({
      code: 'writeback.failed.threshold',
      level: 'warning',
      count: 1,
      threshold: 1
    })
    expect(snapshot.compensationEntries[0]).toMatchObject({
      action: 'manualReplay',
      replayRecordId: replayRecord.id,
      connectorId: 'his-sandbox',
      status: 'pending'
    })
  })
})
