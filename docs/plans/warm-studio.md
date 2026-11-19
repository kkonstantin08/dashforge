# Warm Studio Implementation Plan

> Use Superpowers Executing Plans and Test-Driven Development in task order. Track RED, GREEN and refactoring evidence in the TDD record.

**Goal.** Ship the approved Warm Studio look and a live Appearance editor with local font imports.

**Architecture.** Keep appearance as optional workspace metadata. Store font blobs at separate keys in the same IndexedDB transaction as changes to their metadata. Render the committed or draft palette and selected fonts with CSS variables and the browser FontFace API. Lazy-load the native dialog.

**Stack.** Angular standalone, Signals, CSS and IndexedDB. [Approved specification](../specs/2026-11-19-appearance-design.md)

## Constraints and review focus

- Preserve schema v1 reads and grid geometry, including after layout reset. Exercise an old snapshot and a reset with new metadata.
- Check a failed or stale save that includes a font. Keep pending files for Retry and avoid replaying deleted blobs.
- Accept only verified WOFF2, OTF and TTF blobs up to 5 MiB each, with at most six saved files. Check rejection and missing-asset fallback.
- Verify contrasting text and focus separately against the canvas and card backgrounds. Include extremes and intermediate luminance values.
- Exercise Escape, focus restoration, cancelled imports, mobile bounds, and the existing drag/resize flow. Check published app and bundle budgets.

## 1. Workspace schema and storage

- [x] RED. Add schema tests for optional metadata and invalid references and TestBed tests for failed writes and layout reset.
- [x] GREEN. Extend the workspace and its write queue. Process font changes in the snapshot transaction.
- [x] REFACTOR. Keep normal workspace saves on the same path without asset reads or writes. `2d07615`.

## 2. Presentation and editor

- [x] RED. Add color unit tests and browser tests for live preview, cancel, apply, import, removal and reload.
- [x] GREEN. Add the deferred Appearance dialog, CSS variables and licensed same-origin Lora. Verify Chromium and WebKit.
- [x] REFACTOR. Serve selected faces and unregister unused faces. Keep appearance out of layout geometry. `89f51a4`.

## 3. Acceptance and release

- [x] Verify lint, formatting, strict typecheck, unit tests, production build, full Playwright suite, and the twenty-widget benchmark. Capture desktop and phone-width screenshots.
- [x] Review the complete branch independently, resolve findings with RED → GREEN and document the evidence. `d2cc570`. [TDD](../tdd/warm-studio.md) · [Acceptance](../audits/warm-studio.md)

GitHub Actions publishes the main branch through Pages. Verify the deployment against its current SHA and rerun the appearance, font and restore smoke on the public origin. [CI and Pages](https://github.com/kkonstantin08/dashforge/actions/workflows/ci.yml)
