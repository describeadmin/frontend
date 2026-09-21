import { computed } from 'vue';

import { useAccessStore } from '@describeadmin/stores';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePermission } from '../use-permission';

describe('usePermission', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('拼接 prefix 与 action 后精确比对权限码', () => {
    useAccessStore().setAccessCodes(['system:user:list', 'system:user:edit']);
    const { can } = usePermission('system:user');

    expect(can('list')).toBe(true);
    expect(can('edit')).toBe(true);
    expect(can('add')).toBe(false);
    expect(can('remove')).toBe(false);
  });

  it('前缀不同的同名 action 不会互相命中', () => {
    useAccessStore().setAccessCodes(['system:role:add']);

    expect(usePermission('system:user').can('add')).toBe(false);
    expect(usePermission('system:role').can('add')).toBe(true);
    // 不做任何前缀模糊匹配：'system:user' 不是 'system:user-group' 的前缀语义
    expect(usePermission('system:user-group').can('add')).toBe(false);
  });

  it('canAny 任一命中即为 true，用于整列/整块是否渲染', () => {
    useAccessStore().setAccessCodes(['system:user:remove']);
    const { canAny } = usePermission('system:user');

    expect(canAny('edit', 'remove')).toBe(true);
    expect(canAny('add', 'edit')).toBe(false);
    expect(canAny()).toBe(false);
  });

  it('权限码为空时一律为 false', () => {
    const { can, canAny } = usePermission('system:user');

    expect(can('list')).toBe(false);
    expect(canAny('add', 'edit', 'remove')).toBe(false);
  });

  it('权限码变化后结果跟着变（渲染时重算的前提）', () => {
    const store = useAccessStore();
    const { can } = usePermission('system:user');
    // 模拟模板里的调用：包在 computed 里才能观察到依赖收集是否成立
    const canAdd = computed(() => can('add'));

    expect(canAdd.value).toBe(false);
    store.setAccessCodes(['system:user:add']);
    expect(canAdd.value).toBe(true);
    store.setAccessCodes([]);
    expect(canAdd.value).toBe(false);
  });
});
