// userService：用户与权限相关的业务逻辑层。
// 当前使用内存数据模拟，后续可替换为数据库实现。

// 模拟用户数据。
const users = [
  {
    id: 'u-001',
    username: 'zs',
    password: 'zs',
    realName: '张三',
    userType: 1,
    headPortraitUrl: '',
    roles: [
      { id: 'r-admin', name: '管理员', code: 'admin' },
      { id: 'r-editor', name: '编辑者', code: 'editor' }
    ]
  },
  {
    id: 'u-002',
    username: 'ls',
    password: 'ls',
    realName: '李四',
    userType: 1,
    headPortraitUrl: '',
    roles: [{ id: 'r-editor', name: '编辑者', code: 'editor' }]
  }
]

// 模拟应用信息。
const appInfo = {
  id: 'app-low-code-001',
  appName: 'Low Code Studio',
  logo: '',
  clientId: 'my-low-code'
}

// 模拟角色信息。
const roleList = [
  { id: 'r-admin', name: '管理员', code: 'admin' },
  { id: 'r-editor', name: '编辑者', code: 'editor' },
  { id: 'r-viewer', name: '访客', code: 'viewer' }
]

/**
 * 按账号密码查询用户。
 * @param {string} username
 * @param {string} password
 */
function findUserByCredential(username, password) {
  return users.find((item) => item.username === username && item.password === password) || null
}

/**
 * 按 userId 查询用户。
 * @param {string} userId
 */
function findUserById(userId) {
  return users.find((item) => item.id === userId) || null
}

/**
 * 根据用户角色构建菜单权限。
 * @param {object} user
 */
function buildMenus(user) {
  const isAdmin = user.roles.some((role) => role.code === 'admin')

  return [
    {
      id: 'm-layout',
      pid: '',
      path: '/app/layout',
      title: '布局',
      icon: 'layout',
      target: '',
      permission: 'layout:view',
      permissions: isAdmin ? ['view', 'edit', 'publish'] : ['view', 'edit'],
      breadcrumb: ['首页', '布局']
    },
    {
      id: 'm-data-source',
      pid: '',
      path: '/app/dataSource',
      title: '数据源',
      icon: 'data',
      target: '',
      permission: 'dataSource:view',
      permissions: isAdmin ? ['view', 'edit', 'delete'] : ['view'],
      breadcrumb: ['首页', '数据源']
    },
    {
      id: 'm-actions',
      pid: '',
      path: '/app/actions',
      title: '动作',
      icon: 'action',
      target: '',
      permission: 'actions:view',
      permissions: isAdmin ? ['view', 'edit', 'delete'] : ['view', 'edit'],
      breadcrumb: ['首页', '动作']
    }
  ]
}

/**
 * 用户信息脱敏/格式化，返回前端需要的字段。
 * @param {object} user
 */
function normalizeUser(user) {
  return {
    id: user.id,
    userName: user.username,
    realName: user.realName,
    userType: user.userType,
    headPortraitUrl: user.headPortraitUrl,
    uuaInfo: {},
    roles: user.roles
  }
}

/**
 * 组装登录响应：token 字段 + 用户基础标识。
 * @param {object} user
 * @param {object} tokenData
 */
function buildTokenPayload(user, tokenData) {
  return {
    ...tokenData,
    sub: user.id,
    roles: user.roles.map((role) => role.code)
  }
}

/**
 * 获取当前应用信息。
 */
function getAppInfo() {
  return appInfo
}

/**
 * 获取应用列表。
 */
function getAppList() {
  return [appInfo]
}

/**
 * 获取角色列表。
 */
function getRoleList() {
  return roleList
}

module.exports = {
  findUserByCredential,
  findUserById,
  buildMenus,
  normalizeUser,
  buildTokenPayload,
  getAppInfo,
  getAppList,
  getRoleList
}
