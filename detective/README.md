# 线索工作台 · AI014

独立的静态公开信息核验工具，部署在 `/detective/`。原站五个科学实验保持原有实现，首页只增加入口。

## 实际功能与边界

- 用户名：为十个站点生成主页核验入口。不会自动请求这些站点，不检查账号存在性，也不推断同名账号属于同一人。
- Sherlock：根据校验过的用户名生成 `sherlock NAME --csv`。用户在自己的电脑安装、运行；本页不执行 Python。支持原始 CSV 与逐行 URL 的 TXT 本地导入、去重及 JSON 导出。CSV 支持 `Claimed` 状态，并兼容 `true` / `yes`，其余状态不导入。所有结果仍为待人工核验。
- 文件：Web Crypto SHA-256；exifr 7.1.3 full 读取 JPEG / TIFF 相机、时间与可选 GPS 字段。GPS 默认隐藏；不打开地图。文件上限 25 MiB，报告上限 1 MiB / 1,000 行。
- 网址：使用浏览器标准 URL API 拆解协议、域名、路径、查询参数和片段，提示 HTTP、国际化域名、IP 及可能敏感的参数。不会访问目标，不提供恶意网址检测结论。
- CyberChef：只提供官方链接，不是内置模块。

## 隐私与安全

文件、输入和结果仅保留在当前页面内存，不写入 localStorage、IndexedDB 或 cookie。页面无分析统计、广告、外部字体或远程解析服务。CSP 的 `connect-src 'none'` 禁止脚本发起连接请求。静态网站托管方仍会收到打开页面及其资源的普通访问请求。

只有点击外部链接、或用户自行在电脑运行 Sherlock，才会访问对应第三方网站。外链使用 `noopener noreferrer`。导入的标签、网址及元数据使用 `textContent` 渲染，不按 HTML 执行。报告下载由用户点击触发，不是上传。刷新页面清空工作状态，下载的文件仍由用户保管。

## 来源与许可证

- Sherlock：MIT，仅做命令与报告兼容，没有复制引擎或站点数据库。官方仓库：https://github.com/sherlock-project/sherlock 。CSV 契约核验来源：commit `c588d7c8b476df9f9c84912a05d1430fb8cdcdae`，`sherlock_project/sherlock.py` 与 `result.py`。当前源码 TXT 输出需显式 `--txt`，CSV 使用 `--csv`。
- exifr：MIT，版本 7.1.3 full UMD，自托管于 `vendor/exifr-7.1.3.js`。版权和完整许可保留于 `vendor/exifr-LICENSE.txt`。分发来源：https://cdn.jsdelivr.net/npm/exifr@7.1.3/dist/full.umd.js 。75,848 字节，SHA-256：`2bd05117781c12ddd965dee846de3b3f986b5ecb4c7f6a78f2d2ec1db7c65ae7`。源标签 `v7.1.3` 对应 commit `6cbf6e921688faf7723e1f2e0b9e672d1f0aa21c`。
- CyberChef：Apache-2.0，只链接官方 https://gchq.github.io/CyberChef/ ，未分发其代码。
- SHA-256 与 URL 拆解：浏览器内置 API。

## 本地运行与测试

从仓库根目录执行 `python3 -m http.server 8140`，打开 `http://localhost:8140/detective/`。Web Crypto 需要 HTTPS 或可信的 localhost 环境。

`npm test` 运行原站与新工具的 Node 测试。`node --test tests/detective*.test.js` 单独运行新工具测试。发布时应另外进行浏览器操作、控制台、窄屏溢出与真实文件解析检查。没有运行的检查不得标为通过。

## 发布与恢复

沿用现有 GitHub Pages 和 CNAME，不改 DNS、不建立新后台、不新增凭据或账户。发布提交建立在已核对的远端 main SHA 上，保留所有既有文件。恢复可以通过回退本次提交完成；不要 force push 或覆盖并行提交。
