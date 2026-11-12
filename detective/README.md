# 线索核查 · 大陆适配版 · AI014

独立的静态公开信息核验工具，部署在 `/detective/`。原站五个科学实验保持原有实现，首页只增加入口。

## 大陆手机版适配（2026-11）

默认入口改为中文分享文案核查，不要求用户先学命令或安装 Python。六个页签在小屏排为两行；输入字号 16px、常用按钮最小 44px；没有外部字体、CDN 或远程解析服务。

- 分享文案：本地提取最多 20 个 HTTP(S) / www 网址，显示真实主机名，提示常见短链、跳转参数、伪装域名、HTTP、IP、国际化编码等有限特征。相关凭证参数值和片段仅在展示时遮盖。不是安全网址库；不会展开短链、访问目标或认定身份。
- 二维码：实际自托管 jsQR 1.4.0。选择 JPG / PNG / WebP 图片（最多 10 MiB、40 百万原始像素），本地缩至最长边 1600 像素后读出一个普通二维码。不会打开内容，不申请相机权限。小程序码、条形码、艺术码及模糊图片不保证支持。页面自带无个人信息的示例二维码，供实际浏览器解码验收。
- 主体核验：归一全角、空格与大小写后按 GB 32100-2015 字符集和校验位规则检查 18 位统一社会信用代码。算法匹配不证明企业存在、资质、信用或登记状态。官方登记与ICP备案需由用户前往对应官网人工查询，可能遇到验证码、登录或访问失败。
- 中文公开线索：构造百度、必应及国内平台的搜索引擎收录页入口，用户点击后才会传送关键词。不是后台检索、平台完整站内搜索或账号存在性检测。
- 原 Sherlock 和逐项 URL 工具保留在进阶区，文件指纹与 EXIF 保留在照片文件区。

适配没有迁移托管服务：仍使用现有 GitHub Pages / ai014.cn。无法由前端保证大陆不同地区、运营商或微信内置浏览器的连通性、速度。没有宣称已在大陆实体手机或所有浏览器实测。

## 实际功能与边界

- 用户名：为十个站点生成主页核验入口。不会自动请求这些站点，不检查账号存在性，也不推断同名账号属于同一人。
- Sherlock：根据校验过的用户名生成 `sherlock NAME --csv`。用户在自己的电脑安装、运行；本页不执行 Python。支持原始 CSV 与逐行 URL 的 TXT 本地导入、去重及 JSON 导出。CSV 支持 `Claimed` 状态，并兼容 `true` / `yes`，其余状态不导入。所有结果仍为待人工核验。
- 文件：Web Crypto SHA-256；exifr 7.1.3 full 读取 JPEG / TIFF 相机、时间与可选 GPS 字段。GPS 默认隐藏；不打开地图。文件上限 25 MiB，报告上限 1 MiB / 1,000 行。
- 网址：使用浏览器标准 URL API 拆解协议、域名、路径、查询参数和片段，提示 HTTP、国际化域名、IP 及可能敏感的参数。不会访问目标，不提供恶意网址检测结论。
- CyberChef：只提供官方链接，不是内置模块。

## 隐私与安全

文件、输入和结果仅保留在当前页面内存，不写入 localStorage、IndexedDB 或 cookie。页面无分析统计、广告、外部字体或远程解析服务。二维码图片使用本地 blob URL，结束后释放；jsQR 在第一次使用二维码工具时从本站按需加载。CSP 的 `connect-src 'none'` 禁止脚本发起连接请求。静态网站托管方仍会收到打开页面及其资源的普通访问请求。

只有点击外部链接、或用户自行在电脑运行 Sherlock，才会访问对应第三方网站。外链使用 `noopener noreferrer`。导入的标签、网址及元数据使用 `textContent` 渲染，不按 HTML 执行。报告下载由用户点击触发，不是上传。刷新页面清空工作状态，下载的文件仍由用户保管。

## 来源与许可证

- Sherlock：MIT，仅做命令与报告兼容，没有复制引擎或站点数据库。官方仓库：https://github.com/sherlock-project/sherlock 。CSV 契约核验来源：commit `c588d7c8b476df9f9c84912a05d1430fb8cdcdae`，`sherlock_project/sherlock.py` 与 `result.py`。当前源码 TXT 输出需显式 `--txt`，CSV 使用 `--csv`。
- exifr：MIT，版本 7.1.3 full UMD，自托管于 `vendor/exifr-7.1.3.js`。版权和完整许可保留于 `vendor/exifr-LICENSE.txt`。分发来源：https://cdn.jsdelivr.net/npm/exifr@7.1.3/dist/full.umd.js 。75,848 字节，SHA-256：`2bd05117781c12ddd965dee846de3b3f986b5ecb4c7f6a78f2d2ec1db7c65ae7`。源标签 `v7.1.3` 对应 commit `6cbf6e921688faf7723e1f2e0b9e672d1f0aa21c`。
- CyberChef：Apache-2.0，只链接官方 https://gchq.github.io/CyberChef/ ，未分发其代码。
- jsQR：Apache-2.0（不是 MIT），固定 1.4.0，官方 npm https://registry.npmjs.org/jsqr/-/jsqr-1.4.0.tgz ，gitHead `49a9633931fb8030ac2fc9cecc121d6e5a19f9a3`。自托管 `vendor/jsQR-1.4.0.js`，256885 字节，SHA-256 `bc40c8a15196236b2314db0856f72ca0b49980cd5413b8c852a7349f5fee0859`；完整许可证保留于 `vendor/jsQR-LICENSE.txt`。未修改发行代码，包中无 NOTICE。npm 压缩包已对照 registry 的 SHA-512 integrity 验证。
- 二维码示例：使用开发期 qrcode 1.5.4（MIT）生成无个人信息的 `https://example.com/ai014-demo?from=qr` 图像及测试矩阵；生成器没有内嵌网站，测试不会访问该网址。
- 统一社会信用代码标准官方入口：https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=24691C25985C1073D3A7C85629378AC0 。这里只检查字符与校验位，没有登记数据库，也不验证全部登记管理机关或行政区划代码。
- SHA-256 与 URL 拆解：浏览器内置 API。

## 本地运行与测试

从仓库根目录执行 `python3 -m http.server 8140`，打开 `http://localhost:8140/detective/`。Web Crypto 需要 HTTPS 或可信的 localhost 环境。

`npm test` 运行原站与新工具的 Node 测试。`node --test tests/detective*.test.js` 单独运行新工具测试。发布时应另外进行浏览器操作、控制台、窄屏溢出与真实文件解析检查。没有运行的检查不得标为通过。

## 发布与恢复

沿用现有 GitHub Pages 和 CNAME，不改 DNS、不建立新后台、不新增凭据或账户。发布提交建立在已核对的远端 main SHA 上，保留所有既有文件。恢复可以通过回退本次提交完成；不要 force push 或覆盖并行提交。
