import {Router, RouterOptions, RouteRecordRaw} from 'vue-router';
import {WebappOptions} from './webapp'
import type {RouterHistory} from 'vue-router';

export interface WebappRouterOptions extends RouterOptions {
  /**
   * 路由模式，支持 'hash' | 'history'
   */
  mode: 'history' | 'hash'
  routes?: Readonly<RouteRecordRaw[]>;
  history?: RouterHistory;
  webapps: WebappOptions
}

export declare function createYlRouter(options: WebappRouterOptions): Router;