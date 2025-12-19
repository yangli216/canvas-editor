<h1 align="center">Canvas Editor</h1>

<p align="center">
  <strong>A Canvas/SVG-based rich text editor.</strong>
</p>

<p align="center">
  <a href="https://trendshift.io/repositories/8401" target="_blank">
    <img src="https://trendshift.io/api/badge/repositories/8401" alt="Hufe921%2Fcanvas-editor | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/>
  </a>
</p>

<p align="center">
<a href="https://www.npmjs.com/package/@yangl/canvas-editor" target="_blank"><img src="https://img.shields.io/npm/v/@yangl/canvas-editor.svg?sanitize=true" alt="Version"></a>
 <a href="https://github.com/yangl/canvas-editor/actions" target="_blank">
  <img alt="Cypress Passing" src="https://github.com/yangl/canvas-editor/workflows/cypress/badge.svg" />
</a>
<a href="https://github.com/yangl/canvas-editor/graphs/contributors" target="_blank">
  <img alt="GitHub Contributors" src="https://img.shields.io/github/contributors/yangl/canvas-editor" />
</a>
<a href="https://www.npmjs.com/package/@yangl/canvas-editor" target="_blank"><img src="https://img.shields.io/npm/l/@yangl/canvas-editor.svg?sanitize=true" alt="License"></a>
<a href="https://github.com/yangl/canvas-editor/issues/new/choose" target="_blank"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs"></a>
</p>

<p align="center">
  <a href="https://hufe.club/canvas-editor" target="_blank">View Demo</a>
  ·
  <a href="https://hufe.club/canvas-editor-docs" target="_blank">View Docs</a>
  ·
  <a href="https://github.com/yangl/canvas-editor/issues/new?assignees=&labels=&projects=&template=bug_report.yml" target="_blank">Report Bug</a>
  ·
  <a href="https://github.com/yangl/canvas-editor/issues/new?assignees=&labels=%3Asparkles%3A+feature+request&projects=&template=feature_request.yml" target="_blank">Request Feature</a>
  ·
  <a href="https://github.com/yangl/canvas-editor/discussions" target="_blank">FAQ</a>
</p>

<p align="center">
  English · <a href="https://hufe.club/canvas-editor-docs">中文文档</a>
</p>

---

