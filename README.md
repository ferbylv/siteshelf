# SiteShelf 页架

把正在看的网页保藏到本机，并用 AI 生成一句中文摘要、主分类和标签。v1 只做网页保藏与分类，不含密码管理、自动填充或任何凭证采集。


## v1 范围
- 工具栏弹窗：预览当前页并「保藏」
- 侧边栏页架：搜索、按分类筛选、编辑、删除、在新标签打开
- 仅采集公开元数据：URL、标题、描述、favicon / og 图、可见正文短摘录
- 明确不采集：密码框、隐藏输入、凭证类文本
- 本地 IndexedDB 存储，无账号
- 数据域独立：书签仓库与未来可能的保险库分开，互不混写

## 环境

请先安装依赖，再运行构建。scripts 见 package.json：dev、build、zip、compile。构建产物在 .output/chrome-mv3。



## 在浏览器中加载

1. 先完成本地构建
2. 打开 chrome://extensions 并启用开发者模式
3. 选择加载已解压的扩展程序
4. 指向产物目录 .output/chrome-mv3

完整路径示例：/path/to/siteshelf/.output/chrome-mv3

加载成功后，工具栏会出现「页架」。打开任意普通网页，点击图标即可保藏。侧边栏页架可从弹窗中的「打开页架」进入。

## AI 如何工作

分类只发送公开元数据（网址、标题、描述、短摘录），不会发送页面上的表单值或密码。

### 1. Chrome Prompt API（优先）

Chrome 138+ 在满足设备要求时可使用内置 LanguageModel（Gemini Nano）：

- 桌面 Chrome（Windows / macOS / Linux / 符合条件的 ChromeOS）
- 需要足够磁盘与内存；模型会在首次使用时下载
- 当前官方语言覆盖以 en / ja / es / de / fr 为主，中文摘要可能不稳定。若效果不好，改用兼容接口

默认设置为「自动」：先试 Prompt API，不可用再走兼容接口。

### 2. OpenAI 兼容接口（后备）

在弹窗底部「AI 设置」，或右键扩展图标打开选项页：

- 分类引擎：自动 / 仅 Prompt API / 仅兼容接口
- 接口地址：例如 https://api.openai.com/v1（会请求该地址下的 chat/completions）
- 模型名：例如 gpt-4o-mini
- 密钥：只保存在本机 chrome.storage.local

密钥只会发往你填写的地址。扩展没有云端账号。

若两种引擎都失败，仍然会保藏该页，分类记为「未分类」，之后可手改。

同一规范化网址再次保藏会就地更新，不会产生重复条目。

## 权限说明

- storage：保存 AI 设置
- activeTab 与 scripting：仅在你点击扩展时读取当前页公开元数据
- tabs：读取当前标签标题与地址，并从页架打开链接
- sidePanel：侧边栏图书馆（由 WXT 根据 sidepanel 入口自动加入）

没有 all_urls 主机权限。系统页、扩展商店等无法注入脚本，弹窗会提示。

## 把项目放到 Git 仓库

本目录是从零搭建的源码，不含远程。自行 init 后添加 remote 再推送到你自己的仓库即可。忽略规则已包含依赖目录、构建产物、.wxt 和 .env。不要提交密钥。

建议提交说明：feat: SiteShelf v1 网页保藏与 AI 分类

## 技术栈

WXT + React + TypeScript，Manifest V3。

## 许可证

MIT
