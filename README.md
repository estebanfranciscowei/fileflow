# 转转 FileFlow

[在线使用](https://estebanfranciscowei.github.io/fileflow/)

## GitHub Pages 自动部署

推送到 `main` 后，GitHub Actions 会安装锁定依赖、构建转换组件，并将 `dist/` 发布到 GitHub Pages。仓库 Settings → Pages 的 Source 使用 GitHub Actions。也可以在 Actions 页手动运行发布工作流。所有资源均使用相对路径，支持 `/fileflow/` 项目路径。

面向手机、平板与电脑的文件转换工具，默认进入 PDF 转 Word。文件在当前浏览器内处理，不上传文件，不需要转换服务账号或 API 密钥。

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
