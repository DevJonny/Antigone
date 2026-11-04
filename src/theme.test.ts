// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme } from './theme';

const metas = () => [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) => m.content);

beforeEach(() => {
  document.head.innerHTML = `
    <meta name="theme-color" content="#f2f2f7" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />`;
  delete document.documentElement.dataset.theme;
});

describe('applyTheme', () => {
  it('forces a theme and pins the status bar colour to it', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(metas()).toEqual(['#000000', '#000000']);
  });

  it('returns to the device setting', () => {
    applyTheme('light');
    applyTheme('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(metas()).toEqual(['#f2f2f7', '#000000']);
  });
});
