import { readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import { gzipSync } from 'node:zlib';
import { chromium, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:4173';
const buildPath = 'dist/dashforge/browser';
const runs = 5;
const viewport = { width: 1280, height: 850 };
const types = ['clock', 'bookmarks', 'notes', 'calendar'];

function workspace(count) {
  const initial = {
    clock: { hourFormat: '24', timeZone: '' },
    bookmarks: { links: [] },
    notes: { notes: [] },
    calendar: { events: [] },
  };
  const widgets = Array.from({ length: count }, (_, i) => {
    const type = types[i % types.length];
    return {
      id: `22345678-1234-4234-8234-${String(i + 1).padStart(12, '0')}`,
      type,
      data: initial[type],
    };
  });
  const desktop = Object.fromEntries(
    widgets.map((item, i) => [
      item.id,
      i === 0
        ? { col: 0, row: 0, width: 3, height: 2 }
        : { col: ((i - 1) % 2) * 6, row: 8 + Math.floor((i - 1) / 2) * 5, width: 6, height: 5 },
    ]),
  );
  return { schemaVersion: 1, revision: 1, workspace: { theme: 'light', widgets, desktop } };
}

async function seed(page, value) {
  await page.route(`${origin}/__measure_fixture`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Bench fixture</title>',
    }),
  );
  await page.goto(`${origin}/__measure_fixture`);
  await page.evaluate(
    (fixture) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('dashforge', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('workspaces');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('workspaces', 'readwrite');
          transaction.objectStore('workspaces').put(fixture, 'workspace');
          transaction.onabort = () => reject(transaction.error);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
        };
      }),
    value,
  );
}

