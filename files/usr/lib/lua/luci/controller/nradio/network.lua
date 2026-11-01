-- Copyright 2017-2018 nradio

module("luci.controller.nradio.network", package.seeall)

function index()
	local uci = require("luci.model.uci").cursor()

	if luci.nradio.has_wan_port() then
		entry({"nradio", "basic", "wan"}, template("nradio_network/index"), _("InternetTitle"), 10, true).index = true
		entry({"nradio", "basic", "wan", "save"}, call("action_save_wan"), nil, nil, true).leaf = true
	end

	entry({"nradio", "basic", "lan"}, cbi("nradio_network/lan"), _("LanTitle"), 20, true).index = true
	entry({"nradio", "basic", "iface"}, call("action_net_status"), nil, nil, true).leaf = true
	local page
	page = entry({"nradioadv", "network", "lan"}, alias("nradio", "basic", "lan"), _("LanTitle"), 35, true)
	page.icon = 'nradio-lan'
	page.show = true
end

function action_net_status(ifaces)
	luci.nradio.luci_call_result(luci.nradio.get_net_status(ifaces))
end
function action_save_wan()
	local input_data = luci.http.formvalue() or nil
	local nixio = require "nixio"
	local util = require "luci.util"
	local uci = require "luci.model.uci".cursor()
	local fs = require "nixio.fs"
	local net_kind = ""
	local mwan3_exist = false
	local old_net_kind = uci:get("network","globals", "net_kind") or ""
	local net_type_change = false
	local mwan3_change = false
	local auto_adapt_change = false
	if fs.access("/usr/sbin/mwan3") then
		mwan3_exist = true
	end
	if input_data then
		for key,item in pairs(input_data) do
			if key == "net_kind" then
				net_kind = item
				if net_kind and #net_kind > 0 then
					if net_kind ~= "Dividing" then
						uci:delete("network","globals","dividing")
						uci:delete("network","globals","dividing_default")
					end
					uci:set("network","globals","net_kind",net_kind)
				else
					uci:delete("network","globals","net_kind")
					uci:delete("network","globals","dividing")
					uci:delete("network","globals","dividing_default")
				end
				if net_kind ~= old_net_kind then
					net_type_change = true
				end
				break
			end
		end
		for key,item in pairs(input_data) do
			if key and #key then
				local key_arr = util.split(key, '_')
				if key == "dividing" or key == "dividing_default" then
					if mwan3_exist then
						if item and #item > 0 then
							uci:set("network","globals",key,item)
						else
							uci:delete("network","globals",key)
						end
						mwan3_change = true
					end
				else
					if key_arr and #key_arr == 3 and (key_arr[1] == "wired" or key_arr[1] == "cellular") then
						local name = key_arr[2]
						local sub_option = key_arr[3]
						if sub_option == "weight" then
							if mwan3_exist then
								if key_arr[1] == "wired" then
									uci:set("mwan3",name.."_policy", sub_option,item)
									uci:set("mwan3",name.."6_policy", sub_option,item)
									uci:set("mwan3",name.."_policy", "metric","1")
									uci:set("mwan3",name.."6_policy", "metric","1")
								else
									uci:set("mwan3",name.."_4_policy", sub_option,item)
									uci:set("mwan3",name.."_6_policy", sub_option,item)
									uci:set("mwan3",name.."_4_policy", "metric","1")
									uci:set("mwan3",name.."_6_policy", "metric","1")
								end
								mwan3_change = true
							end
						elseif sub_option == "metric" then
							local temp_item = item
							if mwan3_exist then
								if net_kind == "Overlap" then
									temp_item="1"
								end
								if key_arr[1] == "wired" then
									uci:set("mwan3",name.."_policy", sub_option,temp_item)
									uci:set("mwan3",name.."6_policy", sub_option,temp_item)
								else
									uci:set("mwan3",name.."_4_policy", sub_option,temp_item)
									uci:set("mwan3",name.."_6_policy", sub_option,temp_item)
								end
								mwan3_change = true
							else
								uci:set("network",name, "pos",temp_item)
								net_type_change = true
							end
						else
							uci:set("network",name,"interface")
							if item and #item > 0 then
								uci:set("network", name, sub_option, item)
							else
								uci:delete("network", name, sub_option, item)
							end
							if sub_option == "disabled" then								
								if key_arr[1] == "wired" then
									if item == "0" then
										uci:set("network","nrswitch", "disable_wan", "0")
									else
										uci:set("network","nrswitch", "disable_wan", "1")
									end
								else
									local old_mode = uci:get("network",name, "mode") or ""
									if old_mode == "odu" then
										if item == "0" then
											uci:set("network","globals", "nbcpe", "1")
										else
											uci:set("network","globals", "nbcpe", "0")
										end
									end
								end
							end
							net_type_change = true
						end
					end
				end

			end			
		end
		if  net_type_change then
			uci:commit("network")
		end
		
		if mwan3_change then
			uci:commit("mwan3")
		end
		if net_kind == "" then
			local autowan = uci:get("luci", "module", "auto") or 1
			local wan_disabled = uci:get("network", "wan", "disabled") or "0"
			if tonumber(autowan) ~= 0 then
				if fs.access("/etc/config/auto_adapt") then
					if wan_disabled == "1" then
						uci:set("auto_adapt", "mode","en", "0")
					else
						uci:set("auto_adapt", "mode","en", "1")
					end
					auto_adapt_change = true
				end
			end
		end
	end
	reload_network_relate(net_type_change,mwan3_change,auto_adapt_change)
	luci.nradio.luci_call_result({code=0})
