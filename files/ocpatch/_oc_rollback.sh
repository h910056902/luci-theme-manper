#!/bin/sh
# 一键回滚到 Gemini 功能改动前的厂商原版（备份目录与本次部署一致）
B=/tmp/storage/mmcblk0p2/ocspeed-backup/gemini-20261107
[ -f "$B/speedswitch.sh" ] || { echo "backup missing: $B"; exit 1; }
cp "$B/ocspeed.lua"     /usr/lib/lua/luci/controller/ocspeed.lua
cp "$B/ocspeed.htm"     /usr/lib/lua/luci/view/ocspeed.htm
cp "$B/speedswitch.sh"  /usr/libexec/openclash-helper/speedswitch.sh
chmod 755 /usr/libexec/openclash-helper/speedswitch.sh
if [ -f "$B/ocspeed" ]; then
  cp "$B/ocspeed" /etc/config/ocspeed
else
  uci -q delete ocspeed.main.gemini_backup_enable
  uci -q delete ocspeed.main.gemini_backup_timeout
  uci -q delete ocspeed.main.gemini_check_interval
  uci -q delete ocspeed.main.gemini_fail_count
  uci -q delete ocspeed.main.gemini_switch_cooldown
  uci commit ocspeed
fi
rm -f /etc/openclash-helper/gemini_state
echo rollback_done
