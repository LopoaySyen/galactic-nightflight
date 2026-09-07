export type Readiness =
  | "parameter-pinned"
  | "model-selected"
  | "contract-ready"
  | "data-required"
  | "validation-required";

export type EvidenceClass =
  | "direct-observation"
  | "dynamical-inference"
  | "model-assumption"
  | "numerical-method";

export interface ScientificSource {
  title: string;
  shortTitle: string;
  url: string;
  year: number;
  role: string;
}

export interface ModelComponent {
  id: string;
  name: string;
  domain: string;
  owner: string;
  readiness: Readiness;
  evidence: EvidenceClass;
  sourceIds: string[];
  retainedMass: string;
  excludedMass: string;
  uncertainty: string;
}

export const readinessLabels: Record<Readiness, string> = {
  "parameter-pinned": "参数已固定",
  "model-selected": "模型已选定",
  "contract-ready": "接口已完成",
  "data-required": "等待数据接入",
  "validation-required": "等待联合验证",
};

export const evidenceLabels: Record<EvidenceClass, string> = {
  "direct-observation": "直接观测约束",
  "dynamical-inference": "动力学反演",
  "model-assumption": "模型假设",
  "numerical-method": "数值方法",
};

export const scientificSources: Record<string, ScientificSource> = {
  mcmillan2017: {
    title: "The mass distribution and gravitational potential of the Milky Way",
    shortTitle: "McMillan 2017",
    url: "https://academic.oup.com/mnras/article/465/1/76/2417479",
    year: 2017,
    role: "外银河盘、气体盘和暗物质晕的基准质量模型",
  },
  mcmillanErratum2017: {
    title: "Erratum: The mass distribution and gravitational potential of the Milky Way",
    shortTitle: "McMillan 2017 勘误",
    url: "https://academic.oup.com/mnras/article/466/1/174/2638377",
    year: 2017,
    role: "固定论文勘误，避免沿用错误的本地暗物质密度换算",
  },
  portail2017: {
    title: "Dynamical modelling of the galactic bulge and bar",
    shortTitle: "Portail 等 2017",
    url: "https://academic.oup.com/mnras/article/465/2/1621/2417047",
    year: 2017,
    role: "棒、核球和内盘的非轴对称动力学约束",
  },
  sormaniBar2022: {
    title: "The stellar mass distribution of the Milky Way's bar: an analytic model",
    shortTitle: "Sormani 等 2022 解析棒",
    url: "https://arxiv.org/abs/2204.13114",
    year: 2022,
    role: "对 Portail 粒子模型的解析密度拟合，保留箱形/X 形与长棒结构",
  },
  hunter2024: {
    title: "Testing kinematic distances under a realistic Galactic potential",
    shortTitle: "Hunter 等 2024 复合势",
    url: "https://arxiv.org/html/2403.18000v2",
    year: 2024,
    role: "包含棒和螺旋扰动的复合引力势组装对照；不等于完整银河六维恒星或天空模型",
  },
  sormaniNsd2020: {
    title: "Jeans modelling of the Milky Way's nuclear stellar disc",
    shortTitle: "Sormani 等 2020 解析核星盘",
    url: "https://arxiv.org/abs/2007.06577",
    year: 2020,
    role: "第一版复合势中可复现的解析核星盘密度基线",
  },
  sormani2022: {
    title: "Self-consistent modelling of the Milky Way's nuclear stellar disc",
    shortTitle: "Sormani 等 2022",
    url: "https://academic.oup.com/mnras/article/512/2/1857/6551903",
    year: 2022,
    role: "约 30 至 300 秒差距范围内的核星盘六维分布函数",
  },
  vasilievNsc2026: {
    title: "Distribution function-based modelling of discrete kinematic datasets, in application to the Milky Way nuclear star cluster",
    shortTitle: "Vasiliev 等 2026 核星团模型",
    url: "https://arxiv.org/html/2603.29502v2",
    year: 2026,
    role: "以中央约 10 秒差距内核星团数据为主、固定所采用核星盘分布函数参数的候选核星团模型",
  },
  gravity2022: {
    title: "Mass distribution in the Galactic Center based on interferometric astrometry of multiple stellar orbits",
    shortTitle: "GRAVITY 合作组 2022",
    url: "https://www.aanda.org/articles/aa/full_html/2022/01/aa42465-21/aa42465-21.html",
    year: 2022,
    role: "银河中心黑洞质量和太阳至银河中心距离的轨道约束",
  },
  agama2019: {
    title: "AGAMA: action-based galaxy modelling architecture",
    shortTitle: "AGAMA 论文与官方代码",
    url: "https://github.com/GalacticDynamics-Oxford/Agama",
    year: 2019,
    role: "离线势展开、分布函数采样、轨道积分和数值验证",
  },
  agamaPinned2026: {
    title: "AGAMA source snapshot 60d8d8b8dce4eea33e500c34700f28ebc6bbfd7b",
    shortTitle: "AGAMA 固定提交",
    url: "https://github.com/GalacticDynamics-Oxford/Agama/tree/60d8d8b8dce4eea33e500c34700f28ebc6bbfd7b",
    year: 2026,
    role: "AGAMA（基于作用量的银河建模架构）的候选离线计算版本；论文版参数与示例脚本版参数必须分别登记",
  },
  gaiaDr3: {
    title: "Gaia Data Release 3",
    shortTitle: "Gaia 第三次数据发布",
    url: "https://www.cosmos.esa.int/web/gaia/dr3",
    year: 2022,
    role: "太阳附近恒星计数、颜色、光度和运动学的选择函数校准",
  },
  twoMass: {
    title: "2MASS All-Sky Data Release",
    shortTitle: "2MASS 全天数据发布",
    url: "https://www.ipac.caltech.edu/2mass/releases/allsky/",
    year: 2003,
    role: "2MASS（2 微米全天巡天）的近红外全天恒星计数与内银河消光验证",
  },
  bayestar2019: {
    title: "A 3D Dust Map Based on Gaia, Pan-STARRS 1, and 2MASS",
    shortTitle: "Bayestar19 三维尘埃图",
    url: "https://ui.adsabs.harvard.edu/abs/2019ApJ...887...93G/abstract",
    year: 2019,
    role: "太阳附近及部分天空、数千秒差距内的概率式尘埃约束",
  },
  marshall2006: {
    title: "Modelling the Galactic interstellar extinction distribution in three dimensions",
    shortTitle: "Marshall 等 2006",
    url: "https://www.aanda.org/articles/aa/abs/2006/26/aa3842-05/aa3842-05.html",
    year: 2006,
    role: "内银河盘部分视线的距离分层消光约束",
  },
  edenhofer2024: {
    title: "A parsec-scale Galactic 3D dust map out to 1.25 kpc from the Sun",
    shortTitle: "Edenhofer 等 2024",
    url: "https://www.aanda.org/articles/aa/full_html/2024/05/aa47628-23/aa47628-23.html",
    year: 2024,
    role: "太阳附近高分辨率尘埃后验样本与误差约束",
  },
  decapsDust2025: {
    title: "A Deep, High-Angular Resolution 3D Dust Map of the Southern Galactic Plane",
    shortTitle: "DECaPS 三维尘埃图 2025",
    url: "https://arxiv.org/html/2503.02657v2",
    year: 2025,
    role: "南银河盘和部分内银河的深层尘埃约束；高消光远端仍可能漏失",
  },
  mistV1p2: {
    title: "MESA Isochrones and Stellar Tracks",
    shortTitle: "MIST 1.2 恒星演化网格",
    url: "https://mist.science/",
    year: 2016,
    role: "MIST（MESA 等时线与恒星演化轨迹库）是覆盖较宽质量与演化阶段的单星演化主候选网格；仍需与其他网格比较系统误差",
  },
  parsec2022: {
    title: "PARSEC V2.0: Stellar tracks and isochrones of low- and intermediate-mass stars with rotation",
    shortTitle: "PARSEC 2.0 恒星演化网格",
    url: "https://www.aanda.org/articles/aa/full_html/2022/09/aa44166-22/aa44166-22.html",
    year: 2022,
    role: "PARSEC（帕多瓦与的里雅斯特恒星演化代码）用于恒星旋转与演化系统误差分支，不作为唯一族群真值",
  },
  basti2021: {
    title: "The updated BaSTI stellar evolution models and isochrones. II. α-enhanced calculations",
    shortTitle: "BaSTI α 增强网格 2021",
    url: "https://arxiv.org/abs/2012.10085",
    year: 2021,
    role: "固定 α 元素增强分支的恒星演化系统误差模型；覆盖范围必须作为能力掩膜保存",
  },
  bosz2024: {
    title: "The updated BOSZ synthetic stellar spectral library",
    shortTitle: "BOSZ 光谱库 2024",
    url: "https://www.aanda.org/articles/aa/full_html/2024/08/aa49306-24/aa49306-24.html",
    year: 2024,
    role: "中温恒星光谱大气候选；采用 2025-09-24 重算数据发布并固定文件哈希",
  },
  phoenix2013: {
    title: "A new extensive library of PHOENIX stellar atmospheres and synthetic spectra",
    shortTitle: "PHOENIX 光谱库 2013",
    url: "https://www.aanda.org/articles/aa/full_html/2013/05/aa19058-12/aa19058-12.html",
    year: 2013,
    role: "较冷恒星光谱大气候选，必须按参数覆盖掩膜调用",
  },
  tlusty2002: {
    title: "OSTAR2002: A Grid of NLTE Line-Blanketed Model Atmospheres of O-Type Stars",
    shortTitle: "TLUSTY O 星网格",
    url: "https://tlusty.oca.eu/tlusty/Tlusty2002/tlusty-frames-OS02.html",
    year: 2003,
    role: "高温 O 型恒星的非局部热力学平衡光谱候选",
  },
  powr: {
    title: "Potsdam Wolf-Rayet model atmosphere grids",
    shortTitle: "PoWR 恒星风网格",
    url: "https://www.astro.physik.uni-potsdam.de/PoWR/",
    year: 2025,
    role: "具有强恒星风的炽热大质量恒星光谱候选；具体网格版本仍待固定",
  },
  skirt2020: {
    title: "SKIRT 9: Redesigning an advanced dust radiative transfer code to enable kinematics, line transfer and polarization by aligned dust grains",
    shortTitle: "SKIRT 9 辐射传输",
    url: "https://ui.adsabs.harvard.edu/abs/2020A%26C....3100381C/abstract",
    year: 2020,
    role: "离线计算尘埃吸收、散射和多次散射产生的方向辐射场",
  },
  ciePhotopic: {
    title: "CIE spectral luminous efficiency for photopic vision",
    shortTitle: "国际照明委员会明视觉光谱效率",
    url: "https://cie.co.at/datatable/cie-spectral-luminous-efficiency-photopic-vision",
    year: 2019,
    role: "国际照明委员会发布的明视觉波长响应标准数据",
  },
  cieScotopic: {
    title: "CIE spectral luminous efficiency for scotopic vision",
    shortTitle: "国际照明委员会暗视觉光谱效率",
    url: "https://cie.co.at/datatable/cie-spectral-luminous-efficiency-scotopic-vision",
    year: 2019,
    role: "国际照明委员会发布的暗视觉波长响应标准数据",
  },
  cieMesopic: {
    title: "Recommended System for Mesopic Photometry based on Visual Performance",
    shortTitle: "国际照明委员会中间视觉体系",
    url: "https://cie.co.at/publications/recommended-system-mesopic-photometry-based-visual-performance",
    year: 2010,
    role: "国际照明委员会发布的明视觉与暗视觉之间适应亮度响应体系",
  },
  emva1288: {
    title: "EMVA Standard 1288, Release 4.0",
    shortTitle: "EMVA 1288 相机传感器标准",
    url: "https://www.emva.org/standards-technology/emva-1288/emva-standard-1288-downloads-2/",
    year: 2021,
    role: "欧洲机器视觉协会的相机量子效率、暗电流、读出噪声、饱和与线性响应数据契约基线",
  },
};

