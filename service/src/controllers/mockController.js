// mockController: provides lightweight mock APIs for low-code component testing.
const pagedTableService = require('../services/pagedTableService')

/**
 * Register mock routes.
 * @param {import('@koa/router')} router
 */
function registerMockController(router) {
  // GET /mock/v1/paged-table
  // Supports query params:
  // - Pagination request: current/page/pageNum, size/pageSize/limit, keyword
  // - Response key mapping: recordsKey, totalKey, sizeKey, currentKey, pagesKey
  // - Response path mapping: dataPath, codeKey, messageKey
  router.get('/mock/v1/paged-table', (ctx) => {
    ctx.body = pagedTableService.buildPagedTableResponse(ctx.query || {})
  })

  // POST /mock/v1/paged-table
  // Body has higher priority than query for the same keys.
  router.post('/mock/v1/paged-table', (ctx) => {
    const query = ctx.query || {}
    const body = ctx.request.body || {}
    ctx.body = pagedTableService.buildPagedTableResponse({
      ...query,
      ...body
    })
  })
}

module.exports = registerMockController