1. Official plugin: [canvas-editor-plugin](https://github.com/yangl/canvas-editor-plugin)
2. The render layer by svg is under development, see [feature/svg](https://github.com/yangl/canvas-editor/tree/feature/svg)
3. The export pdf feature is available now, see [feature/pdf](https://github.com/yangl/canvas-editor/tree/feature/pdf)
4. The AI-powered text processing demo, see [feature/ai](https://github.com/yangl/canvas-editor/tree/feature/ai)
5. Table pagination [#41](https://github.com/yangl/canvas-editor/issues/41) is under active development, see: [poc/table-paging](https://github.com/yangl/canvas-editor/tree/poc/table-paging) · [demo](https://hufe.club/canvas-editor-table/)

**Canvas Editor** is a feature-rich, WYSIWYG document editor built on top of the HTML `<canvas>` API. It is designed for use cases that demand pixel-perfect rendering, advanced typography, complex layouts, and Word-like document experiences in the browser — including EMR (Electronic Medical Records), legal contracts, reports, and other document-centric applications.

Unlike traditional `contenteditable`-based editors, Canvas Editor takes full control of the rendering pipeline, providing consistent typography across browsers, precise pagination, and a uniform export experience.

## Features

- **Rich Text** — Undo / Redo, Font, Size, Bold, Italic, Underline, Strikeout, Superscript, Alignment, Headings, Lists, and more
- **Insertable Elements** — Tables, Images, Hyperlinks, Code Blocks, Page Breaks, Math Formulas (LaTeX), Date Pickers, Block elements
- **Form Controls** — Select, Text, Date, Radio, Checkbox controls
- **Pagination** — Native pagination with headers, footers, and page numbers
- **Page Layout** — Configurable page margins, watermarks, backgrounds
- **Document Structure** — Catalog (TOC) generation, comments, group annotations
- **Print & Export** — Print-ready output via canvas-to-image / PDF rendering
- **Interaction** — Custom context menus, customizable shortcut keys, drag-and-drop for text, elements, and controls
- **Extensibility** — Plugin system for adding custom functionality
- **Performance** — Web Workers for word counting, catalog generation, and async value retrieval

## Why Canvas Editor?

|                         | Canvas Editor                    | contenteditable Editors     |
| ----------------------- | -------------------------------- | --------------------------- |
| Cross-browser rendering | Pixel-perfect, identical         | Varies by browser           |
| Pagination              | Native, document-style           | Manual / unsupported        |
| Print fidelity          | Matches on-screen output         | Often diverges              |
| Typography control      | Full control                     | Limited by the browser      |
| Document features       | TOC, headers/footers, watermarks | Requires heavy custom logic |

## Installation

```bash
npm i @yangl/canvas-editor --save
```

## Quick Start

```html
<div class="canvas-editor"></div>
```

```javascript
import Editor from '@yangl/canvas-editor'

const container = document.querySelector('.canvas-editor')

const editor = new Editor(container, {
  main: [
    {
      value: 'Hello, Canvas Editor!'
    }
  ]
})
```

For complete API documentation, see the [official docs](https://hufe.club/canvas-editor-docs).

## Ecosystem

| Project                                                                            | Description                                                           |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [canvas-editor-plugin](https://github.com/Hufe921/canvas-editor-plugin)            | Official plugin collection                                            |
| [feature/svg](https://github.com/Hufe921/canvas-editor/tree/feature/svg)           | SVG render layer (in development)                                     |
| [feature/pdf](https://github.com/Hufe921/canvas-editor/tree/feature/pdf)           | PDF export feature                                                    |
| [feature/ai](https://github.com/Hufe921/canvas-editor/tree/feature/ai)             | AI-powered text processing demo                                       |
| [poc/table-paging](https://github.com/Hufe921/canvas-editor/tree/poc/table-paging) | Table pagination POC ([demo](https://hufe.club/canvas-editor-table/)) |
| [feature/CRDT](https://github.com/Hufe921/canvas-editor/tree/feature/CRDT)         | CRDT-based collaboration (experimental)                               |

1. Table paging
2. Control rules
3. Improve performance
4. [CRDT](https://github.com/yangl/canvas-editor/tree/feature/CRDT)

### Prerequisites

![image](https://github.com/yangl/canvas-editor/blob/main/src/assets/snapshots/main_v0.9.35.png)

### Setup

```bash
# Install dependencies
pnpm install

# Start the development server
npm run dev
```

### Build

```bash
# Build the application (demo)
npm run build

# Build the library (publishable package)
npm run lib
```

### Quality Checks

```bash
# Lint
npm run lint

# Type check
npm run type:check

# Unit tests (Vitest)
npm run test:unit

# E2E tests (Cypress)
npm run cypress:open    # interactive
npm run cypress:run     # headless
```

### Documentation

```bash
npm run docs:dev        # Start VitePress docs locally
npm run docs:build      # Build the documentation site
```

## Project Structure

```
src/editor/
├── core/
│   ├── draw/           # Rendering engine (canvas drawing)
│   │   ├── particle/   # Element renderers (text, image, table, latex, ...)
│   │   ├── control/    # Form control rendering
│   │   ├── frame/      # Frame elements (margin, background, borders)
│   │   ├── richtext/   # Decorations (underline, highlight)
│   │   └── interactive/# Interactive features (search, graffiti)
│   ├── command/        # Command pattern (executeBold, executeUndo, ...)
│   ├── event/          # Canvas and global event handling
│   ├── observer/       # Mouse, selection, image observers
│   ├── worker/         # Web Workers for async operations
│   └── plugin/         # Plugin system
├── interface/          # TypeScript interfaces
├── dataset/            # Enums and constants
└── utils/              # Utility helpers
```

## Contributing

Contributions are what make the open-source community such an amazing place. **Any contributions you make are greatly appreciated** — bug reports, feature requests, documentation improvements, or pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes following [Conventional Commits](https://www.conventionalcommits.org/) (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

> Pre-commit hooks automatically run `lint` and `type:check`. Commit messages must follow Conventional Commits format (`feat:`, `fix:`, `docs:`, `refactor:`, ...).

### Contributors

Thanks to all the people who have contributed to Canvas Editor!

<a href="https://github.com/Hufe921/canvas-editor/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Hufe921/canvas-editor" />
</a>

## Community & Support

- **Documentation** — [hufe.club/canvas-editor-docs](https://hufe.club/canvas-editor-docs)
- **Discussions** — [GitHub Discussions](https://github.com/Hufe921/canvas-editor/discussions)
- **Bug Reports** — [GitHub Issues](https://github.com/Hufe921/canvas-editor/issues)
- **AI-Assisted Q&A** — [Zread](https://zread.ai/Hufe921/canvas-editor) · [DeepWiki](https://deepwiki.com/Hufe921/canvas-editor)

## Sponsors

If you find this project useful, please consider [sponsoring](https://hufe.club/donate.jpg) to support its continued development.

## License

This project is licensed under the [MIT License](./LICENSE).

Copyright © 2022–present, [Hufe921](https://github.com/Hufe921).
