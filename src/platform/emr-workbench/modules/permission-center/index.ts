import {
  buildPermissionCenterViewModel
} from './service'
import { createPermissionCenterView } from './view'

export interface IPermissionRolePreset {
  id: string
  label: string
  description: string
  scopes: string[]
}

interface IPermissionAssignmentPreset {
  id: string
  scopeLabel: string
  owner: string
  roleId: string
  updatedAt: number
}

const ROLE_PRESETS: IPermissionRolePreset[] = [
  {
    id: 'designer',
    label: '设计者',
    description: '负责模板设计、字段维护和页眉页脚编排。',
    scopes: ['template.design', 'template.preview', 'template.saveDraft']
  },
  {
    id: 'reviewer',
    label: '审核者',
    description: '负责试运行、发布准入复核与问题回退建议。',
    scopes: ['template.review', 'template.trialRun', 'template.admission.read']
  },
  {
    id: 'publisher',
    label: '发布者',
    description: '负责送审、发布、撤回和上线运营确认。',
    scopes: ['template.publish', 'template.withdraw', 'template.releaseNote.write']
  },
  {
    id: 'clinician',
    label: '使用者',
    description: '使用已发布模板创建病历并查看实例留痕。',
    scopes: ['document.create', 'document.write', 'document.trace.read']
  }
]

const DEFAULT_ASSIGNMENTS: IPermissionAssignmentPreset[] = [
  {
    id: 'outpatient-note',
    scopeLabel: '门诊病历模板',
    owner: '门诊病历组',
    roleId: 'designer',
    updatedAt: Date.now() - 2 * 3600_000
  },
  {
    id: 'inpatient-note',
    scopeLabel: '住院病程模板',
    owner: '住院病历组',
    roleId: 'reviewer',
    updatedAt: Date.now() - 4 * 3600_000
  },
  {
    id: 'consent-note',
    scopeLabel: '知情同意书模板',
    owner: '医务科',
    roleId: 'publisher',
    updatedAt: Date.now() - 6 * 3600_000
  },
  {
    id: 'trace-view',
    scopeLabel: '留痕追溯查询',
    owner: '临床质控组',
    roleId: 'clinician',
    updatedAt: Date.now() - 8 * 3600_000
  }
]

export class PermissionCenterModule {
  private assignments = DEFAULT_ASSIGNMENTS.map(item => ({ ...item }))

  getRolePresets() {
    return ROLE_PRESETS.slice()
  }

  getAssignments() {
    return this.assignments.map(item => ({ ...item }))
  }

  cycleAssignment(assignmentId: string) {
    const target = this.assignments.find(item => item.id === assignmentId)
    if (!target) return
    const currentIndex = ROLE_PRESETS.findIndex(role => role.id === target.roleId)
    target.roleId = ROLE_PRESETS[(currentIndex + 1) % ROLE_PRESETS.length].id
    target.updatedAt = Date.now()
  }

  resetAssignments() {
    this.assignments = DEFAULT_ASSIGNMENTS.map(item => ({ ...item }))
  }

  createDialogContent() {
    return createPermissionCenterView({
      getModel: () =>
        buildPermissionCenterViewModel(
          this.getRolePresets(),
          this.getAssignments()
        ),
      onCycleAssignment: (assignmentId: string) =>
        this.cycleAssignment(assignmentId),
      onResetAssignments: () => this.resetAssignments()
    })
  }
}

export {
  buildPermissionCenterViewModel,
  type IPermissionCenterRole,
  type IPermissionCenterViewModel
} from './service'
export {
  createPermissionCenterView
} from './view'