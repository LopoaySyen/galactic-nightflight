export type HomeLanguage = 'zh' | 'en';

export const homeSections = [
  { id: 'about', label: { zh: '简介', en: 'About' } },
  { id: 'features', label: { zh: '功能', en: 'Features' } },
  { id: 'guide', label: { zh: '使用', en: 'Getting started' } },
  { id: 'open-source', label: { zh: '开源', en: 'Source' } },
] as const;

export const homePhotos = [
  { image: '/brand/milky-way-4096.webp', srcSet: '/brand/milky-way-1920.webp 1920w, /brand/milky-way-4096.webp 4096w, /brand/milky-way-6000.webp 6000w', name: { zh: '银河全景', en: 'Milky Way panorama' }, credit: 'ESO/S. Brunier', source: 'https://www.eso.org/public/images/eso0932a/' },
  { image: '/brand/theme-orion.webp', srcSet: undefined, name: { zh: '猎户座星云', en: 'Orion Nebula' }, credit: 'ESO/G. Beccari', source: 'https://www.eso.org/public/images/eso1723a/' },
  { image: '/brand/theme-andromeda.webp', srcSet: undefined, name: { zh: '仙女座星系', en: 'Andromeda Galaxy' }, credit: 'NASA, ESA, DSS2; Davide De Martin', source: 'https://esahubble.org/images/heic1502b/' },
  { image: '/deep-sky/omega-centauri-wide.jpg', srcSet: undefined, name: { zh: '半人马座欧米茄星团', en: 'Omega Centauri' }, credit: 'ESO/INAF-VST/OmegaCAM', source: 'https://www.eso.org/public/images/eso1119b/' },
] as const;

export const homeFeatures = [
  { id: 'space', photo: 0, label: { zh: '空间漫游', en: 'Explore space' }, title: { zh: '换个位置，看银河。', en: 'See the galaxy from another position.' }, body: { zh: '从太阳附近出发，前往内银河、外盘或盘面上方。恒星的方向、距离和亮度会随观察位置重新计算。', en: 'Start near the Sun, then move to the inner disc, outer disc or above the galactic plane. Stellar directions, distances and brightness change with your position.' }, detail: { zh: '位置跳转会移动观察者；方向按钮只转动视线。', en: 'Position controls move the observer. Direction controls turn the view.' }, points: { zh: ['六个预设位置', '银河位置图自由选点', '视线可锁定银河中心'], en: ['Six preset positions', 'Choose a point on the galactic map', 'Track the galactic centre'] } },
  { id: 'time', photo: 3, label: { zh: '时间推进', en: 'Move through time' }, title: { zh: '观察星空如何变化。', en: 'Watch the sky change over time.' }, body: { zh: '播放、暂停或倒放模拟时间，调整时间流速，观察恒星与观察者的运动。', en: 'Play, pause or reverse simulated time. Adjust the speed to follow the motion of stars and the observer.' }, detail: { zh: '恒星运动与观察者轨道采用近似模型，适合探索变化，不用于精密预测。', en: 'Stellar motion and observer orbits use approximate models for exploration, rather than precision forecasting.' }, points: { zh: ['调整时间流速', '正向与反向播放', '跟随观察者轨道'], en: ['Adjust time speed', 'Forward and reverse playback', 'Follow the observer’s orbit'] } },
  { id: 'light', photo: 1, label: { zh: '感光与大气', en: 'Light & atmosphere' }, title: { zh: '调整看到星空的方式。', en: 'Change how you see the sky.' }, body: { zh: '切换裸眼、暗适应、相机或近红外响应。调整晨昏、当地恒星高度和大气条件，比较同一片天空的变化。', en: 'Choose naked-eye, dark-adapted, camera or near-infrared response. Adjust twilight, local star altitude and atmosphere to compare the same sky under different conditions.' }, detail: { zh: '近红外采用伪彩显示；大气效果是参数化模拟。', en: 'Near-infrared uses false colour. Atmospheric appearance is a parameterised approximation.' }, points: { zh: ['四种感光响应', '白昼、暮光与深夜', '无大气、晴朗与轻雾'], en: ['Four visual responses', 'Daylight, twilight and night', 'Vacuum, clear sky and haze'] } },
  { id: 'objects', photo: 2, label: { zh: '天体查询', en: 'Find objects' }, title: { zh: '点一下，看看是哪颗星。', en: 'Select a star. Find out what it is.' }, body: { zh: '点击恒星、星云、星团或星系，查看距离、目录资料与图像来源。也可以输入名称或已有星表编号搜索。', en: 'Select a star, nebula, cluster or galaxy to inspect its distance, catalogue information and image source. Search by name or a supported catalogue identifier.' }, detail: { zh: '只有已载入的目录天体提供资料，照片中的每个星点不一定有单独记录。', en: 'Data is available for loaded catalogue objects. Individual stars within photographs may not have separate records.' }, points: { zh: ['中文名与英文名搜索', '点选天体查看资料', '深空照片保留来源'], en: ['Chinese and English name search', 'Select objects to inspect data', 'Deep-sky image credits'] } },
] as const;