export const modelComponents: ModelComponent[] = [
  {
    id: "thin-stellar-disc",
    name: "薄恒星盘",
    domain: "大尺度银河盘；内侧通过有中心孔的密度形式给棒结构腾出质量预算",
    owner: "由 Hunter 等 2024 质量组装派生的新全银河引力势候选，以 McMillan 2017 为外盘对照",
    readiness: "model-selected",
    evidence: "dynamical-inference",
    sourceIds: ["hunter2024", "mcmillan2017"],
    retainedMass: "有中心孔薄盘的独立密度分量",
    excludedMass: "McMillan 原始无中心孔薄盘不能同时保留",
    uncertainty: "固定尺度高只是第一版假设，必须用星数和垂直力作为模型变体检验",
  },
  {
    id: "thick-stellar-disc",
    name: "厚恒星盘",
    domain: "大尺度银河盘的高垂直尺度恒星分量；内侧同样具有中心孔",
    owner: "由 Hunter 等 2024 质量组装派生的新全银河引力势候选，以 McMillan 2017 为外盘对照",
    readiness: "model-selected",
    evidence: "dynamical-inference",
    sourceIds: ["hunter2024", "mcmillan2017"],
    retainedMass: "有中心孔厚盘的独立密度分量",
    excludedMass: "McMillan 原始无中心孔厚盘不能同时保留",
    uncertainty: "内银河厚盘尺度高并非常数真值，需要独立族群和星数验证",
  },
  {
    id: "galactic-bar",
    name: "银河长棒",
    domain: "内银河约数千秒差距，随单一刚性图样角速度旋转",
    owner: "Sormani 等 2022 对 Portail 等 2017 粒子模型的长棒解析密度分量",
    readiness: "data-required",
    evidence: "dynamical-inference",
    sourceIds: ["sormaniBar2022", "portail2017", "hunter2024"],
    retainedMass: "解析模型中标记为长棒的密度分量",
    excludedMass: "Portail 完整模型自带的盘、暗晕和额外中心质量",
    uncertainty: "图样角速度的观测幅值约为 39±3.5 千米每秒每千秒差距；内部符号随坐标约定为负，不能只保存无符号单值",
  },
  {
    id: "box-peanut-bulge",
    name: "箱形/X 形核球",
    domain: "内银河中央箱形和花生形恒星结构，与长棒共用旋转相位",
    owner: "Sormani 等 2022 对 Portail 等 2017 粒子模型的箱形/X 形解析密度分量",
    readiness: "data-required",
    evidence: "dynamical-inference",
    sourceIds: ["sormaniBar2022", "portail2017", "hunter2024"],
    retainedMass: "解析模型中标记为箱形/X 形核球的密度分量",
    excludedMass: "McMillan 的球对称核球必须删除；长棒分量不得重复归入核球",
    uncertainty: "解析密度拟合与中心分量组合产生的力误差必须通过网格收敛和独立力场比较量化，当前没有固定误差值",
  },
  {
    id: "nuclear-stellar-disc",
    name: "核星盘",
    domain: "银河中心半径约 30 至 300 秒差距",
    owner: "第一版引力场采用 Sormani 等 2020 解析密度；六维升级采用 Sormani 等 2022 自洽分布函数",
    readiness: "data-required",
    evidence: "dynamical-inference",
    sourceIds: ["sormaniNsd2020", "sormani2022", "agamaPinned2026"],
    retainedMass: "解析密度版或六维分布函数版二选一",
    excludedMass: "Portail 的额外中心质量和另一版核星盘不能并存",
    uncertainty: "轴对称是当前候选假设；任何非轴对称中心变体都必须有独立来源和模型标识",
  },
  {
    id: "nuclear-star-cluster",
    name: "核星团",
    domain: "银河中心半径小于约 30 秒差距",
    owner: "Hunter 等 2024 解析密度用于论文势复现；Vasiliev 等 2026 用于核星团候选升级，但固定所采用的核星盘参数",
    readiness: "validation-required",
    evidence: "dynamical-inference",
    sourceIds: ["hunter2024", "vasilievNsc2026", "gravity2022"],
    retainedMass: "核星团恒星质量、光度和位置—速度分布必须独立入账",
    excludedMass: "不得用黑洞点质量、核星盘尾部或两个核星团模型的叠加代替",
    uncertainty: "外侧总质量、扁率和与核星盘的分离尚未唯一确定，中心视点必须输出模型差异",
  },
  {
    id: "gas-mass",
    name: "气体质量",
    domain: "原子氢、分子氢与中心分子区对引力势的贡献",
    owner: "第一版保留一次 McMillan 气体盘；中心气体结构需要单独数据与质量归属",
    readiness: "validation-required",
    evidence: "dynamical-inference",
    sourceIds: ["mcmillan2017", "hunter2024"],
    retainedMass: "静态气体密度或有自引力的活动气体二选一",
    excludedMass: "启用有自引力气体时必须移除同一区域的静态气体质量",
    uncertainty: "运动学距离在棒和旋臂附近存在系统误差，不能把气体位置图当成精确三维真值",
  },
  {
    id: "dark-matter-halo",
    name: "暗物质晕",
    domain: "全银河大尺度引力背景",
    owner: "Hunter 等 2024 重新适配重子模型后的 Einasto 型暗晕；McMillan 2017 作为对照",
    readiness: "data-required",
    evidence: "dynamical-inference",
    sourceIds: ["hunter2024", "mcmillan2017", "mcmillanErratum2017"],
    retainedMass: "与最终重子组件联合拟合的一个暗晕分量",
    excludedMass: "Portail 完整模型暗晕和 McMillan 原始暗晕参数不能同时直接保留",
    uncertainty: "内坡、形状和总质量依赖先验与示踪体，必须作为模型集合传播",
  },
  {
    id: "central-black-hole",
    name: "银河中心黑洞",
    domain: "全域参与引力；当前交互范围内按牛顿点质量处理",
    owner: "4.297 × 10⁶ 倍太阳质量的中心点质量基准",
    readiness: "validation-required",
    evidence: "dynamical-inference",
    sourceIds: ["gravity2022", "hunter2024"],
    retainedMass: "仅加入点质量引力项",
    excludedMass: "不渲染虚构的肉眼可见黑色圆盘或吸积盘",
    uncertainty: "质量与太阳距离是带协方差的轨道后验；亚秒差距轨道在相对论分支验证前从牛顿点质量生产域排除",
  },
];

