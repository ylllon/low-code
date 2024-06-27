// import { createRouter, createWebHistory } from 'vue-router'
// import AppView from '@/views/AppView.vue'
// import { defineAsyncComponent } from 'vue'
//
// const router = createRouter({
//   history: createWebHistory(import.meta.env.BASE_URL),
//   routes: [
//     {
//       path: '/app',
//       name: 'home',
//       component: AppView,
//       children: [
//         {
//           path: 'dataSource',
//           name: 'dataSource',
//           component: defineAsyncComponent(() => import('../views/DataSourceView/Index.vue')),
//         },
//         {
//           path: 'layout',
//           name: 'layout',
//           component: defineAsyncComponent(() => import('../views/PageLayoutView/Index.vue'))
//         },
//         {
//           path: 'actions',
//           name: 'actions',
//           component: defineAsyncComponent(() => import('../views/ActionsView/Index.vue'))
//         }
//       ]
//     },
//     {
//       path: '/',
//       redirect: '/app/layout'
//     }
//   ]
// })
//
// export default router
