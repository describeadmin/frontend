import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
} from '@describeadmin/types';

import { generateAccessible } from '@describeadmin/access';
import { preferences } from '@describeadmin/preferences';
import { systemPageMap } from '@describeadmin/system-ui';

import { ElMessage } from 'element-plus';

import { getAllMenusApi } from '#/api';
import { BasicLayout, IFrameView } from '#/layouts';
import { $t } from '#/locales';

const forbiddenComponent = () => import('#/views/_core/fallback/forbidden.vue');

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  // systemPageMap 展开在前：同一 key 时业务方本地 views 覆盖框架默认页面，
  // 而不是反过来被框架默认页面隐性吃掉（曾经的 dashboard/index.vue 就踩过这个坑）
  const pageMap: ComponentRecordType = {
    ...systemPageMap,
    ...import.meta.glob('../views/**/*.vue'),
  };

  const layoutMap: ComponentRecordType = {
    BasicLayout,
    IFrameView,
  };

  return await generateAccessible(preferences.app.accessMode, {
    ...options,
    fetchMenuListAsync: async () => {
      ElMessage({
        duration: 1500,
        message: `${$t('common.loadingMenu')}...`,
      });
      return await getAllMenusApi();
    },
    // 可以指定没有权限跳转403页面
    forbiddenComponent,
    // 如果 route.meta.menuVisibleWithForbidden = true
    layoutMap,
    pageMap,
  });
}

export { generateAccess };
