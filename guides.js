// Activities describe this site's models, not physical measurements.
export const experimentGuides={
  walk:{
    title:'试试看 · 走四倍的步数，会散开四倍吗？',
    values:{bias:0,seed:14},preset:'unbiased',
    instructions:'载入 16 步起点，记下理论散开程度 4。点“比较 64 步”，步数变为四倍，理论值却只变成 8。实测有波动。再把偏向改为 25%，比较同样 64 步：点云中心向右移动，但点云仍然在散开。两个比较按钮都会重建同种子状态并暂停。'
  },
  fractal:{
    title:'试试看 · 随机为什么留下空白？',
    values:{jump:50,seed:14},
    preset:'half',
    instructions:'从 300 点开始，点几次“增加 100 点”，或继续运行。中央的空三角形会被填满吗？再把种子从 14 改为 15，比较相同点数：具体落点不同，空隙的结构相似。最后把前进比例改成 65%，观察空隙怎样扩大。'
  },
  orbit:{
    title:'试试看 · 引力改变后，距离会怎样？',
    values:{gravity:80,speed:100},
    preset:'circular',
    instructions:'载入后，记下首颗行星距离 75。只把引力从 80 调到 40，再继续运行，观察距离是否增大。此时保留原速度；新行星速度滑块不会改变已有行星。再次载入可从同一起点重做。'
  },
  life:{
    title:'试试看 · 数量不变，图案也不变吗？',
    values:{rate:2,density:30},
    preset:'blinker',
    instructions:'载入三个相邻活格子，先看框选的左端：只有 1 个活邻居，下一代会消失。点“下一代 +1”验证；同一格变空后有 3 个活邻居，会在再下一代诞生。再前进一次，图案回到起点，重复周期为 2 代，数量始终是 3。聚焦画布后用方向键看别的格子；只移动，不改图案。'
  },
  wave:{
    title:'试试看 · 抵消的位置为什么很暗？',
    values:{wavelength:32,separation:100},
    preset:'ripple',
    probe:{x:8,y:0},
    instructions:'载入后，实线 A 走 58，虚线 B 走 42；相差 16，正好是半个波长（Δr / λ = 0.50）。看下方位移读数，再连续单步：A、B 大小相等、正负相抵，合成始终接近 0。聚焦画布按 Home（或点中央），A、B 变得相同；继续单步，合成时大时小，完整周期最大幅度为 1。再载入可重做。一次变暗不等于持续抵消。'
  }
};
