# 转转 FileFlow

面向手机、平板与电脑的文件转换工具，默认进入 PDF 转 Word。文件在当前浏览器内处理，不上传文件，不需要转换服务账号或 API 密钥。

[网站地址](https://estebanfranciscowei.github.io/fileflow/) · [发布状态](https://github.com/estebanfranciscowei/fileflow/actions)

网站仅在 Pages 发布成功后可访问。仓库上传成功不等于网站已上线；没有成功的发布记录时，地址可能返回 404。README 是项目说明，真正的网页入口是发布分支根目录中的 `index.html`。

## GitHub Pages 发布方式

本仓库统一使用预编译文件的分支发布。Settings → Pages 应保持以下设置：

| 设置 | 值 |
| --- | --- |
| Source | Deploy from a branch |
| Branch | gh-pages |
| Folder | /(root) |

`main` 保存源码，`gh-pages` 保存网站文件。发布目录是 `gh-pages` 的根目录，含 `index.html`、`office.js`、`vendor/` 和 `.nojekyll`，不使用 `/docs`。

更新网站时，在已登录 GitHub 的本地终端执行：

```powershell
npm ci
npm run deploy:pages
```

发布命令会重新构建，将 `dist/` 的完整内容同步到 `gh-pages`，通过正常推送更新，保留发布历史，不强制覆盖远程提交。之后由 GitHub Pages 内置流程发布。命令上传完成后仍需查看 [Actions 的 pages build and deployment](https://github.com/estebanfranciscowei/fileflow/actions) 是否成功。

只推送 `main` 不会自动更新网站。仓库不再使用另一套自定义 Pages 发布工作流。所有资源均使用相对路径，支持 `/fileflow/` 项目路径。

## 文档转换

- **PDF → Word (.docx)**：可编辑文字模式提取文字与基本段落，保留分页。复杂表格、多栏和排版不保证还原。无文字的扫描件会明确提示。
- **PDF → Word 保留版式**：将每页渲染为图片嵌入 Word，适合扫描件或需要保留页面外观的文档，文字不可编辑。
- **Word (.docx) → PDF**：在浏览器渲染文字、表格、图片、页眉页脚与分页，再生成图片页 PDF。PDF 文字不可选取；缺失字体、复杂排版可能有差异。长页内容会继续分页。
- **PDF 合并**：按文件列表顺序合并，直接复制原页面。
- **PDF 拆分**：选定页面逐页保存为 PDF，ZIP 下载。
- **PDF 页面提取**：例如 `1-3,5`，按填写顺序保存为新 PDF。
- **PDF → JPG**：逐页渲染，ZIP 下载，支持选择页码范围。

旧版 `.doc` 请先在 Word 中另存为 `.docx`。OCR、Excel、PPT 与视频转换尚未提供。加密 PDF 请先解除密码。

## 其他功能

- JPG、PNG、WebP、GIF、BMP、SVG 输入；输出 JPG、PNG、WebP。
- 图片质量、最长边尺寸设置；批量图片合并为 A4 PDF。
- TXT、Markdown、HTML 文字提取与格式保存（Markdown 不进行富文本渲染）。
- CSV 与 JSON 对象数组互转，支持中文、引号、逗号与换行字段。
- 批量转换、逐个下载或全部下载、设备本地最近记录、示例文件。

## 手机保存文件

转换后点“保存”。安卓直接在当前浏览器触发下载，不另开临时文件页面。支持文件分享的 iPhone／iPad 会打开系统分享，可选择“存储到文件”。取消系统分享会保留当前结果，不会自动跳转。

普通下载无反应时，点“保存遇到问题？”，可尝试“兼容下载”（20 MB 以内，使用本机文件数据，不依赖临时 blob 链接），或选择浏览器支持的系统文件分享。兼容方式仍取决于浏览器下载功能，不能保证所有第三方浏览器。若仍被要求跳到 Chrome／Safari，请先在那个浏览器打开网站再重新转换；当前页面生成的临时文件不能随浏览器切换转移。

多份转换结果会提前打成一个 ZIP，点击“保存全部 ZIP”一次保存，避免手机拦截连续下载。合计超过 150 MB 时请逐个保存。

## 构建与预览

```powershell
npm ci
npm run build
npx serve dist
```

请通过 HTTP(S) 打开，浏览器模块和 PDF Worker 无法通过 `file://` 正常运行。部署目录为 `dist/`，包含编译好的浏览器模块与 PDF Worker、CMap、字体和 WASM 资源。修改 `src/office.js` 后需重新构建。依赖版本由 `package-lock.json` 锁定，第三方许可证随静态资源发布。

## 限制与隐私

单文件最大 50 MB，一次最多 20 个。PDF 转文字最多 150 页；保留版式和转图片每次最多 40 页；PDF 合并最多 300 页；Word 渲染最多 100 个原始页面。受手机内存及浏览器限制，大文档可能需要先拆分。

文件与转换结果仅在页面内存中保存，刷新或关闭后清除。最近记录仅在当前浏览器存储文件名、格式、大小和时间，可手动清除。

UI 使用系统中文字体，Google Fonts 可用时载入 Noto Sans SC。转换资源均随网站本地提供，不将文件发送到第三方转换服务。
