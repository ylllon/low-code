<template>
  <div class="login-page">
    <div class="bg-shape shape-left"></div>
    <div class="bg-shape shape-right"></div>

    <div class="login-shell">
      <section class="brand-panel">
        <div class="brand-icon">Y</div>
        <h1 class="brand-title">Yllon Studio</h1>
        <p class="brand-subtitle">低代码应用构建平台</p>

        <ul class="brand-feature-list">
          <li>可视化页面编排</li>
          <li>数据源统一管理</li>
          <li>动作流程快速配置</li>
        </ul>
      </section>

      <section class="login-panel">
        <div class="login-header">
          <h2>欢迎登录</h2>
          <p>使用账号密码进入控制台</p>
        </div>

        <form class="login-form" @submit.prevent="handleSubmit">
          <label class="field-label" for="username">账号</label>
          <input
            id="username"
            v-model.trim="form.username"
            class="field-input"
            type="text"
            name="username"
            autocomplete="username"
            placeholder="请输入账号"
            :disabled="isSubmitting"
          />

          <label class="field-label" for="password">密码</label>
          <div class="password-input-wrapper">
            <input
              id="password"
              v-model="form.password"
              class="field-input password-input"
              :type="isPasswordVisible ? 'text' : 'password'"
              name="password"
              autocomplete="current-password"
              placeholder="请输入密码"
              :disabled="isSubmitting"
            />
            <button
              class="password-toggle"
              type="button"
              :disabled="isSubmitting"
              @click="isPasswordVisible = !isPasswordVisible"
            >
              {{ isPasswordVisible ? '隐藏' : '显示' }}
            </button>
          </div>

          <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

          <button class="submit-btn" type="submit" :disabled="isSubmitting">
            <span v-if="isSubmitting" class="spinner"></span>
            {{ isSubmitting ? '登录中...' : '登录' }}
          </button>
        </form>
      </section>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { reactive, ref } from 'vue'
import { useCoreStore } from '@/core/store'
import { useRoute, useRouter } from 'vue-router'

const coreStore = useCoreStore()
const router = useRouter()
const route = useRoute()

const form = reactive({
  username: import.meta.env.DEV ? 'zs' : '',
  password: import.meta.env.DEV ? 'zs' : ''
})

const isSubmitting = ref(false)
const isPasswordVisible = ref(false)
const errorMessage = ref('')

function validateForm() {
  if (!form.username) {
    errorMessage.value = '请输入账号'
    return false
  }
  if (!form.password) {
    errorMessage.value = '请输入密码'
    return false
  }
  errorMessage.value = ''
  return true
}

async function handleSubmit() {
  if (isSubmitting.value) {
    return
  }

  if (!validateForm()) {
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    await coreStore.passwordLogin({
      username: form.username,
      password: form.password
    })

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace({ path: redirect })
  } catch (error: any) {
    errorMessage.value = error?.message || '登录失败，请检查账号密码或稍后重试'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: hidden;
  background:
    radial-gradient(circle at 0 0, rgb(224 243 255), transparent 38%),
    radial-gradient(circle at 100% 100%, rgb(215 255 245), transparent 36%),
    linear-gradient(135deg, #f7fafc 0%, #edf4ff 100%);
}

.bg-shape {
  position: absolute;
  width: 320px;
  height: 320px;
  border-radius: 999px;
  filter: blur(36px);
  pointer-events: none;
}

.shape-left {
  top: -96px;
  left: -64px;
  background: rgb(0 136 255 / 22%);
}

.shape-right {
  right: -72px;
  bottom: -96px;
  background: rgb(0 196 83 / 24%);
}

.login-shell {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 980px;
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  border-radius: 20px;
  overflow: hidden;
  box-shadow:
    0 24px 60px rgb(39 76 119 / 14%),
    0 8px 18px rgb(39 76 119 / 10%);
  background-color: var(--color-white);
}

.brand-panel {
  padding: 48px 42px;
  color: #eaf4ff;
  background: linear-gradient(165deg, #0c4a7a 0%, #1271ab 52%, #1f9fa1 100%);
}

.brand-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 20px;
  font-weight: var(--font-weight-bolder);
  color: #0d5b86;
  background-color: #e8f8ff;
}

.brand-title {
  margin-top: 18px;
  font-size: 34px;
  font-weight: var(--font-weight-bolder);
  letter-spacing: 0.2px;
}

.brand-subtitle {
  margin-top: 10px;
  font-size: var(--font-size-normal);
  line-height: 1.7;
  color: rgb(234 244 255 / 90%);
}

.brand-feature-list {
  margin-top: 26px;
  display: grid;
  gap: 10px;
}

.brand-feature-list li {
  display: flex;
  align-items: center;
  font-size: 13px;
  line-height: 1.6;
  color: rgb(245 250 255 / 92%);
}

.brand-feature-list li::before {
  content: '';
  width: 6px;
  height: 6px;
  margin-right: 10px;
  border-radius: 999px;
  background-color: #a4e5ff;
  box-shadow: 0 0 0 4px rgb(164 229 255 / 18%);
}

.login-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 44px 42px;
}

.login-header h2 {
  font-size: 28px;
  font-weight: var(--font-weight-bolder);
  color: var(--color-gray-900);
}

.login-header p {
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-gray-700);
}

.login-form {
  margin-top: 28px;
}

.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: var(--font-weight-bold);
  color: var(--color-gray-800);
}

.field-input {
  width: 100%;
  height: 44px;
  border: 1px solid var(--color-gray-400);
  border-radius: 10px;
  padding: 0 14px;
  font-size: 14px;
  color: var(--color-gray-900);
  background-color: #fff;
  transition: all 0.2s ease;
  margin-bottom: 16px;
}

.field-input::placeholder {
  color: var(--color-gray-600);
}

.field-input:focus {
  outline: none;
  border-color: #2f82bf;
  box-shadow: 0 0 0 3px rgb(47 130 191 / 12%);
}

.field-input:disabled {
  cursor: not-allowed;
  background-color: var(--color-gray-100);
}

.password-input-wrapper {
  position: relative;
}

.password-input {
  padding-right: 76px;
}

.password-toggle {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: #2f82bf;
  font-size: 12px;
  font-weight: var(--font-weight-bold);
  cursor: pointer;
}

.password-toggle:disabled {
  color: var(--color-gray-600);
  cursor: not-allowed;
}

.error-message {
  margin: -4px 0 12px;
  font-size: 12px;
  color: #d93025;
}

.submit-btn {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, #1271ab 0%, #14918f 100%);
  color: #fff;
  font-size: 14px;
  font-weight: var(--font-weight-bolder);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgb(19 128 163 / 25%);
}

.submit-btn:disabled {
  opacity: 0.72;
  cursor: not-allowed;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgb(255 255 255 / 38%);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 880px) {
  .login-shell {
    max-width: 520px;
    grid-template-columns: 1fr;
  }

  .brand-panel {
    padding: 34px 30px;
  }

  .brand-title {
    font-size: 28px;
  }

  .login-panel {
    padding: 34px 30px 36px;
  }
}

@media (max-width: 520px) {
  .login-page {
    padding: 16px;
  }

  .brand-panel,
  .login-panel {
    padding-left: 22px;
    padding-right: 22px;
  }

  .login-header h2 {
    font-size: 24px;
  }
}
</style>
