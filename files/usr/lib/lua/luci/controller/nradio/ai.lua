-- Copyright 2017 NRadio

module("luci.controller.nradio.ai", package.seeall)
local nr = require "luci.nradio"
local uci = require "luci.model.uci".cursor()
local util = require "luci.util"
local providers_alias = "alias"

function index()
	local nr = require "luci.nradio"
	local uci = require "luci.model.uci".cursor()
	local first = uci:get("luci", "main", "first") or "1"
	local fs = require "nixio.fs"

	if fs.access("/usr/bin/zeroclaw") then
		page = entry({"nradioadv", "system", "aibot"}, template("nradio_ai/index"),
			_("AIAgentTitle"), 95, true)
		page.show = true
		page.icon = 'nradio-aibot'
	end

	if nr.has_ai and nr.has_ai() then
		if tonumber(first) == 0 then
			entry({"nradio", "ai"}, template("nradio_ai/AI_chat"), _("AINradioTitle"), 1, true).index = true
		else
			entry({"nradio", "ai"}, template("nradio_ai/AI_first"), _("AINradioTitle"), 0, true).index = true
		end
		entry({"nradio", "ai", "internetMode"}, call("action_mode_set"), nil, nil, true).leaf = true
		entry({"nradio", "ai", "wifiset"}, call("action_wifi_set"), nil, nil, true).leaf = true
		entry({"nradio", "ai", "netcheck"}, call("action_netcheck"), nil, nil, true).leaf = true
	else
		entry({"nradio", "ai"}, template("nradio_ai/index"),_("AINradioTitle"), 99, true).index = true
	end
	entry({"nradio", "ai", "providers"}, call("action_providers"), nil, nil, true).leaf = true
	entry({"nradio", "ai", "model"}, call("action_model"), nil, nil, true).leaf = true
	entry({"nradio", "ai", "channels"}, call("action_channels"), nil, nil, true).leaf = true
	entry({"nradio", "ai", "get_channel_info"}, call("get_channel_info"), nil, nil, true).leaf = true
	entry({"nradio", "ai", "reset_channel_info"}, call("reset_channel_info"), nil, nil, true).leaf = true
	entry({"nradio", "ai", "test"}, call("action_model"), nil, nil, true).leaf = true
	entry({"nradio", "ai", "finish"}, call("action_finish"), nil, nil, true).leaf = true
end

function action_wifi_set()
	local sys  = require "luci.sys"
	local ssid = luci.http.formvalue("ssid") or nil
	local key = luci.http.formvalue("key") or nil
	local dual = luci.http.formvalue("dualBand") or nil

	-- save temporarily, it will be deleted later
	uci:set("cloudd", "t0", "ssid_wlan", "X"..ssid)
	if key then
		uci:set("cloudd", "t0", "key_wlan", "X"..key)
	end
	uci:set("cloudd", "t0", "hidden_wlan", "X0")
	uci:set("cloudd", "t0", "disabled_wlan", "X0")
	if dual then
		uci:set("cloudd", "t0", "diff_2_4_wlan", "X0")
	else
		uci:set("cloudd", "t0", "diff_2_4_wlan", "X1")
	end
	local cl = require "luci.model.cloudd".init()
	local ca = require "cloudd.api"
	local id = ca.cloudd_get_self_id()
	local cdev = cl.get_device(id, "master")
	local slaves = cdev:slaves_sort()
	for i = 1, #slaves do
		local slave = slaves[i]
		local radio_cnt = slave:get_radiocnt()
		local radio_band2 = (radio_cnt.band2 or 1)
		local radio_band5 = (radio_cnt.band5 or 1)

		for j = 1, radio_band2 + radio_band5 do
			local index = j - 1
			local wlan
			local group = nil
			if radio_band2 ~= 0 then
				wlan = "wlan"..index
			else
				wlan = "wlan"..(index + 1)
			end

			uci:foreach("cloudd", "group",
						function(s)
							if s.device then
								for idx = 1, #s.device do
									if s.device[idx] == slave.sid then
										group = s[".name"].."wlan"
										return false
									end
								end
							end
						end
			)
			uci:delete("cloudd", group, "disabled_"..wlan)
			uci:delete("cloudd", group, "ssid_"..wlan)
			uci:delete("cloudd", group, "encryption_"..wlan)
			uci:delete("cloudd", group, "key_"..wlan)
			uci:delete("cloudd", group, "hidden_"..wlan)
			uci:delete("cloudd", group, "macfilter_"..wlan)
			uci:delete("cloudd", group, "acllist_"..wlan)
		end
	end
	uci:delete("cloudd", "config", "md5")
	uci:commit("cloudd")
	nr.luci_call_result("{'result':'OK'}")
