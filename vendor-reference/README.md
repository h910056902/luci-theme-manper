# vendor-reference — nradio 固件侧参考控制器

本目录保存 nradio 固件中的**通用命名**控制器与库文件（`admin/*.lua`、`auth.lua`、
`tasks-lib.lua`、`ocspeed.lua`、`store.lua`、`autotimeset.lua`）。

## 为什么默认不安装？

这些文件使用通用命名（如 `admin/status.lua`），在 iStoreOS / GL 原厂等固件上
**与宿主机自带文件同名**，默认安装会覆盖宿主机文件。因此只在需要时通过脚本
菜单的 `2) 安装 nradio 固件侧参考控制器 [高级]` 手动安装：

- 安装前会自动把被覆盖的原文件备份到 `/overlay/nradio-apps/.manper-backup.*`
- 卸载（菜单 3）时会自动恢复

## 手动安装（不用脚本菜单时）

```sh
# 备份
ts=$(date +%Y%m%d-%H%M%S)
cp -a /usr/lib/lua/luci/controller /usr/lib/lua/luci/controller.bak-$ts
# 拷贝
cp -a vendor-reference/usr/lib/lua/luci/controller/. /usr/lib/lua/luci/controller/
# 清缓存并重启
rm -f /tmp/luci-indexcache-bootstrap*
/etc/init.d/uhttpd restart
```

> 注意：`openclash.lua` 未包含在本目录。如需 OpenClash 页面，请直接在目标路由器
> 上安装 `luci-app-openclash`。
