<script lang="ts" setup>
import type { SysDept, SysRole, SysUser } from '#/api';

import { onMounted, reactive, ref } from 'vue';

import { ConfirmDialog } from '@describeadmin/ele-ui';
import { Page } from '@describeadmin/ui';

import {
  ElButton,
  ElCheckbox,
  ElCheckboxGroup,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElPagination,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTreeSelect,
} from 'element-plus';

import {
  assignUserRolesApi,
  createUserApi,
  deleteUserApi,
  getDeptTreeApi,
  getRoleListApi,
  getUserListApi,
  getUserRolesApi,
  resetUserPasswordApi,
  updateUserApi,
} from '#/api';

defineOptions({ name: 'SystemUser' });

const loading = ref(false);
const rows = ref<SysUser[]>([]);
const total = ref(0);
const page = reactive({ current: 1, size: 10 });

const deptTree = ref<SysDept[]>([]);

const formVisible = ref(false);
const submitting = ref(false);
const editingId = ref<null | number>(null);
const formRef = ref();

const form = reactive({
  deptId: undefined as number | undefined,
  nickname: '',
  password: '',
  status: 1,
  username: '',
  version: undefined as number | undefined,
});

const rules = {
  nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
  password: [{ required: true, message: '请输入初始密码', trigger: 'blur' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
};

const confirmVisible = ref(false);
const deletingId = ref<null | number>(null);

const pwdVisible = ref(false);
const pwdUserId = ref<null | number>(null);
const newPassword = ref('');

const roleVisible = ref(false);
const roleUserId = ref<null | number>(null);
const allRoles = ref<SysRole[]>([]);
const checkedRoleIds = ref<number[]>([]);

async function load() {
  loading.value = true;
  try {
    const result = await getUserListApi({ ...page });
    rows.value = result.records;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  Object.assign(form, {
    deptId: undefined,
    nickname: '',
    password: '',
    status: 1,
    username: '',
    version: undefined,
  });
  formVisible.value = true;
}

function openEdit(row: SysUser) {
  editingId.value = row.id ?? null;
  Object.assign(form, {
    deptId: row.deptId ?? undefined,
    nickname: row.nickname ?? '',
    // 编辑时不改密码，改密码走「重置密码」，避免把哈希值当明文回填
    password: '',
    status: row.status ?? 1,
    username: row.username ?? '',
    version: row.version ?? undefined,
  });
  formVisible.value = true;
}

async function submit() {
  await formRef.value?.validate();
  submitting.value = true;
  try {
    if (editingId.value === null) {
      await createUserApi({
        deptId: form.deptId,
        nickname: form.nickname,
        password: form.password,
        username: form.username,
      });
      ElMessage.success('新增成功');
    } else {
      // 不提交 password：后端 BaseController 的 update 会整体覆盖实体，
      // 带上空密码会把已有哈希冲掉
      await updateUserApi(editingId.value, {
        deptId: form.deptId,
        nickname: form.nickname,
        status: form.status,
        username: form.username,
        version: form.version,
      });
      ElMessage.success('保存成功');
    }
    formVisible.value = false;
    await load();
  } finally {
    submitting.value = false;
  }
}

function askDelete(row: SysUser) {
  deletingId.value = row.id ?? null;
  confirmVisible.value = true;
}

async function confirmDelete() {
  if (deletingId.value === null) {
    return;
  }
  submitting.value = true;
  try {
    await deleteUserApi(deletingId.value);
    ElMessage.success('删除成功');
    confirmVisible.value = false;
    await load();
  } finally {
    submitting.value = false;
  }
}

function openResetPassword(row: SysUser) {
  pwdUserId.value = row.id ?? null;
  newPassword.value = '';
  pwdVisible.value = true;
}

async function submitResetPassword() {
  if (pwdUserId.value === null || !newPassword.value) {
    ElMessage.warning('请输入新密码');
    return;
  }
  submitting.value = true;
  try {
    await resetUserPasswordApi(pwdUserId.value, newPassword.value);
    ElMessage.success('密码已重置');
    pwdVisible.value = false;
  } finally {
    submitting.value = false;
  }
}

async function openAssignRole(row: SysUser) {
  roleUserId.value = row.id ?? null;
  const [list, owned] = await Promise.all([
    getRoleListApi({ current: 1, size: 200 }),
    getUserRolesApi(row.id as number),
  ]);
  allRoles.value = list.records;
  checkedRoleIds.value = owned;
  roleVisible.value = true;
}

async function submitAssignRole() {
  if (roleUserId.value === null) {
    return;
  }
  submitting.value = true;
  try {
    await assignUserRolesApi(roleUserId.value, checkedRoleIds.value);
    ElMessage.success('授权成功');
    roleVisible.value = false;
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  deptTree.value = await getDeptTreeApi();
  await load();
});
</script>

<template>
  <Page
    description="用户体系由框架的 framework-system-starter 提供，业务方无需实现"
    title="用户管理"
  >
    <template #extra>
      <ElButton type="primary" data-testid="user-add-btn" @click="openCreate">
        新增
      </ElButton>
    </template>

    <ElTable
      v-loading="loading"
      :data="rows"
      row-key="id"
      data-testid="user-table"
    >
      <ElTableColumn prop="username" label="用户名" min-width="140" />
      <ElTableColumn prop="nickname" label="昵称" min-width="140" />
      <ElTableColumn prop="deptName" label="部门" min-width="140" />
      <ElTableColumn label="状态" width="90">
        <template #default="{ row }">
          {{ row.status === 1 ? '启用' : '停用' }}
        </template>
      </ElTableColumn>
      <ElTableColumn prop="createTime" label="创建时间" min-width="180" />
      <ElTableColumn label="操作" width="320" fixed="right">
        <template #default="{ row }">
          <ElButton
            link
            type="primary"
            data-testid="user-assign-role-btn"
            @click="openAssignRole(row)"
          >
            分配角色
          </ElButton>
          <ElButton
            link
            type="primary"
            data-testid="user-reset-password-btn"
            @click="openResetPassword(row)"
          >
            重置密码
          </ElButton>
          <ElButton
            link
            type="primary"
            data-testid="user-edit-btn"
            @click="openEdit(row)"
          >
            编辑
          </ElButton>
          <ElButton
            link
            type="danger"
            data-testid="user-delete-btn"
            @click="askDelete(row)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <div class="mt-4 flex justify-end">
      <ElPagination
        v-model:current-page="page.current"
        v-model:page-size="page.size"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        data-testid="user-pagination"
        @current-change="load"
        @size-change="load"
      />
    </div>

    <ElDialog
      v-model="formVisible"
      :title="editingId === null ? '新增用户' : '编辑用户'"
      width="520px"
      append-to-body
      data-testid="user-form-dialog"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
        <ElFormItem label="用户名" prop="username">
          <ElInput
            v-model="form.username"
            :disabled="editingId !== null"
            data-testid="user-username-input"
            placeholder="登录账号，创建后不可修改"
          />
        </ElFormItem>
        <ElFormItem label="昵称" prop="nickname">
          <ElInput
            v-model="form.nickname"
            data-testid="user-nickname-input"
            placeholder="请输入昵称"
          />
        </ElFormItem>
        <ElFormItem v-if="editingId === null" label="初始密码" prop="password">
          <ElInput
            v-model="form.password"
            type="password"
            show-password
            data-testid="user-password-input"
            placeholder="创建后请提醒用户尽快修改"
          />
        </ElFormItem>
        <ElFormItem label="部门" prop="deptId">
          <ElTreeSelect
            v-model="form.deptId"
            :data="deptTree"
            :props="{ children: 'children', label: 'deptName' }"
            node-key="id"
            check-strictly
            clearable
            data-testid="user-dept-id-input"
          />
        </ElFormItem>
        <ElFormItem v-if="editingId !== null" label="状态" prop="status">
          <ElSwitch
            v-model="form.status"
            :active-value="1"
            :inactive-value="0"
            data-testid="user-status-input"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton data-testid="user-cancel-btn" @click="formVisible = false">
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="submitting"
          data-testid="user-submit-btn"
          @click="submit"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="pwdVisible"
      title="重置密码"
      width="420px"
      append-to-body
      data-testid="user-password-dialog"
    >
      <ElInput
        v-model="newPassword"
        type="password"
        show-password
        data-testid="user-new-password-input"
        placeholder="请输入新密码"
      />
      <template #footer>
        <ElButton
          data-testid="user-password-cancel-btn"
          @click="pwdVisible = false"
        >
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="submitting"
          data-testid="user-password-submit-btn"
          @click="submitResetPassword"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="roleVisible"
      title="分配角色"
      width="420px"
      append-to-body
      data-testid="user-role-dialog"
    >
      <ElCheckboxGroup v-model="checkedRoleIds" data-testid="user-role-group">
        <ElCheckbox
          v-for="role in allRoles"
          :key="role.id"
          :value="role.id"
          :label="role.roleName"
        />
      </ElCheckboxGroup>
      <template #footer>
        <ElButton
          data-testid="user-role-cancel-btn"
          @click="roleVisible = false"
        >
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="submitting"
          data-testid="user-role-submit-btn"
          @click="submitAssignRole"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>

    <ConfirmDialog
      v-model="confirmVisible"
      testid="user"
      :loading="submitting"
      @confirm="confirmDelete"
    />
  </Page>
</template>
