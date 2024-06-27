import JSSM4 from 'jssm4'
import {sm4Key,sm4Pre} from '../config/constant'


export default {
  /**
   * 加密
   * @param text
   * @param SM4_PRE
   */
  encode(text: string | any, SM4_PRE = true) {
    if (!text) {
      return text
    }
    const sm4 = new JSSM4(sm4Key);
    return SM4_PRE ? sm4Pre + sm4.encryptData_ECB(text) : sm4.encryptData_ECB(text)
  },

  /**
   * 解密
   * @param text
   * @param SM4_PRE
   */
  decode(text: string, SM4_PRE = true) {
    if (typeof text !== 'string' || !text) {
      return text
    }
    if (SM4_PRE) {
      if (text.indexOf(sm4Pre) !== 0) {
        return text
      }
      text = text.replace(sm4Pre, '')
    }
    const sm4 = new JSSM4(sm4Key);
    return sm4.decryptData_ECB(text)

  },

  /**
   * url加密
   * @param text
   */
  urlEncode(text: string) {
    if (!text) {
      return text
    }
    return btoa(encodeURIComponent(text)).replace(/\//g, '_')
  },

  /**
   * url解密
   * @param text
   */
  urlDecode(text: string) {
    if (!text) {
      return text
    }
    try {
      text = text.replace(/_/g, '/')
      return decodeURIComponent(atob(text))
    } catch (e) {
      console.error(e)
    }
    return text

  }

}