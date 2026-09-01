# Chrome Web Store 上架文案 · SiteShelf 页架

供开发者控制台粘贴。产品事实须与 v2.1.1 源码及已构建 manifest 一致。

## 产品名称

SiteShelf 页架

（≤45 字符，当前远短于上限。）

## 简短介绍（保持 manifest，勿改）

```
保藏网页并生成本地分类；另含本机加密保险库与精确主机自动填充。
```

（≤132 字符，已写入 `wxt.config.ts` / 构建后的 `manifest.json`。）

## 分类

Productivity（生产力工具）

## 语言

中文（简体） / zh-CN

## 详细说明（中文，粘贴到商店「详细说明」）

SiteShelf 页架是本机页架：把正在看的网页保藏到浏览器本地，并可选加密保存该站登录。

本扩展的单一用途是「本机页架：保藏网页并可选加密保存该站登录」。数据默认留在你的设备上，没有 SiteShelf 云账号。

**保藏网页**
- 点击工具栏即可把当前页写入本机书签库（IndexedDB `siteshelf` / `bookmarks`），并生成一句中文摘要、主分类和标签。
- 侧边栏「页架」可搜索、打开、编辑；支持自定义分类（1–12 字）以及书签 JSON 导入导出。导出不含任何密码。

**本机 AI 分类（可选）**
- 优先使用 Chrome 设备端 Prompt API（可用时推理留在本机）。
- 也可自行填写 OpenAI 兼容 HTTPS 接口；密钥只保存在 `chrome.storage.local`，只发往你键入的地址。
- 分类**只使用公开元数据**（网址、标题、描述、短摘录）。**密码、用户名和表单内容永远不会发送给任何模型**（Prompt API / OpenAI 皆然）。保险库与分类引擎没有数据通路。

**加密保险库**
- 独立数据库 `siteshelf-vault`，与书签库完全分开。
- 主密码经 PBKDF2-SHA-256（600,000 次）派生包装密钥，再用 AES-256-GCM 包裹随机数据密钥。主密码不落盘，也无法找回。
- 登录提交后，草稿暂存在会话存储；页面右上角出现「保存到页架？」提示卡，**必须点确认才会写入**，不会静默保存。
- 自动填充仅当 **协议 + 主机名 + 端口（origin；默认 80/443 与省略等同）完全一致** 时发生，不用 eTLD+1 或模糊匹配。`github.com` 不会填充 `gist.github.com`。
- 支持加密备份、Bitwarden 未加密 JSON / CSV 导入导出（未加密导出前会警告）。

开源（MIT）：https://github.com/ferbylv/siteshelf

## Detailed description (English fallback)

SiteShelf 页架 is a local page shelf: it saves the current page on your device and can optionally encrypt that site’s login.

Single purpose: a local page shelf to bookmark the current page and optionally encrypt/fill its login. There is no SiteShelf cloud account.

**Bookmarks** — Save the tab to IndexedDB `siteshelf`/`bookmarks` with a short Chinese summary, category, and tags. The side panel searches, opens, and edits items. Custom categories and JSON import/export are included. Bookmark export never contains passwords.

**Optional local AI classify** — Uses on-device Chrome Prompt API when available. You may instead configure an OpenAI-compatible HTTPS endpoint; the API key stays in `chrome.storage.local` and is sent only to the URL you typed. Classify receives only public metadata (url, title, description, excerpt). **Passwords, usernames, and form values are never sent to any model.**

**Encrypted vault** — Separate IndexedDB `siteshelf-vault`. PBKDF2-SHA-256 (600k) wraps an AES-256-GCM data key. The master password is never stored and cannot be recovered. Save-on-login stages a pending draft in session storage and shows 「保存到页架？」; nothing is written until you confirm. Autofill matches exact hostname + scheme + port (origin; default 80/443 ≡ omitted; no eTLD+1). Open-source MIT: https://github.com/ferbylv/siteshelf

## 商店后台链接

| 字段 | 值 |
| --- | --- |
| Homepage | https://github.com/ferbylv/siteshelf |
| Support | https://github.com/ferbylv/siteshelf/issues |
| Privacy policy URL（推送 `PRIVACY.md` 之后） | https://github.com/ferbylv/siteshelf/blob/main/PRIVACY.md |

## 内容分级

Not mature（非成人内容 / Everyone）

本扩展不是面向儿童的产品，也不包含色情、暴力或赌博内容。

## Privacy practices checklist（请按此勾选，须诚实）

