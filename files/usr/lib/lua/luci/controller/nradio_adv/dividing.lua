module("luci.controller.nradio_adv.dividing", package.seeall)

function index()
	local uci  = require "luci.model.uci".cursor()	
	local fs = require "nixio.fs"

	if not fs.access("/usr/sbin/mwan3") then
		return
	end

	page = entry({"nradioadv", "network", "dividing"}, template("nradio_dividing/index"), _("Traffic Dist"), 45, true)
	page.icon = 'nradio-dividing'
	page.show = true
	entry({"nradioadv", "network", "dividing","save"}, call("outwan_save"), nil, nil, true).leaf = true
	entry({"nradioadv", "network", "dividing","protocol"}, template("nradio_dividing/protocol"), nil, 46, true)
	entry({"nradioadv", "network", "dividing","protocol","save"}, call("protocol_save"), nil, nil, true).leaf = true
	
end

function get_outwan_data()
	local data_arr = {globals="",client={}}
	local uci = require "luci.model.uci".cursor()
	data_arr.globals  = uci:get("network","globals", "dividing_default") or ""
	uci:foreach("dividing", "client",
		function(s)
			local mac = s[".name"]:gsub("_", ":")
			data_arr["client"][mac] = s["dividing_default"]
		end
	)
	return data_arr
end
function check_nettype_match()
	local uci = require "luci.model.uci".cursor()
	local net_kind=uci:get("network","globals", "net_kind") or ""
	if net_kind == "Dividing" then
		return true
	end
	return false
end

function outwan_save()
	local input_data = luci.http.formvalue() or nil
	local util = require "luci.util"
	local nixio = require "nixio"
	local fs = require "nixio.fs"
	local uci = require "luci.model.uci".cursor()
	local exsit_commit = false
	if not check_nettype_match() then
		luci.nradio.luci_call_result({code = -1})
		return
	end

	if input_data then
		for key,item in pairs(input_data) do			
			local key_arr = util.split(key, '_')
			if key_arr and #key_arr == 6 then
				uci:set("dividing",key,"client")
				uci:set("dividing",key,"dividing_default" ,item)
			end
		end
	end
	uci:commit("dividing")
	util.exec("access_ctl.sh -r 2")
	if fs.access("/usr/sbin/mwan3") then
		util.exec("mwan3 restart >/dev/null 2>&1")
	end
end

function protocol_save()
	local input_data = luci.http.formvalue() or nil
	local util = require "luci.util"
	local nixio = require "nixio"
	local uci = require "luci.model.uci".cursor()
	local fs = require "nixio.fs"
	local change = false
	if not check_nettype_match() then
		luci.nradio.luci_call_result({code = -1})
		return
	end
	if input_data then
		for key,item in pairs(input_data) do
			if key:match("^model_") then
				local key_arr = util.split(key, '_')
				local item_arr = util.split(item, '\n')
				key_arr[2] = key_arr[2]:gsub("[;'\\\"]", "")
				util.exec("uci -q delete dividing."..key_arr[2])
				util.exec("uci -q set dividing."..key_arr[2].."=protocol")
				for i = 1, #item_arr do	
					if item_arr[i] and #item_arr[i] > 0 then
						item_arr[i] = item_arr[i]:gsub("[;'\\\"]", "")
						util.exec("uci -q add_list dividing."..key_arr[2]..".address="..item_arr[i])
					end
				end
				change = true
			end
		end
		if change then
			util.exec("uci commit dividing")
			util.exec("access_ctl.sh -r 2")
		end
	end
end
function get_protocol_data()
	local data_arr = {}
	local uci = require "luci.model.uci".cursor()
	uci:foreach("dividing", "protocol",
		function(s)
			if not data_arr[s[".name"]] then
				data_arr[s[".name"]] = {}
			end
			data_arr[s[".name"]] = s["address"]
		end
	)
	return data_arr
end