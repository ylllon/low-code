import type {Webapp as IWebapp, WebappOptions} from './webapp.d'
import type { NavigationGuardNext, RouteLocationNormalized, RouteRecordRaw } from 'vue-router'
import {useCoreStore} from '../store'

import type { UserDTO} from '../api/userPermissonApi.d'
import { vueInstance } from '@/core'
import {dialogResult} from './components'
import router from '@/router'
import util from '../utils/util'

export default  class  Webapp {

  /**
   * 基础路由 如
   * http://xxx.com/abc 值是 /abc
   * http://xxx.com/ 值是 /
   */
  readonly baseUrl = '/'

  /**
   * 应用名称
   */
  readonly appName = ''

  /**
   * 应用ID
   */
  appId = ''

  /**
   * 客户端ID third-spa | uaa-spa
   */
  readonly clientId = ''
  /**
   * 登录地址 默认值/login
   */
  readonly loginRouterPath = '/login'

  /**
   * 需要权限的路由
   */
  readonly permissionRoutes = <RouteRecordRaw[]>[]

  /**
   * 系统白名单
   */
  readonly systemRouteWhite = <string[]>[]


  constructor(webappOptions: WebappOptions) {
    Object.assign(this, webappOptions)
    this.systemRouteWhite = [this.loginRouterPath,'/oauth2/authorize','/logout','/404']
  }

  /**
   * 初始调用
   */
  initial() {

  }

  /**
   * 路由跳转开始
   * @param to
   * @param from
   * @param next
   */
  public beforeEach(to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) {
    useCoreStore().initial()

    const coreStore = useCoreStore()
    const token = coreStore.token
    // console.log("ls:",ls.get(('Access_Token')))
    //不需要不登录的路由，直接访问
    if (this.systemRouteWhite.includes(to.path) || to.meta.checkRouteWhite) {
      next()
      // //已登录，但未获取帐户信息
      if (token && !coreStore.roles.length) {
        this.addPermissionRoute(to)
      }
    }

    //没有登录，跳转到登录页
    else if (!token) {
      next({
        path: this.loginRouterPath,
        query: {
          redirect: to.fullPath
        }
      })
    }

    /**
     * 获取权限
     */
    else if (!coreStore.roles.length) {
      // loading = new Loading({text: '帐户安全检测...', delay: 300})
      this.addPermissionRoute(to, () => {
        // debugger
        if (this.permissionRoutes.length) {
          next(to)
        } else {
          next()
        }
      })
    }

    /**
     * 否则就放行
     */
    else {
      next()
    }


  }

  /**
   * 路由跳转结束，数据埋点
   * @param to
   */

  public afterEach(to: RouteLocationNormalized) {
    //异步标题
    if (to.meta.syncTitle) {
      return
    }

    const title = this.getPageTitle(to)
    if (title) {
      util.setDocumentTitle(title)
    }

    if (!to.hash) {
      //可数据埋点
      // new AnalysisApi().cancel('track').addTrack(to)
    }


  }

  /**
   * 获取网站标题
   * @param $route
   * @returns {string}
   */
  public getPageTitle($route: RouteLocationNormalized): string {
    const coreStore = useCoreStore()
    const menuItem = coreStore.menus.find(menu => menu.path === $route.fullPath || menu.path === $route.meta.permissionPath)

    return menuItem && menuItem.title || util.getPageTitle($route) || ''
  }
  /**
   * 验证是否有权限访问当前应用
   * @param user
   */
  public checkPermission(user: UserDTO): Promise<any> | boolean {
    return true
  }

  /**
   * 添加权限路由
   * @param to
   * @param callback
   * @private
   */
  private addPermissionRoute(to: RouteLocationNormalized, callback?: () => void) {
    useCoreStore().getPermission(this.clientId).then((userPermission) => {
      this.appId = userPermission.app?.id

      const user = useCoreStore().user
      if (!user) {
        return Promise.reject()
      }
      const checkPermission = this.checkPermission(user)
      if (typeof checkPermission === 'boolean') {
        return checkPermission ? Promise.resolve() : Promise.reject()
      }
      return checkPermission
    }).then(() => {
      if (this.permissionRoutes.length) {
        this.permissionRoutes.forEach(route => {
          vueInstance.config.globalProperties.$router.addRoute(route)
        })
      }
      const user = useCoreStore().user

      //首页登录修改密码
      // if (user && user.needModifyPassword === '1' && this.loginUpdatePasswordRouterPath && to.path !== this.loginUpdatePasswordRouterPath) {
      //   router.push({
      //     path: this.loginUpdatePasswordRouterPath,
      //     query: {
      //       redirect: to.fullPath
      //     }
      //   })
      // } else if (typeof callback === 'function') {
      //   callback()
      // }
      if (typeof callback === 'function') {
        callback()
      }
    }).catch(e => {
      console.log( '无权限访问系统')
      dialogResult({
        title: e && e.message || '无权限访问系统',
        okText: '确 定',
        ok: () => {
          useCoreStore().logout()
          router.push(this.loginRouterPath)
        }
      })
    })
  }



}