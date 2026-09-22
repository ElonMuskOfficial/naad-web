/**
 * Theme is an explicit choice (Settings), not just prefers-color-scheme — applied to
 * <html data-theme> before first paint by the inline script in app.html; this store only
 * needs to keep that attribute and localStorage in sync once the app is running.
 */
const KEY = 'naad:theme';
export type Theme = 'dark' | 'light';

function systemPrefersLight(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches;
}

class ThemeStore {
  current = $state<Theme>(
    (typeof document !== 'undefined' && (document.documentElement.dataset.theme as Theme)) ||
      (systemPrefersLight() ? 'light' : 'dark'),
  );

  set(theme: Theme) {
    this.current = theme;
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // Private browsing / storage disabled: theme just won't persist across reloads.
    }
  }

  toggle() {
    this.set(this.current === 'dark' ? 'light' : 'dark');
  }
}

export const theme = new ThemeStore();
