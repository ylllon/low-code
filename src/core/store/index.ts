import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import type {
  AppDTO,
  MenuDTO,
  RoleDTO,
  UserDTO,
  Oauth2TokenOptions,
  LoginParams,
  UserPermissionOptions
} from '../api/userPermissonApi.d'
import { ACCESS_REFRESH_TOKEN, ACCESS_TOKEN, ACCESS_USER } from '@/core/config/constant'
import ls from '../vue/yl-ls'
import dayjs from 'dayjs'
import userPermissonApi from '@/core/api/userPermissonApi'
import sm4 from '@/core/utils/sm4'
import util from '../utils/util'

interface DataTemp {
  appList: AppDTO[] | null,
  roleList: RoleDTO[] | null,
  user: UserDTO | null,
  menus: MenuDTO[],
  app: AppDTO | null
}


export const useCoreStore = defineStore('coreStore',()=>{

  //接口缓存
  const dataTemp: DataTemp = reactive({
    areaList: null,
    nodeList: null,
    appList: null,
    roleList: null,
    user: null,
    menus: [],
    app: null,
    areaCodes: null
  })
  /**
   * 当前登录用户token
   */
  const token = ref('')

  /**
   * 用户
   */
  const user = computed(() => dataTemp.user)


  /**
   * 菜单
   */
  const menus = computed(() => dataTemp.menus)
  /**
   * 应用
   */
  const app = computed(() => dataTemp.app)

  /**
   * 用户拥有的角色
   * @param state
   */
  const roles = computed(() => user.value?.roles || [])

  /**
   * 缓存数据
   */
  const cache = new Map<string, any>()

  //所有应用
  const appList = computed(() => {
    if (!dataTemp.appList) {
      dataTemp.appList = []
      userPermissonApi.getAppAll().then((list:any) => {
        dataTemp.appList = list
      })
    }
    return dataTemp.appList
  })


  //所有角色
  const roleList = computed(() => {
    if (!dataTemp.roleList) {
      dataTemp.roleList = []
      userPermissonApi.getRoleAll().then((list:any) => {
        dataTemp.roleList = list
      })
    }
    return dataTemp.roleList
  })

  /**
   * 密码登录
   * @param userInfo
   * @constructor
   */
  async function passwordLogin(userInfo: LoginParams): Promise<Oauth2TokenOptions> {
    const result = await userPermissonApi.passwordLogin(userInfo);
    console.log("result:",result);
    setToken(result);
    return result;
  }

  /**
   * 设置token
   * @param data
   */
  function setToken(data: string | Oauth2TokenOptions | null) {
    //清空
    if (!data) {
      token.value = ''
      ls.remove(ACCESS_TOKEN)
      ls.remove(ACCESS_REFRESH_TOKEN)
      return
    }
    //只是设置token
    if (typeof data === 'string') {
      token.value = data
      return;
    }

    token.value = data.access_token

    //expiration: 30 * 60 * 1000 // 设置token的过期时间为30分钟
    ls.set(ACCESS_TOKEN, data.access_token, data.expires_in * 1000)
    checkLsTokenExpire()
    if (!data.refresh_token) {
      ls.remove(ACCESS_REFRESH_TOKEN)
      return;
    }
    ls.set(ACCESS_REFRESH_TOKEN, {
      expires_in: data.expires_in,
      expires: new Date().getTime() + data.expires_in * 1000,
      refresh_token: data.refresh_token
    }, data.expires_in * 1000)
  }

  function checkLsTokenExpire() {
    const item = ls.storage.getItem(ls.options.namespace + ACCESS_TOKEN);
    if (item === null) {
      return
    }
    try {
      const data: { expire: number, value: any } = JSON.parse(item);
      setTimeout(() => {
        if (token.value && !ls.get(ACCESS_TOKEN)) {
          setToken(null)
          console.log("Access token expired")
          // dialogResult({
          //   title: '身份过期',
          //   subTitle: '登录已失效，请重新登录',
          //   showClose: true,
          //   ok: () => {
          //     window.location.reload()
          //   }
          // })
        }
      }, data.expire - new Date().getTime())

    } catch (e) {
      console.error(e)
    }
  }

  const isRefreshToken = ref(false)

  /**
   * 刷新token
   */
  function  refreshToken(){
    const refreshTokenTime: number = 0;
    if (isRefreshToken.value || !refreshTokenTime || !token.value) {
      return
    }

    const data = ls.get(ACCESS_REFRESH_TOKEN)
    if (!data) {
      return;
    }
    isRefreshToken.value = true

    //token还剩余秒过期
    const time = Math.round((data.expires - new Date().getTime()) / 1000)
    //已经过了多少秒
    const beforeTime = data.expires_in - time

    const beTime = refreshTokenTime - beforeTime

    //console.log(`token过了${beforeTime}秒,${beTime}秒后将刷新token`)
    if (beTime > 0) {
      isRefreshToken.value = false
      return;
    }
    userPermissonApi.refreshToken(data.refresh_token).then((res:any) => {
      console.warn(dayjs().format('YYYY-MM-DD HH:mm:ss'), '刷新token')
      setToken(res)
      isRefreshToken.value = false

    }).catch((e:any) => {
      console.error('刷新token失败', e)
      //state.isRefreshToken = false

    })
  }

  /**
   * 设置用户信息
   * @param userData
   */
  function setUser(userData: UserDTO | null) {
    if (!userData) {
      dataTemp.user = null
    } else {
      const lsUser = {
        id: userData.id,
        userName: sm4.encode(userData?.userName || ''),
        realName: userData.realName,
        userType: userData.userType,
        headPortraitUrl: userData.headPortraitUrl
      }
      //存帐户信息，不要存敏感数据
      ls.set(ACCESS_USER, lsUser)
      dataTemp.user = userData
    }
  }


  /**
   * 设置菜单
   * @param menus
   */
  function setMenus(menus: MenuDTO[]) {
    // dataTemp.menus = menus.map(menu => {
    //   const path = menu.target === 'iframe' && menu.path ?
    //     util.generateIframePath(menu.path)
    //     : menu.path
    //   return {
    //     ...menu,
    //     path,
    //     breadcrumb: util.listToBreadcrumb(menus, menu.id),
    //   }
    // })
    //
    // webapp.setMenus(dataTemp.menus)
  }
  /**
   * 退出登录
   * @constructor
   */
  function logout() {
    setToken(null)
    setUser(null)
    cache.clear()
  }

  /**
   * 获取权限
   * @param clientId
   * @param cache
   */
  function getPermission(clientId?: string, cache?: boolean): Promise<UserPermissionOptions> {
    return new Promise((resolve) => {
      userPermissonApi.getPermission({
        clientId: clientId,
        roleId: '',
        cache,
      }).then(userPermission => {
        if (userPermission.user) {
          if (!userPermission.user.roles.length) {
            return Promise.reject({message: '无角色权限'})
          }

          if (typeof userPermission.user.uuaInfo === 'string' && userPermission.user.uuaInfo) {
            try {
              userPermission.user.uuaInfo = JSON.parse(userPermission.user.uuaInfo)
            } catch (e) {
              console.error(e)
            }
          }

          if (!userPermission.user.uuaInfo) {
            userPermission.user.uuaInfo = {}
          }
        }

        setUser(userPermission.user)
        setMenus(userPermission.menus)

        // dataTemp.app = userPermission.app
        resolve(userPermission)
      }).catch(e => {
        if (!e.status || e.status === 200) {
          logout()
          // window.location.reload()
        }
        console.log(e.message)
        // dialogResult({
        //   title: e.message,
        //   ok: () => {
        //     window.location.reload()
        //   }
        // })
      })
    })
  }

  const isInitial = ref(false)
  /**
   * 初始化加载用户信息,只执行一次
   */
  function initial() {
    if (isInitial.value) {
      return
    }
    isInitial.value = true
    const accessToken = ls.get(ACCESS_TOKEN)
    if (accessToken) {
      const user = util.getLsUser()
      if (!dataTemp.user) {
        dataTemp.user = user
      }
      token.value = accessToken
      checkLsTokenExpire()
    }
    //监听token变化
    ls.on(ACCESS_TOKEN, (accessToken: string, oldToken: string) => {
      token.value = accessToken
      if (!document.hidden) {
        return
      }
      if (!accessToken || !oldToken) {
        window.location.reload()
        return;
      }
    })
  }

  return{
    token,
    user,
    menus,
    app,
    appList,
    roleList,
    logout,
    setToken,
    refreshToken,
    initial,
    getPermission,
    passwordLogin,
    roles
  }
})