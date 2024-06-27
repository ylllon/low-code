import {BaseWebapp, BASE_URL} from '@/core'
import type { RouteLocationNormalized } from 'vue-router'
import { permissionRoutes } from '@/views/router/permission-router'
import { basicRoutes } from '@/views/router/basic-router'
class Webapp extends BaseWebapp{
  /**
   * 不需要登录的路由
   * @param $route
   * @returns {boolean}
   */
  checkRouteWhite($route: RouteLocationNormalized): boolean {
    if (['/demo'].includes($route.path)) {
      return true
    }
    return false
  }

}

export default new Webapp({
  baseUrl: BASE_URL,
  appName: '系统',
  clientId: '',
  clientSecret: '',
  basicsRoutes: basicRoutes,
  permissionRoutes: permissionRoutes
})