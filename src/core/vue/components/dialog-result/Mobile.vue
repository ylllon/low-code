<template>
  <div class="van-overlay" style="z-index: 10000;"  :class="{'zoom-enter-active-overlay' : visible,'zoom-leave-active-overlay' : !visible}"></div>
  <div
    :class="{'zoom-enter-active' : visible,'zoom-leave-active' : !visible}"
    class="van-popup van-popup--center van-dialog"
       style="z-index: 10002;">
    <div class="van-dialog__header">{{ title }}</div>
    <div class="van-dialog__content" v-if="subTitle">
      <div class="van-dialog__message van-dialog__message--has-title">{{ subTitle }}</div>
    </div>
    <div class="van-hairline--top van-dialog__footer"><!---->
      <button type="button" class="van-button van-button--default van-button--large van-dialog__confirm" @click="onOk">
        <div class="van-button__content"><!----><span class="van-button__text">{{ okText }}</span><!----></div>
      </button>
    </div><!----></div>

</template>

<script setup lang="ts">
import {ref} from 'vue'

defineProps({
  title: String,
  subTitle: String,
  okText: {
    type: String,
    default: '确定'
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

.van-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, .7);
  animation-duration: 0.3s;
}
.van-popup--center {
  top: 50%;
  left: 0;
  right: 0;
  width: fit-content;
  max-width: calc(100vw - 16px * 2);
  margin: 0 auto;
  transform: translateY(-50%);
}
.van-dialog {
  position: fixed;
  top: 45%;
  width: 320px;
  overflow: hidden;
  font-size: 16px;
  background: #ffffff;
  border-radius: 16px;
  backface-visibility: hidden;
  animation-duration: 0.3s;
  transition-property: transform,opacity;
}
.van-dialog__header {
  color: #323233;
  padding-top: 26px;
  font-weight: 600;
  line-height: 24px;
  text-align: center;
}
.van-dialog__message {
  flex: 1;
  max-height: 60vh;
  padding: 26px 24px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 20px;
  white-space: pre-wrap;
  text-align: center;
  word-wrap: break-word;
  -webkit-overflow-scrolling: touch;
}
.van-dialog__message--has-title {
  padding-top:8px;
  color: #646566;
}
.van-dialog__footer {
  display: flex;
  overflow: hidden;
  user-select: none;
  padding: 8px 24px 16px;
}
.van-button {
  position: relative;
  display: inline-block;
  box-sizing: border-box;
  height: 36px;
  margin: 0;
  padding: 0;
  font-size: 16px;
  line-height: 1.2;
  text-align: center;
  cursor: pointer;
  transition: opacity 0.2s;
  background: #ffffff;
  color: #ffffff;
  width: 100%;
  background: linear-gradient(to right, rgb(255, 96, 52), rgb(238, 10, 36));


  border-top-right-radius: 999px;
  border-bottom-right-radius:  999px;
  border-top-left-radius:  999px;
  border-bottom-left-radius:  999px;

}
.van-dialog__confirm, .van-dialog__cancel {
  flex: 1;
  margin: 0;
  border: 0;
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
    //transform: scale(0, 0);
  }
  100% {
    opacity: 1;
    //transform: scale(1, 1);
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