end

function reload_network_relate(net_type_change,mwan3_change,auto_adapt_change)
	local nr = require "luci.nradio"
	local uci = require "luci.model.uci".cursor()
	local util = require "luci.util"
	local fs = require "nixio.fs"
	local sys = require "luci.sys"
	local ipv6_open = uci:get("network","globals", "ipv6")
	local support_nat = nr.support_ipv6_nat()
	local support_relay = nr.support_ipv6_relay()
	local relay_on = uci:get("firewall","@defaults[0]", "ipv6_nat")
	if ipv6_open == "1" then
		ipv6_open = true
	else
		ipv6_open = false
	end

	if not support_nat or (relay_on == "0" and ipv6_open) then
		nr.ip6class_set(false,true)				
	else
		nr.ip6class_set(true,true)	
	end	
	
	if fs.access("/etc/config/mtkhnat") then
		sys.exec("/etc/init.d/mtkhnat restart")
	end
	if mwan3_change then
		nixio.syslog("err","mwan3_change restart")
		sys.exec("access_ctl.sh -r 2 >/dev/null 2>&1")
		sys.exec("mwan3 restart >/dev/null 2>&1")
	end

	if auto_adapt_change then
		if fs.access("/etc/init.d/auto_adapt") then
			sys.exec("/etc/init.d/auto_adapt restart >/dev/null 2>&1")
		end
	end

	if net_type_change then
		nr.kpcpectl_sync()
		util.exec("/etc/init.d/wanswd restart >/dev/null 2>&1")
		util.exec("/etc/init.d/atserver-sniffer restart >/dev/null 2>&1")
		util.exec("/etc/init.d/atsd restart >/dev/null 2>&1")
		util.exec("killall -9 cellular_init >/dev/null 2>&1")
		util.exec("/etc/init.d/cellular_init restart >/dev/null 2>&1")
		util.exec("/etc/init.d/cpesel restart >/dev/null 2>&1")
		sys.exec("/etc/init.d/odhcpd restart >/dev/null 2>&1")
		util.exec("/etc/init.d/terminal_trackd restart >/dev/null 2>&1")
		util.exec("/etc/init.d/network reload")
	end
end