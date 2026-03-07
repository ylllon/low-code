// authService：token 生成、解析、校验、刷新等鉴权相关能力。
const crypto = require('node:crypto')

// access_token 有效期（秒）。
const ACCESS_TOKEN_EXPIRES_IN = 60 * 60
// refresh_token 有效期（秒）。
const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60

// 使用内存保存 token 会话。
// 注意：服务重启后会丢失，适合本地联调，不适合生产。
const accessTokenStore = new Map()
const refreshTokenStore = new Map()

/**
 * 生成随机 token。
 * @param {string} prefix
 */
function makeToken(prefix) {
  return `${prefix}_${crypto.randomBytes(24).toString('hex')}`
}

/**
 * 当前 Unix 秒级时间戳。
 */
function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

/**
 * 生成并保存一对 token。
 * @param {string} userId
 */
function issueToken(userId) {
  const accessToken = makeToken('atk')
  const refreshToken = makeToken('rtk')

  accessTokenStore.set(accessToken, {
    userId,
    exp: nowSeconds() + ACCESS_TOKEN_EXPIRES_IN
  })

  refreshTokenStore.set(refreshToken, {
    userId,
    exp: nowSeconds() + REFRESH_TOKEN_EXPIRES_IN
  })

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: ACCESS_TOKEN_EXPIRES_IN,
    token_type: 'Bearer'
  }
}

/**
 * 从 Authorization 头中提取 Bearer token。
 * @param {string} authorization
 */
function extractBearerToken(authorization) {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return ''
  }
  return authorization.slice('Bearer '.length).trim()
}

/**
 * 校验 access_token 并返回对应 userId。
 * token 不存在或过期时返回 null。
 * @param {string} accessToken
 */
function getUserIdByAccessToken(accessToken) {
  if (!accessToken) {
    return null
  }

  const session = accessTokenStore.get(accessToken)
  if (!session) {
    return null
  }

  if (session.exp <= nowSeconds()) {
    accessTokenStore.delete(accessToken)
    return null
  }

  return session.userId
}

/**
 * 使用 refresh_token 刷新 token。
 * @param {string} refreshToken
 */
function refreshByToken(refreshToken) {
  const refreshSession = refreshTokenStore.get(refreshToken)
  if (!refreshSession || refreshSession.exp <= nowSeconds()) {
    refreshTokenStore.delete(refreshToken)
    return {
      ok: false,
      message: 'refresh_token 已过期，请重新登录'
    }
  }

  const tokenData = issueToken(refreshSession.userId)
  return {
    ok: true,
    userId: refreshSession.userId,
    tokenData
  }
}

module.exports = {
  issueToken,
  extractBearerToken,
  getUserIdByAccessToken,
  refreshByToken
}
