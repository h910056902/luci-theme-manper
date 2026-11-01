#!/bin/sh
cp /overlay/nradio-apps/openwrt-luci-8080/theme-backup42-20261021-121000/nradio_cellular.htm.bak /overlay/nradio-apps/openwrt-luci-8080/usr/lib/lua/luci/view/admin_status/nradio_cellular.htm
rm -f /tmp/luci-indexcache-bootstrap*
echo restored
