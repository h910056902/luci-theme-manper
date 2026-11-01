-- 官方 LuCI（80）新增「系统 → 恢复与备份」页
-- 定位：这台机器装不了 Breed（aarch64 + BL2/FIP 引导链，Breed 只有 MIPS 版），
--       所以「不死」用分区级全盘备份 + 恢复指引来实现。
--
-- 只在 80 端口注册：8080 面板是另一套实例，不重复挂这个节点。

module("luci.controller.kp_recovery", package.seeall)

function index()
	local port = os.getenv("SERVER_PORT") or ""
	if port ~= "80" then
		return
	end

	entry({ "admin", "system", "recovery" },
		template("kp_recovery/main"), _("恢复与备份"), 90).leaf = true
end
