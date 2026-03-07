/**
 * 健康检查 controller。
 * 一般用于：
 * 1) 本地联调时快速确认服务是否启动；
 * 2) 部署后用于存活探针。
 * @param {import('@koa/router')} router Koa Router 实例
 */
function registerHealthController(router) {
  router.get('/healthz', (ctx) => {
    ctx.body = {
      state: true,
      data: {
        service: 'low-code-service',
        time: new Date().toISOString()
      }
    }
  })
}

module.exports = registerHealthController
