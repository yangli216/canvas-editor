import { EDITOR_COMPONENT, EditorComponent } from '../../editor'

export type TemplateFeedbackTone =
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'

type TemplateFeedbackActionVariant = 'default' | 'primary' | 'danger'

interface ITemplateFeedbackAction {
  label: string
  variant?: TemplateFeedbackActionVariant
  onClick?: () => void
  closeOnClick?: boolean
}

interface ITemplateFeedbackDialogOptions {
  title: string
  message?: string
  content?: HTMLElement
  tone?: TemplateFeedbackTone
  width?: number
  closeOnBackdrop?: boolean
  actions?: ITemplateFeedbackAction[]
  onClose?: () => void
}

const TOAST_STACK_SELECTOR = '.td-feedback-toast-stack'

function createHostElement<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  el.className = className
  el.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)
  return el
}

function appendMessage(container: HTMLDivElement, message: string) {
  const messageEl = createHostElement('div', 'td-feedback__message')
  messageEl.textContent = message
  container.append(messageEl)
}

export class TemplateFeedback {
  static toast(
    message: string,
    tone: TemplateFeedbackTone = 'info'
  ) {
    const stack = this._getToastStack()
    const toast = createHostElement(
      'div',
      `td-feedback-toast td-feedback-toast--${tone}`
    )
    const badge = createHostElement('span', 'td-feedback-toast__badge')
    badge.textContent =
      tone === 'success'
        ? '完成'
        : tone === 'warning'
          ? '注意'
          : tone === 'danger'
            ? '失败'
            : '提示'
    const text = createHostElement('div', 'td-feedback-toast__text')
    text.textContent = message
    toast.append(badge, text)
    stack.append(toast)

    window.setTimeout(() => {
      toast.classList.add('td-feedback-toast--leave')
      window.setTimeout(() => toast.remove(), 220)
    }, 2600)
  }

  static alert(options: {
    title?: string
    message: string
    tone?: TemplateFeedbackTone
    confirmText?: string
  }) {
    const {
      title = '系统提示',
      message,
      tone = 'info',
      confirmText = '我知道了'
    } = options

    return new Promise<void>(resolve => {
      this.openDialog({
        title,
        message,
        tone,
        actions: [
          {
            label: confirmText,
            variant: tone === 'danger' ? 'danger' : 'primary',
            onClick: () => resolve()
          }
        ],
        onClose: () => resolve()
      })
    })
  }

  static confirm(options: {
    title: string
    message: string
    tone?: TemplateFeedbackTone
    confirmText?: string
    cancelText?: string
  }) {
    const {
      title,
      message,
      tone = 'warning',
      confirmText = '确认',
      cancelText = '取消'
    } = options

    return new Promise<boolean>(resolve => {
      let settled = false
      const settle = (value: boolean) => {
        if (settled) return
        settled = true
        resolve(value)
      }

      this.openDialog({
        title,
        message,
        tone,
        actions: [
          {
            label: cancelText,
            onClick: () => settle(false)
          },
          {
            label: confirmText,
            variant: tone === 'danger' ? 'danger' : 'primary',
            onClick: () => settle(true)
          }
        ],
        onClose: () => settle(false)
      })
    })
  }

  static openDialog(options: ITemplateFeedbackDialogOptions) {
    const {
      title,
      message,
      content,
      tone = 'info',
      width,
      closeOnBackdrop = true,
      actions = [],
      onClose
    } = options

    const overlay = createHostElement('div', 'td-feedback-overlay')
    const dialog = createHostElement(
      'div',
      `td-feedback td-feedback--${tone}`
    )
    if (width) {
      dialog.style.width = `${width}px`
    }

    const close = () => {
      document.removeEventListener('keydown', onKeydown)
      overlay.remove()
      onClose?.()
    }

    const onKeydown = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') close()
    }

    overlay.addEventListener('click', evt => {
      if (evt.target === overlay && closeOnBackdrop) {
        close()
      }
    })
    document.addEventListener('keydown', onKeydown)

    const header = createHostElement('div', 'td-feedback__header')
    const titleWrap = createHostElement('div', 'td-feedback__title-wrap')
    const badge = createHostElement('span', 'td-feedback__tone')
    badge.textContent =
      tone === 'success'
        ? '成功'
        : tone === 'warning'
          ? '请确认'
          : tone === 'danger'
            ? '错误'
            : '提示'
    const titleEl = createHostElement('div', 'td-feedback__title')
    titleEl.textContent = title
    titleWrap.append(badge, titleEl)

    const closeBtn = createHostElement('button', 'td-feedback__close')
    closeBtn.type = 'button'
    closeBtn.textContent = '关闭'
    closeBtn.addEventListener('click', () => close())
    header.append(titleWrap, closeBtn)

    const body = createHostElement('div', 'td-feedback__body')
    if (message) {
      appendMessage(body, message)
    }
    if (content) {
      body.append(content)
    }

    const footer = createHostElement('div', 'td-feedback__footer')
    const footerActions = actions.length
      ? actions
      : [{ label: '关闭', variant: 'primary' as const }]
    footerActions.forEach(action => {
      const btn = createHostElement(
        'button',
        `td-feedback__btn td-feedback__btn--${action.variant ?? 'default'}`
      )
      btn.type = 'button'
      btn.textContent = action.label
      btn.addEventListener('click', () => {
        action.onClick?.()
        if (action.closeOnClick !== false) {
          close()
        }
      })
      footer.append(btn)
    })

    dialog.append(header, body, footer)
    overlay.append(dialog)
    document.body.append(overlay)

    return { close }
  }

  private static _getToastStack(): HTMLDivElement {
    const existing = document.querySelector<HTMLDivElement>(TOAST_STACK_SELECTOR)
    if (existing) return existing
    const stack = createHostElement('div', 'td-feedback-toast-stack')
    document.body.append(stack)
    return stack
  }
}