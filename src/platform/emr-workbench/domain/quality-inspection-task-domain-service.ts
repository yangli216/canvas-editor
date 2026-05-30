export type QualityInspectionTaskSource =
  | 'auto'
  | 'sampling'
  | 'special'
  | 'manual'
  | 'archive'

export type QualityInspectionTaskStatus =
  | 'pendingAssign'
  | 'pendingCheck'
  | 'checking'
  | 'pendingReview'
  | 'completed'
  | 'cancelled'

export type QualityInspectionStrategy =
  | 'full'
  | 'sampling'
  | 'risk'
  | 'documentType'
  | 'special'

export type QualityInspectionTaskEventAction =
  | 'created'
  | 'assigned'
  | 'claimed'
  | 'submittedReview'
  | 'completed'

export interface IQualityInspectionScope {
  departments?: string[]
  documentTypes?: string[]
  templateIds?: string[]
  patientIds?: string[]
  doctorIds?: string[]
  tags?: string[]
}

export interface IQualityInspectionTaskEvent {
  action: QualityInspectionTaskEventAction
  operator: string
  at: number
  assignee?: string
  reviewer?: string
}

export interface IQualityInspectionTaskInput {
  source: QualityInspectionTaskSource
  title: string
  strategy: QualityInspectionStrategy
  scope: IQualityInspectionScope
  documentIds: string[]
  createdBy: string
  dueAt?: number
}

export interface IQualityInspectionTask extends IQualityInspectionTaskInput {
  id: string
  status: QualityInspectionTaskStatus
  assignee?: string
  reviewer?: string
  createdAt: number
  updatedAt: number
  claimedAt?: number
  completedAt?: number
  events: IQualityInspectionTaskEvent[]
}

interface IQualityInspectionTaskRecord extends IQualityInspectionTask {
  sequence: number
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function toTask(record: IQualityInspectionTaskRecord): IQualityInspectionTask {
  const { sequence, ...task } = record
  void sequence
  return clone(task)
}

export class QualityInspectionTaskDomainService {
  private readonly tasks = new Map<string, IQualityInspectionTaskRecord>()
  private sequence = 0

  createTask(input: IQualityInspectionTaskInput): IQualityInspectionTask {
    const now = Date.now()
    const sequence = this.sequence + 1
    this.sequence = sequence
    const task: IQualityInspectionTaskRecord = {
      ...clone(input),
      id: `quality-task-${sequence}`,
      status: 'pendingAssign',
      createdAt: now,
      updatedAt: now,
      sequence,
      events: [
        {
          action: 'created',
          operator: input.createdBy,
          at: now
        }
      ]
    }

    this.tasks.set(task.id, task)
    return toTask(task)
  }

  assign(
    id: string,
    assignee: string,
    operator: string
  ): IQualityInspectionTask {
    const task = this.getRecord(id)
    this.assertStatus(task, 'pendingAssign')
    const now = Date.now()
    const updated: IQualityInspectionTaskRecord = {
      ...task,
      status: 'pendingCheck',
      assignee,
      updatedAt: now,
      events: [
        ...task.events,
        {
          action: 'assigned',
          operator,
          assignee,
          at: now
        }
      ]
    }
    this.tasks.set(id, updated)
    return toTask(updated)
  }

  claim(id: string, assignee: string): IQualityInspectionTask {
    const task = this.getRecord(id)
    this.assertStatus(task, 'pendingCheck')
    if (task.assignee !== assignee) {
      throw new Error(`质控任务未分派给：${assignee}`)
    }
    const now = Date.now()
    const updated: IQualityInspectionTaskRecord = {
      ...task,
      status: 'checking',
      claimedAt: now,
      updatedAt: now,
      events: [
        ...task.events,
        {
          action: 'claimed',
          operator: assignee,
          assignee,
          at: now
        }
      ]
    }
    this.tasks.set(id, updated)
    return toTask(updated)
  }

  submitReview(id: string, assignee: string): IQualityInspectionTask {
    const task = this.getRecord(id)
    this.assertStatus(task, 'checking')
    if (task.assignee !== assignee) {
      throw new Error(`质控任务未领取给：${assignee}`)
    }
    const now = Date.now()
    const updated: IQualityInspectionTaskRecord = {
      ...task,
      status: 'pendingReview',
      updatedAt: now,
      events: [
        ...task.events,
        {
          action: 'submittedReview',
          operator: assignee,
          assignee,
          at: now
        }
      ]
    }
    this.tasks.set(id, updated)
    return toTask(updated)
  }

  complete(id: string, reviewer: string): IQualityInspectionTask {
    const task = this.getRecord(id)
    this.assertStatus(task, 'pendingReview')
    const now = Date.now()
    const updated: IQualityInspectionTaskRecord = {
      ...task,
      status: 'completed',
      reviewer,
      completedAt: now,
      updatedAt: now,
      events: [
        ...task.events,
        {
          action: 'completed',
          operator: reviewer,
          reviewer,
          at: now
        }
      ]
    }
    this.tasks.set(id, updated)
    return toTask(updated)
  }

  get(id: string): IQualityInspectionTask {
    return toTask(this.getRecord(id))
  }

  list(): IQualityInspectionTask[] {
    return Array.from(this.tasks.values())
      .sort((left, right) => right.updatedAt - left.updatedAt
        || right.sequence - left.sequence)
      .map(toTask)
  }

  private getRecord(id: string): IQualityInspectionTaskRecord {
    const task = this.tasks.get(id)
    if (!task) throw new Error(`质控任务不存在：${id}`)
    return task
  }

  private assertStatus(
    task: IQualityInspectionTask,
    expected: QualityInspectionTaskStatus
  ) {
    if (task.status !== expected) {
      throw new Error(`质控任务状态不可流转：${task.status}`)
    }
  }
}