import type { NavigationGuardNext, RouteLocationNormalized, Router } from 'vue-router'
import type {WebappRouterOptions} from './create-yl-router.d'
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { setWebapp, setWebapps, webapp } from '../store/webapp'
import {env} from '../utils/env'

/**
 * 自定义router  ,动态添加权限路由
 * @param options
 */
export function createYlRouter(options: WebappRouterOptions): Router {

  setWebapps(options.webapps)
  // console.log("env.BASE_URL:",env.BASE_URL)
  //查找当前路径对应的哪个应用并加载对应应用的路由
  const findApp = options.webapps.find((app:any) => (location.pathname + '/').indexOf(app.baseUrl + '/') === 0)
  if (!findApp) {
    setWebapp(options.webapps.find((app:any) => app.baseUrl === env.BASE_URL))
  } else {
    setWebapp(findApp)
  }
  if (!webapp) {
    console.error('未找到应用')
  }

  //创建路由
  if (options.mode === 'history') {
    options.history = createWebHistory(webapp.baseUrl)
  }
  if (options.mode === 'hash') {
    options.history = createWebHashHistory(webapp.baseUrl)
  }

  options.routes = webapp.basicsRoutes || []
  // @ts-ignore
  const router = createRouter({...options,webapp: undefined})

  /**
   * 路由开始
   */
  router.beforeEach((to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) => {
    webapp.beforeEach(to, from, next)
  })

  /**
   * 路由出错
   */
  router.onError((error) => {
    //const message: string = error && error.message || ''
    console.error(error)
    // updatePrompt()
  })


  /**
   * 路由跳转结束
   */
  router.afterEach((to: RouteLocationNormalized, from: RouteLocationNormalized) => {
    // webapp.afterEach(to, from)
  })

  //返回路由
  return router

}