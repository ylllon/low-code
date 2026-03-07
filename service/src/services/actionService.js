// actionService：动作模块业务逻辑层。
// 当前使用内存数组存储动作，后续可替换为数据库实现。
const crypto = require('node:crypto')

// 初始动作数据，用于本地联调展示。
const actions = [
  {
    id: 'action-001',
    name: '加载数据源',
    type: 'request',
    enabled: true,
    createdBy: 'u-001'
  },
  {
    id: 'action-002',
    name: '提交后跳转',
    type: 'navigate',
    enabled: true,
    createdBy: 'u-001'
  }
]

/**
 * 获取动作列表。
 */
function listActions() {
  return actions
}

/**
 * 创建动作。
 * @param {object} payload
 * @param {object} user
 */
function createAction(payload, user) {
  const action = {
    id: `action-${crypto.randomBytes(6).toString('hex')}`,
    name: String(payload.name || '未命名动作'),
    type: String(payload.type || 'custom'),
    enabled: payload.enabled !== false,
    createdBy: user.id
  }

  actions.push(action)
  return action
}

/**
 * 更新动作。
 * @param {string} id
 * @param {object} payload
 */
function updateAction(id, payload) {
  const index = actions.findIndex((item) => item.id === id)
  if (index === -1) {
    return null
  }

  const nextAction = {
    ...actions[index],
    ...payload,
    // 保护主键，避免外部覆盖动作 ID。
    id: actions[index].id
  }

  actions[index] = nextAction
  return nextAction
}

/**
 * 删除动作。
 * @param {string} id
 */
function deleteAction(id) {
  const index = actions.findIndex((item) => item.id === id)
  if (index === -1) {
    return false
  }

  actions.splice(index, 1)
  return true
}

module.exports = {
  listActions,
  createAction,
  updateAction,
  deleteAction
}
