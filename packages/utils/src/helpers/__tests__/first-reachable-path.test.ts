import { describe, expect, it } from 'vitest';

import { firstReachablePath } from '../first-reachable-path';

describe('firstReachablePath', () => {
  it('returns null for an empty or missing tree', () => {
    expect(firstReachablePath()).toBeNull();
    expect(firstReachablePath([])).toBeNull();
  });

  it('prefers a leaf over the directory node holding it', () => {
    const menus: any[] = [
      {
        path: '/system',
        children: [
          { path: '/system/user', children: [] },
          { path: '/system/role', children: [] },
        ],
      },
    ];
    expect(firstReachablePath(menus)).toBe('/system/user');
  });

  it('falls back to the node itself when it has no children', () => {
    expect(firstReachablePath([{ path: '/workspace' }])).toBe('/workspace');
  });

  it('descends depth-first, leftmost wins', () => {
    const menus: any[] = [
      { path: '/a', children: [{ path: '/a/b', children: [] }] },
      { path: '/c', children: [] },
    ];
    expect(firstReachablePath(menus)).toBe('/a/b');
  });

  it('skips paths carrying route params — they cannot be navigated to as-is', () => {
    const menus: any[] = [
      { path: '/detail/:id', children: [] },
      { path: '/system/user', children: [] },
    ];
    expect(firstReachablePath(menus)).toBe('/system/user');
  });

  it('returns null when every candidate needs route params', () => {
    const menus: any[] = [
      { path: '/detail/:id', children: [{ path: '/detail/:id/edit' }] },
    ];
    expect(firstReachablePath(menus)).toBeNull();
  });

  it('ignores nodes without a path but still walks their children', () => {
    const menus: any[] = [
      { children: [{ path: '/system/user', children: [] }] },
    ];
    expect(firstReachablePath(menus)).toBe('/system/user');
  });
});
