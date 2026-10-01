// Activities describe this site's models, not physical measurements.
export const experimentGuides={
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
    instructions:'载入三个相邻活格子。连续点两次“下一代 +1”，每次比较方向和活细胞数量。数量一直是 3，但图案在横、竖之间交替；第二代回到起点，观察区会显示重复周期 2 代。'
  },
  wave:{
    title:'试试看 · 抵消的位置为什么很暗？',
    values:{wavelength:32,separation:100},
    preset:'ripple',
    probe:{x:8,y:0},
    instructions:'载入后，白色探针处的 Δr / λ = 0.50，两波接近抵消。点“前进一步”观察这里的位移，再点击画布中央：中央的波程差为 0，两波加强。加强位置也会瞬间变暗；“加强”描述振幅，不保证每一刻都亮。'
  }
};
