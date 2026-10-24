export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'tgh-theme';

/**
 * Inlined in <head> so the right theme is on <html> before the first paint.
 * An explicit choice wins; otherwise the operating system decides.
 */
export const themeBootScript = `(function(){var d=document.documentElement,t;try{t=localStorage.getItem('${THEME_STORAGE_KEY}')}catch(e){}if(t!=='light'&&t!=='dark'){t=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}d.dataset.theme=t})();`;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme, remember: boolean) {
  document.documentElement.dataset.theme = theme;
  if (!remember) return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode / blocked storage: the choice just won't survive a reload.
  }
}

export function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}
