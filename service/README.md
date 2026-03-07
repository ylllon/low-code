# service

Node.js + Koa 后端服务（用于当前 low-code 前端登录与权限联调）。

## 1. 启动

```bash
cd service
pnpm install
pnpm dev
```

默认端口：`3000`

> 前端 `vite.config.ts` 已将 `/api` 代理到 `http://localhost:3000`，并去掉 `/api` 前缀。  
> 即前端请求 `/api/uaa/passwordLogin`，会转发到后端 `/uaa/passwordLogin`。

## 2. 内置测试账号

- `zs / zs`（管理员）
- `ls / ls`（编辑者）

## 3. 已实现接口

- `GET /healthz`
- `GET /uaa/passwordLogin`
- `POST /uaa/passwordLogin`
- `GET /uaa/v1/account/getPermission`
- `GET /uaa/v1/app/mini/list`
- `GET /uaa/v1/role/list`
- `POST /uaa/oauth2/token`

## 4. 使用说明

登录成功后返回 OAuth2 风格字段：

- `access_token`
- `refresh_token`
- `expires_in`
- `token_type`

后续需在请求头带：

```txt
Authorization: Bearer <access_token>
```

`/uaa/v1/account/getPermission` 会返回当前用户、菜单、应用信息，用于前端动态权限路由。