async function instrument(page, count) {
  await page.addInitScript((expected) => {
    const measure = { ready: null, transactions: [], longTasks: [] };
    window.dashforgeMeasures = measure;
    const native = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      const start = performance.now();
      const transaction = native.apply(this, args);
      transaction.addEventListener(
        'complete',
        () => {
          measure.transactions.push({ mode: transaction.mode, ms: performance.now() - start });
        },
        { once: true },
      );
      return transaction;
    };
    new PerformanceObserver((list) => {
      for (const task of list.getEntries()) measure.longTasks.push(task.duration);
    }).observe({ type: 'longtask', buffered: true });
    const observer = new MutationObserver(() => {
      const cards = [...document.querySelectorAll('[data-widget-id]')];
      if (
        cards.length === expected &&
        cards.every((card) =>
          card.querySelector(`app-${card.getAttribute('data-widget-type')}-widget`),
        )
      ) {
        measure.ready = performance.now();
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  }, count);
}

async function metrics(session) {
  const result = await session.send('Performance.getMetrics');
  return Object.fromEntries(result.metrics.map(({ name, value }) => [name, value]));
}

async function ready(page) {
  await page.waitForFunction(() => Number.isFinite(window.dashforgeMeasures?.ready));
}

async function readProfile(browser, count, persisted, reload) {
  const context = await browser.newContext({ viewport });
  try {
    const page = await context.newPage();
    if (persisted) await seed(page, workspace(count));
    await instrument(page, count);
    const session = await context.newCDPSession(page);
    await session.send('Performance.enable');
    await page.goto(origin);
    await ready(page);
    if (reload) {
      await session.send('Performance.disable');
      await session.send('Performance.enable');
      await page.reload();
      await ready(page);
    }
    const measurements = await page.evaluate(() => ({
      ...window.dashforgeMeasures,
      resources: [
        ...new Set(
          performance
            .getEntriesByType('resource')
            .map((entry) => new URL(entry.name).pathname.split('/').at(-1))
            .filter(Boolean),
        ),
      ],
    }));
    const result = await metrics(session);
    return {
      readyMs: measurements.ready,
      readMs: measurements.transactions.find((item) => item.mode === 'readonly')?.ms,
      heapMiB: result.JSHeapUsedSize / 1024 ** 2,
      cpuMs: result.TaskDuration * 1000,
      longTasks: measurements.longTasks.length,
      maxLongTaskMs: Math.max(0, ...measurements.longTasks),
      resources: measurements.resources,
    };
  } finally {
    await context.close();
  }
}

async function gesture(page, handle, dx, dy) {
  const rect = await handle.boundingBox();
  if (!rect) throw new Error('The measured gesture handle is not visible');
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}

async function stress(browser) {
  const context = await browser.newContext({ viewport });
  try {
    const page = await context.newPage();
    await seed(page, workspace(20));
    await instrument(page, 20);
    const session = await context.newCDPSession(page);
    await session.send('Performance.enable');
    await page.goto(origin);
    await ready(page);
    await page.getByRole('button', { name: 'Edit Layout' }).click();
    const card = page.locator('[data-widget-type="clock"]').first();
    const boardRect = await page.locator('.board').boundingBox();
    if (!boardRect) throw new Error('Missing board');
    const step = (boardRect.width + 12) / 12;
    const collect = async () => {
      await session.send('HeapProfiler.collectGarbage');
      const snapshot = await metrics(session);
      return {
        heapMiB: snapshot.JSHeapUsedSize / 1024 ** 2,
        nodes: (await session.send('Memory.getDOMCounters')).nodes,
      };
    };
    const before = await collect();
    const result = { before };
    for (const mode of ['move', 'resize']) {
      const start = await metrics(session);
      await page.evaluate(() => {
        const data = window.dashforgeMeasures;
        data.transactions.length = 0;
        data.longTasks.length = 0;
        data.frames = [];
        const capture = (time) => {
          data.frames.push(time);
          data.frameHandle = requestAnimationFrame(capture);
        };
        data.frameHandle = requestAnimationFrame(capture);
      });
      const durations = [];
      const name = mode === 'move' ? 'Move Clock' : 'Resize Clock';
      for (let i = 0; i < 20; i++) {
        const direction = i % 2 ? -1 : 1;
        const actionStart = performance.now();
        await gesture(
          page,
          card.getByRole('button', { name }),
          step * direction * (mode === 'move' ? 4 : 1),
          mode === 'resize' ? 60 * direction : 0,
        );
        const style = mode === 'move' ? 'grid-column-start' : 'grid-column-end';
        const expected = mode === 'move' ? (i % 2 ? '1' : '5') : i % 2 ? 'span 3' : 'span 4';
        await expect(card).toHaveCSS(style, expected);
        await expect(page.getByText('Saved', { exact: true })).toBeVisible();
        durations.push(performance.now() - actionStart);
      }
      const samples = await page.evaluate(() => {
        const data = window.dashforgeMeasures;
        cancelAnimationFrame(data.frameHandle);
        return {
          writes: data.transactions
            .filter((entry) => entry.mode === 'readwrite')
            .map((entry) => entry.ms),
          longTasks: data.longTasks,
          frames: data.frames.slice(1).map((time, index) => time - data.frames[index]),
        };
      });
      const end = await metrics(session);
      result[mode] = {
        ...samples,
        durations,
        cpuMs: (end.TaskDuration - start.TaskDuration) * 1000,
        elapsedMs: (end.Timestamp - start.Timestamp) * 1000,
      };
      if (samples.writes.length !== 20) throw new Error(`Expected 20 transactions during ${mode}`);
    }
    result.afterGestures = await collect();
    result.lifecycle = [];
    for (let cycle = 0; cycle < 3; cycle++) {
      for (let i = 0; i < 10; i++) {
        const clocks = page.locator('[data-widget-type="clock"]');
        const beforeClocks = await clocks.count();
        await page.getByRole('button', { name: 'Add Widget' }).click();
        await page
          .getByRole('dialog')
          .getByRole('button', { name: /^Clock/ })
          .click();
        await expect(clocks).toHaveCount(beforeClocks + 1);
        await clocks.last().getByRole('button', { name: 'Clock settings' }).click();
        const panel = page.getByRole('dialog', { name: 'Clock settings' });
        await panel.getByRole('button', { name: 'Remove widget' }).click();
        await expect(clocks).toHaveCount(beforeClocks);
        await expect(page.getByText('Saved', { exact: true })).toBeVisible();
      }
      result.lifecycle.push(await collect());
    }
    return result;
  } finally {
    await context.close();
  }
}

async function templateChecks(browser) {
  const context = await browser.newContext({ viewport });
  try {
    const page = await context.newPage();
    await seed(page, workspace(20));
    await instrument(page, 20);
    await page.goto(origin);
    await ready(page);
    const edit = page.getByRole('button', { name: 'Edit Layout' });
    await edit.click();
    const card = page.locator('[data-widget-type="clock"]').first();
    const handle = card.getByRole('button', { name: 'Move Clock' });
    await expect(handle).toBeVisible();
    await page.evaluate(() => {
      if (!window.ng?.ɵsetProfiler) throw new Error('Build with --configuration development');
      window.dashforgeChecks = {};
      // Angular 22 ProfilerEvent.TemplateUpdateStart
      window.ng.ɵsetProfiler((event, instance) => {
        if (event !== 2 || !instance) return;
        const cardId = typeof instance.widget === 'function' ? instance.widget()?.id : undefined;
        const key = instance.constructor.name + (cardId ? ':' + cardId : '');
        window.dashforgeChecks[key] = (window.dashforgeChecks[key] ?? 0) + 1;
      });
    });
    const box = await handle.boundingBox();
    const board = await page.locator('.board').boundingBox();
    if (!box || !board) throw new Error('Missing board or move handle');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const end = x + ((board.width + 12) / 12) * 4;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(end, y, { steps: 20 });
    await expect(page.locator('.placement-preview')).toBeVisible();
    const beforeRelease = await page.evaluate(() => ({ ...window.dashforgeChecks }));
    await page.mouse.up();
    await expect(card).toHaveCSS('grid-column-start', '5');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    const afterRelease = await page.evaluate(() => ({ ...window.dashforgeChecks }));
    return { pointerMoveEvents: 20, beforeRelease, afterRelease };
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch();
try {
  if (process.argv.includes('--dev-checks')) {
    console.log(JSON.stringify(await templateChecks(browser), null, 2));
    process.exitCode = 0;
  } else {
    const results = {};
    for (const [label, count, persisted, reload] of [
      ['firstLoad', 4, false, false],
      ['ordinaryWorkspace', 4, true, false],
      ['fiveWidgets', 5, true, false],
      ['tenWidgets', 10, true, false],
      ['twentyWidgets', 20, true, false],
      ['restoredWorkspace', 4, true, true],
    ]) {
      results[label] = [];
      for (let i = 0; i < runs; i++)
        results[label].push(await readProfile(browser, count, persisted, reload));
    }
    const interactions = await stress(browser);
    const assets = {};
    const index = await readFile(`${buildPath}/index.html`, 'utf8');
    for (const name of await readdir(buildPath)) {
      if (!/\.(js|css)$/.test(name)) continue;
      const contents = await readFile(`${buildPath}/${name}`);
      assets[name] = {
        raw: contents.length,
        gzip: gzipSync(contents, { level: 9 }).length,
        initial: index.includes(name),
      };
    }
    console.log(
      JSON.stringify(
        {
          environment: {
            host: `${os.platform()} ${os.release()} ${os.arch()}`,
            cpu: os.cpus()[0]?.model,
            cores: os.cpus().length,
            memoryGiB: os.totalmem() / 1024 ** 3,
            chromium: browser.version(),
            viewport,
            node: process.version,
            runs,
          },
          assets,
          results,
          interactions,
        },
        null,
        2,
      ),
    );
  }
} finally {
  await browser.close();
}
