import { defineComponent, type PropType } from 'vue'
import type { MessageElemExt } from '../types/MessageElemExt'
import styles from './MessageElement.module.sass'
import { NImage } from 'naive-ui'
import linkifyStr from 'linkify-string'

export default defineComponent({
  props: {
    elem: { required: true, type: Object as PropType<MessageElemExt> },
  },
  setup(props) {
    return () => {
      switch (props.elem.type) {
        case 'text':
          return <div class={styles.messageContent} innerHTML={linkifyStr(props.elem.text || '', {
            nl2br: true,
            target: '_blank',
          })}></div>
        case 'image':
          return <NImage
            width={200}
            src={props.elem.url}
            imgProps={{ referrerpolicy: 'no-referrer' }}
          />
        case 'video-loop':
          return <video src={props.elem.url} autoplay muted loop width={200} />
        case 'tgs':
          return <tgs-player autoplay={true} loop={true} mode="normal" src={props.elem.url}
            style={{ width: 200, height: 200 }} />
        default:
          return <></>
      }
    }
  },
})
