#!/bin/sh
echo PORT_9090
netstat -tlnp 2>/dev/null | grep 9090 || echo "  not listening"
echo OC_PROCESS
ps 2>/dev/null | grep -i -e openclash -e clash -e mihomo | grep -v grep | head -8
echo OC_VERSION
curl -s -m 6 -o /tmp/ocver.txt -w 'code=%{http_code} bytes=%{size_download}' http://127.0.0.1:9090/version; echo
head -c 200 /tmp/ocver.txt 2>/dev/null; echo
echo UCI_OC
uci -q get openclash.config.cn_port
uci -q get openclash.config.dashboard_password
uci -q get openclash.config.enable
echo SERVICE
/etc/init.d/openclash status 2>&1 | head -5
echo CURRENT_STATUS
/usr/libexec/openclash-helper/speedswitch.sh status 2>/dev/null | tr ',' '\n' | grep -e '"current"' -e oc_api_ok -e cur_gemini_ok
echo FAILOVER_LOG_HEAD
grep failover /var/log/ocspeed.log 2>/dev/null | tail -30 | head -18
echo RECENT_MESSAGES
tail -8 /var/log/messages 2>/dev/null
echo DONE
