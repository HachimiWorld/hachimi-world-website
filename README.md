# 基米天堂落地页

[hachimi.world](https://hachimi.world) 的静态站点，没有构建步骤，部署在 Cloudflare Workers（Static Assets）上。

## 目录

```
public/            # 站点根目录，原样上传
  index.html       # 中文首页
  en/index.html    # 英文首页
  song/song.html   # 歌曲分享页，/song/<id> 会重写到这里，前端从路径读取 id
  static/          # 图片等静态资源
  _redirects       # 路由规则（/app → app.hachimi.world，/song/* → 歌曲页）
  .assetsignore    # 不上传的文件
wrangler.jsonc     # Worker 配置
```

## 本地预览

```bash
npx wrangler dev
```

会以线上相同的路由规则启动在 http://localhost:8787 ，可以用来检查 `_redirects`。

## 部署

```bash
npx wrangler deploy
```

注意：Workers 默认会把 `*.html` 重定向到去掉扩展名的地址，所以 `_redirects` 里的重写目标要写成 `/song/song`，不能写 `/song/song.html`。
