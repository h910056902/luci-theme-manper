#!/bin/sh
echo GEMINI_STATE
cat /etc/openclash-helper/gemini_state 2>/dev/null || echo none
echo STATUS_JSON_FIELDS
/usr/libexec/openclash-helper/speedswitch.sh status 2>/dev/null | tr ',' '\n' | grep -e cur_gemini_ok -e last_gemini -e gemini_fail_counter -e '"current"' -e last_failover -e failover_enable -e gemini_backup_enable
echo GEMINI_LOG
grep gemini /var/log/ocspeed.log 2>/dev/null | tail -12
echo FAILOVER_LOG
grep failover /var/log/ocspeed.log 2>/dev/null | tail -8
echo UCI
echo -n 'gemini_backup_enable='; uci -q get ocspeed.main.gemini_backup_enable
echo -n 'failover_enable='; uci -q get ocspeed.main.failover_enable
echo -n 'gemini_url='; uci -q get ocspeed.main.gemini_url
echo DIRECT_PROBE
GRP=$(uci -q get ocspeed.main.group)
PORT=$(uci -q get openclash.config.cn_port)
SECRET=$(uci -q get openclash.config.dashboard_password)
CUR=$(curl -s -m 8 -H "Authorization: Bearer $SECRET" "http://127.0.0.1:$PORT/proxies/$GRP" | grep -o '"now":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "cur=$CUR grp=$GRP port=$PORT"
printf 'gemini_delay='; curl -s -m 12 -H "Authorization: Bearer $SECRET" "http://127.0.0.1:$PORT/proxies/$CUR/delay?url=https%3A%2F%2Fgemini.google.com&timeout=6000" 2>/dev/null | head -c 200; echo
printf 'gstatic_delay='; curl -s -m 12 -H "Authorization: Bearer $SECRET" "http://127.0.0.1:$PORT/proxies/$CUR/delay?url=https%3A%2F%2Fwww.gstatic.com%2Fgenerate_204&timeout=5000" 2>/dev/null | head -c 200; echo
echo DONE
