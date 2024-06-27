<template>

  <div class="ant-modal-root">
    <div class="ant-modal-mask"
         :class="{'zoom-enter-active-overlay' : visible,'zoom-leave-active-overlay' : !visible}"></div>
    <div class="ant-modal-wrap ant-modal-centered"
    >
      <div class="ant-modal" :class="{'zoom-enter-active' : visible,'zoom-leave-active' : !visible}">
        <div class="ant-modal-content">

          <div class="ant-modal-body">


            <div class="ant-result ant-result-403">
              <div class="ant-result-icon ant-result-image" v-if="!showClose">
                <img src="./403.svg "/>
              </div>
              <div class="ant-result-title">{{ title }}</div>
              <div class="ant-result-subtitle" v-if="subTitle">{{ subTitle }}</div>
              <div class="ant-result-extra">
                <button class="ant-btn ant-btn-primary ant-btn-lg" type="button" @click="onOk">
                  <span>{{ okText }}</span>
                </button>
                <div style="margin-top: 10px" v-if="showClose">
                  <a @click="emit('close')">关闭</a>
                </div>

              </div>
            </div>


          </div>


        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref} from 'vue'

defineProps({
  title: String,
  subTitle: String,
  showClose: {
    type: Boolean,
    default: false
  },
  okText: {
    type: String,
    default: '确 定'
  },
  ok: Function
})
const emit = defineEmits(['ok','close'])

const visible = ref(true)

const onOk = () => {
  visible.value = false
  setTimeout(() => {
    emit('ok')
  }, 300)

}
</script>

<style lang="less" scoped>
.ant-result {
  padding: 48px 62px;
}

.ant-result-image {
  width: 250px;
  height: 295px;
  margin: auto;
}

.ant-result-icon {
  margin-bottom: 24px;
  text-align: center;
}

.ant-result-title {
  color: #000000d9;
  font-size: 24px;
  line-height: 1.8;
  text-align: center;
}

.ant-result-subtitle {
  color: #00000073;
  font-size: 14px;
  line-height: 1.6;
  text-align: center;
}

.ant-result-extra {
  margin: 24px 0 0;
  text-align: center;
}

.ant-btn {
  line-height: 1.5715;
  position: relative;
  display: inline-block;
  font-weight: 400;
  white-space: nowrap;
  text-align: center;
  background-image: none;
  border: 1px solid transparent;
  box-shadow: 0 2px #00000004;
  cursor: pointer;
  transition: all .3s cubic-bezier(.645, .045, .355, 1);
  -webkit-user-select: none;
  -moz-user-select: none;
  user-select: none;
  touch-action: manipulation;
  height: 32px;
  padding: 4px 15px;
  font-size: 14px;
  border-radius: 2px;
  color: #000000d9;
  border-color: #d9d9d9;
  background: #fff;
}

.ant-btn-lg {
  height: 40px;
  padding: 0 15px;
  font-size: 16px;
  border-radius: 2px;
}

.ant-btn-primary {
  color: #fff;
  border-color: #1890ff;
  background: #1890ff;
  text-shadow: 0 -1px 0 rgb(0 0 0 / 12%);
  box-shadow: 0 2px #0000000b;

  &:hover {
    border-color: #40a9ff;
    background: #40a9ff;
  }
}


.ant-modal-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10000;
  height: 100%;
  background-color: #00000073;
  animation-duration: 0.3s;
}

.ant-modal-centered {
  text-align: center;
  z-index: 10000
}

.ant-modal-centered:before {
  display: inline-block;
  width: 0;
  height: 100%;
  vertical-align: middle;
  content: "";
}

.ant-modal-wrap {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  overflow: auto;
  outline: 0;
  -webkit-overflow-scrolling: touch;
}

.ant-modal {
  box-sizing: border-box;
  padding: 0 0 24px;
  color: #000000d9;
  font-size: 14px;
  font-variant: tabular-nums;
  line-height: 1.5715;
  list-style: none;
  font-feature-settings: "tnum";
  pointer-events: none;
  position: relative;
  top: 100px;
  width: auto;
  min-width: 520px;
  max-width: calc(100vw - 32px);
  margin: 0 auto;
  animation-duration: 0.3s;
}

.ant-modal-centered .ant-modal {
  top: 0;
  display: inline-block;
  padding-bottom: 0;
  text-align: left;
  vertical-align: middle;
}

.ant-modal-content {
  position: relative;
  background-color: #fff;
  background-clip: padding-box;
  border: 0;
  border-radius: 2px;
  box-shadow: 0 3px 6px -4px #0000001f, 0 6px 16px #00000014, 0 9px 28px 8px #0000000d;
  pointer-events: auto;
}

.ant-modal-body {
  padding: 24px;
  font-size: 14px;
  line-height: 1.5715;
  word-wrap: break-word;
}

.zoom-enter-active {
  animation-name: rcDialogZoomIn;
}

.zoom-leave-active {
  animation-name: rcDialogZoomOut;
  animation-fill-mode: forwards;
}


@keyframes rcDialogZoomIn {
  0% {
    opacity: 0;
    transform: scale(0, 0);
  }
  100% {
    opacity: 1;
    transform: scale(1, 1);
  }
}

@keyframes rcDialogZoomOut {
  0% {
    transform: scale(1, 1);
  }
  100% {
    opacity: 0;
    transform: scale(0, 0);
  }
}

.zoom-enter-active-overlay {
  animation-name: rcDialogZoomInOverlay;
}

.zoom-leave-active-overlay {
  animation-name: rcDialogZoomOutOverlay;
  animation-fill-mode: forwards;
}

@keyframes rcDialogZoomInOverlay {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes rcDialogZoomOutOverlay {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
</style>