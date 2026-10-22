<script lang="ts" setup>
import type { OptionItem, SysUser } from '../../api';
import type { SearchFormSchema } from '../../composables/useSearchForm';

import { computed, onMounted, reactive, ref } from 'vue';

import { usePermission } from '@describeadmin/access';
import { ConfirmDialog } from '@describeadmin/ele-ui';
import { useUserStore } from '@describeadmin/stores';
import { Page } from '@describeadmin/ui';

import {
  ElAvatar,
  ElButton,
  ElCheckbox,
  ElCheckboxGroup,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElPagination,
  ElScrollbar,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTreeSelect,
} from 'element-plus';

import {
  assignUserRolesApi,
  createUserApi,
  deleteUserApi,
  getDeptOptionsApi,
  getRoleOptionsApi,
  getUserListApi,
  getUserRolesApi,
  removeUserAvatarApi,
  resetUserPasswordApi,
  updateUserApi,
  uploadUserAvatarApi,
} from '../../api';
import AvatarPicker from '../../components/AvatarPicker.vue';
import { useSearchForm } from '../../composables/useSearchForm';
import { avatarUrl } from '../../utils/avatar';

defineOptions({ name: 'SystemUser' });

/** 按钮级权限（CLAUDE.md 4.5.3）。前缀须与 seed-rbac.sql 登记的 perm_code 一致。 */
const { can, canAny } = usePermission('system:user');
const userStore = useUserStore();

const loading = ref(false);
const rows = ref<SysUser[]>([]);
const total = ref(0);
const page = reactive({ current: 1, size: 10 });

const filter = reactive<{
  mobile: string;
  nickname: string;
  status: null | number;
  username: string;
}>({
  mobile: '',
  nickname: '',
  status: null,
  username: '',
});

const searchSchema: SearchFormSchema[] = [
  {
    component: 'Input',
    componentProps: { 'data-testid': 'user-search-username-input' },
    fieldName: 'username',
    label: '用户名',
  },
  {
    component: 'Input',
    componentProps: { 'data-testid': 'user-search-nickname-input' },
    fieldName: 'nickname',
    label: '昵称',
  },
  {
    component: 'Input',
    componentProps: { 'data-testid': 'user-search-mobile-input' },
    fieldName: 'mobile',
    label: '手机号',
  },
  {
    component: 'Select',
    componentProps: {
      'data-testid': 'user-search-status-select',
      options: [
        { label: '启用', value: 1 },
        { label: '停用', value: 0 },
      ],
    },
    fieldName: 'status',
    label: '状态',
  },
];

const { SearchFormBar } = useSearchForm({
  testid: 'user',
  schema: searchSchema,
  async onSearch(values) {
    Object.assign(filter, values);
    page.current = 1;
    await load();
  },
  async onReset() {
    filter.username = '';
    filter.nickname = '';
    filter.mobile = '';
    filter.status = null;
    page.current = 1;
    await load();
  },
});

// 部门与角色都取「选项」接口而不是对方模块的列表/树接口：后者要 system:dept:list /
// system:role:list，于是只授「用户管理」的角色会 403，补授又会让侧边栏多出别的模块入口。
// 选项接口只要求登录，且不分页——详见 CLAUDE.md 4.11。
const deptTree = ref<OptionItem[]>([]);

const formVisible = ref(false);
const submitting = ref(false);
const editingId = ref<null | number>(null);
/** 编辑弹窗里的头像对象键。头像不走表单提交，选好图就直接调头像端点，见 uploadAvatar。 */
const editingAvatar = ref<null | string>(null);
const formRef = ref();

