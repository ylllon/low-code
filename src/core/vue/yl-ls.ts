import VueStorage from 'vue-ls'
enum Types {
  Session = 'session',
  Local = 'local',
  Memory = 'memory',
}
export default  VueStorage.useStorage({
  namespace: 'yllon_', // key prefix
  storage: Types.Local // storage name session, local, memory
}).ls