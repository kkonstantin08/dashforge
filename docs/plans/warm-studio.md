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

- [ ] RED. Add tests to `src/app/storage/indexed-db.spec.ts` for optional metadata and invalid references, and to `src/app/dashboard/dashboard-store.spec.ts` for atomic font changes after a failed write and preservation on layout reset.
- [ ] GREEN. Add `Appearance`, its default values and validation in `src/app/appearance/appearance.ts`. Extend `Workspace`, `isWorkspace` and `resetLayout`. Add `IndexedDbWorkspace.readFont(id)` and an optional `FontChanges` argument to `write`. Compute the asset delta for the snapshot in `DashboardStore.applyAppearance(theme, appearance, additions)` and its existing queue.
- [ ] REFACTOR. Keep normal workspace saves on the same transaction path without asset reads or writes. Verify TestBed and typecheck. Commit `feat(storage): persist appearance and font assets`.

## 2. Presentation and editor

- [ ] RED. Write color unit tests and Playwright acceptance scenarios for live preview, save and cancel, uploads, removal and reload. Move existing theme E2E actions to the approved control location.
- [ ] GREEN. Add `appearance-colors.ts`, `appearance-preview.ts`, `local-font.ts`, and the deferred native dialog in `appearance-panel.*`. Use root variables for color, typography, radius and density. Add licensed same-origin Lora and update shell and widget CSS. The typography roles use built-in names or a validated local asset ID.
- [ ] REFACTOR. Serve selected font faces only, unregister unused faces, and keep cosmetics out of layout data. Verify selected browsers and the production budget. Commit `feat(ui): add Warm Studio appearance editor`.

## 3. Acceptance and release

- [ ] Verify lint, formatting, strict typecheck, unit tests, production build, full Playwright suite, and the twenty-widget benchmark. Capture actual desktop and phone-width screenshots.
- [ ] Review the complete branch independently, resolve important findings with RED → GREEN, and document the acceptance evidence, performance and guide. Commit the release documentation separately.
- [ ] Publish and verify GitHub Actions, Pages, settings restore and local import on the public origin. Schedule the portfolio motion work after the redesign is released.