end
function action_mode_set()
	local mode = luci.http.formvalue("mode")
	if mode == "dhcp" then
		uci:set("network", "wan", "proto", "dhcp")
		uci:set("network", "wan", "disabled", "0")
		uci:delete("network", "wan", "username")
		uci:delete("network", "wan", "password")
		uci:delete("network", "wan", "ipaddr")
		uci:delete("network", "wan", "netmask")
		uci:delete("network", "wan", "gateway")
		uci:delete("network", "wan", "dns")
		uci:commit("network")
		os.execute("ifup wan >/dev/null 2>&1")
		nr.luci_call_result("{'result':'OK'}")
	elseif mode == "pppoe" then 
		local username = luci.http.formvalue("account")
		local password = luci.http.formvalue("password")
		uci:set("network", "wan", "proto", "pppoe")
		uci:set("network", "wan", "username", username)
		uci:set("network", "wan", "password", password)
		uci:set("network", "wan", "disabled", "0")
		uci:delete("network", "wan", "ipaddr")
		uci:delete("network", "wan", "netmask")
		uci:delete("network", "wan", "gateway")
		uci:delete("network", "wan", "dns")
		uci:commit("network")
		os.execute("ifup wan >/dev/null 2>&1")
		nr.luci_call_result("{'result':'OK'}")
	elseif mode == "static" then
		local ipaddr = luci.http.formvalue("ip")
		local netmask = luci.http.formvalue("netmask")
		local gateway = luci.http.formvalue("gateway")
		local dns = luci.http.formvalue("dns")

		uci:set("network", "wan", "disabled", "0")
		uci:set("network", "wan", "proto", "static")
		uci:set("network", "wan", "ipaddr", ipaddr)
		uci:set("network", "wan", "netmask", netmask)
		uci:set("network", "wan", "gateway", gateway)
		uci:set("network", "wan", "dns", dns)
		uci:delete("network", "wan", "username")
		uci:delete("network", "wan", "password")
		uci:commit("network")
		os.execute("ifup wan >/dev/null 2>&1")
		nr.luci_call_result("{'result':'OK'}")
	end
end
function action_netcheck()
	local result = util.ubus("infocd", "basic",{name="wans"}) or { }
	nr.luci_call_result(result)
end

function action_model()
	local providers = luci.http.formvalue("providers") or nil
	local key = luci.http.formvalue("key") or nil

	local models = {code=-1}
	local cjson = require "cjson.safe"

	if providers and #providers > 0 and providers:match("^[a-zA-Z0-9%.%-_]+$") then
		util.exec("zeroclaw providers create models '"..providers:gsub("'", "'\\''").."' "..providers_alias)
		if key and #key > 0 then
			util.exec("zeroclaw config set --no-interactive providers.models."..providers.."."..providers_alias..".api_key '"..key:gsub("'", "'\\''").."'")
		end
		local models_return = util.exec("zeroclaw models preview --model-provider "..providers.."."..providers_alias.." --json")
		local info = cjson.decode(models_return)
		nixio.syslog("err","models_return:"..models_return);
		if info and info.models then
			local exsit = false
			local models_buffer = ""
			for _,item in pairs(info.models) do
				exsit = true
				if #models_buffer > 0 then
					models_buffer = models_buffer..","..item
				else
					models_buffer = item
				end
			end
			nixio.syslog("err","models_buffer:"..models_buffer);
			if exsit then
				models = info
				models.code = 0
				nixio.syslog("err","providers:"..providers);
				uci:set("aiagent", providers, "provider")
				uci:set("aiagent", providers, "models", models_buffer)
				uci:commit("aiagent")
			end
		end
	end

	if not models then
		models = {code=-1}
	end

	nr.luci_call_result(models)
end

function action_providers()
	local providers = luci.http.formvalue("providers") or nil
	local model = luci.http.formvalue("model") or nil
	local uri = luci.http.formvalue("uri") or nil
	local key = luci.http.formvalue("key") or nil
	local llm_type = luci.http.formvalue("type") or nil
	local popular_providers = luci.http.formvalue("popular_providers") or nil

	local cfg_data = uci:get_all("aiagent", "default")

	if not cfg_data or (cfg_data.type ~= llm_type or cfg_data.popular_providers ~= popular_providers or cfg_data.providers ~= providers or cfg_data.model ~= model or cfg_data.key ~= key or cfg_data.uri ~= uri ) then
		uci:set("aiagent", "default", "model")
		uci:set("aiagent", "default", "providers", providers)
		uci:set("aiagent", "default", "alias", providers_alias)
		uci:set("aiagent", "default", "model", model)
		uci:set("aiagent", "default", "key", key)
		uci:set("aiagent", "default", "uri", uri)
		uci:delete("aiagent", "default", "popular_providers")
		if llm_type then
			uci:set("aiagent", "default", "type", llm_type)
			if llm_type == "popular" then
				if popular_providers then
					uci:set("aiagent", "default", "popular_providers", popular_providers)
				end
			end
		end
		uci:commit("aiagent")
		util.exec("rm /.zeroclaw/wechat/owner/account.json")	
		util.exec("/etc/init.d/zeroclaw restart >/dev/null 2>&1")
	end
	nr.luci_call_result("{'result':'OK'}")
end

