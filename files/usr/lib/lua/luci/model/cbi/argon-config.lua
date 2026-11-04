local nxfs = require 'nixio.fs'
local wa = require 'luci.tools.webadmin'
local opkg = require 'luci.model.ipkg'
local sys = require 'luci.sys'
local http = require 'luci.http'
local nutil = require 'nixio.util'
local name = 'argon'
local uci = require 'luci.model.uci'.cursor()

local fstat = nxfs.statvfs(opkg.overlay_root())
local space_total = fstat and fstat.blocks or 0
local space_free = fstat and fstat.bfree or 0
local space_used = space_total - space_free

local free_byte = space_free * fstat.frsize

local primary, dark_primary, blur_radius, blur_radius_dark, blur_opacity, mode
if nxfs.access('/etc/config/argon') then
	primary = uci:get_first('argon', 'global', 'primary')
	dark_primary = uci:get_first('argon', 'global', 'dark_primary')
	blur_radius = uci:get_first('argon', 'global', 'blur')
	blur_radius_dark = uci:get_first('argon', 'global', 'blur_dark')
	blur_opacity = uci:get_first('argon', 'global', 'transparency')
	blur_opacity_dark = uci:get_first('argon', 'global', 'transparency_dark')
	mode = uci:get_first('argon', 'global', 'mode')
	bing_background = uci:get_first('argon', 'global', 'bing_background')
	-- manper 双主题: manper 定制层 | orig 原版 argon
	ui_theme = uci:get_first('argon', 'global', 'ui_theme')
	-- 首页样式: manper 驾驶舱 | myos MYOS 原厂初始版
	ui_home = uci:get_first('argon', 'global', 'ui_home')
end
ui_theme = ui_theme or 'manper'
ui_home = ui_home or 'manper'

function glob(...)
    local iter, code, msg = nxfs.glob(...)
    if iter then
        return nutil.consume(iter)
    else
        return nil, code, msg
    end
end

local transparency_sets = {
    0,
    0.1,
    0.2,
    0.3,
    0.4,
    0.5,
    0.6,
    0.7,
    0.8,
    0.9,
    1
}

-- [[ 模糊设置 ]]--
br = SimpleForm('config', translate('Argon Config'), translate('Here you can set the blur and transparency of the login page of argon theme, and manage the background pictures and videos.[Chrome is recommended]'))
br.reset = false
br.submit = false
s = br:section(SimpleSection) 

o = s:option(ListValue, 'bing_background', translate('Wallpaper Source'))
o:value('0', translate('Built-in'))
o:value('1', translate('Bing Wallpapers'))
o.default = bing_background
o.rmempty = false

-- 8080 自建三主题开关: manper 定制 / MYOS UI / iStoreOS 风格(自研单页控制台)
-- 注意必须列出 istore，否则当前为 istore 时 CBI 下拉会回退成 manper，
-- 用户既看不到真实主题，也无法在页面上切回自研主题。
o = s:option(ListValue, 'ui_theme', translate('UI Theme (8080)'))
o:value('manper', 'manper 定制风格（星空登录页 / 驾驶舱首页）')
o:value('myos', 'MYOS UI（移植自 MYOS 官方主题 / 真实数据仪表盘）')
o:value('istore', 'iStoreOS 风格（自研单页控制台 / 浅色卡片 / 蓝色渐变）')
o.default = ui_theme
o.rmempty = false
o.description = translate('选择 8080 独立实例的界面风格，保存后立即生效（页面会重新加载）。istore 为本项目自研主题。')


o = s:option(ListValue, 'mode', translate('Theme mode'))
o:value('normal', translate('Follow System'))
o:value('light', translate('Force Light'))
o:value('dark', translate('Force Dark'))
o.default = mode
o.rmempty = false
o.description = translate('You can choose Theme color mode here')

o = s:option(Value, 'primary', translate('[Light mode] Primary Color'), translate('A HEX Color ; ( Default: #5e72e4 )'))
o.default = primary
o.datatype = ufloat
o.rmempty = false



o = s:option(ListValue, 'transparency', translate('[Light mode] Transparency'), translate('0 transparent - 1 opaque ; ( Suggest: transparent: 0 or translucent preset: 0.5 )'))
for _, v in ipairs(transparency_sets) do
    o:value(v)
end
o.default = blur_opacity
o.datatype = ufloat
o.rmempty = false

