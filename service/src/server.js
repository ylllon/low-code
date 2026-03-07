// Koa 应用主入口：仅负责中间件装配、路由挂载和服务启动。
const Koa = require('koa')
const Router = require('@koa/router')
const bodyParser = require('koa-bodyparser')
const cors = require('@koa/cors')
const registerControllers = require('./controllers')
const previewService = require('./services/previewService')

// 服务端口可通过环境变量覆盖，默认使用 3001。
const PORT = Number(process.env.PORT || 3001)

const app = new Koa()
const router = new Router()

// 全局错误与 404 兜底中间件：
// 1) 统一处理路由未命中返回；
// 2) 捕获下游抛出的异常并返回统一结构，避免进程异常退出。
app.use(async (ctx, next) => {
  try {
    await next()

    // 如果没有任何 controller 对当前请求进行响应，则返回统一 404。
    if (ctx.status === 404 && !ctx.body) {
      ctx.status = 404
      ctx.body = {
        title: '未找到接口',
        message: `${ctx.method} ${ctx.path}`
      }
    }
  } catch (error) {
    ctx.status = error.status || 500
    ctx.body = {
      title: '服务异常',
      message: error.message || 'Internal Server Error'
    }
  }
})

// 跨域和请求体解析必须先于路由注册，以保证 controller 可直接读取请求内容。
app.use(cors())
app.use(bodyParser())

// 注册所有业务 controller（用户、动作、健康检查等）。
registerControllers(router)

app.use(router.routes())
app.use(router.allowedMethods())

const httpServer = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[low-code-service] running on http://localhost:${PORT}`)
})

let shuttingDown = false

/**
 * 进程退出时清理预览子进程，避免遗留 dev server。
 * @param {string} reason
 */
function shutdown(reason) {
  if (shuttingDown) {
    return
  }
  shuttingDown = true

  previewService.stopAllPreviews()

  httpServer.close(() => {
    // eslint-disable-next-line no-console
    console.log(`[low-code-service] shutdown by ${reason}`)
    process.exit(0)
  })

  // 兜底：若连接未能在短时间内正常关闭，强制退出进程。
  setTimeout(() => {
    process.exit(0)
  }, 1500).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

if (process.env.NODE_ENV !== 'production') {
  process.once('SIGUSR2', () => {
    previewService.stopAllPreviews()
    process.kill(process.pid, 'SIGUSR2')
  })
}