export const pipelineStages = [
  {
    index: "01",
    name: "观察者状态",
    description: "三维位置、三维速度、独立观察方向与模拟时刻。",
    status: "接口完成",
  },
  {
    index: "02",
    name: "联合银河模型",
    description: "经过质量去重和全局重拟合的引力势、分布函数与棒旋转。",
    status: "模型待接入",
  },
  {
    index: "03",
    name: "恒星与辐射场",
    description: "六维恒星样本、族群属性和每个波长上的体积发光率。",
    status: "专用契约待完成",
  },
  {
    index: "04",
    name: "三维视线积分",
    description: "距离、方向、直射光消光、尘埃散射源项，以及未分辨恒星辐射传输。",
    status: "仅直射消光积分完成",
  },
  {
    index: "05",
    name: "观测系统",
    description: "点源先保留光谱辐照度，弥散光保留光谱辐亮度，再分别进入人眼或相机响应。",
    status: "响应数据待接入",
  },
  {
    index: "06",
    name: "最终图像",
    description: "只有前述验证通过后才解锁实时全天球渲染。",
    status: "有意锁定",
  },
];

export const dataProducts = [
  {
    name: "引力势系数块",
    format: "版本化二进制系数 + 元数据",
    content: "各质量分量的密度、势和梯度展开；保留分量标识以审计质量归属。",
    onlineUse: "按位置和时刻求总加速度，不在网页中重新做全银河拟合。",
  },
  {
    name: "六维相空间分块",
    format: "按空间单元和恒星分量分区的列式数据",
    content: "三维位置、三维速度、采样权重和所属动力学分量。",
    onlineUse: "只查询可能进入当前观测阈值的恒星，不按观察者距离人为增减。",
  },
  {
    name: "恒星族群模板",
    format: "年龄—金属丰度—初始质量网格",
    content: "当前质量、演化阶段、光度、有效温度、绝对星等和光谱能量分布；不同银河分量拥有各自的恒星形成与化学历史。",
    onlineUse: "把动力学样本转换为真实光谱通量，并为未分辨背景提供积分核。",
  },
  {
    name: "三维尘埃概率场",
    format: "多分辨率体素或树结构 + 后验样本",
    content: "观测给出的累计或微分红化/消光后验，与另行选择的尘粒吸收、散射和相函数光学模型分开保存。",
    onlineUse: "沿观察者到恒星或天空边界的真实线段做自适应积分。",
  },
  {
    name: "未分辨发光率场",
    format: "按空间、族群和波长分箱的体积发光率",
    content: "体积发光率表示单位空间体积、单位波长产生的辐射功率；它与固定随机实现、稳定恒星标识和逐视图扣除账本共同定义，不能静态删除一批‘永远可分辨’的星。",
    onlineUse: "按当前观测系统升降级恒星时，从背景精确扣除或返还同一份光谱通量，再沿视线积分表面亮度。",
  },
  {
    name: "尘埃散射源场",
    format: "按空间、方向与波长压缩的辐射传输系数",
    content: "使用 SKIRT 9（三维尘埃辐射传输程序）离线追踪大量光子路径，求得各空间单元从所有方向接收并散射出去的辐射；包括吸收、一次散射与多次散射。",
    onlineUse: "在线插值连续辐射传输解并沿真实视线积分；它不是预制天空图片。",
  },
];

