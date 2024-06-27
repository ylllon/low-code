<template>
  <div>
    <button type="submit" @click="login">登录</button>
  </div>
</template>
<script lang="ts" setup>
import { useCoreStore } from '@/core/store'
import {useRouter} from 'vue-router'

const router = useRouter()
let login =  ()=>{
  useCoreStore().passwordLogin({username:'zs',password:'zs' }).then(res => {
    console.log("router login:",router.getRoutes())
    router.replace({
      path: '/'
    })
    console.log(res)
  })
}

</script>