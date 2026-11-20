#!/bin/sh
# 把 OpenClash / 自动测速 注册进厂商应用商店（appcenter），并应用商店美化皮肤
# 原理：控制器在 ubus 目录后追加两条本地应用（local=1），视图对 local 应用
# 隐藏「卸载」并直接用 LuCI 路由打开；不改 /etc/config/appcenter，避免被云端目录覆盖。
set -e
D=/usr/lib/lua/luci
HERE="$(dirname "$0")"

# 1) 控制器 + 视图
cp "$HERE/appcenter.lua" $D/controller/nradio_adv/appcenter.lua
cp "$HERE/appcenter.htm" $D/view/nradio_appcenter/appcenter.htm

# 2) 美化皮肤（外层商店 + 插件库桥接壳）
mkdir -p /www/luci-static/nradio/css
cp "$HERE/manper-store.css" /www/luci-static/nradio/css/manper-store.css

# 3) 插件库桥接壳注入皮肤（商店自更新会覆盖 store.htm，本函数可重复执行）
STORE=$D/view/nradio_adv/store.htm
if [ -f "$STORE" ] && ! grep -q "manper-store.css" "$STORE"; then
  printf '\n<link rel="stylesheet" href="/luci-static/nradio/css/manper-store.css?v=4">\n' >> "$STORE"
fi

# 4) 图标：OpenClash 用自带 logo，测速图标随包放置
[ -f /www/luci-static/resources/openclash/img/logo.png ] && \
  cp /www/luci-static/resources/openclash/img/logo.png /www/luci-static/nradio/images/icon/openclash.png
[ -f "$HERE/ocspeed.png" ] && cp "$HERE/ocspeed.png" /www/luci-static/nradio/images/icon/ocspeed.png

# 5) LuCI 编译缓存必须清: 否则 CGI 继续用旧字节码
rm -rf /tmp/luci-modulecache/* /tmp/luci-indexcache*
echo "appcenter registered + skin applied"
