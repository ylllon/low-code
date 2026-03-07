// userController 负责用户与鉴权相关路由分发。
// 业务逻辑尽量沉到 services 中，controller 仅处理请求/响应与错误分支。
const authService = require('../services/authService')
const userService = require('../services/userService')

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
 * 统一返回账号密码错误响应。
 * @param {import('koa').Context} ctx
 */
function loginFailed(ctx) {
  ctx.status = 401
  ctx.body = {
    title: '登录失败',
    message: '账号或密码错误'
  }
}

/**
 * 从请求头 Authorization 解析并定位当前登录用户。
 * 返回 null 表示未登录、token 无效或用户不存在。
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
 * 生成前端期望的登录响应（OAuth2 token 字段 + 当前用户角色）。
 * @param {object} user
 */
function buildTokenResult(user) {
  const tokenData = authService.issueToken(user.id)
  return userService.buildTokenPayload(user, tokenData)
}

/**
 * 账号密码登录流程（GET/POST 两种路由共用）。
 * @param {import('koa').Context} ctx
 * @param {string} username
 * @param {string} password
 */
function loginWithCredential(ctx, username, password) {
  const user = userService.findUserByCredential(String(username || ''), String(password || ''))

  if (!user) {
    loginFailed(ctx)
    return
  }

  ctx.body = buildTokenResult(user)
}

/**
 * 注册用户模块相关路由。
 * @param {import('@koa/router')} router Koa Router 实例
 */
function registerUserController(router) {
  // 兼容当前前端实现：GET 方式登录。
  router.get('/uaa/passwordLogin', (ctx) => {
    const { username = '', password = '' } = ctx.query
    loginWithCredential(ctx, username, password)
  })

  // 预留更标准的 POST 方式登录。
  router.post('/uaa/passwordLogin', (ctx) => {
    const body = ctx.request.body || {}
    const { username = '', password = '' } = body
    loginWithCredential(ctx, username, password)
  })

  // 获取当前登录用户权限信息（用户/菜单/应用）。
  router.get('/uaa/v1/account/getPermission', (ctx) => {
    const user = resolveCurrentUser(ctx)
    if (!user) {
      unauthorized(ctx)
      return
    }

    ctx.body = {
      user: userService.normalizeUser(user),
      menus: userService.buildMenus(user),
      app: userService.getAppInfo()
    }
  })

  // 获取可访问应用列表。
  router.get('/uaa/v1/app/mini/list', (ctx) => {
    const user = resolveCurrentUser(ctx)
    if (!user) {
      unauthorized(ctx)
      return
    }

    ctx.body = userService.getAppList()
  })

  // 获取角色列表。
  router.get('/uaa/v1/role/list', (ctx) => {
    const user = resolveCurrentUser(ctx)
    if (!user) {
      unauthorized(ctx)
      return
    }

    ctx.body = userService.getRoleList()
  })

  // refresh_token 刷新 token。
  router.post('/uaa/oauth2/token', (ctx) => {
    const body = ctx.request.body || {}
    const refreshToken = ctx.query.refresh_token || body.refresh_token
    const grantType = ctx.query.grant_type || body.grant_type

    // 仅支持 refresh_token 模式。
    if (grantType !== 'refresh_token' || !refreshToken) {
      ctx.status = 400
      ctx.body = {
        title: '参数错误',
        message: '缺少 refresh_token 或 grant_type 不正确'
      }
      return
    }

    const refreshResult = authService.refreshByToken(String(refreshToken))
    if (!refreshResult.ok) {
      ctx.status = 401
      ctx.body = {
        title: '登录失效',
        message: refreshResult.message
      }
      return
    }

    const user = userService.findUserById(refreshResult.userId)
    if (!user) {
      ctx.status = 401
      ctx.body = {
        title: '登录失效',
        message: '用户不存在，请重新登录'
      }
      return
    }

    ctx.body = userService.buildTokenPayload(user, refreshResult.tokenData)
  })
}

module.exports = registerUserController
