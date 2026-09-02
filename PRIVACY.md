# SiteShelf 页架 隐私政策

**开发者：** ferbylv（GitHub）  
**联系方式：** [GitHub Issues · ferbylv/siteshelf](https://github.com/ferbylv/siteshelf/issues)  
**生效日期：** 2026-08-31

SiteShelf 页架（下称「本扩展」）是一款本机优先的 Chrome Manifest V3 扩展。单一用途是：**本机页架——保藏当前网页，并可选加密保存、填充该站登录。** 本扩展没有云端账号，开发者也不运营 SiteShelf 服务器。

## 1. 本地存储的数据及原因

所有数据默认只写在你的浏览器配置中。书签库与保险库使用**相互独立**的 IndexedDB，书签代码不会读取保险库明文。

### 书签（IndexedDB `siteshelf` / `bookmarks`）

保藏当前页时写入：网址、标题、描述、摘录、摘要、分类、标签、图标地址与时间戳。用于在侧边栏「页架」中搜索、打开和编辑。不含密码。

### 加密保险库（IndexedDB `siteshelf-vault`）

- `meta`：随机盐、PBKDF2 迭代次数（SHA-256，600,000 次）、用包装密钥包裹的 AES-256-GCM 数据密钥（DEK）。**不保存主密码，也不保存裸密钥。**
- `records`：登录记录的密文（IV + ciphertext）。明文用户名/密码只在解锁后的内存中出现。

主密码无法找回。忘记后无法解密已有登录，只能丢弃保险库数据。

### chrome.storage.local

- AI 设置（分类引擎、兼容接口地址、模型名）以及你填写的 **API 密钥**（仅当你启用 OpenAI 兼容分类时）。
- 自定义分类名（`siteshelf.categories`）。
- 保险库闲置锁定等非密钥配置（`siteshelf.vault.settings`）。
- **源站索引**（`siteshelf.vault.savedHosts`）：仅 origin（`scheme + host + port`，例如 `https://example.com` 或 `http://192.168.1.1:8080`；默认 80/443 与省略端口等同），用于在锁定时判断该站是否已有登录、避免重复提示。**不含用户名或密码。**

`chrome.storage.local` **从不存放登录密码。**

### chrome.storage.session（仅当前浏览器会话）

- 解锁后的数据密钥（用于保持解锁；服务工作线程被回收后若会话仍在则可恢复，否则需重新输入主密码）。
- 待确认的登录草稿（Save-on-login）：内容脚本在提交登录表单或点击登录类按钮后把用户名/密码暂存于此，**必须你在「保存到页架？」中点确认才会写入加密保险库**。关闭标签或点「不保存」即丢弃。不会静默保存。

## 2. 永远不会发送的内容

本扩展**不会**把下列内容发送到任何网络端点、AI / Prompt API / OpenAI、日志或分析服务：

- 登录密码、用户名、表单字段值
- 主密码或派生出的密钥
- 保险库明文记录

分类引擎与保险库没有数据通路。

## 3. 可选的网络传输

默认不需要网络。仅在你主动启用时：

1. **OpenAI 兼容分类（可选）**  
   若你在设置中填写 HTTPS 接口地址与 API 密钥：本扩展只把**公开页面元数据**（网址、标题、描述、短摘录）以及该密钥，发送到**你键入的那个 URL**（例如其下的 `chat/completions`）。密钥只存在 `chrome.storage.local`，不会发往开发者或其他第三方（除非你填写的地址本身属于该方）。

2. **Chrome Prompt API（设备端，可选）**  
   在支持的 Chrome 上可使用内置 LanguageModel。推理留在本机，不会把密码或表单值送入模型。输入仍是上述公开元数据。

若两种引擎都不可用，仍会保藏该页，分类记为「未分类」，之后可手改。

## 4. 我们不收集、不出售

- 没有 SiteShelf 云、没有开发者后端、没有账号系统。
- 没有分析、广告、跟踪像素、远程代码、`nativeMessaging` 或 `debugger`。
- 不出售数据。开发者无法从远程读取你的书签或保险库。

## 5. Chrome 网上应用店 Limited Use（有限用途）披露

本扩展对用户数据的使用，仅限于实现**已披露的单一用途**：本机页架——保藏/分类当前页，以及可选地加密保存并在精确匹配的站点填充登录。

- **不**将用户数据用于广告，包括再营销、个性化或基于兴趣的广告。
- **不**将用户数据出售给第三方。
- **不**用于确定信用或放贷。
- 除下列情形外**不转移**用户数据：(a) 你自行配置的分类接口；(b) 法律要求；(c) 为保护用户、本扩展或他人安全所必需；(d) 若发生合并/收购且继承方受本政策同等约束。
- **没有人工阅读**你的用户数据（开发者没有云端副本可读）。
- 我们遵守 Chrome Web Store 用户数据政策，包括 Limited Use。

## 6. 主机权限与内容脚本

权限 `https://*/*` 与 `http://*/*` 用于在**普通网页**注入内容脚本 `vault.js`，以便：

- 检测用户名 + 密码登录表单；
- 在提交或点击登录按钮后显示右上角约 360px 的「保存到页架？」提示卡（须确认）；
- 仅当 **scheme + hostname + port（origin；默认 80/443 与省略等同）完全一致** 时填充（无 eTLD+1、无模糊匹配）。`github.com` 不会填充 `gist.github.com`；https 记录不会填充 http 页面；不同端口互不填充。

**不会**注入 `chrome://`、Chrome 网上应用店或其他受保护页面。主机权限**不用于**抓取、分析或广告。

## 7. 权限列表（与已构建的 manifest 一致）

| 权限 | 用途 |
| --- | --- |
| `storage` | 持久化书签相关设置、AI 配置与 API 密钥、自定义分类、保险库加密元数据/主机索引、会话解锁与待保存草稿。密码不写入 `chrome.storage.local`。 |
| `activeTab` | 你点击工具栏图标时，读取当前标签的公开元数据以便保藏。 |
| `scripting` | 配合 `activeTab`，在用户手势下读取当前页公开元数据。 |
| `tabs` | 读取当前标签标题与网址；从页架打开已保藏链接。 |
| `sidePanel` | 侧边栏「页架 / 保险库」。 |
| 主机权限 `https://*/*`、`http://*/*` | 见第 6 节。 |

未申请 `nativeMessaging`、`debugger`、`clipboardRead`、`webRequestBlocking` 等。

## 8. 如何删除数据

- **卸载扩展：** 浏览器会删除本扩展的 IndexedDB 与 `chrome.storage` 数据。
- **应用内：** 可逐条删除书签或登录；可导出书签 JSON（不含密码）；可导出保险库加密备份（密文）或在你确认警告后导出未加密 JSON。导入加密备份会整库替换。
- **主密码：** 无法找回。丢失后无法解密保险库，只能丢弃记录或从你持有的备份恢复。

## 9. 政策变更

若本政策变更，我们会更新本文件并修改文首生效日期。最新版本以仓库中的 `PRIVACY.md` 为准：<https://github.com/ferbylv/siteshelf/blob/main/PRIVACY.md>

---

## Privacy Policy (English, for Chrome Web Store reviewers)

**Developer:** ferbylv (GitHub). **Contact:** GitHub Issues on [ferbylv/siteshelf](https://github.com/ferbylv/siteshelf/issues). **Effective date:** 2026-08-31.

SiteShelf 页架 is a local-first Chrome MV3 extension. **Single purpose:** a local page shelf — bookmark/classify the current page, and optionally encrypt and fill logins for that site. There is no SiteShelf cloud, no developer-operated backend, and no user account.

### Data stored locally

- **Bookmarks** in IndexedDB `siteshelf` / `bookmarks` (URL, title, description, excerpt, summary, category, tags). Fully separate from the vault. No passwords.
- **Encrypted vault** in IndexedDB `siteshelf-vault`: PBKDF2-SHA-256 (600,000 iterations) wrapping an AES-256-GCM DEK. The master password is never stored and cannot be recovered. Ciphertext records only.
- **chrome.storage.local:** AI settings and optional API key; custom category names; vault idle-lock settings; an **origin index of scheme+host+port only** (default 80/443 ≡ omitted; no usernames/passwords). Passwords are never written to `chrome.storage.local`.
- **chrome.storage.session:** in-memory DEK while unlocked; pending save-on-login drafts until the user confirms 「保存到页架？」. Confirm-to-save only.

### Never transmitted

Passwords, usernames, form values, and the master password are **never** sent to a network endpoint, the Prompt API, OpenAI, logs, or analytics. Classify uses only public metadata (url, title, description, excerpt).

### Optional transmission

If the user enables an OpenAI-compatible classify endpoint, public page metadata plus the API key are sent **only** to the HTTPS URL the user typed. Chrome Prompt API, when available, stays on-device. No other remote code.

### No cloud / ads / sale

No SiteShelf cloud, analytics, ads, tracking, remote code, `nativeMessaging`, or `debugger`. We do not sell data. Developers cannot remotely read user libraries.

### Chrome Web Store Limited Use

User data is used only to provide the single disclosed purpose (local page shelf: bookmark/classify the current page, and optionally encrypt/fill logins for that site). No transfer except (a) the user-configured classify endpoint, (b) legal requirement, (c) protecting users/security, (d) a merger with equivalent protections. No ads. No humans read user data. We certify Limited Use.

### Host permissions

`http(s)://*/*` injects `vault.js` on ordinary pages to detect login forms, show a compact save prompt, and exact-origin fill (hostname + scheme + port; default 80/443 ≡ omitted; no fuzzy / eTLD+1). No injection on `chrome://` or the Chrome Web Store. Not used for analytics or scraping.

### Permissions (built manifest)

`storage`, `activeTab`, `scripting`, `tabs`, `sidePanel`; host_permissions `https://*/*` and `http://*/*`.

### Deletion

Uninstall the extension, or delete/export in-app. The master password cannot recover the vault.

### Changes

We will update this file and bump the effective date.
