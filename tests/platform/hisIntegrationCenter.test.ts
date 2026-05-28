import { describe, expect, it } from 'vitest'
import {
  buildHisIntegrationCenterViewModel,
  type IHisIntegrationCenterConnector,
  type IHisIntegrationCenterSession,
  type IHisIntegrationCenterTraceRecord
} from '@/platform/emr-workbench/modules'

describe('his integration center view model', () => {
  it('会汇总连接器、上下文会话和联调追踪状态', () => {
    const connectors: IHisIntegrationCenterConnector[] = [
      {
        id: 'his-sandbox',
        label: 'HIS 沙箱连接器',
        mode: 'sandbox',
        authType: 'trustedTicket',
        dataSources: ['his.patient', 'his.encounter'],
        capabilities: ['context', 'read', 'writeback']
      }
    ]
    const sessions: IHisIntegrationCenterSession[] = [
      {
        id: 'session-1',
        connectorId: 'his-sandbox',
        launchMode: 'embedded',
        status: 'active',
        context: {
          patientId: 'P-1001',
          encounterId: 'V-1',
          operatorName: '张医生',
          roleCodes: ['doctor']
        },
        createdAt: 1,
        updatedAt: 2
      }
    ]
    const traces: IHisIntegrationCenterTraceRecord[] = [
      {
        id: 'trace-1',
        connectorId: 'his-sandbox',
        sessionId: 'session-1',
        action: 'read',
        status: 'success',
        message: '已读取 2 个字段',
        durationMs: 28,
        createdAt: 3
      },
      {
        id: 'trace-2',
        connectorId: 'his-sandbox',
        sessionId: 'session-1',
        action: 'writeBack',
        status: 'failed',
        message: 'HIS 回写超时',
        durationMs: 5000,
        createdAt: 4
      }
    ]

    const model = buildHisIntegrationCenterViewModel({
      connectors,
      sessions,
      traces,
      fieldDiagnostics: [
        {
          fieldId: 'field-1',
          label: '患者姓名',
          businessCode: 'patient.name',
          dataSource: 'his.patient',
          value: '张三'
        },
        {
          fieldId: 'field-2',
          label: '过敏史',
          businessCode: 'patient.allergy',
          dataSource: 'his.patient',
          value: null,
          note: 'HIS 未返回该字段'
        }
      ]
    })

    expect(model.summary).toMatchObject({
      connectorCount: 1,
      activeSessionCount: 1,
      traceCount: 2,
      failedTraceCount: 1,
      averageDurationMs: 2514,
      fieldDiagnosticCount: 2,
      coveredFieldCount: 1,
      fieldCoverageRate: 50
    })
    expect(model.connectors[0]).toMatchObject({
      id: 'his-sandbox',
      statusText: '可联调',
      dataSourceText: 'his.patient / his.encounter'
    })
    expect(model.sessions[0]).toMatchObject({
      contextText: '患者 P-1001 / 就诊 V-1 / 操作员 张医生'
    })
    expect(model.traces[0]).toMatchObject({
      actionText: '状态回写',
      statusText: '失败'
    })
    expect(model.fieldDiagnostics).toEqual([
      expect.objectContaining({
        fieldId: 'field-1',
        statusText: '已命中',
        valueText: '张三'
      }),
      expect.objectContaining({
        fieldId: 'field-2',
        statusText: '缺失',
        valueText: '空值'
      })
    ])
  })

  it('会汇总产品化运维告警和人工补偿入口', () => {
    const model = buildHisIntegrationCenterViewModel({
      connectors: [],
      sessions: [],
      traces: [],
      operationsSnapshot: {
        summary: {
          packageCount: 1,
          interfaceLogCount: 2,
          failedInterfaceLogCount: 1,
          auditEventCount: 2,
          alertCount: 1,
          compensationEntryCount: 1
        },
        packages: [],
        interfaceLogs: [],
        auditEvents: [],
        alerts: [
          {
            id: 'alert-1',
            level: 'warning',
            code: 'writeback.failed.threshold',
            message: '失败接口调用达到 1 次',
            count: 1,
            threshold: 1,
            createdAt: 1
          }
        ],
        compensationEntries: [
          {
            id: 'compensation-1',
            replayRecordId: 'replay-1',
            connectorId: 'his-sandbox',
            sessionId: 'session-1',
            action: 'manualReplay',
            status: 'pending',
            message: 'HIS 回写接口超时',
            updatedAt: 2
          }
        ]
      }
    })

    expect(model.summary).toMatchObject({
      packageCount: 1,
      operationAlertCount: 1,
      compensationEntryCount: 1
    })
    expect(model.operations.alerts[0]).toMatchObject({
      statusText: '预警',
      detailText: '失败接口调用达到 1 次'
    })
    expect(model.operations.compensationEntries[0]).toMatchObject({
      actionText: '人工重放',
      statusText: '待处理',
      detailText: 'his-sandbox / replay-1'
    })
  })
})
