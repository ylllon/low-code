import type {App} from 'vue'

let vueInstance : App<Element>

export function setVueInstance(app: App){
    vueInstance = app
}

export {
  vueInstance
}