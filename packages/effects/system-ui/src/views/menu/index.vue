<script lang="ts" setup>
import type { MenuType, SysMenu } from '../../api';

import { computed, onMounted, reactive, ref } from 'vue';

import { ConfirmDialog } from '@describeadmin/ele-ui';
import { IconPicker, Page, VbenIcon } from '@describeadmin/ui';

import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
  ElTreeSelect,
} from 'element-plus';

import {
  createMenuApi,
  deleteMenuApi,
  getMenuTreeApi,
  updateMenuApi,
} from '../../api';

defineOptions({ name: 'SystemMenu' });

const loading = ref(false);
const tree = ref<SysMenu[]>([]);

const formVisible = ref(false);
const submitting = ref(false);
const editingId = ref<null | number>(null);
const formRef = ref();

/** 同 dept：表单模型与实体分开，避免为可空字段在每个控件上做 null 处理。 */
interface MenuForm {
  activePath: string;
  component: string;
  icon: string;
  menuName: string;
  menuType: MenuType;
  parentId: number;
  path: string;
  permCode: string;
  sort: number;
  version?: number;
  visible: number;
}

const form = reactive<MenuForm>({
  activePath: '',
  component: '',
  icon: '',
  menuName: '',
  menuType: 'MENU',
  parentId: 0,
  path: '',
  permCode: '',
  sort: 0,
  visible: 1,
});

const rules = {
  menuName: [{ required: true, message: '请输入菜单名称', trigger: 'blur' }],
  menuType: [{ required: true, message: '请选择类型', trigger: 'change' }],
};

const confirmVisible = ref(false);
const deletingId = ref<null | number>(null);

const tableRef = ref();
const expanded = ref(false);

/**
 * 展开 / 收起全部。
 *
 * 树表默认全收起（不用 default-expand-all）——菜单一多整页塞满就找不到东西了。
 * 但全收起之后没有快速展开的手段，所以配一个开关。
 *
 * 用 ElTable 的 toggleRowExpansion 而不是受控的 expand-row-keys：后者在用户手动
 * 展开某行后不会回写数组，于是「收起全部」在数组本就是 [] 时不产生变化、点了没反应。
 */
function toggleExpandAll() {
  const next = !expanded.value;
  const walk = (rows: SysMenu[]) => {
    rows.forEach((row) => {
      if (row.children?.length) {
        tableRef.value?.toggleRowExpansion(row, next);
        walk(row.children);
      }
    });
  };
  walk(tree.value);
  expanded.value = next;
}

const parentOptions = ref<SysMenu[]>([]);

/** BUTTON 是权限点，不产生路由，因此路径与组件两栏对它无意义。 */
const isButton = computed(() => form.menuType === 'BUTTON');

const TYPE_LABEL: Record<MenuType, string> = {
  BUTTON: '按钮',
  DIR: '目录',
  MENU: '菜单',
};

/**
 * 后端把 Long 序列化成字符串（雪花 ID 安全，见 CLAUDE.md §4.8），菜单树的 id / parentId
 * 因此是 "0" / "1" … ElTreeSelect 用严格相等匹配 node-key，字符串 "0" 配不上合成根节点的
 * 数字 0，编辑顶层菜单时「上级菜单」框只显示原始的 "0"。在消费前统一转回数字，让
 * form.parentId / 树节点 id / 合成根 三者类型一致。
 */
function normalizeIds(nodes: SysMenu[]) {
  for (const node of nodes) {
    if (node.id !== null && node.id !== undefined) {
      node.id = Number(node.id);
    }
    if (node.parentId !== null && node.parentId !== undefined) {
      node.parentId = Number(node.parentId);
    }
    if (node.children?.length) normalizeIds(node.children);
  }
}

async function load() {
  loading.value = true;
  try {
    tree.value = await getMenuTreeApi();
    normalizeIds(tree.value);
    // 数据重建后 ElTable 的展开态全部丢失，按钮文案要跟着回到「展开全部」
    expanded.value = false;
    parentOptions.value = [
      { children: tree.value, id: 0, menuName: '顶层菜单' } as SysMenu,
    ];
  } finally {
    loading.value = false;
  }
}

function openCreate(parentId: number = 0) {
  editingId.value = null;
  Object.assign(form, {
    activePath: '',
    component: '',
    icon: '',
    menuName: '',
    menuType: 'MENU',
    parentId,
    path: '',
    permCode: '',
    sort: 0,
    visible: 1,
  });
  formVisible.value = true;
}

