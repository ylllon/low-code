import axios from "./Axios";
import type {
  RoleDTO,
  AppDTO,
  Oauth2TokenOptions,
  LoginParams
} from '../api/userPermissonApi.d'
class UserPermissonApi{

  /**
   * 获取权限
   * @param {GetPermissionParams} params
   * @returns {Promise}
   */
  getPermission(params: any): Promise<any> {
    return axios.get('uaa/v1/account/getPermission', {
      params
    })
  }

  /**
   * 获取所有应用
   */
  getAppAll(): Promise<AppDTO[]> {
    return axios.get('uaa/v1/app/mini/list')
  }

  /**
   * 获取所有角色
   */
  getRoleAll(): Promise<RoleDTO[]> {
    return axios.get('uaa/v1/role/list')
  }

  /**
   * 刷新token
   * @param {string} refreshToken
   *
   */
  refreshToken(refreshToken: string): Promise<Oauth2TokenOptions> {
    return axios.post('uaa/oauth2/token', {}, {
      params: {
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'openid'
      }
    })
  }

  /**
   * 密码登录
   * @param {LoginParams} loginData
   * @returns {Promise}
   */
  passwordLogin(loginData: LoginParams): Promise<Oauth2TokenOptions> {

    // const params = {
    //   ...loginData,
    //   username: sm4.encode(loginData.username.trim()),
    //   password: sm4.encode(loginData.password.trim()),
    //   grant_type: loginData.grant_type || 'password',
    //   scope: 'openid'
    // }
    // return this.oauth2Login(params)

    return axios({
      url:  'uaa/passwordLogin',
      method: 'GET',
      params: loginData
    });
  }

  oauth2Login(params: Record<string, any>): Promise<Oauth2TokenOptions> {
    const data = new URLSearchParams()
    for (const i in params) {
      data.append(i, params[i])
    }
    return axios.post('uaa/oauth2/token', data)
  }
}


export default  new UserPermissonApi()