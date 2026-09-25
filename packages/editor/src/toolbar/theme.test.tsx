// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY, type ThemeState, useThemePreference } from './theme.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('useThemePreference', () => {
  let state: ThemeState;
  const Probe = ({ host }: { host: 'light' | 'dark' | 'system' }) => {
    state = useThemePreference(host);
    return null;
  };
  const mount = async (host: 'light' | 'dark' | 'system') => {
    const root = createRoot(document.createElement('div'));
    await act(async () => root.render(<Probe host={host} />));
    return root;
  };

  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('follows the system until the author chooses, then remembers the choice', async () => {
    const root = await mount('system');
    expect(state).toMatchObject({ preference: 'system', attribute: 'system', forced: false });
    await act(async () => state.setPreference('dark'));
    expect(state.attribute).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    await act(async () => root.unmount());
    const again = await mount('system');
    expect(state.preference).toBe('dark');
    await act(async () => again.unmount());
  });

  it('lets an explicit host theme win over the remembered choice', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const root = await mount('light');
    expect(state).toMatchObject({ attribute: 'light', forced: true });
    await act(async () => root.unmount());
  });

  it('ignores an unknown stored value and survives blocked storage', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    const root = await mount('system');
    expect(state.preference).toBe('system');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await act(async () => state.setPreference('light'));
    expect(state.attribute).toBe('light');
    await act(async () => root.unmount());
  });
});
