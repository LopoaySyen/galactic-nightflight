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
  { id: 'space', photo: 0, label: { zh: '空间漫游', en: 'Travel' }, title: { zh: '换个地方，星空就不同。', en: 'Somewhere else. A different sky.' }, body: { zh: '去银河深处，去外围，或来到盘面上方。熟悉的星座会变换模样，银河也会出现在不同方向——这是从你所在位置重新计算的星空。', en: 'Head inward, out to the rim, or above the galactic disc. Familiar constellations change shape. The Milky Way fills a different part of the sky. Every view is calculated from where you stand.' }, detail: { zh: '位置跳转会移动观察者；方向按钮只转动视线。', en: 'Position controls move the observer. Direction controls turn the view.' }, points: { zh: ['六个预设位置', '银河位置图自由选点', '视线可锁定银河中心'], en: ['Six preset positions', 'Choose a point on the galactic map', 'Track the galactic centre'] } },
  { id: 'time', photo: 3, label: { zh: '时间推进', en: 'Time' }, title: { zh: '看看几千年后的星空。', en: 'Fast-forward a few thousand years.' }, body: { zh: '播放、暂停或倒放模拟时间，调整时间流速，观察恒星与观察者的运动。', en: 'Play, pause or reverse simulated time. Adjust the speed to follow the motion of stars and the observer.' }, detail: { zh: '恒星运动与观察者轨道采用近似模型，适合探索变化，不用于精密预测。', en: 'Stellar motion and observer orbits use approximate models for exploration, rather than precision forecasting.' }, points: { zh: ['调整时间流速', '正向与反向播放', '跟随观察者轨道'], en: ['Adjust time speed', 'Forward and reverse playback', 'Follow the observer’s orbit'] } },
  { id: 'light', photo: 1, label: { zh: '感光与大气', en: 'Atmosphere' }, title: { zh: '这里的夜晚，会是什么样？', en: 'What does night look like here?' }, body: { zh: '让日光退去，让薄雾升起，或关掉大气，直接看向深空。再换用裸眼或相机，比较这里的星空会怎样显现。', en: 'Let daylight fade. Add a little haze, or remove the atmosphere entirely. Then switch between eye and camera to see what comes into view.' }, detail: { zh: '近红外模式把人眼看不见的波段映射成可见颜色；大气由设定条件模拟。', en: 'Near-infrared mode maps invisible light to visible colour. Atmosphere is simulated from the conditions you choose.' }, points: { zh: ['四种感光响应', '白昼、暮光与深夜', '无大气、晴朗与轻雾'], en: ['Four visual responses', 'Daylight, twilight and night', 'Vacuum, clear sky and haze'] } },
  { id: 'objects', photo: 2, label: { zh: '天体查询', en: 'Star finder' }, title: { zh: '那颗星，叫什么名字？', en: 'Which star is that?' }, body: { zh: '点击恒星、星云、星团或星系，查看距离、目录资料与图像来源。也可以输入名称或已有星表编号搜索。', en: 'Select a star, nebula, cluster or galaxy to inspect its distance, catalogue information and image source. Search by name or a supported catalogue identifier.' }, detail: { zh: '只有已载入的目录天体提供资料，照片中的每个星点不一定有单独记录。', en: 'Data is available for loaded catalogue objects. Individual stars within photographs may not have separate records.' }, points: { zh: ['中文名与英文名搜索', '点选天体查看资料', '深空照片保留来源'], en: ['Chinese and English name search', 'Select objects to inspect data', 'Deep-sky image credits'] } },
] as const;