function action_channels()
	local channels = luci.http.formvalue("channels") or nil
	local agent = luci.http.formvalue("agent") or nil
	local cleanall = luci.http.formvalue("cleanall")
	local ZEROCLAW_CFG_PATH="/.zeroclaw"
	if channels and agent then
		local channel_arr = util.split(channels,",")
		local channels_cur = uci:get("aiagent", agent, "channels")
		if channels_cur ~= channels then
			uci:set("aiagent", agent, "agent")
			uci:set("aiagent", agent, "channels", channels)

			uci:foreach("aiagent", "channel",
				function(s)
					uci:set("aiagent", s[".name"], "enabled", "0")
				end
			)

			for _,item  in pairs(channel_arr) do
				local channel_combine = util.split(item,".")
				if channel_combine and channel_combine[1] then
					uci:set("aiagent", channel_combine[1], "enabled", "1")
				end
			end
			uci:commit("aiagent")

			if cleanall == "1" then
				uci:foreach("aiagent", "channel",
					function(s)
						if s[".name"] == "whatsapp" then
							util.exec("rm "..ZEROCLAW_CFG_PATH.."/"..s[".name"].."/* -fr")
							util.exec("rm /tmp/run/zeroclaw/"..s[".name"].."/"..s["alias"].."/status.json")
						else
							util.exec("rm "..ZEROCLAW_CFG_PATH.."/"..s[".name"].."/"..s["alias"].."/account.json")				
							util.exec("rm /tmp/run/zeroclaw/"..s[".name"].."/"..s["alias"].."/status.json")
						end
					end
				)
			end
			util.exec("/etc/init.d/zeroclaw restart >/dev/null 2>&1")
		end
	end
	nr.luci_call_result("{'result':'OK'}")
end
function reset_channel_info()
	local channels = luci.http.formvalue("channels") or nil
	local agent = luci.http.formvalue("agent") or nil

	if not channels or not channels:match("^[,a-zA-Z0-9%.]+$") then
		nr.luci_call_result("{'result':'FAIL'}")
		return
	end

	local ZEROCLAW_CFG_PATH="/.zeroclaw"
	if channels and agent then
		local channel_arr = util.split(channels,",")
		for _,item  in pairs(channel_arr) do
			local channel_combine = util.split(item,".")
			if channel_combine and channel_combine[1] then				
				if channel_combine[1] == "whatsapp" then
					util.exec("rm "..ZEROCLAW_CFG_PATH.."/"..channel_combine[1].."/* -fr")
					util.exec("rm /tmp/run/zeroclaw/"..channel_combine[1].."/"..channel_combine[2].."/status.json")
				else
					util.exec("rm "..ZEROCLAW_CFG_PATH.."/"..channel_combine[1].."/"..channel_combine[2].."/account.json")
					util.exec("rm /tmp/run/zeroclaw/"..channel_combine[1].."/"..channel_combine[2].."/status.json")
				end
			end
		end
		util.exec("/etc/init.d/zeroclaw restart >/dev/null 2>&1")
	end
	nr.luci_call_result("{'result':'OK'}")
end

function get_channel_info()
	local channels = luci.http.formvalue("channels") or nil
	local agent = luci.http.formvalue("agent") or nil
	local cjson = require "cjson.safe"
	local ZEROCLAW_CFG_PATH="/.zeroclaw"
	local data = {}

	if not channels or not channels:match("^[,a-zA-Z0-9%.]+$") then
		nr.luci_call_result("{'result':'FAIL'}")
		return
	end

	if channels and agent then
		local channel_arr = util.split(channels,",")
		for _,item  in pairs(channel_arr) do
			local channel_combine = util.split(item,".")
			if channel_combine and channel_combine[1] then

				if channel_combine[1] == "whatsapp" then
					account_data = util.exec("cat /tmp/run/zeroclaw/"..channel_combine[1].."/"..channel_combine[2].."/status.json")
					if account_data and #account_data > 0 then
						local info = cjson.decode(account_data)
						if info then
							data[channels] = info
						end
						if data[channels] and data[channels].status and data[channels].status == "connected" then
							data[channels].bind_result = 1
						end
					end
				else
					account_data = util.exec("cat "..ZEROCLAW_CFG_PATH.."/"..channel_combine[1].."/"..channel_combine[2].."/account.json")
					if account_data and #account_data > 0 then
						local info = cjson.decode(account_data)
						if info then
							data[channels] = info
						end
					end
					if data[channels] and data[channels].account_id then
						data[channels].bind_result = 1
					else					
						channel_data = util.exec("cat /tmp/run/zeroclaw/"..channel_combine[1].."/"..channel_combine[2].."/status.json")
						if channel_data and #channel_data > 0 then
							local info = cjson.decode(channel_data)
							if info then
								data[channels] = info
							end
						end
						if data[channels] then
							data[channels].bind_result = 0
						end
					end
				end
			end
		end

	end
	nr.luci_call_result(data)
end

function action_finish()
	uci:set("luci", "main", "first", "0")
	uci:commit("luci")
	nr.luci_call_result("{'result':'OK'}")
end
