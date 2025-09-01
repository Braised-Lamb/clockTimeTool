# 系统说明（系统时间显示与同步工具）

一个基于 Electron + Vue3 的桌面小工具，用于：

1. 大号数字显示当前系统时间（精准到秒，自动校准秒边界与漂移）
2. 一键与指定 NTP 时间服务器同步（调用 Windows w32tm，需要管理员权限）
3. 支持自定义 / 选择历史时间服务器，自动记忆最近使用顺序（最多 10 条）
4. 记忆当前选定的时间服务器与字体大小设置
5. 支持“始终置顶”开关（📍/📌），窗口可保持最前
6. 主进程提供权威时间戳，前端定时器根据毫秒偏移动态调整，降低累计误差

[English README](./README.en.md)

---

## 功能概览

| 功能       | 说明                                                        |
| ---------- | ----------------------------------------------------------- |
| 时间显示   | 24 小时制 HH:MM:SS，跨秒精准刷新                            |
| 同步时间   | 🔄 按钮：与当前配置的服务器执行 w32tm /resync /force        |
| 服务器管理 | ⚙️ 弹窗：新增、选择、删除历史服务器；自动置顶最近使用       |
| 历史保存   | 保存到用户目录 server-history.json + localStorage 当前选择  |
| 字体调节   | A- / A+ 按钮（2 ~ 30 vw）持久化到 localStorage              |
| 始终置顶   | 📍=关闭，📌=开启；状态持久化并与主进程同步                  |
| 权威时间   | 通过 ipcMain.handle('get-current-time') 统一获取 Date.now() |
| 漂移处理   | 检测毫秒偏移与跳变，必要时强制快速刷新                      |

## 运行环境要求

- Windows（时间同步依赖 w32tm）
- Node.js >= 20.19.0
- 需要管理员权限执行时间同步（UAC）

## 安装与启动

```powershell
npm install
npm run start:dev   # 前端+Electron 调试
npm run dist        # 打包分发
```

更多脚本参见下方“开发脚本速览”。

## 时间同步机制

1. 生成临时 PowerShell 脚本：
   - Start-Service w32time
   - w32tm /config /manualpeerlist:"\<server\>" /syncfromflags:manual /update
   - w32tm /resync /force
2. 管理员权限执行并等待完成
3. 成功后前端立即刷新显示

用户取消 UAC -> 返回 Operation cancelled by user。

## 刷新策略

- 通过 IPC 每次获取权威时间戳
- 下一次刷新延迟 = 1000 - (now % 1000)
- 检测跳变或页面重新可见时强制刷新

## 始终置顶

- 按钮切换 📍/📌
- localStorage + 主进程 `get-always-on-top` / `set-always-on-top`

## 目录与关键文件

| 文件                    | 作用         |
| ----------------------- | ------------ |
| main.cjs                | 主进程 / IPC |
| preload.js              | 安全桥层     |
| src/App.vue             | UI 与逻辑    |
| src/types/electron.d.ts | 类型声明     |
| public/clock.png        | 图标         |

## 常见问题

1. 同步无效：确认以管理员权限运行。
2. 置顶失效：全屏程序可能覆盖，退出全屏即可。
3. 可否添加自定义 NTP：支持，直接新增即可。

## 待修复 / 已知问题

- 个别情况下系统时间手动大幅修改后首次刷新存在未知时间延迟。

## 后续可拓展

- 多服务器轮询
- 偏差统计
- 托盘菜单
- 透明/全屏模式

## 开发脚本速览

| 命令                    | 说明                     |
| ----------------------- | ------------------------ |
| npm run dev             | 仅 Vite 前端开发服务器   |
| npm run start:dev       | 前端 + Electron 热调试   |
| npm run build           | 构建前端静态资源         |
| npm run start           | 运行已构建 Electron 应用 |
| npm run build-and-start | 构建并启动               |
| npm run dist            | 打包发布                 |

---
