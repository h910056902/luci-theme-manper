-- Docker 顶层菜单（OpenWrt / LuCI 标准注册方式，与 luci-app-* 的 controller 完全同构）
-- 路径：/admin/docker   标题：Docker   排序：30（状态 20 → 系统 40 之间）
--
--   * entry() 注册在 admin 根下 → 与 系统/服务/网络 同级（不放在「状态」里）；
--   * .leaf = true → 可点击的终端节点，无子菜单，不会被 argon 侧栏渲染成下拉分组；
--   * 模板走 8080 实例私有 view：admin_status/nradio_docker.htm
--     （该名字已在 CGI 模板白名单中，否则不会从实例目录加载）。
--
-- 只在 8080 实例注册：80 端口那份既没有该 view，也没有 ?action=docker 的后端，
-- 若共用 controller 会在 80 出现一个点开报错的空菜单。
--
-- 注意：不要在这里 `local dispatcher = require "luci.dispatcher"` ——
--       该模块在 cacheloader 上下文里返回 nil，会报
--       "attempt to index upvalue 'dispatcher' (a nil value)"。
--       entry/template 由 dispatcher 在调用 index() 前注入为全局，直接调用即可。
--
-- 卸载：删本文件 + rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache

module("luci.controller.kp_docker", package.seeall)

function index()
	local port = os.getenv("SERVER_PORT") or ""
	if port ~= "8080" then
		return
	end

	entry({ "admin", "docker" }, template("admin_status/nradio_docker"), _("Docker"), 30).leaf = true
end
