#!/bin/sh
# 把 ocspeed（自动测速）打成 NRadio 老固件（OpenWrt 21.02 / opkg）可安装的 ipk。
#
# 注意：该固件 opkg 接受的是 **tar.gz 包装的 ipk**（内含 debian-binary /
# control.tar.gz / data.tar.gz），不是标准 ar 归档；打 ar 会报
# "Malformed package file"。
#
# 用法：在仓库根目录执行  sh files/ocpatch/build_ocspeed_ipk.sh
# 产物：./ocspeed_3.3_all.ipk
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=${1:-./ocspeed_3.3_all.ipk}
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/data/usr/lib/lua/luci/controller" \
         "$TMP/data/usr/lib/lua/luci/view" \
         "$TMP/data/usr/libexec/openclash-helper" \
         "$TMP/data/www/luci-static/nradio/images/icon" \
         "$TMP/data/etc/config" \
         "$TMP/control" "$TMP/ipkroot"

cp "$HERE/ocspeed.lua"  "$TMP/data/usr/lib/lua/luci/controller/ocspeed.lua"
cp "$HERE/ocspeed.htm"  "$TMP/data/usr/lib/lua/luci/view/ocspeed.htm"
cp "$HERE/speedswitch.sh" "$TMP/data/usr/libexec/openclash-helper/speedswitch.sh"
chmod 755 "$TMP/data/usr/libexec/openclash-helper/speedswitch.sh"
cp "$HERE/../www/luci-static/nradio/images/icon/ocspeed.png" \
   "$TMP/data/www/luci-static/nradio/images/icon/ocspeed.png" 2>/dev/null || true

# 默认停用：未装 OpenClash 时不会每分钟刷错误日志；装好后页面一键启用
cat > "$TMP/data/etc/config/ocspeed" <<'CFG'
config ocspeed 'main'
	option enabled '0'
	option interval '30'
	option threshold '50'
	option group '宝贝云'
	option test_url 'https://www.gstatic.com/generate_204'
	option gemini_url 'https://gemini.google.com'
	option exclude '剩余流量 套餐到期 重置剩余 无法使用 请更换 请升级 直连地址 TG群 邀请 返佣 公告'
	option timeout '4000'
	option failback_enable '0'
CFG

cat > "$TMP/control/control" <<'CTL'
Package: ocspeed
Version: 3.3
Architecture: all
Maintainer: manper
Section: luci
Depends: luci-base, curl
Description: OpenClash 自动测速与节点切换（全量测速、分类测速、备用节点预选、Gemini 自检）。
CTL
cat > "$TMP/control/postinst" <<'POST'
#!/bin/sh
chmod 755 /usr/libexec/openclash-helper/speedswitch.sh 2>/dev/null
if [ "$(uci -q get ocspeed.main.enabled)" = "1" ]; then
  /usr/libexec/openclash-helper/speedswitch.sh enable >/dev/null 2>&1
else
  /usr/libexec/openclash-helper/speedswitch.sh disable >/dev/null 2>&1
fi
rm -rf /tmp/luci-modulecache/* /tmp/luci-indexcache* 2>/dev/null
exit 0
POST
cat > "$TMP/control/prerm" <<'PRE'
#!/bin/sh
sed -i '/ocspeed-auto/d; /ocspeed-failover/d; /ocspeed-backup/d; /ocspeed-gemini/d; /speedswitch.sh/d' /etc/crontabs/root 2>/dev/null
/etc/init.d/cron restart >/dev/null 2>&1
rm -rf /tmp/luci-modulecache/* /tmp/luci-indexcache* 2>/dev/null
exit 0
PRE
chmod 755 "$TMP/control/postinst" "$TMP/control/prerm"

tar -czf "$TMP/control.tar.gz" -C "$TMP/control" ./control ./postinst ./prerm
tar -czf "$TMP/data.tar.gz"    -C "$TMP/data"    ./etc ./usr ./www
printf '2.0\n' > "$TMP/ipkroot/debian-binary"
cp "$TMP/control.tar.gz" "$TMP/data.tar.gz" "$TMP/ipkroot/"
tar -czf "$OUT" -C "$TMP/ipkroot" ./debian-binary ./control.tar.gz ./data.tar.gz
echo "built: $OUT"
