import { DestroyRef, inject, Injectable } from '@angular/core';
import type { Workspace } from '../dashboard/workspace';
import { isStoredWorkspace, isWorkspace, type StoredWorkspace } from './schema';

const STORE = 'workspaces';
const KEY = 'workspace';

export class RevisionConflict extends Error {}

@Injectable({ providedIn: 'root' })
export class IndexedDbWorkspace {
  private connection?: Promise<IDBDatabase>;

  constructor() {
    inject(DestroyRef).onDestroy(
      () =>
        void this.connection?.then(
          (db) => db.close(),
          () => undefined,
        ),
    );
  }

  async read(): Promise<StoredWorkspace | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readonly');
      const request = transaction.objectStore(STORE).get(KEY);
      transaction.onabort = () => reject(transaction.error ?? new Error('Read aborted'));
      transaction.oncomplete = () => {
        const record: unknown = request.result;
        if (record === undefined) resolve(null);
        else if (isStoredWorkspace(record)) resolve(record);
        else reject(new Error('Unsupported or invalid workspace snapshot'));
      };
    });
  }

  async write(workspace: Workspace, expectedRevision: number): Promise<number> {
    if (!isWorkspace(workspace)) throw new Error('Invalid workspace snapshot');
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      const request = store.get(KEY);
      const revision = expectedRevision + 1;
      transaction.onabort = () => reject(transaction.error ?? new Error('Write aborted'));
      transaction.oncomplete = () => resolve(revision);
      request.onsuccess = () => {
        const record: unknown = request.result;
        if (record !== undefined && !isStoredWorkspace(record)) {
          reject(new Error('Invalid saved workspace'));
          transaction.abort();
          return;
        }
        if ((record?.revision ?? 0) !== expectedRevision) {
          reject(new RevisionConflict());
          transaction.abort();
          return;
        }
        store.put({ schemaVersion: 1, revision, workspace } satisfies StoredWorkspace, KEY);
      };
    });
  }

  private open(): Promise<IDBDatabase> {
    this.connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('dashforge', 1);
      let abandoned = false;
      request.onblocked = () => {
        abandoned = true;
        reject(new Error('Opening workspace is blocked'));
      };
      request.onerror = () =>
        reject(request.error ?? new Error('Workspace storage is unavailable'));
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => {
        const db = request.result;
        if (abandoned) {
          db.close();
          return;
        }
        db.onversionchange = () => {
          db.close();
          this.connection = undefined;
        };
        resolve(db);
      };
    }).catch((error: unknown) => {
      this.connection = undefined;
      throw error;
    });
    return this.connection;
  }
}
