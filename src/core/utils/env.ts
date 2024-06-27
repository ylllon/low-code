export const env = {
  get BASE_URL() {
    return import.meta.env.BASE_URL
  },

  get NODE_ENV() {
    return import.meta.env.MODE
  },
  /**
   * 是否开发环境
   */
  get isDev(): boolean {
    return import.meta.env.DEV
  }
}