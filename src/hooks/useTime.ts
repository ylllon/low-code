import type { Ref } from 'vue'
import { onMounted, onUnmounted, ref } from 'vue'

export type UseTimeParams = {
  silent?: boolean
}

export type UseTimeReturn = {
  time: Ref<string>
}

// export type UseTimeReturnTemp = {
//   time: Ref<string>,
//   name: string,
//   age: string
// }
// type C = Partial<UseTimeReturnTemp> //把参数变成非必填
//
// type R = Required<UseTimeReturnTemp> //把参数变成必填

export const useTime = (params: UseTimeParams): UseTimeReturn =>{
  let timer: number | null = null;
  const {silent = true} = params
  //定义初始时间
  const time = ref(new Date().toLocaleString())
  //每隔一秒 ，更新一次事件
  onMounted(()=>{
    if(!silent){
      timer = window.setInterval(()=>{
        time.value = new Date().toLocaleString()
      },1000)
    }
  })
  onUnmounted(()=>{
    if(!silent && timer){
      window.clearInterval(timer)
    }
  })

  return { time }
}