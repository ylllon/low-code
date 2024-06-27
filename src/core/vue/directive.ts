import type {App} from 'vue';
import {hasPermission} from '../utils/permission'
import router from '@/router'

export default function install(app: App<Element>) {
  action(app)
}

function action(app: App<Element>) {

  app.directive('action', {
    created(el, binding) {
      // 获取当前路由
      const route = router.currentRoute.value
      const permissions = binding.value || []
      if (!hasPermission(route, permissions)) {
        el.style.display = 'none'
      }
    }
  })
}