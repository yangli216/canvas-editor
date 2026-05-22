import { afterEach, vi } from 'vitest'

type CanvasEventEntry = {
  type: string
  props: Record<string, unknown>
}

const CANVAS_CTX_KEY = Symbol('canvas-context-stub')

function createCanvasGradientStub() {
  return {
    addColorStop: () => {}
  }
}

function createCanvasPatternStub() {
  return {}
}

function createTextMetricsStub(text: string): TextMetrics {
  const width = text.length * 8
  return {
    width,
    actualBoundingBoxAscent: 12,
    actualBoundingBoxDescent: 4,
    actualBoundingBoxLeft: 0,
    actualBoundingBoxRight: width,
    fontBoundingBoxAscent: 12,
    fontBoundingBoxDescent: 4,
    emHeightAscent: 12,
    emHeightDescent: 4,
    hangingBaseline: 0,
    alphabeticBaseline: 0,
    ideographicBaseline: 0
  } as TextMetrics
}

function createCanvasContextStub() {
  const events: CanvasEventEntry[] = []
  const record = (type: string, props: Record<string, unknown> = {}) => {
    events.push({ type, props })
  }

  const ctx = {
    canvas: null as HTMLCanvasElement | null,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '14px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    shadowBlur: 0,
    shadowColor: 'transparent',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    save: () => record('save'),
    restore: () => record('restore'),
    scale: (x: number, y: number) => record('scale', { x, y }),
    rotate: (angle: number) => record('rotate', { angle }),
    translate: (x: number, y: number) => record('translate', { x, y }),
    transform: (...args: number[]) => record('transform', { args }),
    setTransform: (...args: number[]) => record('setTransform', { args }),
    resetTransform: () => record('resetTransform'),
    clearRect: (x: number, y: number, width: number, height: number) =>
      record('clearRect', { x, y, width, height }),
    fillRect: (x: number, y: number, width: number, height: number) =>
      record('fillRect', { x, y, width, height }),
    strokeRect: (x: number, y: number, width: number, height: number) =>
      record('strokeRect', { x, y, width, height }),
    beginPath: () => record('beginPath'),
    closePath: () => record('closePath'),
    moveTo: (x: number, y: number) => record('moveTo', { x, y }),
    lineTo: (x: number, y: number) => record('lineTo', { x, y }),
    bezierCurveTo: (...args: number[]) => record('bezierCurveTo', { args }),
    quadraticCurveTo: (...args: number[]) => record('quadraticCurveTo', { args }),
    arc: (...args: number[]) => record('arc', { args }),
    arcTo: (...args: number[]) => record('arcTo', { args }),
    ellipse: (...args: number[]) => record('ellipse', { args }),
    rect: (...args: number[]) => record('rect', { args }),
    fill: () => record('fill'),
    stroke: () => record('stroke'),
    clip: () => record('clip'),
    fillText: (text: string, x: number, y: number) => record('fillText', { text, x, y }),
    strokeText: (text: string, x: number, y: number) => record('strokeText', { text, x, y }),
    measureText: (text: string) => {
      record('measureText', { text })
      return createTextMetricsStub(text)
    },
    drawImage: (...args: unknown[]) => record('drawImage', { args }),
    setLineDash: (segments: number[]) => record('setLineDash', { segments }),
    getLineDash: () => [],
    createLinearGradient: (...args: number[]) => {
      record('createLinearGradient', { args })
      return createCanvasGradientStub()
    },
    createRadialGradient: (...args: number[]) => {
      record('createRadialGradient', { args })
      return createCanvasGradientStub()
    },
    createPattern: (...args: unknown[]) => {
      record('createPattern', { args })
      return createCanvasPatternStub()
    },
    createImageData: (...args: unknown[]) => {
      record('createImageData', { args })
      return { data: new Uint8ClampedArray(4), width: 1, height: 1 }
    },
    getImageData: (...args: unknown[]) => {
      record('getImageData', { args })
      return { data: new Uint8ClampedArray(4), width: 1, height: 1 }
    },
    putImageData: (...args: unknown[]) => record('putImageData', { args }),
    __getEvents: () => events
  }

  return ctx as unknown as CanvasRenderingContext2D & {
    __getEvents: () => CanvasEventEntry[]
  }
}

;(HTMLCanvasElement.prototype as any).getContext = function getContext() {
  if (!(this as any)[CANVAS_CTX_KEY]) {
    const ctx = createCanvasContextStub()
    ;(ctx as any).canvas = this
    ;(this as any)[CANVAS_CTX_KEY] = ctx
  }
  return (this as any)[CANVAS_CTX_KEY]
}

;(HTMLCanvasElement.prototype as any).toDataURL = () => 'data:image/png;base64,stub'

;(globalThis as any).Path2D ??= class Path2D {
  addPath(): void {}
}

;(globalThis as any).DOMMatrix ??= class DOMMatrix {
  a = 1
  d = 1
  e = 0
  f = 0
  multiplySelf(): this { return this }
  translateSelf(): this { return this }
  scaleSelf(): this { return this }
  rotateSelf(): this { return this }
}

;(globalThis as any).ImageData ??= class ImageData {
  data: Uint8ClampedArray
  width: number
  height: number
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.data = new Uint8ClampedArray(width * height * 4)
  }
}

// jsdom 缺失补齐
class StubResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
class StubIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): unknown[] { return [] }
  root: Element | null = null
  rootMargin = ''
  thresholds: ReadonlyArray<number> = []
}
;(globalThis as any).ResizeObserver ??= StubResizeObserver
;(globalThis as any).IntersectionObserver ??= StubIntersectionObserver

;(window as any).matchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false
})

// 同步 Worker 替身: 仅满足 new Worker(url) 不抛错
class StubWorker {
  onmessage: ((this: Worker, ev: MessageEvent) => any) | null = null
  onerror: ((this: AbstractWorker, ev: ErrorEvent) => any) | null = null
  postMessage(): void {}
  terminate(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean { return false }
}
;(globalThis as any).Worker ??= StubWorker

// 防止 fakeTimers 泄漏
afterEach(() => {
  vi.useRealTimers()
})
