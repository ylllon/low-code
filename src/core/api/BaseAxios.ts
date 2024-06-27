import type {AxiosInstance, AxiosRequestConfig} from 'axios'
import axios from 'axios'
import disposeError from './DisposeError'
import { useCoreStore } from '@/core/store'
import { webapp } from '../store/webapp'

export default  class BaseAxios{
  /**
   * 将DELETE，PUT请求转为POST，默认false
   */
  methodToPost : boolean
  constructor(){
    this.methodToPost = false
  }

  create(config: AxiosRequestConfig): AxiosInstance{
    const service = axios.create(Object.assign({
      baseUrl: '/api',
      timeout:config.timeout || 15000
    },config))

    //统一处理
    service.interceptors.request.use(config=>{
      //将DELETE，PUT请求转为POST
      if (this.methodToPost) {
        config.headers['X-DestRequestMethod'] = config?.method?.toUpperCase()
        if (config?.method?.toUpperCase() === 'PUT' || config?.method?.toUpperCase() === 'DELETE') {
          config.method = 'POST'
        }
      }
      this.requestUse(config)

      return config
    },error=>{
      return Promise.reject(error)
    })
    //请求结果
    service.interceptors.response.use((response) => {
      const coreStore = useCoreStore()
      coreStore.refreshToken()
      console.log("response:",response)

      return this.responseUse(response)
    }, this.responseError)

    return service
  }


  /**
   * 使用请求前
   * @param config
   */
  public requestUse(config: any) {
    const token = useCoreStore().token
    if (token) {
      config.headers['Authorization'] = config.headers['Authorization'] || 'Bearer ' + token
    }
    //授权登录
    if (config.url && config.url.indexOf('uaa/oauth2/token') === 0) {
      const basicToken = btoa(webapp.clientId + ':' + webapp.clientSecret)
      config.headers['Authorization'] = 'Basic ' + basicToken

    }
  }

  /**
   * 使用结果
   * @param response
   */
  public responseUse(response: any) {
    const data = response.data

    if (typeof data === 'object' && typeof data.state === 'boolean') {
      if (data.state) {
        // if (typeof data.data === 'string' && data.data.indexOf(coreConfig.sm4Pre) === 0) {
        //   const sm4Data = sm4.decode(data.data)
        //   if (!sm4Data) {
        //     return Promise.reject({message: '解密失败'})
        //   }
        //   return JSON.parse(sm4Data)
        // }

        return data.data

      } else {
        console.error(data.detail)
        return Promise.reject({
          ...data,
          message: data.title
        })
      }
    }
    return data
  }
  /**
   * 结果发生错误
   * @param error
   */
  public responseError(error: any) {
    if (axios.isCancel(error)) {
      return Promise.reject()
    }
    //二次设置错误信息
    disposeError.setErrorMessage(error)
    console.error('url=', error.config && error.config.url, error.message)


    //弹出错误结果
    disposeError.dialogErrorResult(error)

    return Promise.reject(error || '')

  }

}