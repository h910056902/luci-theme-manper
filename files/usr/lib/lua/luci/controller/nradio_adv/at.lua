
module("luci.controller.nradio_adv.at", package.seeall)

local nixio = require "nixio"
local util = require "luci.util"
local http = require "luci.http"
local fs = require "nixio.fs"

local AT_LOG = "/tmp/at.log"
local AT_LOCK_FILE = "/tmp/at.lock"

-- AT 命令台二级口令(开源发布时已脱敏;部署到设备后请改成自己的口令)
local PASSWD = "manper-change-me"
local CMD_PREFIX = "cpetools.sh -t 0 -c"

function index()
	local nr = require "luci.nradio"
	local firmware_type = nr.get_firmware_type()
	local has_cpe = nr.has_cpe()
	if firmware_type ~= "odm" and has_cpe then
		page = entry({"nradioadv", "system", "at"}, template("nradio_adv/at"), _("AT"), 20, true)
		entry({"nradioadv", "system", "at", "run"}, call("action_at_run"), nil, nil, true)
		entry({"nradioadv", "system", "at", "clear"}, call("action_at_clear"), nil, nil, true)
		entry({"nradioadv", "system", "at", "auth"}, call("action_at_auth"), nil, nil, true)
		page.icon = 'nradio-at'
		page.show = true
	end
end

function action_at_clear()
	fs.unlink(AT_LOG)
	http.prepare_content("application/json")
	http.write_json({ code = 0 })
end

function action_at_auth()
	local password = http.formvalue("password")
	local status = (password ~= nil and password == PASSWD)

	http.prepare_content("application/json")
	if status then
		http.write_json({ code = 0 })
	else
		http.write_json({ code = 1 })
	end
end

local function shellquote(s)
	if s == nil then
		return "''"
	end
	s = tostring(s)
	s = s:gsub("'", "'\\''")
	return "'" .. s .. "'"
end

local function is_valid_at(cmd)
	if not cmd or #cmd == 0 or #cmd > 256 then
		return false
	end
	if not cmd:match("^[^%c]+$") then
		return false
	end
	return true
end

function action_at_run()
	local at_cmd = http.formvalue("at_cmd")
	local code = 1
	local at_responses = ""
	at_cmd = at_cmd:gsub("\r", ""):gsub("\n", "")
	if is_valid_at(at_cmd) then
		local inner = string.format("%s %s", CMD_PREFIX, shellquote(at_cmd))
		local cmdline = string.format("%s -n %s -c %s || echo LOCKED", "flock", AT_LOCK_FILE, shellquote(inner))
		local exit, out = pcall(util.exec, cmdline)
		if exit then
			if out and out:find("LOCKED") then
				code = -1
				at_responses = ""
			else
				at_responses = out or ""
				code = 0
			end
		else
			at_responses = "Failed: Error in command execution"
			code = 2
		end
	else
		at_responses = "Error: Invalid AT command"
		code = 3
	end

	local function write_at_log(time, cmd, resp)
		local f = io.open(AT_LOG, "a")
		if f then
			f:write(time .. "\t" .. cmd .. "\n")
			f:write(time .. "\t" .. resp .. "\n")
			f:close()
		end
	end

	local time = os.date("%Y-%m-%d %H:%M:%S")
	if code ~= -1 then
		write_at_log(time, at_cmd, at_responses)
	end

	local temp = ""
	if code ~= -1 then
		temp = time .. "\t" .. at_cmd .. "\n" .. time .. "\t" .. at_responses .. "\n"
	end

	http.prepare_content("application/json")
	http.write_json({ responses = temp, code = code })
end