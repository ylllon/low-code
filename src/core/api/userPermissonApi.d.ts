/**
 * 密码登录信息
 */
export interface LoginParams {
  /**
   * 帐号
   */
  username: string
  /**
   * 密码
   */
  password: string

  /**
   * 验证码数据
   */
  captcha_data?: string
  /**
   * 登录方式，默认password
   */
  grant_type?: 'password' | 'password_with_captcha'
}


/**
 * 登录接口返回信息
 */
export interface Oauth2TokenOptions {
  access_token: string,
  refresh_token: string,
  /**
   * 过期时间，单位秒
   */
  expires_in: number,
  /**
   * 用户ID
   */
  sub: string,

  /**
   * 角色
   */
  roles: string[]

  /**
   * Bearer
   */

  token_type: string
}

export interface UserDTO{
  /**
   * id
   */

  id: string
  /**
   * 用户名
   */
  userName: string
  /**
   * 用户呢称
   */
  realName: string

  /**
   * 用户性别
   */
  sex: '' | '男' | '女'

  /**
   * 民族
   */
  nation: string

  /**
   * 身份类型
   */
  idType: number

  /**
   * 身份编号
   */
  idCode: string

  /**
   * 地址
   */
  address: string

  /**
   * 手机号
   */
  mobile: string

  /**
   * 邮箱
   */
  email: string

  /**
   * 注册来源
   */
  registerSource: string

  /**
   * 外部授权扩展字段-json
   */
  uuaInfo: Record<string, any>

  /**
   * 用户类型
   */
  userType: number

  /**
   * 是否实名认证(0=未实名 | 1=已实名)
   */
  isCertification: '0' | '1'

  /**
   * 头像
   */
  headPortraitUrl: string

  /**
   * 注册IP
   */
  createdUserIp: string

  /**
   * 机构ID
   */
  nodeId: string

  /**
   * 密码级别(30 60 100)
   */
  passwordLevel: string

  /**
   * 启用状态 (0=禁用 | 1=正常)
   */
  status: '0' | '1'

  /**
   * 锁定状态 (0=未锁定 | 1=锁定)
   */
  lockStatus: '0' | '1'

  /**
   * 最后登陆时间
   */
  lastLoginTime: string

  /**
   * 密码错误次数
   */
  passwordWrongTimes: number

  /**
   * 锁定时间
   */
  lockTime: string

  /**
   * 是否需要修改密码(0=不需要 | 1=需要)
   */
  needModifyPassword: '0' | '1'

  /**
   * 所属机构
   */
  node: NodeDTO

  /**
   * 角色
   */
  roles: RoleDTO[]


}

/**
 * 菜单
 */
export interface MenuDTO {
  /**
   * 菜单ID
   */
  id: string
  /**
   * 菜单上级ID
   */
  pid: string
  /**
   * 菜单路径，一级菜单可能没路径
   */
  path: string
  /**
   * 菜单名
   */
  title: string
  /**
   * 图标
   */
  icon: string

  /**
   * 打开方式(_blank=新标签)
   */
  target: '' | '_blank' | 'iframe'

  permission?: string
  /**
   * 权限，如["访问","删除"]
   */
  permissions: string[]
  /**
   * 面包屑
   */
  breadcrumb: string[]
}

/**
 * 应用
 */
export interface AppDTO {
  /**
   * ID
   */
  id: string
  /**
   * 应用名称
   */
  appName: string
  /**
   * logo
   */
  logo: string

  /**
   * clientId
   */
  clientId: string

}

/**
 * 角色
 */
export interface RoleDTO {
  /**
   * 角色ID
   */
  id: string
  /**
   * 角色名称
   */
  name?: string
  /**
   * 角色编码
   */
  code?: string

  /**
   * 父级ID
   */
  pid?: string

  /**
   * 标题？
   */
  title?: string
}

export interface UserPermissionOptions {

  /**
   * 用户
   */
  user: UserDTO

  /**
   * 菜单
   */
  menus: MenuDTO[]

  /**
   * 应用
   */
  app: AppDTO
}

