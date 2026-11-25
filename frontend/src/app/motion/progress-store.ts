import { Injectable } from '@angular/core';

/** Entries older than this are pruned. */
export const PROGRESS_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const PREFIX = 'cwm.';
const VERSION = 'v1';

interface Entry<T> { t: number; v: T }

/**
 * Small, versioned `localStorage` wrapper for things the cook did on this
 * device (checked ingredients, done steps, the Cook Mode step).
 *
 * Keys are `cwm.<thing>.v1.<id>`. Every access is wrapped: when storage is
 * blocked or full the store silently falls back to memory, so features keep
 * working for the session and never throw.
 */
@Injectable({ providedIn: 'root' })
export class ProgressStore {
  private readonly memory = new Map<string, string>();
  private pruned = false;

  get<T>(thing: string, id: string): T | null {
    this.prune();
    const entry = this.read<T>(this.key(thing, id));
    return entry ? entry.v : null;
  }

  set<T>(thing: string, id: string, value: T, now = Date.now()): void {
    const key = this.key(thing, id);
    const raw = JSON.stringify({ t: now, v: value } satisfies Entry<T>);
    this.memory.set(key, raw);
    try {
      localStorage.setItem(key, raw);
    } catch {
      /* blocked or full — the in-memory copy still serves this session */
    }
  }

  remove(thing: string, id: string): void {
    const key = this.key(thing, id);
    this.memory.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  /** Every live entry of one kind, newest first. */
  list<T>(thing: string): Array<{ id: string; value: T; updatedAt: number }> {
    this.prune();
    const prefix = `${PREFIX}${thing}.${VERSION}.`;
    const out: Array<{ id: string; value: T; updatedAt: number }> = [];
    for (const key of this.keys()) {
      if (!key.startsWith(prefix)) continue;
      const entry = this.read<T>(key);
      if (entry) out.push({ id: key.slice(prefix.length), value: entry.v, updatedAt: entry.t });
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /** Drop everything older than 14 days (runs once per session, and on demand in tests). */
  prune(now = Date.now(), force = false): void {
    if (this.pruned && !force) return;
    this.pruned = true;
    for (const key of this.keys()) {
      if (!key.startsWith(PREFIX)) continue;
      const entry = this.parse(this.raw(key));
      if (!entry || now - entry.t > PROGRESS_TTL_MS) {
        this.memory.delete(key);
        try {
          localStorage.removeItem(key);
        } catch {
          /* ignore */
        }
      }
    }
  }

  private key(thing: string, id: string) {
    return `${PREFIX}${thing}.${VERSION}.${id}`;
  }

  private keys(): string[] {
    const keys = new Set(this.memory.keys());
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) keys.add(key);
      }
    } catch {
      /* ignore */
    }
    return [...keys];
  }

  private raw(key: string): string | null {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return stored;
    } catch {
      /* fall through to memory */
    }
    return this.memory.get(key) ?? null;
  }

  private parse<T>(raw: string | null): Entry<T> | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && typeof parsed.t === 'number' && 'v' in parsed ? (parsed as Entry<T>) : null;
    } catch {
      return null;
    }
  }

  private read<T>(key: string): Entry<T> | null {
    const entry = this.parse<T>(this.raw(key));
    return entry && Date.now() - entry.t <= PROGRESS_TTL_MS ? entry : null;
  }
}