const form = reactive({
  deptId: undefined as number | undefined,
  email: '',
  mobile: '',
  nickname: '',
  password: '',
  // 只在新增时使用：后端 /with-password 支持建号的同时授予角色，省掉
  // 「先建号、再分配角色」两步。编辑时仍走「分配角色」按钮，保持单一路径。
  roleIds: [] as number[],
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
const allRoles = ref<OptionItem[]>([]);
const checkedRoleIds = ref<number[]>([]);
const roleUserName = ref('');
const roleKeyword = ref('');
/** 弹窗里的展示顺序，与新增表单共用的 allRoles 分开，免得打开一次弹窗就改了下拉的顺序。 */
const dialogRoles = ref<OptionItem[]>([]);
// 搜索只收窄展示，不动勾选：被滤掉的已选角色仍留在 checkedRoleIds 里照常提交
const filteredRoles = computed(() => {
  const kw = roleKeyword.value.trim().toLowerCase();
  return kw
    ? dialogRoles.value.filter((r) => r.label.toLowerCase().includes(kw))
    : dialogRoles.value;
});
// 角色 id 运行时是字符串（4.8 Long → String），声明却是 number[]，按字符串比对两边都兜住
function isRoleChecked(value: string) {
  return checkedRoleIds.value.some((id) => String(id) === value);
}

async function load() {
  loading.value = true;
  try {
    const result = await getUserListApi({
      ...page,
      mobile: filter.mobile || undefined,
      nickname: filter.nickname || undefined,
      status: filter.status ?? undefined,
      username: filter.username || undefined,
    });
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
    email: '',
    mobile: '',
    nickname: '',
    password: '',
    roleIds: [],
    status: 1,
    username: '',
    version: undefined,
  });
  formVisible.value = true;
}

function openEdit(row: SysUser) {
  editingId.value = row.id ?? null;
  editingAvatar.value = row.avatar ?? null;
  Object.assign(form, {
    deptId: row.deptId ?? undefined,
    email: row.email ?? '',
    mobile: row.mobile ?? '',
    nickname: row.nickname ?? '',
    // 编辑时不改密码，改密码走「重置密码」，避免把哈希值当明文回填
    password: '',
    roleIds: [],
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
        email: form.email || undefined,
        mobile: form.mobile || undefined,
        nickname: form.nickname,
        password: form.password,
        roleIds: form.roleIds,
        username: form.username,
      });
      ElMessage.success('新增成功');
    } else {
      // 不提交 password：后端 SysUserController.update 已用 @TableField(updateStrategy
      // = NOT_NULL) 锁住密码列，但这里仍不传，保持"改密码只走重置密码"的单一路径
      await updateUserApi(editingId.value, {
        deptId: form.deptId,
        email: form.email || undefined,
        mobile: form.mobile || undefined,
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

/**
 * 头像单独提交，不并进「确定」：后端写头像不递增版本号（avatar 列通用编辑写不进去，
 * 两条写入路径不重叠），所以换完头像再点「确定」不会撞乐观锁，form.version 不用刷新。
 */
async function uploadAvatar(file: File) {
  const id = editingId.value as number;
  applyAvatar(id, await uploadUserAvatarApi(id, file));
}

async function removeAvatar() {
  const id = editingId.value as number;
  await removeUserAvatarApi(id);
  applyAvatar(id, null);
}

function applyAvatar(id: number, key: null | string) {
  editingAvatar.value = key;
  const row = rows.value.find((r) => r.id === id);
  if (row) {
    row.avatar = key;
  }
  // 管理员改的是自己：顶栏头像跟着变，不必等下次刷新页面
  const info = userStore.userInfo;
  if (info && info.userId === String(id)) {
    userStore.setUserInfo({ ...info, avatar: avatarUrl(key) });
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
  roleUserName.value =
    row.nickname && row.nickname !== row.username
      ? `${row.nickname}（${row.username}）`
      : (row.username ?? '');
  roleKeyword.value = '';
  const [options, owned] = await Promise.all([
    getRoleOptionsApi(),
    getUserRolesApi(row.id as number),
  ]);
  allRoles.value = options;
  // 已持有的排在前面，角色一多时不用滚动去找。只在打开时排一次，勾选过程中不跟着跳
  const ownedSet = new Set(owned.map(String));
  dialogRoles.value = [
    ...options.filter((r) => ownedSet.has(r.value)),
    ...options.filter((r) => !ownedSet.has(r.value)),
  ];
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
  // 角色与部门都走只要求登录的选项接口，不会再因为缺少别的模块的 :list 权限而 403，
  // 所以这里不再需要那段「单独 try 吞掉角色 403」的绕行代码——留着它只会掩盖真实故障。
  try {
    [allRoles.value, deptTree.value] = await Promise.all([
      getRoleOptionsApi(),
      getDeptOptionsApi(),
    ]);
    await load();
  } catch {
    // 已经由请求层的全局拦截器处理（弹出提示、401 时跳转登录页），这里只需要
    // 避免异常继续冒泡成 Vue 的 "Unhandled error during execution of mounted hook"。
  }
});
</script>

<template>
  <Page title="用户管理">
    <!-- 用户体系由框架的 framework-system-starter 提供，业务方无需实现——这是给开发者看的实现说明，不面向最终用户，故不放进 Page 的 description。 -->
    <template #extra>
      <ElButton
        v-if="can('add')"
        type="primary"
        data-testid="user-add-btn"
        @click="openCreate"
      >
        新增
      </ElButton>
    </template>

    <SearchFormBar />

    <ElTable
      v-loading="loading"
      :data="rows"
      row-key="id"
      data-testid="user-table"
    >
      <ElTableColumn label="头像" width="70">
        <template #default="{ row }">
          <ElAvatar :size="32" :src="avatarUrl(row.avatar) || undefined">
            {{ (row.nickname || row.username || '').charAt(0) }}
          </ElAvatar>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="username" label="用户名" min-width="140" />
      <ElTableColumn prop="nickname" label="昵称" min-width="140" />
      <ElTableColumn prop="deptName" label="部门" min-width="140" />
      <ElTableColumn label="状态" width="90">
        <template #default="{ row }">
          {{ row.status === 1 ? '启用' : '停用' }}
        </template>
      </ElTableColumn>
      <ElTableColumn prop="createTime" label="创建时间" min-width="180" />
      <ElTableColumn
        v-if="canAny('assign-role', 'reset-password', 'edit', 'remove')"
        label="操作"
        width="320"
        fixed="right"
      >
        <template #default="{ row }">
          <ElButton
            v-if="can('assign-role')"
            link
            type="primary"
            data-testid="user-assign-role-btn"
            @click="openAssignRole(row)"
          >
            分配角色
          </ElButton>
          <ElButton
            v-if="can('reset-password')"
            link
            type="primary"
            data-testid="user-reset-password-btn"
            @click="openResetPassword(row)"
          >
            重置密码
          </ElButton>
          <ElButton
            v-if="can('edit')"
            link
            type="primary"
            data-testid="user-edit-btn"
            @click="openEdit(row)"
          >
            编辑
          </ElButton>
          <ElButton
            v-if="can('remove')"
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
        <!-- 新增时不放：用户还不存在，没有可挂的 id。建好后再编辑设置 -->
        <ElFormItem v-if="editingId !== null" label="头像">
          <AvatarPicker
            :src="avatarUrl(editingAvatar)"
            :text="form.nickname || form.username"
            :upload="uploadAvatar"
            :remove="removeAvatar"
            testid="user"
          />
        </ElFormItem>
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
        <ElFormItem label="手机号" prop="mobile">
          <ElInput
            v-model="form.mobile"
            data-testid="user-mobile-input"
            placeholder="选填，重复的手机号会被拒绝"
          />
        </ElFormItem>
        <ElFormItem label="邮箱" prop="email">
          <ElInput
            v-model="form.email"
            data-testid="user-email-input"
            placeholder="选填，重复的邮箱会被拒绝"
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
            :props="{
              children: 'children',
              label: 'label',
              disabled: 'disabled',
            }"
            node-key="value"
            check-strictly
            clearable
            data-testid="user-dept-id-input"
          />
        </ElFormItem>
        <ElFormItem v-if="editingId === null" label="角色" prop="roleIds">
          <ElSelect
            v-model="form.roleIds"
            multiple
            clearable
            placeholder="选填，可在创建后通过「分配角色」调整"
            class="!w-full"
            data-testid="user-role-ids-select"
          >
            <ElOption
              v-for="role in allRoles"
              :key="role.value"
              :label="role.label"
              :value="role.value"
            />
          </ElSelect>
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
      width="560px"
      append-to-body
      data-testid="user-role-dialog"
    >
      <div class="mb-3 flex items-center justify-between gap-4">
        <span class="text-muted-foreground truncate text-sm">
          用户：{{ roleUserName }}
        </span>
        <span class="shrink-0 text-sm">
          已选
          <span class="text-primary font-medium">{{
            checkedRoleIds.length
          }}</span>
          / {{ dialogRoles.length }}
          <ElButton
            v-if="checkedRoleIds.length > 0"
            link
            type="primary"
            class="ml-2"
            data-testid="user-role-clear-btn"
            @click="checkedRoleIds = []"
          >
            清空
          </ElButton>
        </span>
      </div>
      <ElInput
        v-model="roleKeyword"
        clearable
        placeholder="搜索角色名称"
        class="mb-3"
        data-testid="user-role-search-input"
      />
      <!-- 用 ElScrollbar 的 max-height 而不是 max-h-[…] 任意值类：后者在业务方以 npm 依赖
           消费本包时不保证能被扫出 CSS 规则（见 dict/index.vue 模板顶部的说明）。 -->
      <ElScrollbar max-height="320px">
        <ElCheckboxGroup
          v-model="checkedRoleIds"
          class="grid grid-cols-2 gap-2 pr-2"
          data-testid="user-role-group"
        >
          <!-- 停用角色仍然展示（否则已持有的停用角色无从取消），但未持有时不可新选 -->
          <ElCheckbox
            v-for="role in filteredRoles"
            :key="role.value"
            :value="role.value"
            :disabled="role.disabled && !isRoleChecked(role.value)"
            :title="role.label"
            border
            class="!mr-0 !w-full"
          >
            {{ role.label }}
            <span v-if="role.disabled" class="text-muted-foreground text-xs">
              （已停用）
            </span>
          </ElCheckbox>
        </ElCheckboxGroup>
        <div
          v-if="filteredRoles.length === 0"
          class="text-muted-foreground py-8 text-center text-sm"
        >
          {{ dialogRoles.length === 0 ? '暂无角色' : '没有匹配的角色' }}
        </div>
      </ElScrollbar>
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
