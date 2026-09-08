# 第三方内容与来源

项目的 MIT 代码许可只覆盖可以由本项目作者授权的原创部分，以下内容保留原许可。本文件和 `public/data` 中的来源文件应随副本一起保留。

## 首页银河照片

- 文件：`public/brand/milky-way-1920.webp`、`milky-way-4096.webp`、`milky-way-6000.webp`。
- 照片：[The Milky Way panorama](https://www.eso.org/public/images/eso0932a/)。署名：**ESO/S. Brunier**。
- 许可：[知识共享署名 4.0](https://creativecommons.org/licenses/by/4.0/)，允许在遵守署名等条件下使用；[欧洲南方天文台使用说明](https://www.eso.org/public/outreach/copyright/)。
- 使用公开的 6000 × 3000 像素版本，没有使用另行保留权利的超大原图。网页使用格式转换及缩小版本；显示时进行裁切、压暗和轻微位移。穿行粒子是额外的艺术动画。
- 下载地址与尺寸记录：`public/brand/milky-way-source.json`。

## 深空照片

- 猎户座：**ESO/G. Beccari**，[来源](https://www.eso.org/public/images/eso1723a/)，知识共享署名 4.0。
- 半人马座欧米茄星团：**ESO/INAF-VST/OmegaCAM. Acknowledgement: A. Grado, L. Limatola/INAF-Capodimonte Observatory**，[来源](https://www.eso.org/public/images/eso1119b/)，知识共享署名 4.0。
- 仙女座宽视场：**NASA, ESA, Digitized Sky Survey 2 (Acknowledgement: Davide De Martin)**，[来源](https://esahubble.org/images/heic1502b/)，知识共享署名 4.0。
- 昴星团：**NASA, ESA, AURA/Caltech, Palomar Observatory**，[原页面](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-45/)。请遵守页面中各摄影机构的署名与使用条件。
- 运行时进行显示缩放、边缘渐隐、背景混合与可选色彩映射；这些处理不构成天文测光标定。详细方向、范围和显示限制见 `public/data/deep-sky-image-sources.json`。

## 恒星数据

### 耶鲁亮星目录整理数据

来自 [Geir Isene 的 starmap](https://github.com/isene/starmap)，上游为耶鲁亮星表，距离资料依据依巴谷星表。当前来源记录将整理数据注明为公有领域；应保留来源、筛选条件和处理说明。见 `public/data/bright-star-catalog-source.json`。

### 盖亚第三批数据的明亮恒星子样本

使用欧洲空间局盖亚任务公开数据，经盖亚数据处理与分析联盟处理。联盟经费由各国机构提供，特别是参与盖亚多边协议的机构。英文标准致谢如下：

> This work has made use of data from the European Space Agency (ESA) mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium). Funding for the DPAC has been provided by national institutions, in particular the institutions participating in the Gaia Multilateral Agreement.

[官方致谢指引](https://www.cosmos.esa.int/web/gaia-users/credits)、[数据许可说明](https://www.cosmos.esa.int/web/gaia-users/license)、[档案使用条款](https://www.cosmos.esa.int/web/esdc/terms-and-conditions)。发布包保留查询条件、数据文件和转换脚本；不把这些第三方数据改为本项目的代码许可。

## 人工智能生成素材

星舟及其他标志候选、旧版首页艺术背景、行星地貌由图像生成工具制作。生成说明见 `public/brand/generation-notes.json` 和 `public/data/terrain-asset-source.json`。本项目仅在法律允许的范围内授权自身可以授权的权益；不声称获得商标注册或排他权利，也不把艺术素材当作实测天文数据。

## 软件依赖

依赖名称与版本由 `package.json` 和 `package-lock.json` 记录。React、Next.js、Vinext、Vite、Cloudflare 工具以及其他依赖保留各自的软件许可；安装后可在对应软件包中查看原许可。此项目不通过自身许可重新授权第三方依赖。

## 首页主题与标签页图标

- 首页主题使用原有观测照片的高分辨率发布版本：`public/brand/theme-orion.webp` 来自 https://cdn.eso.org/images/publicationjpg/eso1723a.jpg ；`theme-andromeda.webp` 来自 https://cdn.esahubble.org/archives/images/publicationjpg/heic1502b.jpg 。署名与许可同上面的猎户座、仙女座条目。只转换格式，网页另行进行裁切、压暗与主题过渡。
- 标签页图标是在已选星舟标志基础上通过图像生成重新适配，采用浅蓝底、加粗深蓝图形，并提供多个小尺寸版本。提示词见 `public/brand/favicon-generation-prompt.txt`。

## 静谧钢琴配乐音色 / Quiet piano soundtrack samples

The original Nightflight arrangements use modified Salamander Grand Piano samples (Yamaha C5), recorded by Alexander Holm and distributed by Tone.js under CC BY 3.0.
Source and attribution: https://github.com/Tonejs/audio/tree/master/salamander
License: https://creativecommons.org/licenses/by/3.0/
Modifications: resampling, softened attacks, low-pass filtering, release envelopes, stereo narrowing and reverb. See public/music/CREDITS.md. No Minecraft or C418 recordings or melodies are incorporated.


## Chinese stellar names

The derived table `public/data/chinese-star-names.json` joins 2,455 existing Hipparcos catalogue entries to Stellarium's Chinese sky culture. Attribution: Karrie Berglund, Sun Shuwei, Stellarium contributors and Chinese translators. Source: https://github.com/Stellarium/stellarium-skycultures/tree/master/chinese . Text/data retain the upstream **CC BY-SA** terms stated in that culture's `description.md`; they are separate from the MIT application code. Changes: selected existing stars with usable distances, translated source asterism labels and numeric suffixes, combined aliases, and added common Polaris names. Full provenance: `/data/chinese-star-names-source.json`.
