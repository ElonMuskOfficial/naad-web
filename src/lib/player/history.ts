import { formatIsoWithOffset } from './math';
import { getStoredEngineUrl } from '$lib/api/client';

export interface ListenContext {
  type: string;
  id: string;
}

export interface ListenEntry {
  trackId: string;
  startedAt: string; // ISO 8601 with timezone offset
  msPlayed: number;
  completed?: boolean;
  context?: ListenContext;
  sourceProvider?: string;
}

const BATCH_SIZE_LIMIT = 20;
const FLUSH_INTERVAL_MS = 60_000;

export class HistoryTracker {
  private queue: ListenEntry[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.handlePageHide);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private handlePageHide = () => {
    this.flush();
  };

  private handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.flush();
    }
  };

  /**
   * Records a listen event into the pending batch.
   * If batch reaches 20 items, triggers an immediate flush.
   */
  record(entry: {
    trackId: string;
    startedAt?: string | Date;
    msPlayed: number;
    completed?: boolean;
    context?: ListenContext;
    sourceProvider?: string;
  }) {
    const startedAt =
      entry.startedAt instanceof Date
        ? formatIsoWithOffset(entry.startedAt)
        : (entry.startedAt ?? formatIsoWithOffset());

    this.queue.push({
      trackId: entry.trackId,
      startedAt,
      msPlayed: Math.round(entry.msPlayed),
      completed: entry.completed,
      context: entry.context,
      sourceProvider: entry.sourceProvider,
    });

    if (this.queue.length >= BATCH_SIZE_LIMIT) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.flush();
      }, FLUSH_INTERVAL_MS);
    }
  }

  getPendingCount(): number {
    return this.queue.length;
  }

  getPendingItems(): readonly ListenEntry[] {
    return this.queue;
  }

  /**
   * Flushes the pending listens batch via fetch with keepalive: true.
   */
  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0) return;

    const itemsToSend = [...this.queue];
    this.queue = [];

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (typeof localStorage !== 'undefined') {
      try {
        const apiKey = localStorage.getItem('naad:apiKey');
        if (apiKey) {
          headers.Authorization = `Bearer ${apiKey}`;
        }
      } catch {
        // Storage unavailable
      }
    }

    if (typeof fetch !== 'undefined') {
      const base = getStoredEngineUrl() ?? '';
      fetch(`${base}/v1/history`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ listens: itemsToSend }),
        keepalive: true,
      }).catch((err) => {
        console.warn('Failed to flush history listens:', err);
        // Put items back if not destroyed
        if (!this.isDestroyed) {
          this.queue.unshift(...itemsToSend);
        }
      });
    }
  }

  destroy() {
    this.isDestroyed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.handlePageHide);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }
}

export const historyTracker = new HistoryTracker();
