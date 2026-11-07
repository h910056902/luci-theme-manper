--[[
 istore-ui · 系统进程管理路由
 页面本体与 JSON 接口都在 view/admin_status/kp_procmgr.htm 内（仿 kp_cellular 的
 ?action= 模式），控制器只负责注册路由，避免多处维护。
]]
module("luci.controller.kp_procmgr", package.seeall)

function index()
	entry({ "admin", "status", "procmgr" },
		template("admin_status/kp_procmgr"), _("进程管理"), 9).leaf = true
end
