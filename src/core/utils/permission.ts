import type {RouteLocationNormalized} from 'vue-router';
import { useCoreStore } from '../store'

/**
 * 验证权限
 * @param $route
 * @param {string[]} permissions
 * @returns {boolean}
 */
export function hasPermission($route: RouteLocationNormalized | string, permissions: string[]): boolean {
  if (!permissions) {
    return false
  }
  const coreStore = useCoreStore()
  let path: any = $route
  if (typeof $route === 'object') {
    path = $route.meta.permissionPath || $route.path
  }
  const menu = coreStore.menus.find((t:any) => t.path == path)
  if (!menu || !menu.permissions) {
    return false
  }
  const filterPermission = menu.permissions.filter(function (v:any) {
    return permissions.indexOf(v) !== -1 // 利用filter方法来遍历是否有相同的元素
  })
  return filterPermission.length != 0;

}