import {createYlRouter} from '@/core'

//import admin from '@/webapp/admin'
import views from '@/views'
//a
const router =createYlRouter({
  mode: "history",
  scrollBehavior: () => ({top: 0, left: 0}),
  webapps: [
    /**
     * 添加管理后台应用
     * 访问地址：http://localhost:8000/admin
     */
    views
  ]
})

export default router