function openEdit(row: SysMenu) {
  editingId.value = row.id ?? null;
  Object.assign(form, {
    activePath: row.activePath ?? '',
    component: row.component ?? '',
    icon: row.icon ?? '',
    menuName: row.menuName ?? '',
    menuType: row.menuType ?? 'MENU',
    parentId: row.parentId ?? 0,
    path: row.path ?? '',
    permCode: row.permCode ?? '',
    sort: row.sort ?? 0,
    version: row.version,
    visible: row.visible ?? 1,
  });
  formVisible.value = true;
}

async function submit() {
  await formRef.value?.validate();
  submitting.value = true;
  try {
    const payload: SysMenu = {
      ...form,
      // 按钮不参与路由，路径与组件强制置空，避免留下会生成坏路由的脏数据
      activePath: isButton.value ? null : form.activePath || null,
      component: isButton.value ? null : form.component || null,
      path: isButton.value ? null : form.path || null,
    };
    await (editingId.value === null
      ? createMenuApi(payload)
      : updateMenuApi(editingId.value, payload));
    ElMessage.success(editingId.value === null ? '新增成功' : '保存成功');
    formVisible.value = false;
    await load();
  } finally {
    submitting.value = false;
  }
}

function askDelete(row: SysMenu) {
  deletingId.value = row.id ?? null;
  confirmVisible.value = true;
}

async function confirmDelete() {
  if (deletingId.value === null) {
    return;
  }
  submitting.value = true;
  try {
    await deleteMenuApi(deletingId.value);
    ElMessage.success('删除成功');
    confirmVisible.value = false;
    await load();
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  try {
    await load();
  } catch {
    // 已经由请求层的全局拦截器处理（弹出提示、401 时跳转登录页），这里只需要
    // 避免异常继续冒泡成 Vue 的 "Unhandled error during execution of mounted hook"。
  }
});
</script>

