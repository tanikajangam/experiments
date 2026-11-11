// The on-device copy of the last-loaded data and the pending writes, in IndexedDB, so the app opens
// instantly and offline. One key holds everything, so data and queue are always saved together.
import { createStore, del, get, set } from 'idb-keyval'
import type { Cache, Snapshot } from './backend.ts'

export function idbCache(): Cache {
  const db = createStore('experiments', 'cache')
  return {
    async read() {
      try {
        return ((await get('snapshot', db)) as Snapshot | undefined) ?? null
      } catch {
        return null
      }
    },
    async write(snapshot) {
      try {
        await set('snapshot', snapshot, db)
      } catch (e) {
        console.error('Could not save the offline copy', e)
      }
    },
    async clear() {
      try {
        await del('snapshot', db)
      } catch {
        // Nothing to clear.
      }
    },
  }
}
