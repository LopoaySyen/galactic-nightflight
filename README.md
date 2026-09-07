# 银河夜航 · Galactic Nightflight

银河夜航是一座可以自由选取银河观察位置的三维观星平台，同时提供独立的星空主题首页。实测恒星、模型恒星、连续银河光和观测照片分别说明其依据及限制。

[English documentation](README.en.md) · [GitHub 仓库](https://github.com/LopoaySyen/galactic-nightflight)

## 页面

- `/`：中文首页，包含网站简介、功能亮点、可切换的功能幻灯片与项目开源信息。
- `/en`：英文首页，可与中文页互相切换。观星平台目前使用中文界面。
- `/observe`：全屏观星平台，包含位置跳转、方向控制、银河中心持续锁定、时间推进、感光与大气、天体搜索及点选。
- `/logos`：已经采用的“星舟”标志、其余候选与生成说明。

首次进入观星平台时显示七步引导。完成或跳过后在当前浏览器保存记录；底部“新手教程”可再次打开。数据不用于跨设备用户识别。

## 实现范围与限制

当前已经接入实测亮星与盖亚明亮恒星子样本，并通过三维模型推断远离太阳后的恒星投影、连续银河光及尘埃遮挡。恒星运动、观察者轨道、大气和感光仍有近似；完整高精度科学制品门禁与当前交互模型是不同的实现层次。不得把当前画面描述为全银河观测真值。

具体说明见 `public/data/SCIENCE_DISPLAY_UPDATE.md`；星表和深空影像来源分别保存在 `public/data` 的对应说明文件。

首页包含银河、猎户座星云与仙女座三种摄影主题。银河照片原生宽 6000 像素，两张主题照片原生宽 4000 像素。主题与功能介绍支持按钮、键盘、触摸和自动切换；切换时的星光加速与画面推进仅用于入口艺术呈现，不参与观星平台物理计算。动画可暂停，不可见时停止绘制，并遵循系统减少动画设置。标志采用第一款“星舟”；标签页使用独立的小尺寸图标。

## 源码与使用许可

作者：[LopoaySyen](https://github.com/LopoaySyen)。公开仓库：[galactic-nightflight](https://github.com/LopoaySyen/galactic-nightflight)。

本项目原创部分采用 [Apache License 2.0](LICENSE)，允许学习、修改、分享和商业使用，无需另行向作者申请授权。分发时按照许可保留版权、署名、来源、许可与 NOTICE，修改文件需注明变更。完整条款以 LICENSE 为准。

使用及引用说明见 [COMMERCIAL-LICENSING.md](COMMERCIAL-LICENSING.md)，作者与来源见 [NOTICE](NOTICE)。第三方数据、照片和软件依赖保留原许可，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 本地运行与检查

需要 Node.js 22.13 或更高版本，即在本地运行网站构建程序的 JavaScript 运行环境。建议使用 Linux 或可运行 Bash 的环境；Windows 可使用适用的 Linux 子系统。

```bash
npm ci
npm run dev
```

开发服务会输出本地访问地址。源码包含运行所需的明亮恒星子样本和图像，不需要账号、数据库或天文数据服务密钥。

检查与构建：

```bash
npm run typecheck
npm run test:core
npm run build
node --test tests/*.test.mjs
```

公开版本里的 `.openai/hosting.json` 只保留通用配置，不携带作者的线上站点标识。构建输出在 `dist`；可按托管平台的 Cloudflare Workers 说明部署。主页与观星平台的科学限制见上文。

维护者可执行 `node scripts/export-public-source.mjs /绝对路径/新目录` 导出当前源码快照。导出会去除私有历史与原站点标识，并检查常见凭证格式；不会导出依赖缓存或构建结果。