| 控制台问题 | 答案 | 说明 |
| --- | --- | --- |
| Personally identifiable information | **Yes**（仅本地） | 书签中的标题/网址；保险库中加密存放的用户名等。开发者不收集到服务器。 |
| Health | **No** | 产品不处理健康数据。 |
| Financial and payment | **No**（产品功能不采集金融数据） | 我们不提供支付、也不收集银行卡或交易。用户**可以自行**把任意站点（含银行）的登录保存到本机加密保险库——那是用户自己保存的登录，不是本扩展的金融数据采集功能。控制台可同时勾选 **Authentication information** / **Website content**（见下），不要把「金融」标成产品收集项。 |
| Authentication information | **Yes** | 登录用户名/密码经 AES-256-GCM 加密后仅存本机；主密码不保存。我们不传输这些凭据。 |
| Personal communications | **No** | |
| Location | **No** | |
| Web history | **Yes**（有限） | 仅用户主动保藏的网址，以及用户确认保存的登录所对应的 scheme+host+port（origin）。不是全量历史记录器，不记录未保藏的浏览。 |
| User activity | **No** | 无分析、无使用统计、无遥测。 |
| Website content | **Yes** | 保藏时读取当前页公开元数据用于分类；登录表单字段仅在用户提交后用于保存提示，且须确认才写入保险库。 |
| Remote code | **No** | 无远程代码；无 eval 加载的远程脚本。可选的 OpenAI 兼容调用只把元数据 POST 到用户填写的 HTTPS 地址。 |
| Certify Limited Use | **Yes** | 数据仅用于上述单一用途。 |

## 权限说明（中英，可直接粘贴到权限 justification）

### storage

**中文：** 用于在本机持久化书签相关设置、AI 配置（含你填写的 API 密钥）、自定义分类、保险库加密元数据与 scheme+host+port 源站索引、以及会话内的解锁状态和待确认保存草稿。登录密码不写入 `chrome.storage.local`（密码只以密文进入独立 IndexedDB，待保存草稿只在 `chrome.storage.session`）。

**English:** Persist bookmark settings, AI config (including a user-supplied API key), custom categories, vault crypto metadata and a scheme+host+port origin index, plus session unlock state and pending save drafts. Passwords are never stored in `chrome.storage.local`.

### activeTab + scripting

**中文：** 仅在你点击工具栏图标时，读取当前标签页的公开元数据（网址、标题、描述、摘录）以便保藏到页架。不在后台扫描其他标签。

**English:** On user click, read the active tab’s public metadata to bookmark it. Not used to scan other tabs in the background.

### tabs

**中文：** 读取当前标签的标题与网址；从页架打开已保藏的链接。

**English:** Read the current tab title/URL and open bookmarked pages from the shelf.

### sidePanel

**中文：** 提供「页架 / 保险库」侧边栏。

**English:** Host the 页架 / 保险库 sidebar.

### host_permissions `https://*/*` and `http://*/*`

**中文：** 在普通 http(s) 网页注入内容脚本，用于检测登录表单、显示紧凑的「保存到页架？」卡片，以及仅在主机名、协议与端口（origin）完全一致时自动填充。不用于分析、广告或抓取全站。无法注入 `chrome://` 与 Chrome 网上应用店。作为可在任意网站工作的本机密码保险库，需要匹配所有普通网页，而不是预设域名列表。

**English:** Inject the content script on ordinary http(s) pages to detect login forms, show a compact save card, and exact-origin autofill (hostname + scheme + port). Not used for analytics, ads, or scraping. Cannot inject on `chrome://` or the Chrome Web Store. Broad hosts are required because this is a password manager that must work on any site the user visits, not a fixed allow-list.

## Review notes for Google (English)

SiteShelf 页架 is a **local-first, open-source** (MIT) Chrome MV3 extension. Source: https://github.com/ferbylv/siteshelf (developer: ferbylv). Version 2.1.1.

**Single purpose:** a local page shelf — bookmark/classify the current page, and optionally encrypt/fill logins for that site.

The vault (IndexedDB `siteshelf-vault`) is fully separate from bookmarks (`siteshelf`/`bookmarks`). Credentials use PBKDF2-SHA-256 (600k) and AES-256-GCM. The master password is never stored. **Passwords, usernames, and form values are never sent to Prompt API, OpenAI, or any model** — classify is public metadata only. Confirm-to-save only (pending draft in `chrome.storage.session`). Autofill is exact hostname + scheme + port (origin; default 80/443 ≡ omitted); no eTLD+1.

**Why `<all_urls>`-style host permissions:** the content script (`vault.js`) must run on whatever http(s) page the user is logging into, like any password manager. We do not scrape, advertise, or analytics. `chrome://` and the Web Store cannot be injected.

No remote code, no `nativeMessaging`, no `debugger`, no ads, no telemetry. Privacy policy: `PRIVACY.md` in the same repo.

Please load unpacked from the zip root (`manifest.json` is at the archive root, not nested).
