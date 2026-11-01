-- Copyright 2017 NRadio
module("luci.controller.nradio.client", package.seeall)

local uci = require "luci.model.uci".cursor()
local lng = require "luci.i18n"
local utl = require "luci.util"
local fs = require "nixio.fs"
local nr = require "luci.nradio"
local stat = require "luci.tools.status"

function index()
    entry({"nradio", "client"}, template("nradio_client/index"), _("Client"), 20, true).index = true
    entry({"nradio", "client", "list"}, call("action_client_list"), nil, nil, true).leaf = true
    entry({"nradio", "client", "all_list"}, call("action_all_list"), nil, nil, true).leaf = true
    entry({"nradio", "client", "set"}, post("action_client_set"), nil, nil, true).leaf = true
    entry({"nradio", "client", "access_set"}, post("action_client_access_set"), nil, nil, true).leaf = true
    entry({"nradio", "client", "qos_set"}, post("action_client_qos_set"), nil, nil, true).leaf = true
    entry({"nradio", "system", "client"}, alias("nradio", "client"), _("Station List"), 30, true).index = true
end


function action_client_list()
    nr.luci_call_result(nr.list_radio_clients())
end

function action_all_list()
	local http = require "luci.http"
	local base_data = nr.list_clients() or {}
	local sms_unread = http.formvalue("sms_unread")
	if sms_unread == "1" then
		base_data.sms_unread = nr.get_sms_unread()
	end
    nr.luci_call_result(base_data)
end

local function set_client_name()
    local mac = luci.http.formvalue("mac")
    local name = luci.http.formvalue("name")

    nr.set_client_name(mac, name)
    os.execute("ubus call infocdp trigger \"{'sync':1}\" >/dev/null")
end

function action_client_set()
    local set_type = luci.http.formvalue("type") or nil

    if not set_type then
        return false
    end

    if set_type == "name" then
        return set_client_name()
    end
end

function  action_client_access_set()
    local mac = luci.http.formvalue("mac") or nil
    local enabled = luci.http.formvalue("enabled")
    local ctl_type = luci.http.formvalue("type")
    if enabled ~= "0" then
        enabled="1"
    end
    if not mac or #mac == 0 or not nr.macaddr(mac) then
        return
    end
    local switch = nr.get_client_switch(mac,ctl_type)
    if tonumber(enabled) ~= switch then
        nr.set_client_switch(mac,enabled,ctl_type)
        os.execute("ubus call infocdp trigger \"{'sync':1}\" >/dev/null")
    end
    nr.luci_call_result({code=0})
end

function  action_client_qos_set()
    local mac = luci.http.formvalue("mac") or nil
    local enabled = luci.http.formvalue("enabled")
    local download = luci.http.formvalue("download") or "0"
    local upload = luci.http.formvalue("upload") or "0"

    if enabled ~= "0" then
        enabled="1"
    end

    if not mac or #mac == 0 or not nr.macaddr(mac) then
        return
    end
    local data = {
        client = mac,
        qos = enabled,
        download = download,
        upload = upload
    }
    nr.set_client_qos(data)
    nr.luci_call_result({code=0})
end