<script lang="ts" setup>
import type { MenuType, SysMenu } from '#/api';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@describeadmin/ui';

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
} from '#/api';
import ConfirmDialog from '#/components/confirm-dialog.vue';

defineOptions({ name: 'SystemMenu' });

const loading = ref(false);
const tree = ref<SysMenu[]>([]);

const formVisible = ref(false);
const submitting = ref(false);
const editingId = ref<null | number>(null);
const formRef = ref();

/** 同 dept：表单模型与实体分开，避免为可空字段在每个控件上做 null 处理。 */
interface MenuForm {
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

const parentOptions = ref<SysMenu[]>([]);

/** BUTTON 是权限点，不产生路由，因此路径与组件两栏对它无意义。 */
const isButton = computed(() => form.menuType === 'BUTTON');

const TYPE_LABEL: Record<MenuType, string> = {
  BUTTON: '按钮',
  DIR: '目录',
  MENU: '菜单',
};

async function load() {
  loading.value = true;
  try {
    tree.value = await getMenuTreeApi();
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

onMounted(load);
</script>

<template>
  <Page
    description="菜单同时定义前端路由与按钮级权限点，两者共用同一份数据"
    title="菜单管理"
  >
    <template #extra>
      <ElButton
        type="primary"
        data-testid="menu-add-btn"
        @click="openCreate(0)"
      >
        新增
      </ElButton>
    </template>

    <ElTable
      v-loading="loading"
      :data="tree"
      row-key="id"
      default-expand-all
      :tree-props="{ children: 'children' }"
      data-testid="menu-table"
    >
      <ElTableColumn prop="menuName" label="菜单名称" min-width="180" />
      <ElTableColumn label="类型" width="90">
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
        <ElFormItem v-if="!isButton" label="图标" prop="icon">
          <ElInput
            v-model="form.icon"
            data-testid="menu-icon-input"
            placeholder="如 lucide:users"
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
          <ElSwitch
            v-model="form.visible"
            :active-value="1"
            :inactive-value="0"
            data-testid="menu-visible-input"
          />
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
