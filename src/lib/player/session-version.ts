/**
 * The saved player session (current track, queue) holds whole track objects. When the engine behind the app
 * changes, their ids stop existing there, so the session is wiped once per data version.
 * Version 2: the naad engine (JioSaavn ids).
 */
export const DATA_VERSION_KEY = 'naad:dataVersion';
export const DATA_VERSION = '2';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Returns true when it wiped or initialised the version, false when nothing was needed (or storage failed). */
export function migrateSession(storage: Store, sessionKeys: string[]): boolean {
  try {
    if (storage.getItem(DATA_VERSION_KEY) === DATA_VERSION) return false;
    for (const key of sessionKeys) storage.removeItem(key);
    storage.setItem(DATA_VERSION_KEY, DATA_VERSION);
    return true;
  } catch {
    return false;
  }
}
