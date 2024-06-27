import type { App } from 'vue'
import { setVueInstance,vueInstance } from '@/core/store/vueInstance'
import directive from './vue/directive'
import BaseAxios from './api/BaseAxios'
import BaseWebapp from './vue/webapp'
import {createYlRouter} from './vue/create-yl-router'
import {
  ErrorComponent,
  dialogResult,
  updatePrompt
} from './vue/components'


const BASE_URL = import.meta.env.BASE_URL
/**
 * 设置vue实例 和注册指令
 * @param app
 */
export default  function install(app: App<Element>){
  setVueInstance(app)
  directive(app)
}

export  {
  BaseAxios,
  BaseWebapp,
  BASE_URL,
  createYlRouter,
  vueInstance,
  //组件
  ErrorComponent,
  dialogResult,
  updatePrompt

}