import type {UserDTO} from '../api/userPermissonApi.d'
import { ACCESS_USER } from '@/core/config/constant'
import ls from '../vue/yl-ls'
import sm4 from '@/core/utils/sm4'
import { webapp } from '../store/webapp'
import type { RouteLocationNormalized } from 'vue-router'
class Util {
  /**
   * 获取缓存用户信息
   */
  getLsUser(): UserDTO | null {
    const user: UserDTO = ls.get(ACCESS_USER)
    if (!user) {
      return null
    }
    // user.userName = user.userName ? sm4.decode(user.userName) : ''
    return user
  }

  /**
   * 设置浏览器标题
   * @param title
   * @param webAppName
   */
  setDocumentTitle = (title: string, webAppName = webapp.appName) => {
    if (title) {
      if (webAppName) {
        document.title = title + " - " + webAppName
      } else {
        document.title = title
      }
    } else if (webAppName) {
      document.title = webAppName
    }
  }

  /**
   * 获取网站标题
   * @param route
   * @returns {string}
   */
  getPageTitle = (route: RouteLocationNormalized): string | null => {
    const {meta} = route
    return typeof meta?.title === 'string' ? meta?.title : null
  }
}

export default  new Util();