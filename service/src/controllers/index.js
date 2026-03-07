// controller 聚合入口：统一注册各业务 controller。
const registerHealthController = require('./healthController')
const registerUserController = require('./userController')
const registerActionController = require('./actionController')
const registerProjectController = require('./projectController')

/**
 * 将各业务 controller 按模块挂载到同一个 router。
 * @param {import('@koa/router')} router Koa Router 实例
 */
function registerControllers(router) {
  registerHealthController(router)
  registerUserController(router)
  registerActionController(router)
  registerProjectController(router)
}

module.exports = registerControllers
