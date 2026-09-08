# 大气中的星光闪烁

晴朗与轻雾模式加入随现实时间变化的恒星闪烁。各颗星使用固定、独立的相位与多频率起伏，避免整片天空同步呼吸；闪烁不移动星位，也不改变目录亮度。当地地平高度越低，大气路径越长，起伏越明显。无大气模式关闭此效果；照片、星云和银河连续背景不参与点源闪烁。

这是大气闪烁的有界显示近似，不是根据实测湍流剖面计算的波传播模型。幅度随相对大气质量增加；相机与近红外模式减弱起伏，表示时间平均和波段响应的定性差异，不对应某个已标定的快门时间。轻雾的消光单独计算，不把雾的多少等同于湍流强度。

闪烁使用现实时间，独立于银河运动模拟。可在“观察”里关闭；页面隐藏时停止重绘，并遵循系统的减少动态效果设置。正常情况下只重绘 GPU 恒星图层，每秒最多 30 次；不重复计算三维尘埃、银河背景、照片和地形。没有 WebGL 时使用同一明暗起伏函数降低频率绘制。

参考：

- [ESO：Why do stars twinkle / Adaptive optics](https://supernova.eso.org/exhibition/0818/?lang=en)：大气湍流影响星光传播。
- [Osborn et al. (2015), Atmospheric Scintillation in Astronomical Photometry](https://arxiv.org/abs/1506.06921)：闪烁与大气湍流、观测几何和曝光平均的关系。

实现见 `lib/rendering/stellar-scintillation.ts`、`lib/rendering/star-gpu.ts`。
