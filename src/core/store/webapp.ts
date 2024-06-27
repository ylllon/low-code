import type {Webapp} from '../vue/webapp.d'

const webapps: Webapp[] = []
let webapp: Webapp


export function setWebapps(apps: Webapp[]) {
  apps.forEach(app => {
    webapps.push(app)
  })
}

export function setWebapp(app: Webapp) {
  webapp = app
}
export {
  webapps,
  webapp
}