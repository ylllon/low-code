import './assets/main.css'
// import './test/test1.cjs'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import core from './core';

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(core)

app.mount('#app')
