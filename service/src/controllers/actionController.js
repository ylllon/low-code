// actionController 负责动作模块路由分发。
// 仅处理输入、鉴权和响应，具体数据处理交由 actionService。
const authService = require('../services/authService')
const userService = require('../services/userService')
const actionService = require('../services/actionService')

/**
 * 统一返回未登录/登录过期响应。
 * @param {import('koa').Context} ctx
 * @param {string} [message]
 */
function unauthorized(ctx, message = '登录状态失效，请重新登录') {
  ctx.status = 401
  ctx.body = {
    title: '提示',
    message
  }
}

/**
 * 解析并返回当前登录用户。
 * @param {import('koa').Context} ctx
 * @returns {object | null}
 */
function resolveCurrentUser(ctx) {
  const bearerToken = authService.extractBearerToken(ctx.get('authorization'))
  if (!bearerToken) {
    return null
  }

  const userId = authService.getUserIdByAccessToken(bearerToken)
  if (!userId) {
    return null
  }

  return userService.findUserById(userId)
}

/**
 * 注册动作模块路由。
 * @param {import('@koa/router')} router Koa Router 实例
 */
function registerActionController(router) {
  // 查询动作列表。
  router.get('/action/v1/list', (ctx) => {
    const user = resolveCurrentUser(ctx)
    if (!user) {
      unauthorized(ctx)
      return
    }

    ctx.body = {
      state: true,
      data: actionService.listActions(user)
    }
  })

  // 创建动作。
  router.post('/action/v1/create', (ctx) => {
    const user = resolveCurrentUser(ctx)
    if (!user) {
      unauthorized(ctx)
      return
    }

    const payload = ctx.request.body || {}
    const action = actionService.createAction(payload, user)

    ctx.body = {
      state: true,
      data: action
    }
  })

  // 更新动作。
  router.put('/action/v1/:id', (ctx) => {
    const user = resolveCurrentUser(ctx)
    if (!user) {
      unauthorized(ctx)
      return
    }

    const { id } = ctx.params
    const payload = ctx.request.body || {}
    const action = actionService.updateAction(id, payload, user)

    if (!action) {
      ctx.status = 404
      ctx.body = {
        title: '未找到动作',
        message: `action ${id} 不存在`
      }
      return
    }

    ctx.body = {
      state: true,
      data: action
    }
  })

  // 删除动作。
  router.delete('/action/v1/:id', (ctx) => {
    const user = resolveCurrentUser(ctx)
    if (!user) {
      unauthorized(ctx)
      return
    }

    const { id } = ctx.params
    const removed = actionService.deleteAction(id, user)

    if (!removed) {
      ctx.status = 404
      ctx.body = {
        title: '未找到动作',
        message: `action ${id} 不存在`
      }
      return
    }

    ctx.body = {
      state: true,
      data: {
        id
      }
    }
  })
}

module.exports = registerActionController
