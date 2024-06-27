import type { RouteRecordRaw } from 'vue-router'
import { defineAsyncComponent } from 'vue'
import AppView from '@/views/AppView.vue'

/**
 * 需要权限的路由
 * @type {Array}
 */
export const permissionRoutes: RouteRecordRaw[] = [
  {
    path: '/app',
    name: 'home',
    component: AppView,
    children: [
      {
        path: 'dataSource',
        name: 'dataSource',
        component: () => import('../DataSourceView/Index.vue'),
      },
      {
        path: 'layout',
        name: 'layout',
        component: () => import('../PageLayoutView/Index.vue')
      },
      {
        path: 'actions',
        name: 'actions',
        component: defineAsyncComponent(() => import('../ActionsView/Index.vue'))
      }
    ]
  },

]