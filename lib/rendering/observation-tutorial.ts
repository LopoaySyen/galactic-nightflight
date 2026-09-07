export const tutorialStorageKey='galactic-nightflight-tutorial-v1';
export const observationTutorialSteps=[
  {title:'欢迎登上银河夜航',body:'这里是正式的观星平台。这份简短引导会带你认识朝向、位置、时间和天体查询；任何时候都可以跳过，之后再从“新手教程”打开。',target:null,panel:null},
  {title:'先决定朝哪里看',body:'左侧“银河中心”“银河外围”等按钮只转动视线，不移动观察位置。平时按住天幕拖动可自由转向，滚轮或视场角滑杆可以缩放。',target:'[data-guide="directions"]',panel:null},
  {title:'再决定站在哪里',body:'这些预设坐标会真正移动观察者。也可以拖动下面的银河位置图和距离滑杆。跳转会暂停并重置模拟时间；恒星方向与亮度随后按新位置计算。',target:'[data-guide="positions"]',panel:'location'},
  {title:'让银河中心始终在前方',body:'打开中心锁定后，跳转位置或播放时间都会持续看向银河中心，仍可缩放。关闭时停留在当前方向；选择其他朝向或定位天体会解除锁定。',target:'[data-guide="centre-lock"]',panel:null},
  {title:'让时间开始流动',body:'播放、暂停或切换正向与反向。流速的“年/秒”表示每过一秒现实时间，模拟中经过多少年，数值越大播放越快。运动仍是模型近似。',target:'[data-guide="time"]',panel:null},
  {title:'调整你的夜空',body:'在裸眼、暗适应和相机之间切换，并选择大气与晨昏条件。显示曝光越高画面越亮，但不等同于真实相机快门时间。',target:'[data-guide="response"]',panel:'view'},
  {title:'找到名字背后的星光',body:'打开搜索，输入中文名、英文名或已有星表编号。也可以直接点击恒星、星云、星团和目录星系查看资料。准备好后，就开始自己的夜航吧。',target:'[data-guide="search"]',panel:null},
] as const;
export function shouldShowObservationTutorial(storage:Pick<Storage,'getItem'>):boolean {try{return storage.getItem(tutorialStorageKey)!=='seen';}catch{return true;}}
export function rememberObservationTutorial(storage:Pick<Storage,'setItem'>):void {try{storage.setItem(tutorialStorageKey,'seen');}catch{/* Browser storage can be unavailable; the tutorial remains usable. */}}
