module("luci.controller.nradio_adv.apcli", package.seeall)

function index()
	local platform = ""

	if not pcall(require, "luci.nradio") then
		return
	end

	platform = luci.nradio.get_platform()

	if platform ~= "mtk" and platform ~= "tdtech" then
		return
	end

	page = entry({"nradioadv", "wireless", "apcli"}, cbi("nradio_adv/apcli", {hideapplybtn = true, hidesavebtn = true, hideresetbtn = true}), _("Wireless Bridge"), 40, true)
	page.icon = 'rss'
	page.show = luci.nradio.has_own_wlan(true) and luci.nradio.has_ptype("rt", "ap")
end
