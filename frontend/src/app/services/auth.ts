import { Injectable, computed, signal } from '@angular/core';

export interface AuthUser {
  _id?: string;
  username: string;
  email: string;
  role: string;
}

const TOKEN_KEY = 'token';
const USER_KEY = 'userDetails';

/**
 * Single source of truth for the signed-in session. The navbar, guards, login,
 * logout and the HTTP interceptor all read the same signals, so the UI updates
 * the moment the session changes.
 *
 * Only { _id, username, email, role } is ever persisted — never the raw server
 * response.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _token = signal<string | null>(this.readToken());
  private readonly _user = signal<AuthUser | null>(this.readUser());

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());
  readonly isAdmin = computed(() => this._user()?.role?.toLowerCase() === 'admin');

  /** Checks token expiry at call time (guards use this); clears a stale session. */
  hasValidSession(): boolean {
    const token = this._token();
    if (!token) return false;
    if (this.isExpired(token)) {
      this.clear();
      return false;
    }
    return true;
  }

  setSession(token: string, user: Partial<AuthUser>): void {
    const safeUser: AuthUser = {
      _id: user._id,
      username: user.username ?? '',
      email: user.email ?? '',
      role: user.role ?? 'User',
    };
    this.write(TOKEN_KEY, token);
    this.write(USER_KEY, JSON.stringify(safeUser));
    this._token.set(token);
    this._user.set(safeUser);
  }

  updateUser(user: Partial<AuthUser>): void {
    const current = this._user();
    if (!current) return;
    const next: AuthUser = {
      _id: current._id,
      username: user.username ?? current.username,
      email: user.email ?? current.email,
      role: current.role,
    };
    this.write(USER_KEY, JSON.stringify(next));
    this._user.set(next);
  }

  /** Removes only the auth keys (not the whole sessionStorage). */
  clear(): void {
    this.remove(TOKEN_KEY);
    this.remove(USER_KEY);
    this._token.set(null);
    this._user.set(null);
  }

  private readToken(): string | null {
    const token = this.read(TOKEN_KEY);
    if (token && this.isExpired(token)) {
      this.remove(TOKEN_KEY);
      this.remove(USER_KEY);
      return null;
    }
    return token;
  }

  private readUser(): AuthUser | null {
    const raw = this.read(USER_KEY);
    if (!raw || !this.read(TOKEN_KEY)) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && typeof parsed.username === 'string') {
        return {
          _id: parsed._id,
          username: parsed.username,
          email: String(parsed.email ?? ''),
          role: String(parsed.role ?? 'User'),
        };
      }
    } catch {
      // corrupt data — fall through and discard it
    }
    this.remove(USER_KEY);
    return null;
  }

  private isExpired(token: string): boolean {
    try {
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const { exp } = JSON.parse(atob(payload));
      return typeof exp === 'number' && exp * 1000 <= Date.now();
    } catch {
      return true; // malformed token
    }
  }

  // sessionStorage can throw (blocked storage, private mode) — never let that break the app.
  private read(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }
  private write(key: string, value: string): void {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }
  private remove(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
