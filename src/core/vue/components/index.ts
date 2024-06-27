// import {Loading} from './loading'
import {env} from '../../utils/env'
import dialogResult from './dialog-result'
import {defineComponent} from "vue";

function updatePrompt() {
  if (!window.navigator.onLine) {
    dialogResult({
      title: '连接网络失败',
      subTitle: '网络无法连接，请检查网络后再重试',
      showClose: true,
      okText: '我知道了'
    })
    return
  }
  !env.isDev && dialogResult({
    title: '更新提示',
    subTitle: '新版本已经准备好，是否切换到新版本？',
    showClose: true,
    okText: '去新版本',
    ok: () => {
      window.location.reload()
    }
  })
}


const ErrorComponent = defineComponent({
  created() {
    updatePrompt()
  }
})
export {
  ErrorComponent,
  dialogResult,
  updatePrompt,
  // Loading
}