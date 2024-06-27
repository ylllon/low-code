import {createApp, h} from 'vue';
import Mobile from './Mobile.vue'
import Pc from './Pc.vue'
import isMobile from '../../../utils/isMobile'

interface ResultOptions {
  title: string
  subTitle?: string
  okText?: string
  showClose?: boolean
  ok?: () => any
}

let visible = false
/**
 * 获取Dialog
 * @param resultOptions
 */
export default function dialog(resultOptions: ResultOptions) {
  if (visible) {
    console.warn("重复显示DialogResult")
    return
  }
  visible = true


  const dialogInstance = createApp({
    render() {
      const dialogProps = {
        ...resultOptions,
        ok: undefined,
        onOk: () => {
          dialogInstance.unmount();
          visible = false

          if (typeof resultOptions.ok === 'function') {
            resultOptions.ok();
          }

        },
        onClose: () => {
          dialogInstance.unmount();
          visible = false
        }
      };
      if (isMobile()) {
        return h(Mobile, dialogProps);
      }
      return h(Pc, dialogProps);
    }
  });

  const dialogDiv = document.createElement('div');
  document.body.appendChild(dialogDiv);
  dialogInstance.mount(dialogDiv);
}