// projectController：项目目录读取与项目预览相关路由。
// 只负责参数提取与响应分发，具体业务逻辑下沉到 service。
const projectService = require('../services/projectService')
const previewService = require('../services/previewService')

/**
 * 注册项目目录相关路由。
 * @param {import('@koa/router')} router Koa Router 实例
 */
function registerProjectController(router) {
  // 根据本机目录路径读取项目结构树。
  // 示例：GET /project/v1/tree?path=D:\\yl\\workspace\\low-code\\low-code
  router.get('/project/v1/tree', (ctx) => {
    const projectPath = String(ctx.query.path || '').trim()

    if (!projectPath) {
      ctx.status = 400
      ctx.body = {
        title: '参数错误',
        message: 'path 不能为空'
      }
      return
    }

    try {
      const result = projectService.getProjectTree(projectPath)
      ctx.body = {
        state: true,
        data: result
      }
    } catch (error) {
      ctx.status = 400
      ctx.body = {
        title: '读取项目失败',
        message: error.message || '目录读取失败'
      }
    }
  })

  // 启动项目预览（本机开发模式）。
  // 示例：POST /project/v1/preview/start { "projectName": "low-code" }
  router.post('/project/v1/preview/start', async (ctx) => {
    const body = ctx.request.body || {}
    const projectName = String(body.projectName || '').trim()
    const projectPath = String(body.projectPath || '').trim()
    const port = Number(body.port || 0)

    try {
      const result = await previewService.startPreview({
        projectName,
        projectPath,
        port
      })

      ctx.body = {
        state: true,
        data: result
      }
    } catch (error) {
      ctx.status = 400
      ctx.body = {
        title: '启动预览失败',
        message: error.message || '启动项目预览失败'
      }
    }
  })

  // 停止指定项目预览进程。
  // 示例：POST /project/v1/preview/stop { "projectName": "low-code" }
  router.post('/project/v1/preview/stop', (ctx) => {
    const body = ctx.request.body || {}
    const projectName = String(body.projectName || '').trim()
    const projectPath = String(body.projectPath || '').trim()

    try {
      const result = previewService.stopPreview({
        projectName,
        projectPath
      })

      ctx.body = {
        state: true,
        data: result
      }
    } catch (error) {
      ctx.status = 400
      ctx.body = {
        title: '停止预览失败',
        message: error.message || '停止项目预览失败'
      }
    }
  })

  // 停止全部项目预览进程（主要用于窗口关闭时兜底清理）。
  // 示例：POST /project/v1/preview/stop-all
  router.post('/project/v1/preview/stop-all', (ctx) => {
    try {
      const result = previewService.stopAllPreviews()

      ctx.body = {
        state: true,
        data: result
      }
    } catch (error) {
      ctx.status = 400
      ctx.body = {
        title: '停止全部预览失败',
        message: error.message || '停止全部项目预览失败'
      }
    }
  })

  // 获取项目预览状态。
  // 示例：GET /project/v1/preview/status?projectName=low-code
  router.get('/project/v1/preview/status', (ctx) => {
    const projectName = String(ctx.query.projectName || '').trim()
    const projectPath = String(ctx.query.projectPath || '').trim()

    try {
      const result = previewService.getPreviewStatus({
        projectName,
        projectPath
      })

      ctx.body = {
        state: true,
        data: result
      }
    } catch (error) {
      ctx.status = 400
      ctx.body = {
        title: '获取预览状态失败',
        message: error.message || '获取项目预览状态失败'
      }
    }
  })

  // 新标签预览心跳：用于自动回收长时间无心跳的预览进程。
  // 示例：POST /project/v1/preview/heartbeat { "projectName": "low-code", "source": "new-tab" }
  router.post('/project/v1/preview/heartbeat', (ctx) => {
    const body = ctx.request.body || {}
    const projectName = String(body.projectName || '').trim()
    const projectPath = String(body.projectPath || '').trim()
    const source = String(body.source || '').trim()

    try {
      const result = previewService.refreshPreviewHeartbeat({
        projectName,
        projectPath,
        source
      })

      ctx.body = {
        state: true,
        data: result
      }
    } catch (error) {
      ctx.status = 400
      ctx.body = {
        title: '预览心跳上报失败',
        message: error.message || '预览心跳上报失败'
      }
    }
  })
}

module.exports = registerProjectController
