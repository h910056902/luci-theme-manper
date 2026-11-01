# luci-theme-manper — nradio 8080 定制 LuCI 一键部署脚本

[![GitHub](https://img.shields.io/github/license/h910056902/luci-theme-manper.svg?label=LICENSE&logo=github&logoColor=%20)](https://github.com/h910056902/luci-theme-manper/blob/main/LICENSE)
![GitHub Stars](https://img.shields.io/github/stars/h910056902/luci-theme-manper.svg?style=flat&logo=appveyor&label=Stars&logo=github)
![GitHub Forks](https://img.shields.io/github/forks/h910056902/luci-theme-manper.svg?style=flat&logo=appveyor&label=Forks&logo=github)
![GitHub Last Commit](https://img.shields.io/github/last-commit/h910056902/luci-theme-manper.svg?style=flat&logo=github&label=Last%20Commit)

## 🤔 这是什么？

本项目源自一台 nradio 固件路由器上深度定制的 **8080 端口独立 LuCI 实例**（项目代号 `manper`），
现已将其完整抽取为可分发的离线包，让**其他路由器不用刷机**，SSH 执行一条命令即可获得同款 UI：

- 🌌 **星空动画登录页**（基于 bootstrap 主题深度定制）
- 📊 **全新首页** `/admin/status/details`：网络状态、CPU/内存、在线设备一屏展示
- 📶 **蜂窝网络面板**：SIM 卡管理、短信、信号详情（依赖宿主机带模组）
- 🐳 **Docker 顶层菜单**、终端 ttyd、文件管理等常用入口
- 🧩 独立于 80 端口原 LuCI 运行，**互不影响**，随时可卸载还原

## 📸 预览

![preview](res/preview.png)

## 🚀 快速上手

### 1. SSH 连接到路由器，执行如下命令

```bash
sh -c "$(wget -O - https://raw.githubusercontent.com/h910056902/luci-theme-manper/main/manper.sh)"
```

或者下载后执行：

```bash
wget -O manper.sh https://raw.githubusercontent.com/h910056902/luci-theme-manper/main/manper.sh
sh manper.sh            # 交互菜单（安装 / 卸载 / 状态）
sh manper.sh install    # 直接安装
sh manper.sh uninstall  # 卸载并恢复
```

### 2. 浏览器访问

安装完成后访问：`http://<路由器IP>:8080`

> 登录账号密码即路由器的 root 管理密码。

### 常用安装选项

```bash
# 8080 端口被占用时（例如 GL 原厂固件自带 8080 LuCI），换端口安装：
MANPER_PORT=8081 sh manper.sh install

# 只监听 LAN 口 IP：
MANPER_LISTEN=192.168.1.1 sh manper.sh install

# 国内下载加速（可用任意 ghproxy 镜像前缀）：
export MANPER_DL_URL=https://ghproxy.com/https://github.com/h910056902/luci-theme-manper/archive/refs/heads/main.tar.gz
```

## 💡 支持的固件

| 固件 | 支持情况 | 说明 |
| --- | --- | --- |
| nradio 固件 | ✅ 完整支持 | 本项目宿主固件，云服务/APP 全功能 |
| iStoreOS | ✅ 可用 | UI 框架、登录页、首页可用；云相关页面依赖固件服务 |
| GL.iNet 原厂 | ✅ 可用 | 注意其自带 8080 LuCI，请用 `MANPER_PORT=8081` |
| 主线 OpenWrt | ⚠️ 需 Lua 运行时 | 需安装 `luci-base luci-lua-runtime`（Lua 版 LuCI） |
| 纯 JS 渲染固件（无 Lua LuCI） | ❌ 不支持 | 项目基于 Lua 版 LuCI dispatcher |

本项目属于 **UI/主题级部署**：不动系统分区、不刷机、不改防火墙，卸载即完全还原。

## 🗑️ 卸载

```bash
sh manper.sh           # 菜单选 3
sh manper.sh uninstall # 或直接执行
```

卸载脚本会：恢复所有被覆盖的固件侧 Lua 文件（安装时自动备份）→ 移除 8080 实例目录 → 移除 uhttpd 实例 → 清理调度缓存。

## ❓ 常见问题

**Q: 提示端口 8080 被占用？**
GL 原厂固件的 LuCI 本身就在 8080。使用 `MANPER_PORT=8081 sh manper.sh install` 换端口即可。

**Q: 安装后页面打不开？**
执行 `sh manper.sh status` 查看监听状态；或重启 uhttpd：`/etc/init.d/uhttpd restart`。

**Q: 登录后部分菜单空白/报错？**
这些页面依赖 nradio 固件的服务（蜂窝、云服务等）。其他固件上属正常现象，
可在菜单选 `2) 安装 nradio 固件侧参考控制器` 补齐页面骨架（覆盖前自动备份，可卸载还原）。

**Q: 国内下载脚本/离线包太慢？**
设置 `MANPER_DL_URL` 环境变量指向任意镜像（见快速上手），或将仓库 clone 到本地后把 `manper.sh` 放在仓库根目录运行（自动使用本地文件，不再联网下载）。

## 🧩 目录结构

```
luci-theme-manper/
├── manper.sh                  # 一键部署脚本（安装/更新/卸载/状态）
├── files/                     # 部署到目标路由器的文件（按目标路径镜像存放）
│   ├── overlay/nradio-apps/openwrt-luci-8080/
│   │   ├── www/               # 8080 实例站点：cgi-bin 调度器、luci-static/argon(定制层)、router3d、fontawesome
│   │   │   └── luci-static/symlinks.list   # 符号链接清单，部署时自动重建
│   │   └── usr/lib/lua/luci/view/          # 实例私有视图（登录页/首页/蜂窝/Docker/themes/argon 模板）
│   ├── usr/lib/lua/           # 固件侧依赖（nradio.lua、cloudd、nradio 控制器、argon-config 0.9）
│   ├── usr/share/rpcd/acl.d/  # argon-config rpcd ACL
│   └── etc/config.argon.default  # /etc/config/argon 默认配置（仅缺失时写入）
├── vendor-reference/          # nradio 固件侧参考控制器（admin/ 等，高级选项手动安装）
├── res/                       # README 预览图
└── README.md
```

> `files/overlay/nradio-apps/openwrt-luci-8080/` 内的 `theme-backup40~42-*`、
> `www/cgi-bin/luci.bak-*` 等为项目演进过程中的**历史备份档案**，一并保留于仓库；
> 部署时脚本会自动去掉备份脚本的执行位，避免被当作 CGI 调用。

## 🛠️ 技术说明

- **Argon 底层迁移（2026-11）**：主题底层已迁移至 [luci-theme-argon v2.4.3](https://github.com/jerrykuku/luci-theme-argon)（Lua 模板的最新版本，argon 3.x 为 ucode 模板、与 Lua LuCI 不兼容），并集成 **luci-app-argon-config 0.9**（CBI 版，适配老式 Lua LuCI）——8080 界面「系统 → Argon 主题设置」可配置主色调/透明度/毛玻璃/暗色模式。样式保持 manper 定制外观不变：`cascade.css`/`dark.css`/`mwrt-*` 定制层原样保留，2.4.3 的 cascade 备存于 `css/cascade-2.4.3.css` 供后续渐进切换
- 8080 实例 = 独立 uhttpd 节点（`/etc/config/uhttpd` 中的 `openwrt8080` 段）+ 独立 docroot + 定制版 Lua CGI dispatcher（构建自己的菜单树，复用宿主机 Lua LuCI 运行时与控制器）
- 私有视图层覆盖了登录页、首页、蜂窝、Docker、终端等页面；静态资源自带 argon(定制层)/router3d/fontawesome，其余通过 `symlinks.list` 链接宿主机资源
- 源路由器为 OpenWrt 25.12-SNAPSHOT（mediatek/filogic, aarch64），但本项目是纯 Lua/静态资源，与 CPU 架构无关

## 🔙 回滚

部署脚本安装时自动把旧实例备份为 `/overlay/nradio-apps/openwrt-luci-8080.bak-<时间戳>`。
若需手动回退到迁移前（老 bootstrap 底层）：

```sh
cp -a /overlay/nradio-apps/openwrt-luci-8080.bak-<时间戳>/. /overlay/nradio-apps/openwrt-luci-8080/
rm -f /tmp/luci-indexcache-argon* /tmp/luci-indexcache-bootstrap*
/etc/init.d/uhttpd restart
```

## 🗂️ 引用与致谢

本项目的开发参照/受益于以下项目，感谢这些开源项目的作者：

- [wukongdaily/gl-inet-onescript](https://github.com/wukongdaily/gl-inet-onescript) — 本仓库的脚本组织与 README 风格参照
- [jerrykuku/luci-theme-argon](https://github.com/jerrykuku/luci-theme-argon) — LuCI 主题开发的经典参考
- [istoreos/istoreos](https://github.com/istoreos/istoreos) — iStoreOS / quickstart 生态
- OpenWrt / LuCI 团队

## ⚠️ 免责声明

本项目按"现状"提供。刷写/部署前请自行评估风险，因使用本脚本造成的任何问题由使用者自行承担。部署前请确认已了解如何通过 SSH 恢复访问。

## ⭐ Star 趋势

如果本项目对你有帮助，欢迎点个 Star！