o = s:option(Value, 'blur', translate('[Light mode] Frosted Glass Radius'), translate('Larger value will more blurred ; ( Suggest:  clear: 1 or blur preset: 10 )'))
o.default = blur_radius
o.datatype = ufloat
o.rmempty = false

o = s:option(Value, 'dark_primary', translate('[Dark mode] Primary Color'), translate('A HEX Color ; ( Default: #483d8b )'))
o.default = dark_primary
o.datatype = ufloat
o.rmempty = false

o = s:option(ListValue, 'transparency_dark', translate('[Dark mode] Transparency'), translate('0 transparent - 1 opaque ; ( Suggest: Black translucent preset: 0.5 )'))
for _, v in ipairs(transparency_sets) do
    o:value(v)
end
o.default = blur_opacity_dark
o.datatype = ufloat
o.rmempty = false

o = s:option(Value, 'blur_dark', translate('[Dark mode] Frosted Glass Radius'), translate('Larger value will more blurred ; ( Suggest:  clear: 1 or blur preset: 10 )'))
o.default = blur_radius_dark
o.datatype = ufloat
o.rmempty = false

o = s:option(Button, 'save', translate('Save Changes'))
o.inputstyle = 'reload'

function br.handle(self, state, data)
    if (state == FORM_VALID and data.blur ~= nil and data.blur_dark ~= nil and data.transparency ~= nil and data.transparency_dark ~= nil and data.mode ~= nil) then
        nxfs.writefile('/tmp/aaa', data)
        for key, value in pairs(data) do
            -- 跳过按钮字段,避免把按钮文案写成 uci 选项(如 option save '保存更改')
            if key ~= 'save' and key ~= 'upload' then
                uci:set('argon','@global[0]',key,value)
            end
        end 
        uci:commit('argon')
    end
    return true
end

ful = SimpleForm('upload', translate('Upload  (Free: ') .. wa.byte_format(free_byte) .. ')', translate("You can upload files such as jpg,png,gif,mp4,webm files, To change the login page background."))
ful.reset = false
ful.submit = false

sul = ful:section(SimpleSection, '', translate("Upload file to '/www/luci-static/argon/background/'"))
fu = sul:option(FileUpload, '')
fu.template = 'argon-config/other_upload'
um = sul:option(DummyValue, '', nil)
um.template = 'argon-config/other_dvalue'

local dir, fd
dir = '/www/luci-static/argon/background/'
nxfs.mkdir(dir)
http.setfilehandler(
    function(meta, chunk, eof)
        if not fd then
            if not meta then
                return
            end

            if meta and chunk then
                fd = nixio.open(dir .. meta.file, 'w')
            end

            if not fd then
                um.value = translate('Create upload file error.')
                return
            end
        end
        if chunk and fd then
            fd:write(chunk)
        end
        if eof and fd then
            fd:close()
            fd = nil
            um.value = translate('File saved to') .. ' "/www/luci-static/argon/background/' .. meta.file .. '"'
        end
    end
)

if http.formvalue('upload') then
    local f = http.formvalue('ulfile')
    if #f <= 0 then
        um.value = translate('No specify upload file.')
    end
end

local function getSizeStr(size)
    local i = 0
    local byteUnits = {' kB', ' MB', ' GB', ' TB'}
    repeat
        size = size / 1024
        i = i + 1
    until (size <= 1024)
    return string.format('%.1f', size) .. byteUnits[i]
end

local inits, attr = {}
for i, f in ipairs(glob(dir .. '*')) do
    attr = nxfs.stat(f)
    if attr then
        inits[i] = {}
        inits[i].name = nxfs.basename(f)
        inits[i].mtime = os.date('%Y-%m-%d %H:%M:%S', attr.mtime)
        inits[i].modestr = attr.modestr
        inits[i].size = getSizeStr(attr.size)
        inits[i].remove = 0
        inits[i].install = false
    end
end

form = SimpleForm('filelist', translate('Background file list'), nil)
form.reset = false
form.submit = false

tb = form:section(Table, inits)
nm = tb:option(DummyValue, 'name', translate('File name'))
mt = tb:option(DummyValue, 'mtime', translate('Modify time'))
sz = tb:option(DummyValue, 'size', translate('Size'))
btnrm = tb:option(Button, 'remove', translate('Remove'))
btnrm.render = function(self, section, scope)
    self.inputstyle = 'remove'
    Button.render(self, section, scope)
end

btnrm.write = function(self, section)
    local v = nxfs.unlink(dir .. nxfs.basename(inits[section].name))
    if v then
        table.remove(inits, section)
    end
    return v
end

return br, ful, form
