#!/bin/sh
# Gemini 感知备用节点功能 · 部署后校验（幂等）
echo "=== shell 语法 ==="
sh -n /usr/libexec/openclash-helper/speedswitch.sh && echo "  OK speedswitch.sh" || echo "  FAIL speedswitch.sh"
echo "=== Lua 语法 ==="
lua -e 'local f,e=loadfile("/usr/lib/lua/luci/controller/ocspeed.lua"); print(f and "  OK ocspeed.lua" or ("  FAIL "..tostring(e)))'
echo "=== 权限 ==="
chmod 755 /usr/libexec/openclash-helper/speedswitch.sh
ls -l /usr/libexec/openclash-helper/speedswitch.sh
echo "=== UCI 默认值（已有则不覆盖） ==="
setdef() {
  k="$1"; v="$2"; cur=$(uci -q get ocspeed.main.$k)
  if [ -z "$cur" ]; then uci set ocspeed.main.$k="$v"; echo "  set $k=$v"; else echo "  keep $k=$cur"; fi
}
setdef gemini_backup_enable 1
setdef gemini_backup_timeout 6000
setdef gemini_check_interval 5
setdef gemini_fail_count 2
setdef gemini_switch_cooldown 300
uci commit ocspeed
echo "=== crontab ocspeed 行数（不应新增） ==="
grep -c ocspeed /etc/crontabs/root 2>/dev/null || echo 0
echo "=== 新功能标记 ==="
echo -n "  gemini_check="; grep -c 'gemini_check()' /usr/libexec/openclash-helper/speedswitch.sh
echo -n "  gemini_failover="; grep -c 'gemini_failover()' /usr/libexec/openclash-helper/speedswitch.sh
echo -n "  gemini_state_get="; grep -c 'gemini_state_get()' /usr/libexec/openclash-helper/speedswitch.sh
echo -n "  case geminicheck="; grep -c 'geminicheck)' /usr/libexec/openclash-helper/speedswitch.sh
echo -n "  controller action="; grep -c 'action_geminicheck' /usr/lib/lua/luci/controller/ocspeed.lua
echo -n "  view fields="; grep -c 'f_gemini_backup_timeout' /usr/lib/lua/luci/view/ocspeed.htm
echo "=== status 新字段（真实脚本输出） ==="
/usr/libexec/openclash-helper/speedswitch.sh status 2>/dev/null | grep -o '"gemini_[^"]*":[^,}]*' | head -12
echo "=== POSTDEPLOY_DONE ==="
