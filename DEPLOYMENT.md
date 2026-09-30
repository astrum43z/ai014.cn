# ai014.cn · 腾讯云 DNS 接入指南

本仓库对应独立的新站“微观宇宙”。只配置 ai014.cn，不修改其他域名。

## 1. 开启 GitHub Pages

进入仓库 Settings → Pages：

- Source：Deploy from a branch
- Branch：main
- Folder：/ (root)
- 点击 Save，等待 pages build and deployment 成功

## 2. 绑定域名

在相同 Pages 页面，将 Custom domain 填为 `ai014.cn` 并保存。GitHub 分支发布模式会创建 CNAME 文件。先绑定，再更改 DNS。

## 3. 腾讯云添加解析

登录腾讯云 → 云解析 DNS / DNSPod → 权威解析 → 选择 ai014.cn → 添加记录。

添加以下四条 A 记录，每条单独保存：

| 主机记录 | 类型 | 线路 | 记录值 | TTL |
| --- | --- | --- | --- | --- |
| @ | A | 默认 | 185.199.108.153 | 600 |
| @ | A | 默认 | 185.199.109.153 | 600 |
| @ | A | 默认 | 185.199.110.153 | 600 |
| @ | A | 默认 | 185.199.111.153 | 600 |

建议再添加：

| 主机记录 | 类型 | 线路 | 记录值 | TTL |
| --- | --- | --- | --- | --- |
| www | CNAME | 默认 | astrum43z.github.io | 600 |

记录值不带 https://，也不带仓库路径。不要添加通配符 *。如果 @ 或 www 已有旧 A、AAAA、CNAME，先核对是否冲突；保留邮件用 MX、验证用 TXT 等其他记录。这里只操作 ai014.cn。

## 4. 等待并验证

回到 GitHub Pages，等待 DNS check 成功与证书签发，然后启用 Enforce HTTPS。该选项可能需要最多 24 小时才可用。最终验证 https://ai014.cn 和 www 的跳转，以及三个实验的操作。

如果域名 DNS 服务商并非 DNSPod，腾讯云中新增的记录不一定生效；应在该域名实际使用的权威 DNS 服务商处添加。

## 官方说明

- [GitHub 自定义域名说明](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [腾讯云 A 记录操作说明](https://cloud.tencent.com/document/api/302/3449)

核对日期：2026-09-30。