<template>
  <Page
    description="菜单同时定义前端路由与按钮级权限点，两者共用同一份数据"
    title="菜单管理"
  >
    <template #extra>
      <ElButton data-testid="menu-expand-toggle-btn" @click="toggleExpandAll">
        {{ expanded ? '收起全部' : '展开全部' }}
      </ElButton>
      <ElButton
        type="primary"
        data-testid="menu-add-btn"
        @click="openCreate(0)"
      >
        新增
      </ElButton>
    </template>

    <!-- 刻意不加 default-expand-all：菜单一多整页塞满，找不到东西。默认全收起，
         需要时用头部的「展开全部」。 -->
    <ElTable
      ref="tableRef"
      v-loading="loading"
      :data="tree"
      row-key="id"
      :tree-props="{ children: 'children' }"
      data-testid="menu-table"
    >
      <ElTableColumn prop="menuName" label="菜单名称" min-width="180" />
      <ElTableColumn align="center" label="图标" width="70">
        <template #default="{ row }">
          <!-- 与侧边栏同一个渲染组件，这里看到什么、菜单里就是什么。
               必须带 inline-block：Tailwind 的 preflight 把 svg 设成了 display: block，
               块级元素不吃单元格的 text-align: center，会一直贴在格子左边，
               看起来就是「表头居中、图标靠左」。 -->
          <VbenIcon
            v-if="row.icon"
            :icon="row.icon"
            class="inline-block size-4"
          />
          <span v-else class="text-muted-foreground">—</span>
        </template>
      </ElTableColumn>
      <ElTableColumn align="center" label="类型" width="90">
        <template #default="{ row }">
          <ElTag
            :type="
              row.menuType === 'BUTTON'
                ? 'info'
                : row.menuType === 'DIR'
                  ? 'warning'
                  : 'success'
            "
          >
            {{ TYPE_LABEL[row.menuType as MenuType] ?? row.menuType }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="permCode" label="权限标识" min-width="180" />
      <ElTableColumn prop="path" label="路由路径" min-width="160" />
      <ElTableColumn prop="component" label="组件路径" min-width="180" />
      <ElTableColumn align="center" label="显示" width="80">
        <template #default="{ row }">
          <ElTag v-if="row.menuType === 'BUTTON'" type="info">—</ElTag>
          <ElTag v-else-if="row.visible === 0" type="warning">隐藏</ElTag>
          <ElTag v-else type="success">显示</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="sort" label="排序" width="80" />
      <ElTableColumn label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <ElButton
            link
            type="primary"
            data-testid="menu-add-child-btn"
            @click="openCreate(row.id)"
          >
            新增下级
          </ElButton>
          <ElButton
            link
            type="primary"
            data-testid="menu-edit-btn"
            @click="openEdit(row)"
          >
            编辑
          </ElButton>
          <ElButton
            link
            type="danger"
            data-testid="menu-delete-btn"
            @click="askDelete(row)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <ElDialog
      v-model="formVisible"
      :title="editingId === null ? '新增菜单' : '编辑菜单'"
      width="560px"
      append-to-body
      data-testid="menu-form-dialog"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="100px">
        <ElFormItem label="上级菜单" prop="parentId">
          <ElTreeSelect
            v-model="form.parentId"
            :data="parentOptions"
            :props="{ children: 'children', label: 'menuName' }"
            node-key="id"
            check-strictly
            data-testid="menu-parent-id-input"
          />
        </ElFormItem>
        <ElFormItem label="类型" prop="menuType">
          <ElSelect v-model="form.menuType" data-testid="menu-menu-type-input">
            <ElOption label="目录" value="DIR" />
            <ElOption label="菜单" value="MENU" />
            <ElOption label="按钮" value="BUTTON" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="菜单名称" prop="menuName">
          <ElInput
            v-model="form.menuName"
            data-testid="menu-menu-name-input"
            placeholder="请输入菜单名称"
          />
        </ElFormItem>
        <ElFormItem label="权限标识" prop="permCode">
          <ElInput
            v-model="form.permCode"
            data-testid="menu-perm-code-input"
            placeholder="如 system:user:add，前端 v-access:code 用它控制显隐"
          />
        </ElFormItem>
        <ElFormItem v-if="!isButton" label="路由路径" prop="path">
          <ElInput
            v-model="form.path"
            data-testid="menu-path-input"
            placeholder="如 /system/user"
          />
        </ElFormItem>
        <ElFormItem v-if="!isButton" label="组件路径" prop="component">
          <ElInput
            v-model="form.component"
            data-testid="menu-component-input"
            placeholder="相对 src/views，不带 .vue；目录填 BasicLayout"
          />
        </ElFormItem>
        <!-- 图标不再让人手填 `lucide:xxx`：从面板里选，值仍是同一个 iconify 名称。
             readonly 挡住手输（清空走面板内的按钮，EP 的 clearable 在 readonly 下不显示）；
             z-index 必须抬高到 3000——ElDialog 的弹层从 2000 起自增，否则面板会被压在弹窗下面。 -->
        <ElFormItem v-if="!isButton" label="图标" prop="icon">
          <IconPicker
            v-model="form.icon"
            clearable
            data-testid="menu-icon-input"
            :input-component="ElInput"
            icon-slot="append"
            :page-size="48"
            prefix="lucide"
            :readonly="true"
            :z-index="3000"
          />
        </ElFormItem>
        <ElFormItem label="排序" prop="sort">
          <ElInputNumber
            v-model="form.sort"
            :min="0"
            data-testid="menu-sort-input"
          />
        </ElFormItem>
        <ElFormItem v-if="!isButton" label="显示" prop="visible">
          <div class="flex flex-col">
            <ElSwitch
              v-model="form.visible"
              :active-value="1"
              :inactive-value="0"
              data-testid="menu-visible-input"
            />
            <span class="text-muted-foreground mt-1 text-xs">
              关闭后不出现在侧边栏，但页面仍可访问（前提是角色已授权）。
              独立的新增/编辑页就这么建。
            </span>
          </div>
        </ElFormItem>
        <ElFormItem v-if="!isButton && form.visible === 0" label="高亮菜单">
          <div class="flex flex-col">
            <ElInput
              v-model="form.activePath"
              data-testid="menu-active-path-input"
              placeholder="如 /system/user"
            />
            <span class="text-muted-foreground mt-1 text-xs">
              填所属列表页的路由路径。不填的话，进入本页后侧边栏没有任何一项高亮。
            </span>
          </div>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton data-testid="menu-cancel-btn" @click="formVisible = false">
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="submitting"
          data-testid="menu-submit-btn"
          @click="submit"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>

    <ConfirmDialog
      v-model="confirmVisible"
      testid="menu"
      :loading="submitting"
      message="删除菜单会同时影响已授予该菜单的角色。确定继续？"
      @confirm="confirmDelete"
    />
  </Page>
</template>