export const validationGates = [
  {
    gate: "动力学闭合",
    pass: "组合后的密度不出现非物理负值；旋转曲线、太阳附近垂直力和内银河运动学同时通过。",
    failure: "任何单个分量看似正确，但组合后质量重复或旋转曲线失真。",
  },
  {
    gate: "轨道数值可靠性",
    pass: "静态势检查总机械能；旋转棒势检查雅可比积分，并报告最大与平均相对漂移。",
    failure: "只展示平滑轨迹而不报告守恒量误差。",
  },
  {
    gate: "太阳位置反向验证",
    pass: "在巡天选择函数和误差模型作用后，星数—星等、颜色、全天密度和尘埃暗带与真实巡天一致。",
    failure: "直接拿合成真值与受观测阈值限制的星表逐项比较。",
  },
  {
    gate: "内银河独立验证",
    pass: "不参与拟合的红外星数、径向速度、自行运动和核星盘运动学仍能被预测。",
    failure: "把用于拟合的数据再次当作独立验证集。",
  },
  {
    gate: "辐射守恒",
    pass: "可分辨恒星与未分辨背景互斥且完备；改变分辨阈值不会凭空改变总光通量。",
    failure: "同一颗星既作为点源又被计入背景，或在层级切换时消失。",
  },
  {
    gate: "观测时刻一致性",
    pass: "直射光求解延迟发射时刻；观察者像差和多普勒变换使用同一六维状态；散射光记录多段传播延迟或有界静态近似。",
    failure: "把同一时刻动力学快照直接投影，并把它称为严格时间模拟。",
  },
];

