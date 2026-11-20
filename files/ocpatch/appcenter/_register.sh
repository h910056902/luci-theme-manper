#!/bin/sh
# 把 OpenClash / 自动测速 注册进厂商应用商店（appcenter）
# 原理：控制器在 ubus 目录后追加两条本地应用（local=1），视图对 local 应用
# 隐藏「卸载」并直接用 LuCI 路由打开；不改 /etc/config/appcenter，避免被云端目录覆盖。
set -e
D=/usr/lib/lua/luci
cp "$(dirname "$0")/appcenter.lua" $D/controller/nradio_adv/appcenter.lua
cp "$(dirname "$0")/appcenter.htm" $D/view/nradio_appcenter/appcenter.htm
# 图标：OpenClash 用自带 logo，测速图标需随包放置
[ -f /www/luci-static/resources/openclash/img/logo.png ] && \
  cp /www/luci-static/resources/openclash/img/logo.png /www/luci-static/nradio/images/icon/openclash.png
[ -f "$(dirname "$0")/ocspeed.png" ] && cp "$(dirname "$0")/ocspeed.png" /www/luci-static/nradio/images/icon/ocspeed.png
# LuCI 编译缓存必须清: 否则 CGI 继续用旧字节码
rm -rf /tmp/luci-modulecache/* /tmp/luci-indexcache*
echo "appcenter registered: OpenClash + ocspeed"
