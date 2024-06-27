// import config from '../config'
import { webapp } from '../store/webapp'
import { vueInstance } from '../store/vueInstance'
import { dialogResult } from '../vue/components'
import { useCoreStore } from '../store'


export default class DisposeError {

  /**
   * 弹出错误结果
   * @param error
   */
  static dialogErrorResult(error: any) {
    const coreStore = useCoreStore()

    //非401 与 403 不处理错误
    if (error.status !== 401 && error.status !== 403) {
      return null
    }
    const ok = () => {
      if (error.status === 403) {
        vueInstance.config.globalProperties.$router.push({ path: '/' })
        return
      }
      coreStore.logout()
      const { path, fullPath } = vueInstance.config.globalProperties.$route

      if (path === webapp.loginRouterPath) {
        window.location.reload()
        return
      }
      vueInstance.config.globalProperties.$router.push({
        path: webapp.loginRouterPath,
        query: {
          redirect: fullPath
        }
      })


    }
    console.log("error.message:",error.message)

    //弹出窗口
    dialogResult({
      title: error.title,
      subTitle: error.message,
      okText: error.status === 403 ? '返回首页' : '重新登录',
      ok: ok
    })
  }

  /**
   * 二次设置错误信息
   * @param error
   */
  static setErrorMessage(error: any) {
    let errorMessage = ''
    try {
      error.message = error.response.data.title || error.response.data.message || error.response.data.error || error.response.statusText
      if (error.response.data.detail) {
        error.detail = error.response.data.detail
        console.error(error.detail)
      }
      if (error.response.data.code) {
        error.code = error.response.data.code
      }
      errorMessage = error.response.data.errorMessage
      error.status = error.response.status


    } catch (e) {
      error = error || {}
    }
    if (!error.message) {
      error.message = '未知错误'
    }
    error.title = '服务异常'

    if (error.message.indexOf('timeout of') === 0) {
      error.message = '网络连接超时，请检查网络！'

    } else if (error.message === 'error.http.500') {
      error.message = '系统错误！'

    } else if (error.message === 'Network Error') {
      error.message = '网络错误，请检查网络！'

    } else if (error.status === 503) {
      error.message = '系统服务重启中'

    } else if (error.response.config.url === 'uaa/oauth2/token') {
      error.status = 500
      if (['server_error', 'Unauthorized'].includes(error.message)) {
        error.message = '帐号或者密码错误'
      }

    } else if (error.status === 401) {
      error.title = '提示'
      error.message = errorMessage || '您登录的帐号因超时无操作失效，请重新登录'

    } else if (error.status === 403) {
      error.title = '未获取接口权限'
      error.message = error.response.config.url.replace(error.response.config.baseURL, '') + ' 接口拒绝访问，如已获得权限，请等几分钟再试'

    }
    //[{"field":"xmmc","message":"项目名称最大字符不能超过 32 个字符","objectName":"bdcdyInitializationVM"}]
    if (error.status === 500 && error.code === '5001') {
      try {
        const detail = JSON.parse(error.detail)
        const errorFields: any[] = []
        detail.forEach((item: any) => {
          errorFields.push({
            errors: [item.message],
            name: [item.field]
          })
        })
        error.errorFields = errorFields
      } catch (e) {
        console.error(e)
      }


    }
  }

}