export type Theme = 'system' | 'light' | 'dark';

export const THEME_KEY = 'antigone.theme';

// Matches --bg, so the iOS status bar blends into the page.
const SURFACE = { light: '#f2f2f7', dark: '#000000' };

/** Forces a theme via data-theme, or follows the device when `system`. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;

  // index.html has one theme-color tag per scheme; a forced theme pins both to its colour.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = meta.getAttribute('media')?.includes('dark') ? 'dark' : 'light';
    meta.content = SURFACE[theme === 'system' ? scheme : theme];
  }
}
