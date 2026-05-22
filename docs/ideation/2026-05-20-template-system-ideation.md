---
date: 2026-05-20
topic: template-system-improvements
focus: next steps after initial template DSL + visual designer implementation
---

# Ideation: Template System Next Steps

## Codebase Context

canvas-editor is a canvas-based rich text editor (TypeScript, ~96KB Draw.ts core) that recently
gained a medical record template DSL system (`src/editor/template/`) and a visual designer UI
(`src/components/template-designer/`). The template pipeline is:
`ITemplateSchema` → `compileTemplate()` → `IEditorData` → `executeSetValue()`.

**Confirmed bugs in the newly built code:**
1. `ControlState.BLUR` does not exist (enum only has ACTIVE/INACTIVE) — reactive rule evaluation silently never fires
2. `collectFields()` copy-pasted identically in TemplateRuleEngine.ts and TemplateValueExtractor.ts, both missing header/footer fields
3. `TemplateDesigner._handleSave()` ignores `categoryInput.value` — category silently discarded
4. `required` rule conditional in RuleEngine computes a boolean but never writes it to `props` — silent no-op
5. `SchemaCanvas._render()` does `innerHTML = ''` on every update — scroll position lost on every field edit
6. `TemplateManager` export button has no click handler — non-functional
7. Section/group blocks show static badge only — no nested block editing in designer

## Ranked Ideas

### 1. Fix ControlState.BLUR + EventBus migration + proper dispose()
**Description:** `TemplateRuleEngine._subscribe()` uses `ControlState.BLUR` (undefined) as a filter, so `_evaluate()` never fires after initial mount. Migrate to `eventBus.on('controlContentChange', ...)` and fix `dispose()` to call `eventBus.off()`.
**Rationale:** The rule engine backbone of the entire conditional logic system is silently broken. Visibility rules, conditional required, conditional readonly — none re-evaluate after the initial render.
**Downsides:** None — pure bug fix with bounded scope.
**Confidence:** 95%
**Complexity:** Low
**Status:** Explored → implemented 2026-05-20

### 2. SchemaCanvas scroll preservation
**Description:** Save and restore `scrollTop` before/after `this.container.innerHTML = ''` rebuild in `_render()`. Three lines of change.
**Rationale:** Editing any field in PropertiesPanel triggers a full canvas rebuild, scrolling back to the top. For 10+ block templates this makes editing near-impossible.
**Downsides:** None. Scroll restoration is visually transparent.
**Confidence:** 92%
**Complexity:** Low
**Status:** Explored → implemented 2026-05-20

### 3. Bundle export fix
**Description:** Wire the non-functional "Export selected" button in TemplateManager to export all templates in the active category as a JSON array.
**Rationale:** The import path works; the export button has no listener. Operators need to distribute approved template packs between workstations.
**Downsides:** Category-scoped export is slightly less flexible than per-template selection, but avoids building a multi-select UI state.
**Confidence:** 92%
**Complexity:** Low
**Status:** Explored → implemented 2026-05-20

### 4. Extract shared buildFieldIndex() + extend to header/footer
**Description:** Extract the duplicated `collectFields()` into a shared `buildFieldIndex(schema): Map<fieldId, ITemplateField>` in `src/editor/template/index.ts`, traversing `header`, `blocks`, and `footer`. Import it in both RuleEngine and ValueExtractor.
**Rationale:** DRY fix that also makes header/footer fields visible to rules and validation — currently every built-in template's header fields are invisible to both.
**Downsides:** None.
**Confidence:** 85%
**Complexity:** Low
**Status:** Explored → implemented 2026-05-20

### 5. Schema validation before compileTemplate
**Description:** A `validateSchema(schema): IValidationError[]` exported from `index.ts` that checks for duplicate field IDs and dangling rule condition references.
**Rationale:** Duplicate IDs cause silent Map collisions; dangling condition.field references cause rules to silently default to hidden. Both are authoring errors with zero feedback today.
**Downsides:** Adds a pre-compile step; can be bypassed if callers don't invoke it.
**Confidence:** 82%
**Complexity:** Low
**Status:** Unexplored

### 6. Fix 3 quick bugs: category save, required no-op, header/footer
**Description:** (1) Read `this.categoryInput.value` in `TemplateDesigner._handleSave()`. (2) Either remove the unreachable `required` rule branch or add a clear comment that `required` is validation-only (not a runtime control property). (3) Covered by idea 4.
**Rationale:** Category loss makes template organization broken. The required branch is actively misleading — it looks like it works and doesn't.
**Downsides:** None.
**Confidence:** 80%
**Complexity:** Low
**Status:** Explored → implemented 2026-05-20

### 7. Section/group nested block drill-down editing in SchemaCanvas
**Description:** Add a "drill into" mode for section/group blocks: clicking a section card expands it inline, showing its child blocks with the same block-card UI (add, delete, move) and a "back" breadcrumb.
**Rationale:** Every medical record template uses sections. Currently a section can be created but never populated via the designer — the only way to add child blocks is hand-editing JSON and importing.
**Downsides:** Medium complexity; requires SchemaCanvas to manage a path stack and TemplateDesigner to write mutations at arbitrary nesting depth.
**Confidence:** 75%
**Complexity:** Medium
**Status:** Explored → implemented 2026-05-20

### 8. Dirty-state close guard in TemplateDesigner
**Description:** Compare `this.schema` against a snapshot taken at construction or last save before calling `_dispose()` on close. If different, show a confirmation dialog.
**Rationale:** Clicking close immediately discards all unsaved work with no warning.
**Downsides:** None. Skip the localStorage auto-save half of this idea — explicit Save is sufficient.
**Confidence:** 72%
**Complexity:** Low
**Status:** Explored → implemented 2026-05-20

### 9. Schema-aware rule condition field picker
**Description:** Replace the free-text `<input>` for `condition.field` in PropertiesPanel's rule editor with a `<select>` populated from all fields in the current schema.
**Rationale:** No-code designers cannot know field IDs by heart; a typo produces a silent rule that evaluates against an empty string.
**Downsides:** Requires threading `blocks` prop down to the rule editor. Low cost.
**Confidence:** 60%
**Complexity:** Low
**Status:** Explored → implemented 2026-05-20

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| G | Non-destructive patch re-apply | Premature — rule engine is broken; revisit after A+B+C stabilize |
| I | Compound AND/OR rule conditions | Defer until rule engine fires correctly; DSL extension should follow stability |
| J | TemplatePlugin (editor.use()) | API stabilization belongs after correctness is confirmed |
| M | Template inheritance (extends:) | High DSL complexity, no expressed user need yet |
| N | RuleEngine dependency graph | Premature optimization on a broken foundation |
| O | Computed formula fields | New paradigm, high complexity, no existing groundwork |

## Session Log
- 2026-05-20: Initial ideation — ~28 candidates generated across 4 frames, 9 survivors. All 9 marked for immediate implementation.
