#!/bin/sh
echo UCI
for k in enabled failover_enable backup_enable backup_interval backup_probe backup_keep gemini_backup_enable gemini_backup_timeout gemini_check_interval gemini_fail_count gemini_switch_cooldown failover_cooldown failover_quiet; do
  printf '  %s=' "$k"; uci -q get ocspeed.main.$k
done
echo CRONTAB
grep -e ocspeed -e speedswitch /etc/crontabs/root
echo BACKUP_JSON
cat /etc/openclash-helper/backup.json 2>/dev/null
echo
echo GEMINI_STATE
cat /etc/openclash-helper/gemini_state 2>/dev/null || echo none
echo STATUS_JSON_VALID
/usr/libexec/openclash-helper/speedswitch.sh status > /tmp/kp_status.json 2>/dev/null
wc -c < /tmp/kp_status.json
lua -e 'local f=io.open("/tmp/kp_status.json","r"); local s=f:read("*a"); f:close(); local j=require "luci.jsonc"; local d=j.parse(s); print(d and "  JSON_OK" or "  JSON_INVALID")'
echo STATUS_FIELDS
tr ',' '\n' < /tmp/kp_status.json | grep -e oc_api_ok -e cur_gemini_ok -e gemini_backup_enable -e '"current"' -e gemini_ok -e last_gemini
echo RECENT_LOG
tail -8 /var/log/ocspeed.log
echo DONE
