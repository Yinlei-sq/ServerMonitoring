# Server Monitor

一个用于 VS Code 的服务器资源监控扩展原型。它在普通本地窗口中监控本机资源；在 Remote SSH Linux 窗口中，优先监控当前远程主机资源。

当前版本重点是把扩展运行链路打通：活动栏视图、Dashboard Webview、Summary 树视图、本机概览采集、远程 Linux 概览采集、刷新命令和基础进程操作。

## 当前能力

- 左侧活动栏新增 `Server Monitor` 容器
- 提供 `Dashboard` Webview 面板
- 提供 `Summary` 树视图摘要
- 本机窗口显示本机概览数据
- Remote SSH Linux 窗口显示远程 Linux 概览数据
- 支持手动刷新概览
- 支持通过命令结束指定 PID
- 本机采集支持 host、CPU、内存和 best-effort 磁盘信息
- 远程 Linux 采集支持 host、CPU、内存、磁盘、GPU 和进程信息

## 当前限制

- 这仍是开发原型，不是已发布的 VSIX 成品
- 本机进程列表尚未接入 Dashboard
- 本机 GPU 采集尚未实现
- Windows 本机磁盘采集当前标记为 unsupported
- 尚未实现历史曲线、告警、多服务器列表、Docker/Kubernetes 监控
- Remote SSH 只支持 Linux
- 同一远程窗口内不做“远程/本机”双宿主切换；本地窗口监控本机，远程窗口监控远程

## 环境要求

- VS Code `^1.100.0`
- Node.js 20 或更高版本
- npm
- 如需远程监控，需要 VS Code Remote SSH
- 如需远程 GPU 数据，远程 Linux 主机需安装 `nvidia-smi`

## 安装依赖

```powershell
npm.cmd install
```

## 常用命令

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

说明：

- `npm.cmd test`：运行 `tests/**` 下的所有测试
- `npm.cmd run typecheck`：运行 TypeScript 类型检查
- `npm.cmd run build`：用 esbuild 打包扩展入口到 `dist/extension.cjs`

## 在 VS Code 中调试

不要直接运行 `dist/extension.cjs`。该文件依赖 VS Code 扩展宿主提供的 `vscode` 模块，普通 Node 进程无法加载它。

正确方式：

1. 用 VS Code 打开项目目录 `E:\project\服务器监控`
2. 切到 `运行和调试`
3. 选择 `Run Server Monitor Extension`
4. 按 `F5`
5. 新窗口会以 `Extension Development Host` 方式启动
6. 在新窗口左侧活动栏打开 `Server Monitor`

调试配置位于：

- `.vscode/launch.json`
- `.vscode/tasks.json`

## 本机验证流程

1. 启动 `Run Server Monitor Extension`
2. 在新打开的扩展开发宿主窗口中找到左侧 `Server Monitor`
3. 打开 `Dashboard`
4. 确认能看到本机目标、主机名、CPU、内存、平台和更新时间
5. 打开 `Summary`
6. 执行命令面板中的 `Server Monitor: Refresh Overview`
7. 确认 Dashboard 和 Summary 都会刷新

## Remote SSH 验证流程

1. 在扩展开发宿主窗口中连接一台 Linux Remote SSH 主机
2. 打开 `Server Monitor`
3. 确认 `Target` 显示为 `Remote`
4. 确认 host、CPU、内存、磁盘等数据来自远程主机
5. 如果远程主机有 NVIDIA GPU，确认 GPU 数据是否显示
6. 如果远程主机没有 `nvidia-smi`，GPU 模块应降级为 unsupported，而不是导致整个面板失败

## 命令

扩展当前贡献以下命令：

- `Server Monitor: Refresh Overview`
- `Server Monitor: Kill Process`

`Kill Process` 只接受正整数 PID。`0`、负数、非整数、`NaN`、`Infinity` 都会被拒绝，避免误杀进程组或系统进程。

## 项目结构

```text
src/
  actions/                    # 用户操作：结束进程、自定义命令执行
  collectors/
    local/                    # 本机采集
    remote/linux/             # Remote SSH Linux 采集
  config/                     # VS Code 设置读取
  core/                       # 目标解析、刷新调度、控制器
  shared/                     # 共享类型和错误模型
  views/                      # Summary Tree View
  webview/                    # Dashboard Webview Provider
media/                        # Webview 前端资源和活动栏图标
tests/                        # Node test runner 测试
```

## 设计说明

当前实现采用单扩展模型：

- 本地窗口：扩展在本机上下文中运行，采集本机数据
- Remote SSH Linux 窗口：扩展在远程扩展宿主中运行，采集远程 Linux 数据

因此远程窗口内不会直接读取本机 Node 资源。这个限制来自 VS Code 的本地/远程扩展宿主模型，也是当前版本明确接受的架构边界。

## 下一步

推荐后续优先补齐：

1. 本机进程列表
2. Dashboard 视觉 polish
3. 本机 GPU 采集
4. Remote SSH 手工验收清单
5. VSIX 打包与安装验证
