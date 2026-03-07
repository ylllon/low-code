import './assets/main.css'
import 'element-plus/dist/index.css'
// import './test/test1.cjs'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'

import App from './App.vue'
import router from './router'

import core from './core';

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(core)
app.use(ElementPlus)

app.mount('#app')
