import BaseAxios from './BaseAxios'

class Axios extends BaseAxios {

  constructor() {
    super()

    /**
     * 将DELETE，PUT请求转为POST
     */
    this.methodToPost = true
  }


  /**
   * 使用请求前
   * @param config
   */
  requestUse(config: any) {
    super.requestUse(config)
    //开发环境
    if (import.meta.env.DEV) {
      // if (config.url.indexOf('visual/') === 0 || config.url.indexOf('flowable/') === 0) {
      //   //config.url = 'http://10.1.53.241:98/api/' + config.url
      // }

    }


  }


  /**
   * 使用结果
   * @param response
   */
  responseUse(response: any) {
    return super.responseUse(response)
  }

}

const axios = new Axios().create({
  timeout: 12 * 200,
  baseURL: '/api/'
})

export default axios