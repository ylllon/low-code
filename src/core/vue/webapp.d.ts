import type {RouteRecordRaw, Route, NavigationGuardNext, RouteLocationNormalized} from 'vue-router';
import type {UserDTO} from "../index";

export declare class WebappOptions {
  /**
   * 基础路由 如
   * http://xxx.com/abc 值是 /abc
   * http://xxx.com/ 值是 /
   */
  readonly baseUrl: string

  /**
   * 应用名称
   */
  readonly appName: string

  /**
   * 应用ID
   */
  appId?: string
  /**
   * 客户端ID third-spa | uaa-spa
   */
  readonly clientId?: string

  /**
   * 客户端秘钥
   */
  readonly clientSecret?: string

  /**
   * 登录地址 默认值/login
   */
  readonly loginRouterPath?: string

  /**
   * 首次修改密码，默认值/login-update-password
   */
  readonly loginUpdatePasswordRouterPath?: string
  /**
   * 基础路由
   */
  readonly basicsRoutes: RouteRecordRaw[]

  /**
   * 需要权限的路由
   */
  readonly permissionRoutes: RouteRecordRaw[]

  /**
   * 系统白名单
   */
  readonly systemRouteWhite?: string[]

  /**
   * 路由加载中
   */
  routerLoading?: boolean
}

/**
 * 站点应用信息
 */
export declare class Webapp extends WebappOptions {

  /**
   * 初始化
   */

  initial()

  /**
   * 不需要登录的路由
   * @param {Route} $route
   * @param {UserDTO} user
   * @returns {boolean}
   */
  checkRouteWhite($route: Route, user: UserDTO | null): boolean


  /**
   * 验证权限
   * @param user
   */
  checkPermission(user: UserDTO): Promise<any> | boolean

  /**
   * 路由跳转前
   * @param to
   * @param from
   * @param next
   */
  beforeEach(to: Route, from: Route, next: NavigationGuardNext): void

  /**
   * 路由跳转结束
   * @param {Route} to
   * @param {Route} from
   */
  afterEach(to: Route, from: Route): void

  /**
   * 获取网站标题
   * @param {Route} $route
   * @returns {string}
   */
  getPageTitle($route: Route): string

  /**
   * 设置菜单
   * @param menus
   */
  setMenus(menus: MenuDTO[])
}