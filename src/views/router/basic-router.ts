import type {RouteRecordRaw} from 'vue-router';

export const basicRoutes: RouteRecordRaw[] = [
  {
   path:'/login',
   component: () => import('@/views/login/login.vue'),
   meta: {title: '登录'}
  },
  {
    path: '/',
    redirect: '/app/layout'
  }

  // {
  //   path: '/404',
  //   component: () => import('@/tlw/ant-design-vue/components/error-page/404.vue'),
  //   meta: {title: '未找到页面'}
  // }
]