export const ACTIONS = {
  walking: {
    title: "自信走秀",
    clip: "walking",
    color: "#3ee0ff",
    once: false,
  },
  boxing: {
    title: "拳击",
    clip: "boxing",
    color: "#ff6b4a",
    once: false,
  },
  jiangnan: {
    title: "江南舞",
    clip: "jiangnan",
    color: "#ffc14d",
    once: false,
  },
  die: {
    title: "倒地",
    clip: "die",
    color: "#c9a6ff",
    once: true,
  },
  running: {
    title: "奔跑",
    clip: "running",
    color: "#3dffb0",
    once: false,
  },
  getup: {
    title: "起身",
    clip: "getup",
    color: "#ff4d9a",
    once: true,
  },
  dance: {
    title: "跳舞",
    clip: "dance",
    color: "#e86bff",
    once: false,
  },
  swing: {
    title: "摇摆舞步",
    clip: "swing",
    color: "#6ea8ff",
    once: false,
  },
};

export const GESTURE_TO_ACTION = {
  ok: "walking",
  fist: "boxing",
  peace: "jiangnan",
  gun: "die",
  slap: "running",
  middle: "getup",
  ily: "dance",
  piano: "swing",
};

export const GESTURE_NAMES = {
  ok: "OK",
  middle: "竖中指",
  fist: "握拳",
  peace: "比耶",
  gun: "手枪",
  slap: "手掌拍下",
  beckon: "掌心向上勾手指",
  ily: "拇指食指小指",
  piano: "掌心朝下轮指",
  palm: "张开手掌",
  point: "食指",
  circle: "食指画圈",
  none: "等待手势",
};

export const PROGRAMS = {
  walking: [
    {
      file: "stage/boot.ts",
      body: `defaultClip = "walking"\nload("walking.glb")\n`,
    },
    {
      file: "clips/walking.ts",
      body: `mixer.fadeTo("walking", 0.45)\nloop("repeat")\npinHips()`,
    },
    {
      file: "gate/stable.ts",
      body: `if (stableFor(480)) {\n  commit(action)\n}\nrejectFlicker()`,
    },
    {
      file: "stage/idle.ts",
      body: `play("walking")\nuserScale = 1\nfacing.front()`,
    },
  ],
  boxing: [
    {
      file: "gesture/fist.ts",
      body: `match("fist")\n  .hold(480)\n  .only("boxing")`,
    },
    {
      file: "clips/boxing.ts",
      body: `load("boxing.glb")\nmixer.fadeTo("boxing", 0.45)\nloop("repeat")`,
    },
    {
      file: "gate/stable.ts",
      body: `if (stableFor(480)) {\n  commit("boxing")\n}\noneGestureOneAction()`,
    },
    {
      file: "stage/box.ts",
      body: `play("Boxing_Practice")\npinHips()\nloop("repeat")`,
    },
  ],
  jiangnan: [
    {
      file: "gesture/peace.ts",
      body: `match("victory")\n  .hold(480)\n  .only("jiangnan")`,
    },
    {
      file: "clips/jiangnan.ts",
      body: `load("jiangnan_dance.glb")\nmixer.fadeTo("jiangnan", 0.45)\nloop("repeat")`,
    },
    {
      file: "gate/stable.ts",
      body: `if (stableFor(480)) {\n  commit("jiangnan")\n}\nrejectFlicker()`,
    },
    {
      file: "stage/dance.ts",
      body: `play("Gangnam_Groove")\npinHips()\nloop("repeat")`,
    },
  ],
  die: [
    {
      file: "gesture/gun.ts",
      body: `match("gun")\n  .fingers("thumb", "index")\n  .only("die")`,
    },
    {
      file: "clips/die.ts",
      body: `load("die.glb")\nmixer.fadeTo("die", 0.35)\nholdLastFrame()`,
    },
    {
      file: "gate/stable.ts",
      body: `if (stableFor(480)) {\n  commit("die")\n}\noneGestureOneAction()`,
    },
    {
      file: "stage/down.ts",
      body: `play("Dead")\nonce()\npinHips()`,
    },
  ],
  running: [
    {
      file: "gesture/slap.ts",
      body: `palm.open()\nstroke.down()\n  .only("running")`,
    },
    {
      file: "clips/running.ts",
      body: `load("running.glb")\nmixer.fadeTo("running", 0.45)\nloop("repeat")`,
    },
    {
      file: "gate/stable.ts",
      body: `if (stableFor(480)) {\n  commit("running")\n}\nrejectFlicker()`,
    },
    {
      file: "stage/run.ts",
      body: `play("running")\npinHips()\nloop("repeat")`,
    },
  ],
  getup: [
    {
      file: "gesture/middle.ts",
      body: `match("middle")\n  .only("getup")`,
    },
    {
      file: "clips/getup.ts",
      body: `load("getup.glb")\nmixer.fadeTo("getup", 0.45)\nholdLastFrame()`,
    },
    {
      file: "gate/stable.ts",
      body: `if (stableFor(480)) {\n  commit("getup")\n}\noneGestureOneAction()`,
    },
    {
      file: "stage/rise.ts",
      body: `play("Arise")\nonce()\npinHips()`,
    },
  ],
  dance: [
    {
      file: "gesture/ily.ts",
      body: `match("ily")\n  .fingers("thumb", "index", "pinky")\n  .only("love_dance")`,
    },
    {
      file: "clips/love.ts",
      body: `load("love_dance.glb")\nmixer.fadeTo("dance", 0.45)\nloop("repeat")`,
    },
    {
      file: "gate/stable.ts",
      body: `if (stableFor(480)) {\n  commit("dance")\n}\nrejectFlicker()`,
    },
    {
      file: "stage/love.ts",
      body: `pinHips()\nplay("FunnyDancing_01")\nloop("repeat")`,
    },
  ],
  swing: [
    {
      file: "gesture/piano.ts",
      body: `palm.down()\nfingers.alternate()\n  .hold(480)\n  .only("swing")`,
    },
    {
      file: "clips/swing.ts",
      body: `load("swing_dance.glb")\nmixer.fadeTo("swing", 0.45)\nloop("repeat")`,
    },
    {
      file: "gate/stable.ts",
      body: `if (stableFor(480)) {\n  commit("swing")\n}\noneGestureOneAction()`,
    },
    {
      file: "stage/swing.ts",
      body: `pinHips()\nplay("Indoor_Swing")\nloop("repeat")`,
    },
  ],
};