export const uncertaintyRegister = [
  {
    area: "完整三维尘埃",
    known: "太阳附近与部分银河盘视线有距离分层观测约束。",
    unknown: "不存在可从银河任意内部位置直接查询的全银河三维尘埃真值。",
    policy: "拼接观测后验与结构模型，输出模型集合的亮度区间；禁止标成确定地图。",
  },
  {
    area: "银河棒与外盘拼接",
    known: "棒的总体质量、图样角速度和内银河运动学有观测约束。",
    unknown: "不同文献模型采用的盘、核球和中心质量定义并不天然兼容。",
    policy: "在密度分量层面替换并全局重拟合；参考历元、棒主轴相位和带符号图样角速度必须绑定到同一制品。",
  },
  {
    area: "核星团与最中心族群",
    known: "总质量、尺度和部分恒星轨道有较强约束。",
    unknown: "暗弱恒星的完整光度函数、三维结构和族群梯度仍有系统误差。",
    policy: "建立多个候选模型；在模型间差异收敛前，中心视点只输出不确定性范围。",
  },
  {
    area: "人眼观测",
    known: "明视觉、暗视觉和中间视觉的标准光谱效率曲线可用。",
    unknown: "极暗扩展源、个体暗适应和显示设备共同造成的可见阈值不是单一星等常数。",
    policy: "从点源光谱辐照度、弥散光谱辐亮度和局部背景出发，显式记录适应状态与显示标定，不用曝光滑杆冒充暗适应。",
  },
  {
    area: "观察者局部环境",
    known: "银河坐标只确定观察者在银河中的位置，不能决定当地是否存在行星大气、舱窗、气辉或光污染。",
    unknown: "没有额外输入时，所谓“一个人站在那里”并不存在唯一的眼前天空。",
    policy: "默认定义为真空、无大气、无气辉、无光污染且透明视窗透射率为 1；地球地面验证使用单独的大气分支。",
  },
  {
    area: "光传播时间",
    known: "恒星光和散射光以有限光速传播，运动观察者还会测到像差与多普勒变化。",
    unknown: "全银河光锥求解器、散射多段延迟和相应误差预算尚未接入。",
    policy: "生产门禁保持关闭；任何同刻快照只能标为带时距误差上界的近似。",
  },
];

export const scienceBaseline = {
  version: "0.3.0-renderer-kernel",
  releasedAt: "2026-08-23",
  claim: "物理模型、数据架构与确定性渲染核；尚未生成任意位置银河星空预测",
  coordinateSystem: {
    origin: "银河中心",
    xAxis: "银河盘面内，正方向由太阳一侧指向银河中心；默认太阳位于负横向坐标",
    yAxis: "太阳位置处的银河旋转方向，与其余坐标轴构成右手系",
    zAxis: "指向银河北极",
    lengthUnit: "秒差距",
    velocityUnit: "千米每秒",
    timeUnit: "百万年",
  },
  observerRangeParsec: { minimum: 100, maximum: 20_000 },
  solarAnchorParsec: 8_277,
  centralBlackHoleMassPosteriorMeanSolarMass: 4.297e6,
  rendererUnlocked: false,
  forbiddenDirectControls: [
    "星点数量",
    "银河辉光",
    "银河带宽度",
    "位置相关曝光",
    "预制天空插值",
  ],
};
