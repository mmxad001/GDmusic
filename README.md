# GD Studio MusicFree 插件

这是一个 MusicFree 播放器插件，基于 GD Studio API 实现搜索、播放、歌词和封面获取。

## 安装

在 MusicFree 的「插件设置」中选择「从网络安装插件」，填入：

```text
https://cdn.jsdelivr.net/gh/mmxad001/GDmusic@main/gdstudio-music.js
```

或者添加插件订阅：

```text
https://cdn.jsdelivr.net/gh/mmxad001/GDmusic@main/plugins.json
```

添加订阅后，可以在插件页通过「更新订阅」获取后续版本。

## 更新插件

1. 修改 `dist/gdstudio-music.js` 里的 `version`，例如 `1.0.1`。
2. 同步更新 `plugins.json` 里的 `version`。
3. 提交并推送到 GitHub。
4. 在 MusicFree 中点击「更新订阅」。

## 注意

插件数据来自 GD Studio API，仅供学习交流，请勿用于商业用途。
