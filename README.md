# 云小闲 · 手势互动

用摄像头识别手势，驱动 `model-files` 里的角色和动画。默认循环播放自信走秀（`walking.glb`）。

## 本地打开

摄像头不能在 `file://` 下使用，需要本地静态服务器。

```bash
cd laoganbu-gesture-studio
python3 -m http.server 5173
```

也可以运行 `npm start`。然后用 Chrome 或 Edge 打开 [http://localhost:5173](http://localhost:5173)，点击「开启互动」并允许摄像头。

页面、角色和手势模型都放在本站，打开时不需要访问 Google 或 jsDelivr。

## 手势

同一个手势只对应一个反应。动作类手势需要稳住大约半秒才会切换。

| 手势 | 反应 |
| --- | --- |
| 默认 | 自信走秀 `walking.glb` |
| 握拳 | 拳击 `boxing.glb` |
| 比耶 | 江南舞 `jiangnan_dance.glb` |
| 食指 + 拇指手枪 | 倒地 `die.glb` |
| 手掌拍下 | 奔跑 `running.glb` |
| 掌心向上勾手指 | 起身 `getup.glb` |
| 拇指、食指、小指伸出 | 跳舞 `love_dance.glb` |
| 掌心朝下，手指交替弹奏 | 摇摆舞步 `swing_dance.glb` |
| 张开手掌，靠近或远离摄像头 | 放大或缩小 |
| 食指画圈 | 跟随转动，停止后平滑回正 |
