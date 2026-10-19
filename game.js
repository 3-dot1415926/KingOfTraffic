(function () {
  "use strict";

  const LANE_X = [-2.78, 0, 2.78];
  const MAX_SPEED = 380;
  const SPEEDO_MAX = 260;
  const BRAKE_LIMIT = 1612;
  const BRAKE_MAX = 1900;
  const SKILL_COST = { battery: 30, jump: 34, jet: 52 };
  const PLAYER_HALF_W = 0.9;
  const PLAYER_HALF_L = 1.95;
  const PLAYER_LIMIT = 4.45;
  const STEER_STEP = 1.55;
  const RAIL_SPARK_X = 3.88;

  const $ = (id) => document.getElementById(id);

  const dom = {
    game: $("game"),
    canvas: $("scene"),
    hud: $("hud"),
    welcome: $("welcome"),
    results: $("results"),
    endingBanner: $("endingBanner"),
    endingTag: $("endingTag"),
    endingTitle: $("endingTitle"),
    endingSub: $("endingSub"),
    score: $("scoreValue"),
    best: $("bestValue"),
    welcomeBest: $("welcomeBest"),
    speed: $("speedValue"),
    speedNeedle: $("speedNeedle"),
    speedo: $("speedo"),
    speedUnit: $("speedUnit"),
    fuelValue: $("fuelValue"),
    fuelFill: $("fuelFill"),
    fuelGauge: document.querySelector(".fuel-gauge"),
    integrityGauge: $("integrityGauge"),
    integrityValue: $("integrityValue"),
    integrityFill: $("integrityFill"),
    brakeValue: $("brakeValue"),
    brakeFill: $("brakeFill"),
    brakeGauge: $("brakeGauge"),
    skillPercent: $("skillPercent"),
    skillFill: $("skillFill"),
    rearWarning: $("rearWarning"),
    speedFx: $("speedFx"),
    hitFlash: $("hitFlash"),
    toast: $("toast"),
    floatLayer: $("floatLayer"),
    throttlePedal: $("throttlePedal"),
    brakePedal: $("brakePedal"),
    steerLeft: $("steerLeft"),
    steerRight: $("steerRight"),
    steeringWheel: $("steeringWheel"),
    hornBtn: $("hornBtn"),
    muteBtn: $("muteBtn"),
    startBtn: $("startBtn"),
    restartBtn: $("restartBtn"),
    homeBtn: $("homeBtn"),
    skillBattery: $("skillBattery"),
    skillJump: $("skillJump"),
    skillJet: $("skillJet"),
    finalScore: $("finalScore"),
    newBest: $("newBest"),
    resultDistance: $("resultDistance"),
    resultTime: $("resultTime"),
    resultSpeed: $("resultSpeed"),
    resultSkills: $("resultSkills"),
    resultTitle: $("resultTitle"),
    resultDesc: $("resultDesc"),
    resultEndingType: $("resultEndingType")
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));
  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const pick = (array) => array[Math.floor(Math.random() * array.length)];

  let highScore = 0;
  try {
    highScore = Number(localStorage.getItem("highwayKingHighScore") || 0) || 0;
  } catch (error) {
    highScore = 0;
  }

  let muted = false;
  try {
    muted = localStorage.getItem("highwayKingMuted") === "1";
  } catch (error) {
    muted = false;
  }

  const ENDINGS = {
    crash: {
      title: "车祸",
      tag: "普通结局",
      desc: "撞上车流的瞬间，公路之王的故事戛然而止。",
      sub: "高速上没有重来键",
      special: false,
      delay: 3.4
    },
    brake: {
      title: "踏板断裂",
      tag: "特殊结局",
      desc: "1612N。刹车踏板断裂，你连同整台车一起冲上了天空。",
      sub: "1612N 的最后一脚",
      special: true,
      delay: 3.9
    },
    fuel: {
      title: "燃料耗尽",
      tag: "普通结局",
      desc: "油表归零，引擎熄火。你被留在了这条没有尽头的公路上。",
      sub: "推着公路之王走下神坛",
      special: false,
      delay: 3.1
    },
    rear: {
      title: "我追他尾",
      tag: "特殊结局",
      desc: "后车从背后狠狠撞上来，你在车流中彻底失去控制。",
      sub: "被后车顶上了天际",
      special: true,
      delay: 3.6
    },
    rail: {
      title: "你醒啦？",
      tag: "特殊结局",
      desc: "护栏撕开车门，整台车翻出公路，在爆炸中把你叫醒。",
      sub: "护栏不是终点",
      special: true,
      delay: 3.6
    }
  };

  const game = {
    state: "welcome",
    elapsed: 0,
    score: 0,
    distance: 0,
    speed: 46,
    displaySpeed: 46,
    fuel: 100,
    integrity: 100,
    brakeForce: 0,
    skill: 22,
    topSpeed: 0,
    skillsUsed: 0,
    throttle: false,
    brake: false,
    targetX: 0,
    playerX: 0,
    playerY: 0,
    jumpMode: null,
    jumpTimer: 0,
    jumpDuration: 0,
    airVy: 0,
    invulnerable: 0,
    steerPulse: 0,
    wheelAngle: 0,
    shake: 0,
    endType: null,
    endTimer: 0,
    endDelay: 3.4,
    endLaunchVy: 0,
    endSpinX: 0,
    endSpinY: 0,
    endSpinZ: 0,
    endDriftX: 0,
    endDriftZ: 0,
    hornCooldown: 0,
    rearDanger: false,
    rearSpawnTimer: 10,
    spawnTimer: 1.2,
    demoTrafficTimer: 0,
    fuelHintShown: false,
    batterySide: 0,
    railSparkTimer: 0,
    damageSmokeTimer: 0,
    overdriveHintShown: false,
    newBest: false,
    scrollSpeed: 0,
    hudCache: {}
  };

  let time = 0;
  let npcs = [];
  let batteries = [];
  let pickups = [];
  let effects = [];
  let pendingEvents = [];
  let toastTimer = 0;
  let flashTimer = 0;
  let audio = null;

  const renderer = new THREE.WebGLRenderer({
    canvas: dom.canvas,
    antialias: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf29272, 72, 292);

  const camera = new THREE.PerspectiveCamera(57, 1, 0.1, 620);
  camera.position.set(0, 5.15, 14.2);
  camera.lookAt(0, 1.1, -18);

  const hemisphere = new THREE.HemisphereLight(0xffd0a1, 0x221d43, 1.9);
  scene.add(hemisphere);

  const sunLight = new THREE.DirectionalLight(0xffd7a4, 2.9);
  sunLight.position.set(-32, 46, 20);
  sunLight.target.position.set(0, 0, -30);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -26;
  sunLight.shadow.camera.right = 26;
  sunLight.shadow.camera.top = 34;
  sunLight.shadow.camera.bottom = -46;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 140;
  sunLight.shadow.bias = -0.0008;
  sunLight.shadow.normalBias = 0.025;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const rimLight = new THREE.DirectionalLight(0x5bc8ff, 1.15);
  rimLight.position.set(18, 16, -40);
  scene.add(rimLight);

  const fillLight = new THREE.DirectionalLight(0xa9c6ff, 1.4);
  fillLight.position.set(10, 13, 38);
  fillLight.target.position.set(0, 0.8, -8);
  scene.add(fillLight);
  scene.add(fillLight.target);

  const ambientFill = new THREE.AmbientLight(0x8d88b5, 0.6);
  scene.add(ambientFill);

  function makeRadialTexture(inner, middle, outer, size) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(0.36, middle);
    gradient.addColorStop(1, outer);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const fireTexture = makeRadialTexture("rgba(255,255,230,1)", "rgba(255,152,54,.95)", "rgba(255,52,18,0)", 128);
  const smokeTexture = makeRadialTexture("rgba(205,205,214,.62)", "rgba(59,58,70,.42)", "rgba(20,20,28,0)", 128);
  const glowTexture = makeRadialTexture("rgba(255,250,218,1)", "rgba(255,186,82,.6)", "rgba(255,120,40,0)", 128);
  const sparkTexture = makeRadialTexture("rgba(255,255,255,1)", "rgba(120,244,255,.9)", "rgba(44,190,255,0)", 64);
  const dustTexture = makeRadialTexture("rgba(255,225,180,.55)", "rgba(185,134,102,.28)", "rgba(110,80,65,0)", 64);

  function makeSkyTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#17143e");
    gradient.addColorStop(0.34, "#56336c");
    gradient.addColorStop(0.58, "#c65772");
    gradient.addColorStop(0.76, "#ff9161");
    gradient.addColorStop(1, "#ffd58c");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glow = ctx.createRadialGradient(268, 325, 0, 268, 325, 260);
    glow.addColorStop(0, "rgba(255,245,196,.95)");
    glow.addColorStop(0.12, "rgba(255,208,112,.72)");
    glow.addColorStop(0.45, "rgba(255,142,83,.22)");
    glow.addColorStop(1, "rgba(255,120,70,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 50; i++) {
      const x = rand(0, canvas.width);
      const y = rand(0, canvas.height * 0.44);
      ctx.fillStyle = `rgba(255,255,255,${rand(0.08, 0.34)})`;
      ctx.fillRect(x, y, rand(0.6, 1.8), rand(0.6, 1.8));
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return texture;
  }

  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(430, 32, 20),
    new THREE.MeshBasicMaterial({
      map: makeSkyTexture(),
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    })
  );
  scene.add(skyDome);

  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffd27a,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    })
  );
  sunSprite.position.set(-60, 44, -325);
  sunSprite.scale.set(165, 165, 1);
  scene.add(sunSprite);

  const mountainMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x2d234d, roughness: 1, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x443158, roughness: 1, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x5e3d61, roughness: 1, flatShading: true })
  ];

  for (let i = 0; i < 22; i++) {
    const height = rand(18, 58);
    const radius = rand(20, 48);
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(radius, height, randInt(4, 6)),
      mountainMaterials[i % mountainMaterials.length]
    );
    mountain.position.set((i - 11) * 33 + rand(-12, 12), height / 2 - 6, -275 - rand(0, 58));
    mountain.rotation.y = rand(0, Math.PI);
    scene.add(mountain);
  }

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 720),
    new THREE.MeshStandardMaterial({ color: 0x5a4144, roughness: 0.98, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.08, -230);
  ground.receiveShadow = true;
  scene.add(ground);

  const shoulderMaterial = new THREE.MeshStandardMaterial({ color: 0x765557, roughness: 0.95 });
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 470), shoulderMaterial);
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.set(side * 7.1, 0.005, -185);
    shoulder.receiveShadow = true;
    scene.add(shoulder);
  }

  function makeAsphaltTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 320;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#282830";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 3200; i++) {
      const shade = randInt(24, 72);
      ctx.fillStyle = `rgba(${shade},${shade},${shade + randInt(3, 12)},${rand(0.12, 0.45)})`;
      ctx.fillRect(rand(0, canvas.width), rand(0, canvas.height), rand(0.5, 2.2), rand(0.5, 2.6));
    }
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = `rgba(10,10,14,${rand(0.12, 0.3)})`;
      ctx.lineWidth = rand(0.5, 1.4);
      ctx.beginPath();
      const x = rand(0, canvas.width);
      const y = rand(0, canvas.height);
      ctx.moveTo(x, y);
      ctx.lineTo(x + rand(-12, 12), y + rand(8, 30));
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.2, 34);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const asphaltTexture = makeAsphaltTexture();
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(10.7, 470),
    new THREE.MeshStandardMaterial({
      color: 0xb7b3b8,
      map: asphaltTexture,
      roughness: 0.9,
      metalness: 0.04
    })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.012, -185);
  road.receiveShadow = true;
  scene.add(road);

  const lineMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff1cf,
    roughness: 0.55,
    emissive: 0xffdd9a,
    emissiveIntensity: 0.08
  });
  const edgeLineMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8e4b9,
    roughness: 0.62,
    emissive: 0xffce72,
    emissiveIntensity: 0.1
  });

  for (const side of [-1, 1]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 470), edgeLineMaterial);
    edge.position.set(side * 4.46, 0.035, -185);
    edge.receiveShadow = true;
    scene.add(edge);
  }

  const laneDashes = [];
  const dashGeometry = new THREE.BoxGeometry(0.13, 0.032, 3.6);
  for (const x of [-1.39, 1.39]) {
    for (let i = 0; i < 42; i++) {
      const dash = new THREE.Mesh(dashGeometry, lineMaterial);
      dash.position.set(x, 0.037, 42 - i * 10.7);
      dash.receiveShadow = true;
      scene.add(dash);
      laneDashes.push(dash);
    }
  }

  const railSegments = [];
  const railMaterial = new THREE.MeshStandardMaterial({ color: 0x8e8c91, metalness: 0.72, roughness: 0.35 });
  const postMaterial = new THREE.MeshStandardMaterial({ color: 0x45434a, metalness: 0.4, roughness: 0.55 });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 36; i++) {
      const group = new THREE.Group();
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 12.6), railMaterial);
      rail.position.y = 0.84;
      group.add(rail);
      for (const offset of [-5.3, 0, 5.3]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.1), postMaterial);
        post.position.set(0, 0.43, offset);
        group.add(post);
      }
      group.position.set(side * 5.84, 0, 42 - i * 12.7);
      scene.add(group);
      railSegments.push(group);
    }
  }

  const reflectors = [];
  const reflectorGeometry = new THREE.BoxGeometry(0.09, 0.08, 0.24);
  const reflectorMaterial = new THREE.MeshStandardMaterial({
    color: 0xffb13e,
    emissive: 0xff8a20,
    emissiveIntensity: 0.8,
    roughness: 0.4
  });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 38; i++) {
      const reflector = new THREE.Mesh(reflectorGeometry, reflectorMaterial);
      reflector.position.set(side * 5.15, 0.28, 38 - i * 11.4);
      scene.add(reflector);
      reflectors.push(reflector);
    }
  }

  function createPalm() {
    const group = new THREE.Group();
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6a4b2e, roughness: 0.9, flatShading: true });
    const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x2c725a, roughness: 0.8, flatShading: true });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.33, 5.2, 6), trunkMaterial);
    trunk.position.y = 2.6;
    trunk.rotation.z = rand(-0.08, 0.08);
    trunk.castShadow = true;
    group.add(trunk);
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.58, 2.9, 4), leafMaterial);
      leaf.position.set(Math.cos(i * 1.67) * 0.7, 5.1, Math.sin(i * 1.67) * 0.7);
      leaf.rotation.z = Math.PI / 2.25;
      leaf.rotation.y = i * 1.67;
      leaf.scale.y = 1.3;
      group.add(leaf);
    }
    group.scale.setScalar(rand(0.8, 1.25));
    return group;
  }

  function createCactus() {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0x38694e, roughness: 0.9, flatShading: true });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 3.3, 7), material);
    trunk.position.y = 1.65;
    group.add(trunk);
    const armA = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.5, 6), material);
    armA.position.set(0.55, 2.25, 0);
    armA.rotation.z = 1.1;
    group.add(armA);
    const armB = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.15, 6), material);
    armB.position.set(-0.46, 1.75, 0);
    armB.rotation.z = -1.1;
    group.add(armB);
    group.scale.setScalar(rand(0.8, 1.35));
    return group;
  }

  function createRock() {
    const material = new THREE.MeshStandardMaterial({ color: pick([0x6a4c4b, 0x785a53, 0x57424a]), roughness: 1, flatShading: true });
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.9, 2.1), 0), material);
    rock.position.y = 0.4;
    rock.rotation.set(rand(0, 1), rand(0, 3), rand(0, 1));
    rock.scale.set(rand(0.8, 1.6), rand(0.5, 1.1), rand(0.8, 1.5));
    const group = new THREE.Group();
    group.add(rock);
    return group;
  }

  function createLamp() {
    const group = new THREE.Group();
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2b34, metalness: 0.65, roughness: 0.38 });
    const lampMaterial = new THREE.MeshStandardMaterial({
      color: 0xffe2a1,
      emissive: 0xffb24a,
      emissiveIntensity: 2.1,
      roughness: 0.25
    });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 6.2, 6), poleMaterial);
    pole.position.y = 3.1;
    group.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.12), poleMaterial);
    arm.position.set(-0.8, 6.1, 0);
    group.add(arm);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.34), lampMaterial);
    lamp.position.set(-1.72, 6.0, 0);
    group.add(lamp);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xffbf62,
        transparent: true,
        opacity: 0.26,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    glow.position.set(-1.72, 6.0, 0);
    glow.scale.set(2.6, 2.6, 1);
    group.add(glow);
    return group;
  }

  function makeBillboardTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#141119";
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = "#ffca52";
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, 488, 232);
    ctx.fillStyle = "#ffcb52";
    ctx.font = "900 74px 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("公路之王", 256, 122);
    ctx.fillStyle = "rgba(255,243,216,.55)";
    ctx.font = "700 22px Arial, sans-serif";
    ctx.letterSpacing = "6px";
    ctx.fillText("KING OF THE HIGHWAY", 256, 180);
    ctx.fillStyle = "#ff6b35";
    ctx.fillRect(78, 203, 356, 7);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const billboardTexture = makeBillboardTexture();

  function createBillboard() {
    const group = new THREE.Group();
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x34313c, metalness: 0.55, roughness: 0.5 });
    for (const x of [-1.1, 1.1]) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.4, 0.18), poleMaterial);
      pole.position.set(x, 2.2, 0);
      group.add(pole);
    }
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(4.7, 2.35),
      new THREE.MeshStandardMaterial({
        map: billboardTexture,
        emissive: 0xffffff,
        emissiveMap: billboardTexture,
        emissiveIntensity: 0.18,
        roughness: 0.62
      })
    );
    board.position.set(0, 4.25, 0);
    group.add(board);
    return group;
  }

  const props = [];
  for (let i = 0; i < 28; i++) {
    const roll = Math.random();
    let prop;
    if (roll < 0.32) prop = createPalm();
    else if (roll < 0.5) prop = createCactus();
    else if (roll < 0.68) prop = createRock();
    else if (roll < 0.91) prop = createLamp();
    else prop = createBillboard();
    const side = Math.random() < 0.5 ? -1 : 1;
    prop.position.set(side * rand(7.8, 15.5), 0, 44 - i * 15.6 + rand(-4, 4));
    prop.rotation.y = side < 0 ? rand(-0.2, 0.4) : Math.PI + rand(-0.4, 0.2);
    scene.add(prop);
    props.push(prop);
  }

  const shared = {
    tire: new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.92, metalness: 0.02 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.26, metalness: 0.82 }),
    rimDark: new THREE.MeshStandardMaterial({ color: 0x3d3d45, roughness: 0.4, metalness: 0.7 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x15232c, roughness: 0.13, metalness: 0.78, flatShading: true }),
    dark: new THREE.MeshStandardMaterial({ color: 0x16161d, roughness: 0.58, metalness: 0.24, flatShading: true }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xb8b4aa, roughness: 0.24, metalness: 0.9 }),
    truckBed: new THREE.MeshStandardMaterial({ color: 0x8f8b84, roughness: 0.72, metalness: 0.22, flatShading: true }),
    hazard: new THREE.MeshStandardMaterial({ color: 0xff7b21, emissive: 0xa8370c, emissiveIntensity: 0.32, roughness: 0.52 })
  };
  const sharedMaterials = new Set(Object.values(shared));

  function addBox(parent, width, height, depth, material, x, y, z, castShadow) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow !== false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addWheel(parent, x, y, z, radius, width) {
    const wheel = new THREE.Group();
    wheel.position.set(x, y, z);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 12), shared.tire);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheel.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width * 1.05, 10), shared.rim);
    rim.rotation.z = Math.PI / 2;
    wheel.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, width * 1.1, 8), shared.rimDark);
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);
    wheel.userData.radius = radius;
    parent.add(wheel);
    return wheel;
  }

  function makeLightMaterial(color, intensity) {
    return new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.3,
      metalness: 0.18
    });
  }

  function addRearLights(group, x, y, z, indicatorX) {
    const tailMaterial = makeLightMaterial(0xff2938, 1.1);
    const leftTail = addBox(group, 0.34, 0.14, 0.06, tailMaterial, -x, y, z, false);
    const rightTail = addBox(group, 0.34, 0.14, 0.06, tailMaterial, x, y, z, false);
    const indicatorMaterialL = makeLightMaterial(0xff961f, 0.05);
    const indicatorMaterialR = makeLightMaterial(0xff961f, 0.05);
    const indL = addBox(group, 0.19, 0.13, 0.07, indicatorMaterialL, -indicatorX, y + 0.02, z + 0.005, false);
    const indR = addBox(group, 0.19, 0.13, 0.07, indicatorMaterialR, indicatorX, y + 0.02, z + 0.005, false);
    return {
      tailMats: [tailMaterial],
      indicatorL: { mesh: indL, material: indicatorMaterialL },
      indicatorR: { mesh: indR, material: indicatorMaterialR },
      tails: [leftTail, rightTail]
    };
  }

  function buildSedan(paintColor, options) {
    const opts = options || {};
    const group = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({
      color: paintColor,
      metalness: 0.56,
      roughness: 0.32,
      flatShading: true
    });
    const paintDark = new THREE.MeshStandardMaterial({
      color: new THREE.Color(paintColor).multiplyScalar(0.55),
      metalness: 0.5,
      roughness: 0.4,
      flatShading: true
    });
    const accent = new THREE.MeshStandardMaterial({
      color: opts.accentColor || 0xffd36b,
      metalness: 0.62,
      roughness: 0.28,
      flatShading: true
    });

    addBox(group, 1.94, 0.42, 4.16, paint, 0, 0.59, 0);
    addBox(group, 1.82, 0.15, 3.86, paintDark, 0, 0.34, 0);
    addBox(group, 1.78, 0.17, 1.45, paint, 0, 0.85, -1.3);
    addBox(group, 1.78, 0.19, 1.12, paint, 0, 0.86, 1.42);
    addBox(group, 1.5, 0.48, 1.82, shared.glass, 0, 1.04, 0.12);
    addBox(group, 1.4, 0.09, 1.53, paint, 0, 1.32, 0.18);
    addBox(group, 0.08, 0.47, 0.12, paintDark, -0.73, 1.03, -0.5);
    addBox(group, 0.08, 0.47, 0.12, paintDark, 0.73, 1.03, -0.5);
    addBox(group, 0.08, 0.47, 0.12, paintDark, -0.73, 1.03, 0.82);
    addBox(group, 0.08, 0.47, 0.12, paintDark, 0.73, 1.03, 0.82);
    addBox(group, 1.37, 0.26, 0.05, shared.glass, 0, 1.02, -0.79);
    addBox(group, 1.34, 0.23, 0.05, shared.glass, 0, 1.02, 1.04);
    addBox(group, 1.86, 0.12, 0.34, shared.dark, 0, 0.42, -2.04);
    addBox(group, 1.84, 0.1, 0.26, shared.dark, 0, 0.46, 2.05);
    addBox(group, 0.78, 0.16, 0.06, shared.dark, 0, 0.68, -2.095);
    addBox(group, 0.06, 0.08, 1.55, shared.chrome, -0.975, 0.74, -0.62, false);
    addBox(group, 0.06, 0.08, 1.55, shared.chrome, 0.975, 0.74, -0.62, false);

    const headMaterial = makeLightMaterial(0xfff3c3, 1.8);
    addBox(group, 0.52, 0.14, 0.06, headMaterial, -0.59, 0.72, -2.09, false);
    addBox(group, 0.52, 0.14, 0.06, headMaterial, 0.59, 0.72, -2.09, false);

    if (opts.stripes) {
      addBox(group, 0.13, 0.022, 1.5, accent, -0.33, 0.945, -1.3, false);
      addBox(group, 0.13, 0.022, 1.5, accent, 0.33, 0.945, -1.3, false);
      addBox(group, 0.13, 0.022, 1.15, accent, -0.33, 0.94, 1.43, false);
      addBox(group, 0.13, 0.022, 1.15, accent, 0.33, 0.94, 1.43, false);
      addBox(group, 1.28, 0.016, 0.12, accent, 0, 1.37, -0.37, false);
    }

    if (opts.spoiler) {
      addBox(group, 0.09, 0.32, 0.11, paintDark, -0.59, 1.02, 1.72, false);
      addBox(group, 0.09, 0.32, 0.11, paintDark, 0.59, 1.02, 1.72, false);
      addBox(group, 1.5, 0.09, 0.42, paintDark, 0, 1.22, 1.76, false);
      addBox(group, 1.34, 0.04, 0.34, accent, 0, 1.28, 1.77, false);
    }

    const wheels = [
      addWheel(group, -0.94, 0.38, -1.3, 0.36, 0.28),
      addWheel(group, 0.94, 0.38, -1.3, 0.36, 0.28),
      addWheel(group, -0.94, 0.38, 1.34, 0.36, 0.28),
      addWheel(group, 0.94, 0.38, 1.34, 0.36, 0.28)
    ];

    const rearLights = addRearLights(group, 0.56, 0.73, 2.11, 0.79);

    if (opts.underglow) {
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(2.45, 4.2),
        new THREE.MeshBasicMaterial({
          color: 0x38dcff,
          transparent: true,
          opacity: 0.2,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.055;
      group.add(glow);
    }

    return {
      group,
      wheels,
      halfW: 0.98,
      halfL: 2.12,
      indicators: [rearLights.indicatorL, rearLights.indicatorR],
      tailMats: rearLights.tailMats
    };
  }

  function addTruckCab(group, paint, z) {
    addBox(group, 2.12, 0.3, 8.2, shared.dark, 0, 0.55, 0.1);
    addBox(group, 2.16, 1.68, 2.55, paint, 0, 1.43, z);
    addBox(group, 1.96, 0.56, 0.06, shared.glass, 0, 1.73, z - 1.31);
    addBox(group, 1.68, 0.45, 0.06, shared.glass, 0, 1.61, z + 1.3);
    addBox(group, 2.2, 0.18, 0.3, shared.chrome, 0, 0.52, z - 1.34);
    addBox(group, 2.17, 0.15, 0.22, shared.dark, 0, 0.92, z - 1.31);
    addBox(group, 1.86, 0.23, 0.06, shared.dark, 0, 1.93, z - 1.33, false);
    addBox(group, 0.55, 0.16, 0.06, makeLightMaterial(0xfff0bd, 1.3), -0.69, 0.97, z - 1.35, false);
    addBox(group, 0.55, 0.16, 0.06, makeLightMaterial(0xfff0bd, 1.3), 0.69, 0.97, z - 1.35, false);
    addBox(group, 2.24, 0.4, 0.24, shared.chrome, 0, 0.36, z - 1.35);
    for (const x of [-0.58, 0.58]) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.7, 6), shared.chrome);
      stack.position.set(x, 1.42, z + 1.36);
      group.add(stack);
    }
  }

  function buildTruck(paintColor) {
    const group = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: paintColor, metalness: 0.46, roughness: 0.38, flatShading: true });
    addTruckCab(group, paint, -3.0);
    addBox(group, 2.34, 2.55, 5.25, shared.truckBed, 0, 2.05, 1.28);
    addBox(group, 2.36, 0.22, 5.3, paint, 0, 3.35, 1.28);
    addBox(group, 2.38, 0.32, 0.16, paint, 0, 0.83, 3.91);
    addBox(group, 0.6, 1.75, 0.08, shared.dark, -0.58, 2.05, 3.93, false);
    addBox(group, 0.6, 1.75, 0.08, shared.dark, 0.58, 2.05, 3.93, false);
    addBox(group, 2.2, 0.14, 0.08, shared.chrome, 0, 1.1, 3.95, false);
    const wheels = [
      addWheel(group, -1.05, 0.43, -3.0, 0.43, 0.32),
      addWheel(group, 1.05, 0.43, -3.0, 0.43, 0.32),
      addWheel(group, -1.05, 0.43, 1.12, 0.43, 0.32),
      addWheel(group, 1.05, 0.43, 1.12, 0.43, 0.32),
      addWheel(group, -1.05, 0.43, 2.52, 0.43, 0.32),
      addWheel(group, 1.05, 0.43, 2.52, 0.43, 0.32)
    ];
    const rearLights = addRearLights(group, 0.8, 1.03, 4.01, 1.0);
    return {
      group,
      wheels,
      halfW: 1.2,
      halfL: 4.05,
      indicators: [rearLights.indicatorL, rearLights.indicatorR],
      tailMats: rearLights.tailMats
    };
  }

  function buildTanker(paintColor) {
    const group = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: paintColor, metalness: 0.5, roughness: 0.32, flatShading: true });
    const tankMaterial = new THREE.MeshStandardMaterial({ color: 0xc7c1b3, metalness: 0.7, roughness: 0.27, flatShading: true });
    addTruckCab(group, paint, -3.0);
    addBox(group, 2.1, 0.26, 7.8, shared.dark, 0, 0.58, 0.4);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 5.7, 18), tankMaterial);
    tank.rotation.x = Math.PI / 2;
    tank.position.set(0, 1.92, 1.12);
    tank.castShadow = true;
    group.add(tank);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.17, 1.17, 0.48, 18), shared.hazard);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, 1.92, 1.1);
    group.add(band);
    const bandTwo = band.clone();
    bandTwo.position.z = 2.24;
    group.add(bandTwo);
    for (const z of [-1.24, 1.08, 3.3]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.055, 6, 18), shared.chrome);
      ring.position.set(0, 1.92, z);
      group.add(ring);
    }
    const diamond = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.8),
      new THREE.MeshBasicMaterial({ color: 0xff8b22, side: THREE.DoubleSide })
    );
    diamond.rotation.z = Math.PI / 4;
    diamond.position.set(0, 1.92, 3.42);
    group.add(diamond);
    addBox(group, 2.06, 0.18, 0.16, shared.dark, 0, 3.72, 3.43, false);
    const wheels = [
      addWheel(group, -1.05, 0.43, -3.0, 0.43, 0.32),
      addWheel(group, 1.05, 0.43, -3.0, 0.43, 0.32),
      addWheel(group, -1.05, 0.43, 1.05, 0.43, 0.32),
      addWheel(group, 1.05, 0.43, 1.05, 0.43, 0.32),
      addWheel(group, -1.05, 0.43, 2.5, 0.43, 0.32),
      addWheel(group, 1.05, 0.43, 2.5, 0.43, 0.32)
    ];
    const rearLights = addRearLights(group, 0.82, 0.96, 3.5, 1.02);
    return {
      group,
      wheels,
      halfW: 1.22,
      halfL: 3.5,
      indicators: [rearLights.indicatorL, rearLights.indicatorR],
      tailMats: rearLights.tailMats,
      special: "tanker"
    };
  }

  function buildFlatbed(paintColor) {
    const group = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: paintColor, metalness: 0.45, roughness: 0.4, flatShading: true });
    const rampMaterial = new THREE.MeshStandardMaterial({ color: 0x5e5d61, metalness: 0.55, roughness: 0.48, flatShading: true });
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xff8b22,
      emissive: 0xd94b0d,
      emissiveIntensity: 0.5,
      roughness: 0.4
    });
    addTruckCab(group, paint, -3.1);
    addBox(group, 2.44, 0.28, 6.2, shared.truckBed, 0, 0.96, 1.5);
    addBox(group, 2.46, 0.22, 0.5, paint, 0, 1.13, 4.38);
    addBox(group, 0.12, 0.64, 6.2, paint, -1.18, 1.28, 1.5, false);
    addBox(group, 0.12, 0.64, 6.2, paint, 1.18, 1.28, 1.5, false);
    for (const z of [0.8, 2.1, 3.45]) {
      addBox(group, 2.2, 0.08, 0.08, shared.chrome, 0, 1.42, z, false);
    }
    const rampPivot = new THREE.Group();
    rampPivot.position.set(0, 1.62, 2.98);
    group.add(rampPivot);
    const ramp = addBox(rampPivot, 2.52, 0.13, 4.35, rampMaterial, 0, 0, 2.0);
    addBox(rampPivot, 0.08, 0.2, 4.35, edgeMaterial, -1.24, 0.08, 2.0, false);
    addBox(rampPivot, 0.08, 0.2, 4.35, edgeMaterial, 1.24, 0.08, 2.0, false);
    addBox(rampPivot, 2.52, 0.05, 0.32, edgeMaterial, 0, 0.1, 4.05, false);
    rampPivot.rotation.x = -0.035;
    const support = addBox(group, 1.9, 0.12, 1.2, shared.dark, 0, 1.65, 3.3, false);
    support.rotation.x = -0.02;
    const wheels = [
      addWheel(group, -1.06, 0.43, -3.1, 0.43, 0.32),
      addWheel(group, 1.06, 0.43, -3.1, 0.43, 0.32),
      addWheel(group, -1.06, 0.43, 0.55, 0.43, 0.32),
      addWheel(group, 1.06, 0.43, 0.55, 0.43, 0.32),
      addWheel(group, -1.06, 0.43, 2.5, 0.43, 0.32),
      addWheel(group, 1.06, 0.43, 2.5, 0.43, 0.32)
    ];
    const lights = addRearLights(group, 0.84, 1.12, 4.48, 1.02);
    return {
      group,
      wheels,
      halfW: 1.28,
      halfL: 6.35,
      indicators: [lights.indicatorL, lights.indicatorR],
      tailMats: lights.tailMats,
      rampPivot,
      rampReady: false,
      special: "flatbed"
    };
  }

  function buildHopper(paintColor) {
    const group = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: paintColor, metalness: 0.42, roughness: 0.42, flatShading: true });
    const hopperMaterial = new THREE.MeshStandardMaterial({ color: 0x8b8a7c, metalness: 0.35, roughness: 0.56, flatShading: true });
    const tarpMaterial = new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.86, metalness: 0.04, flatShading: true });
    addTruckCab(group, paint, -3.0);
    addBox(group, 2.08, 0.28, 7.7, shared.dark, 0, 0.57, 0.55);
    addBox(group, 2.38, 1.34, 4.8, hopperMaterial, 0, 1.72, 0.95);
    const sideLeft = addBox(group, 0.18, 1.56, 4.9, paint, -1.15, 1.28, 0.95, false);
    sideLeft.rotation.z = -0.24;
    const sideRight = addBox(group, 0.18, 1.56, 4.9, paint, 1.15, 1.28, 0.95, false);
    sideRight.rotation.z = 0.24;
    addBox(group, 2.36, 0.12, 4.95, tarpMaterial, 0, 2.46, 0.95);
    addBox(group, 1.84, 0.18, 0.16, shared.chrome, 0, 2.54, -1.3, false);
    addBox(group, 2.4, 0.28, 0.22, paint, 0, 0.82, 3.5);
    addBox(group, 1.9, 0.95, 0.18, shared.dark, 0, 1.25, 3.62, false);
    const hazard = new THREE.MeshStandardMaterial({
      color: 0xff9a2f,
      emissive: 0x8d3208,
      emissiveIntensity: 0.28,
      roughness: 0.55
    });
    addBox(group, 1.92, 0.1, 0.04, hazard, 0, 1.6, 3.72, false);
    addBox(group, 1.92, 0.1, 0.04, hazard, 0, 1.24, 3.72, false);
    addBox(group, 0.64, 0.78, 0.52, shared.dark, 0, 0.94, 3.9, false);
    addBox(group, 0.5, 0.16, 0.56, hazard, 0, 1.36, 3.9, false);
    const wheels = [
      addWheel(group, -1.03, 0.43, -3.0, 0.43, 0.32),
      addWheel(group, 1.03, 0.43, -3.0, 0.43, 0.32),
      addWheel(group, -1.03, 0.43, 0.72, 0.43, 0.32),
      addWheel(group, 1.03, 0.43, 0.72, 0.43, 0.32),
      addWheel(group, -1.03, 0.43, 2.48, 0.43, 0.32),
      addWheel(group, 1.03, 0.43, 2.48, 0.43, 0.32)
    ];
    const lights = addRearLights(group, 0.84, 1.0, 4.17, 1.02);
    return {
      group,
      wheels,
      halfW: 1.22,
      halfL: 4.15,
      indicators: [lights.indicatorL, lights.indicatorR],
      tailMats: lights.tailMats,
      special: "hopper"
    };
  }

  const playerRoot = new THREE.Group();
  scene.add(playerRoot);
  const playerVehicle = buildSedan(0x2f7dff, {
    stripes: true,
    spoiler: true,
    underglow: true,
    accentColor: 0xffcf5a
  });
  playerRoot.add(playerVehicle.group);
  playerRoot.position.set(0, 0, 0);

  const jetFlames = [];
  for (const x of [-0.48, 0.48]) {
    const flame = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: fireTexture,
        color: 0x6befff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    flame.position.set(x, -0.35, 2.0);
    flame.scale.set(0.7, 1.8, 1);
    flame.visible = false;
    playerRoot.add(flame);
    jetFlames.push(flame);
  }

  const playerGlowLight = new THREE.PointLight(0x3edcff, 0, 5.2, 2);
  playerGlowLight.position.set(0, 0.3, 0.3);
  playerRoot.add(playerGlowLight);

  function createVehicle(type, paintColor) {
    if (type === "truck") return buildTruck(paintColor);
    if (type === "tanker") return buildTanker(paintColor);
    if (type === "flatbed") return buildFlatbed(paintColor);
    if (type === "hopper") return buildHopper(paintColor);
    return buildSedan(paintColor, {});
  }

  const NPC_COLORS = [0xd54b3e, 0xd8d0bf, 0x393f4e, 0x2e8583, 0x745095, 0x4f7e4e, 0xc88c3e, 0x7d8fa8];
  const TRUCK_COLORS = [0x9a5944, 0x456474, 0x8d7f5e];

  function makeNPC(type, lane, z, speed, isRear) {
    const vehicle = createVehicle(type, type === "sedan" ? pick(NPC_COLORS) : pick(TRUCK_COLORS));
    vehicle.group.position.set(LANE_X[lane], 0, z);
    scene.add(vehicle.group);
    const npc = {
      type,
      lane,
      targetLane: lane,
      x: LANE_X[lane],
      z,
      targetX: LANE_X[lane],
      speed,
      baseSpeed: speed,
      halfW: vehicle.halfW,
      halfL: vehicle.halfL,
      group: vehicle.group,
      wheels: vehicle.wheels,
      indicators: vehicle.indicators,
      tailMats: vehicle.tailMats,
      rampPivot: vehicle.rampPivot || null,
      rampReady: false,
      signalOn: false,
      signalSide: 0,
      braking: 0,
      actionTimer: rand(1.2, 3.5),
      aggressionUntil: 0,
      isRear: Boolean(isRear),
      passed: false,
      lastZ: z,
      special: vehicle.special || null,
      hintShown: false,
      dropTimer: rand(2.2, 4.6),
      wreck: false,
      wreckAge: 0,
      smokeTimer: 0
    };
    npcs.push(npc);
    return npc;
  }

  function disposeObject(object) {
    object.traverse((child) => {
      if (child.isMesh || child.isSprite) {
        if (child.isMesh && child.geometry) child.geometry.dispose();
        if (child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => {
            if (sharedMaterials.has(material)) return;
            if (material.userData && material.userData.disposeMap && material.map) material.map.dispose();
            material.dispose();
          });
        }
      }
    });
  }

  function removeNPC(npc) {
    const index = npcs.indexOf(npc);
    if (index >= 0) npcs.splice(index, 1);
    if (npc.group.parent) npc.group.parent.remove(npc.group);
    disposeObject(npc.group);
  }

  function spawnNPC(options) {
    const opts = options || {};
    if (npcs.length >= 13) return null;
    let type = opts.type;
    if (!type) {
      const roll = Math.random();
      if (roll < 0.08) type = "tanker";
      else if (roll < 0.2) type = "flatbed";
      else if (roll < 0.32) type = "hopper";
      else if (roll < 0.5) type = "truck";
      else type = "sedan";
    }
    let lane = opts.lane;
    if (lane === undefined) {
      const candidates = [0, 1, 2].sort(() => Math.random() - 0.5);
      lane = candidates.find((candidate) => {
        return !npcs.some((npc) => npc.lane === candidate && Math.abs(npc.z - (opts.z || -120)) < 18);
      });
      if (lane === undefined) lane = randInt(0, 2);
    }
    const z = opts.z !== undefined ? opts.z : opts.rear ? rand(19, 34) : rand(-172, -128);
    const base = opts.speed !== undefined ? opts.speed : clamp(game.speed - rand(18, 58), 32, 132);
    const speed = opts.rear ? clamp(game.speed + rand(24, 48), 62, 282) : base;
    if (npcs.some((npc) => npc.lane === lane && Math.abs(npc.z - z) < 15.5)) return null;
    const npc = makeNPC(type, lane, z, speed, opts.rear);
    if (opts.rear) npc.isRear = true;
    return npc;
  }

  function spawnInitialTraffic() {
    makeNPC("sedan", 0, -38, clamp(game.speed - rand(18, 28), 34, 70));
    makeNPC("sedan", 2, -56, clamp(game.speed - rand(26, 42), 30, 64));
    makeNPC("truck", 1, -78, clamp(game.speed - rand(36, 52), 28, 58));
    makeNPC("sedan", 1, -112, clamp(game.speed - rand(22, 38), 32, 64));
    makeNPC("flatbed", 0, -145, clamp(game.speed - rand(40, 55), 28, 52));
    makeNPC("hopper", 2, -162, clamp(game.speed - rand(15, 30), 36, 70));
    makeNPC("tanker", 1, -196, clamp(game.speed - rand(28, 45), 32, 62));
  }

  function clearNPCs() {
    for (const npc of npcs.slice()) {
      if (npc.group.parent) npc.group.parent.remove(npc.group);
      disposeObject(npc.group);
    }
    npcs = [];
  }

  function resetBatteries() {
    for (const battery of batteries) {
      if (battery.group.parent) battery.group.parent.remove(battery.group);
      disposeObject(battery.group);
    }
    batteries = [];
  }

  function clearPickups() {
    for (const pickup of pickups) {
      if (pickup.group.parent) pickup.group.parent.remove(pickup.group);
      disposeObject(pickup.group);
    }
    pickups = [];
  }

  function clearEffects() {
    for (const effect of effects) {
      if (effect.object && effect.object.parent) effect.object.parent.remove(effect.object);
      if (effect.object) disposeObject(effect.object);
    }
    effects = [];
  }

  function addEvent(delay, callback) {
    pendingEvents.push({ time: time + delay, callback });
  }

  function processEvents() {
    for (let i = pendingEvents.length - 1; i >= 0; i--) {
      if (time >= pendingEvents[i].time) {
        const event = pendingEvents.splice(i, 1)[0];
        event.callback();
      }
    }
  }

  function setPedalVisual(element, pressed) {
    element.classList.toggle("is-pressed", pressed);
  }

  function setThrottle(value) {
    if (game.state !== "running" && value) return;
    game.throttle = value;
    setPedalVisual(dom.throttlePedal, value);
  }

  function setBrake(value) {
    if (game.state !== "running" && value) return;
    game.brake = value;
    setPedalVisual(dom.brakePedal, value);
  }

  function changeLane(direction) {
    if (game.state !== "running") return;
    const proposed = game.targetX + direction * STEER_STEP;
    const atEdge = game.jumpMode === null && (direction > 0 ? game.playerX >= PLAYER_LIMIT - 0.14 : game.playerX <= -PLAYER_LIMIT + 0.14);
    if (proposed > PLAYER_LIMIT) {
      if (atEdge) {
        endGame("rail", { side: 1 });
        return;
      }
      game.targetX = PLAYER_LIMIT;
    } else if (proposed < -PLAYER_LIMIT) {
      if (atEdge) {
        endGame("rail", { side: -1 });
        return;
      }
      game.targetX = -PLAYER_LIMIT;
    } else {
      game.targetX = proposed;
    }
    game.steerPulse = direction;
    playSound("lane");
  }

  function bindHold(element, onDown, onUp) {
    let pointerId = null;
    element.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (pointerId !== null) return;
      pointerId = event.pointerId;
      try {
        element.setPointerCapture(pointerId);
      } catch (error) {
        pointerId = null;
      }
      onDown();
    });
    const release = (event) => {
      if (pointerId === null) return;
      if (event && event.pointerId !== undefined && event.pointerId !== pointerId) return;
      pointerId = null;
      onUp();
    };
    element.addEventListener("pointerup", release);
    element.addEventListener("pointercancel", release);
    element.addEventListener("lostpointercapture", release);
    element.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  bindHold(dom.throttlePedal, () => setThrottle(true), () => setThrottle(false));
  bindHold(dom.brakePedal, () => setBrake(true), () => setBrake(false));

  dom.steerLeft.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    changeLane(-1);
  });
  dom.steerRight.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    changeLane(1);
  });

  function showToast(message, type, duration) {
    dom.toast.textContent = message;
    dom.toast.classList.toggle("is-alert", type === "alert");
    dom.toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      dom.toast.classList.remove("is-visible");
    }, duration || 1700);
  }

  function spawnFloat(text, type, offsetX, offsetY) {
    const element = document.createElement("div");
    element.textContent = text;
    element.className = "float-text";
    if (type) element.classList.add("is-" + type);
    element.style.left = `calc(50% + ${offsetX || 0}px)`;
    element.style.top = `calc(48% + ${offsetY || 0}px)`;
    dom.floatLayer.appendChild(element);
    setTimeout(() => element.remove(), 1220);
  }

  function triggerFlash() {
    dom.hitFlash.classList.remove("is-active");
    void dom.hitFlash.offsetWidth;
    dom.hitFlash.classList.add("is-active");
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => dom.hitFlash.classList.remove("is-active"), 580);
  }

  function skillUnlockCount() {
    let count = 0;
    if (game.skill >= SKILL_COST.battery) count++;
    if (game.skill >= SKILL_COST.jump) count++;
    if (game.skill >= SKILL_COST.jet) count++;
    return count;
  }

  function updateSkillButtons() {
    const mapping = [
      [dom.skillBattery, SKILL_COST.battery, game.jumpMode !== "jet"],
      [dom.skillJump, SKILL_COST.jump, game.jumpMode === null],
      [dom.skillJet, SKILL_COST.jet, game.jumpMode === null]
    ];
    for (const [element, cost, available] of mapping) {
      const locked = game.skill < cost || !available;
      element.classList.toggle("is-locked", locked);
    }
  }

  function animateUnlockPulse() {
    const count = skillUnlockCount();
    if (count <= (game.hudCache.readyPulse || 0)) {
      game.hudCache.readyPulse = count;
      return;
    }
    game.hudCache.readyPulse = count;
    for (const element of [dom.skillBattery, dom.skillJump, dom.skillJet]) {
      if (!element.classList.contains("is-locked")) {
        element.classList.remove("is-unlocked");
        void element.offsetWidth;
        element.classList.add("is-unlocked");
      }
    }
  }

  function award(points, options) {
    const opts = options || {};
    game.score += points;
    if (opts.energy !== false) {
      game.skill = clamp(game.skill + points * (opts.energyRate || 0.16), 0, 100);
    }
    if (opts.floatText) {
      spawnFloat(opts.floatText, opts.floatType, opts.offsetX, opts.offsetY);
    }
    animateUnlockPulse();
  }

  function useSkill(name) {
    if (game.state !== "running") return;
    if (game.skill < SKILL_COST[name]) {
      showToast("技能充能不足，保持速度继续得分", "alert", 1200);
      playSound("deny");
      return;
    }
    if ((name === "jump" || name === "jet") && game.jumpMode !== null) {
      showToast("车辆还在空中", "alert", 1000);
      return;
    }
    if (name === "battery") {
      launchBattery();
    } else if (name === "jump") {
      launchJump();
    } else if (name === "jet") {
      launchJet();
    }
    game.skill = Math.max(0, game.skill - SKILL_COST[name]);
    game.skillsUsed++;
    updateSkillButtons(true);
  }

  function launchBattery() {
    let target = null;
    let targetDistance = Infinity;
    for (const npc of npcs) {
      if (!npc.wreck && npc.group.parent && npc.z < 5 && npc.z > -45 && npc.x < game.playerX + 0.5) {
        const distance = Math.abs(npc.z) + Math.abs(npc.x - game.playerX) * 0.4;
        if (distance < targetDistance) {
          targetDistance = distance;
          target = npc;
        }
      }
    }
    const group = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1d22,
      metalness: 0.65,
      roughness: 0.32,
      emissive: 0x1d6a79,
      emissiveIntensity: 0.25
    });
    const batteryBody = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.58, 10), bodyMaterial);
    batteryBody.rotation.z = Math.PI / 2;
    group.add(batteryBody);
    const capMaterial = makeLightMaterial(0x5ef4ff, 2.3);
    for (const x of [-0.31, 0.31]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 8), capMaterial);
      cap.rotation.z = Math.PI / 2;
      cap.position.x = x;
      group.add(cap);
    }
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sparkTexture,
        color: 0x6df4ff,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    glow.scale.set(1.6, 1.6, 1);
    group.add(glow);
    group.position.set(game.playerX - 0.6, 0.85 + game.playerY, 0.9);
    scene.add(group);
    const direction = new THREE.Vector3();
    if (target) {
      direction.set(target.x - group.position.x, 0.9 + game.playerY - group.position.y, target.z - group.position.z).normalize();
    } else {
      direction.set(-1, 0.05, -0.25).normalize();
    }
    const speed = target ? 44 : 28;
    batteries.push({
      group,
      velocity: direction.multiplyScalar(speed),
      life: 2.2,
      trail: 0,
      spin: rand(5, 11)
    });
    game.batterySide = -1;
    playSound("battery");
    showToast("弹射电池已发射", "", 900);
  }

  function launchJump() {
    game.jumpMode = "jump";
    game.jumpTimer = 0;
    game.playerY = 0.04;
    game.airVy = 10.2;
    game.invulnerable = 1.8;
    playSound("jump");
    showToast("主动弹跳", "", 900);
  }

  function launchJet() {
    game.jumpMode = "jet";
    game.jumpTimer = 0;
    game.playerY = Math.max(0, game.playerY);
    game.invulnerable = 4.8;
    game.speed = clamp(game.speed + 10, 0, MAX_SPEED);
    playSound("jet");
    showToast("喷气起飞 · 空中得分加成", "", 1200);
  }

  function playSound(name) {
    if (!audio || muted) return;
    const ctx = audio.ctx;
    const now = ctx.currentTime;
    const master = audio.master;
    if (name === "horn") {
      for (const [frequency, delay] of [[382, 0], [476, 0.01]]) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(frequency, now + delay);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.03, now + 0.35);
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.075, now + delay + 0.012);
        gain.gain.setValueAtTime(0.075, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start(now + delay);
        oscillator.stop(now + 0.42);
      }
    } else if (name === "lane") {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(280, now);
      oscillator.frequency.exponentialRampToValueAtTime(170, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now);
      oscillator.stop(now + 0.17);
    } else if (name === "bump") {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(110, now);
      oscillator.frequency.exponentialRampToValueAtTime(60, now + 0.1);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now);
      oscillator.stop(now + 0.14);
    } else if (name === "battery") {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(720, now);
      oscillator.frequency.exponentialRampToValueAtTime(120, now + 0.3);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.055, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now);
      oscillator.stop(now + 0.34);
    } else if (name === "jump") {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(150, now);
      oscillator.frequency.exponentialRampToValueAtTime(640, now + 0.26);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.055, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now);
      oscillator.stop(now + 0.34);
    } else if (name === "jet") {
      const bufferSource = ctx.createBufferSource();
      bufferSource.buffer = audio.noise;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(380, now);
      filter.frequency.exponentialRampToValueAtTime(2400, now + 0.6);
      filter.Q.value = 0.8;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
      bufferSource.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      bufferSource.start(now);
      bufferSource.stop(now + 0.85);
    } else if (name === "land") {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(95, now);
      oscillator.frequency.exponentialRampToValueAtTime(38, now + 0.22);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now);
      oscillator.stop(now + 0.28);
    } else if (name === "near") {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(980, now);
      oscillator.frequency.setValueAtTime(1320, now + 0.06);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now);
      oscillator.stop(now + 0.2);
    } else if (name === "deny") {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(130, now);
      oscillator.frequency.setValueAtTime(100, now + 0.08);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now);
      oscillator.stop(now + 0.18);
    } else if (name === "explosion" || name === "crash") {
      const isCrash = name === "crash";
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(isCrash ? 120 : 78, now);
      oscillator.frequency.exponentialRampToValueAtTime(isCrash ? 38 : 24, now + (isCrash ? 0.44 : 0.85));
      gain.gain.setValueAtTime(isCrash ? 0.24 : 0.34, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (isCrash ? 0.5 : 0.95));
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now);
      oscillator.stop(now + (isCrash ? 0.52 : 1));
      const bufferSource = ctx.createBufferSource();
      bufferSource.buffer = audio.noise;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(isCrash ? 1700 : 900, now);
      filter.frequency.exponentialRampToValueAtTime(isCrash ? 220 : 90, now + (isCrash ? 0.6 : 1));
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(isCrash ? 0.24 : 0.34, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + (isCrash ? 0.7 : 1.2));
      bufferSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(master);
      bufferSource.start(now);
      bufferSource.stop(now + (isCrash ? 0.72 : 1.22));
    } else if (name === "ramp") {
      const bufferSource = ctx.createBufferSource();
      bufferSource.buffer = audio.noise;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(260, now + 0.8);
      filter.Q.value = 1.4;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      bufferSource.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      bufferSource.start(now);
      bufferSource.stop(now + 0.95);
    }
  }

  function setupAudio() {
    if (audio) {
      if (audio.ctx.state === "suspended") audio.ctx.resume();
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(ctx.destination);

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 520;
    engineFilter.Q.value = 3;
    const oscA = ctx.createOscillator();
    oscA.type = "sawtooth";
    oscA.frequency.value = 55;
    const oscB = ctx.createOscillator();
    oscB.type = "triangle";
    oscB.frequency.value = 84;
    const oscAGain = ctx.createGain();
    oscAGain.gain.value = 0.5;
    const oscBGain = ctx.createGain();
    oscBGain.gain.value = 0.32;
    oscA.connect(oscAGain);
    oscB.connect(oscBGain);
    oscAGain.connect(engineFilter);
    oscBGain.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    oscA.start();
    oscB.start();

    audio = {
      ctx,
      master,
      noise: noiseBuffer,
      engineGain,
      engineFilter,
      oscA,
      oscB
    };
  }

  function updateEngine() {
    if (!audio) return;
    const now = audio.ctx.currentTime;
    const active = game.state === "running" || game.state === "ending";
    const speedFactor = clamp(game.displaySpeed / MAX_SPEED, 0, 1);
    const targetGain = muted || !active ? 0 : 0.028 + speedFactor * 0.035 + (game.throttle ? 0.013 : 0);
    audio.engineGain.gain.setTargetAtTime(targetGain, now, 0.08);
    if (!muted) {
      audio.oscA.frequency.setTargetAtTime(43 + speedFactor * 112 + (game.throttle ? 10 : 0), now, 0.08);
      audio.oscB.frequency.setTargetAtTime(66 + speedFactor * 179, now, 0.08);
      audio.engineFilter.frequency.setTargetAtTime(280 + speedFactor * 1450, now, 0.1);
    }
  }

  function updateMuteButton() {
    dom.muteBtn.classList.toggle("is-muted", muted);
    dom.muteBtn.setAttribute("aria-label", muted ? "开启声音" : "静音");
    if (audio) {
      audio.master.gain.setTargetAtTime(muted ? 0 : 0.7, audio.ctx.currentTime, 0.04);
    }
  }

  function createSpriteEffect(options) {
    const material = new THREE.SpriteMaterial({
      map: options.map,
      color: options.color,
      transparent: true,
      opacity: options.opacity,
      blending: options.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(options.position);
    const scale = options.scale;
    sprite.scale.set(scale, scale, 1);
    scene.add(sprite);
    effects.push({
      type: "sprite",
      object: sprite,
      velocity: options.velocity.clone(),
      gravity: options.gravity || 0,
      life: options.life,
      age: 0,
      startScale: scale,
      grow: options.grow || 0,
      opacity: options.opacity
    });
  }

  function createFlash(position, scale) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshBasicMaterial({
        color: 0xfff2bf,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    mesh.position.copy(position);
    mesh.scale.setScalar(scale * 0.4);
    scene.add(mesh);
    effects.push({
      type: "flash",
      object: mesh,
      life: 0.32,
      age: 0,
      scale
    });
  }

  function createShockwave(position, scale) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1, 36),
      new THREE.MeshBasicMaterial({
        color: 0xffc36c,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(position);
    mesh.position.y = 0.12;
    mesh.scale.setScalar(scale);
    scene.add(mesh);
    effects.push({
      type: "ring",
      object: mesh,
      life: 0.56,
      age: 0,
      scale
    });
  }

  function createDebris(position, scale) {
    const material = new THREE.MeshStandardMaterial({
      color: pick([0x2a272c, 0x5c3b2b, 0xb87533, 0x201f25]),
      roughness: 0.7,
      metalness: 0.35,
      flatShading: true
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(rand(0.1, 0.4), rand(0.08, 0.28), rand(0.1, 0.5)), material);
    mesh.position.copy(position);
    mesh.castShadow = true;
    scene.add(mesh);
    const velocity = new THREE.Vector3(rand(-7, 7), rand(5, 13), rand(-4, 8)).multiplyScalar(scale);
    effects.push({
      type: "debris",
      object: mesh,
      velocity,
      spin: new THREE.Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)),
      life: rand(1.1, 1.9),
      age: 0,
      gravity: 22
    });
  }

  function spawnExplosion(position, scale, options) {
    const opts = options || {};
    const explosionScale = scale || 1;
    const playerPosition = new THREE.Vector3(game.playerX, 1 + game.playerY, 0);
    const proximity = clamp(1 - position.distanceTo(playerPosition) / 55, 0.04, 1);
    game.shake = Math.min(1.5, game.shake + 0.75 * explosionScale * proximity);
    if (proximity > 0.18 && !opts.noFlash) triggerFlash();
    createFlash(position, explosionScale * 2.2);
    createShockwave(position, explosionScale * 1.4);
    for (let i = 0; i < 22; i++) {
      const velocity = new THREE.Vector3(rand(-6, 6), rand(0.5, 9), rand(-6, 6)).multiplyScalar(explosionScale);
      createSpriteEffect({
        map: fireTexture,
        color: pick([0xffdc7a, 0xff8a2f, 0xff5728, 0xfff1ba]),
        position: position.clone().add(new THREE.Vector3(rand(-0.7, 0.7), rand(0, 1.8), rand(-0.7, 0.7))),
        scale: rand(0.9, 2.6) * explosionScale,
        velocity,
        gravity: -1.5,
        life: rand(0.38, 0.92),
        grow: rand(1.3, 2.8) * explosionScale,
        opacity: 0.92
      });
    }
    for (let i = 0; i < 15; i++) {
      const velocity = new THREE.Vector3(rand(-3, 3), rand(1.3, 5.5), rand(-3, 3)).multiplyScalar(explosionScale);
      createSpriteEffect({
        map: smokeTexture,
        color: pick([0x3a3742, 0x57525c, 0x2a2833]),
        position: position.clone().add(new THREE.Vector3(rand(-1, 1), rand(0.4, 2.2), rand(-1, 1))),
        scale: rand(1.3, 3.2) * explosionScale,
        velocity,
        gravity: -0.25,
        life: rand(1.1, 2.3),
        grow: rand(2.4, 4.6) * explosionScale,
        opacity: 0.54,
        additive: false
      });
    }
    for (let i = 0; i < 14; i++) createDebris(position, explosionScale);
    if (!opts.silent) playSound(explosionScale > 1.5 ? "explosion" : "crash");
    if (opts.big) {
      addEvent(0.16, () => {
        createFlash(position.clone().add(new THREE.Vector3(rand(-2, 2), 1, rand(-3, 3))), explosionScale * 1.2);
      });
    }
  }

  function spawnSparks(position, color, count) {
    const total = count || 8;
    for (let i = 0; i < total; i++) {
      createSpriteEffect({
        map: sparkTexture,
        color: color || 0xffd36b,
        position: position.clone(),
        scale: rand(0.16, 0.4),
        velocity: new THREE.Vector3(rand(-5, 5), rand(1, 7), rand(-5, 5)),
        gravity: 14,
        life: rand(0.3, 0.7),
        grow: -0.1,
        opacity: 1
      });
    }
  }

  function spawnDust(position) {
    createSpriteEffect({
      map: dustTexture,
      color: pick([0xc49b7b, 0x9e7a67]),
      position,
      scale: rand(0.45, 0.9),
      velocity: new THREE.Vector3(rand(-1.4, 1.4), rand(0.3, 1.3), rand(0.2, 2)),
      gravity: 0.3,
      life: rand(0.5, 0.9),
      grow: 1.2,
      opacity: 0.32,
      additive: false
    });
  }

  function makePickupLabel(text, color) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 80;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(8,7,13,.82)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 64, 16);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = "800 36px 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 43);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function createPickupVisual(type) {
    const group = new THREE.Group();
    const glowColor = type === "fuel" ? 0xffb33c : type === "toolbox" ? 0x58dfff : 0xb26cff;
    if (type === "fuel") {
      const body = new THREE.MeshStandardMaterial({ color: 0xe5452f, metalness: 0.42, roughness: 0.4, flatShading: true });
      const cap = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.55, roughness: 0.3 });
      addBox(group, 0.5, 0.58, 0.34, body, 0, 0, 0);
      addBox(group, 0.16, 0.09, 0.16, cap, 0.12, 0.34, 0);
      addBox(group, 0.36, 0.07, 0.08, shared.chrome, 0, 0.36, 0);
      addBox(group, 0.06, 0.25, 0.08, shared.chrome, -0.18, 0.46, 0);
      addBox(group, 0.06, 0.25, 0.08, shared.chrome, 0.18, 0.46, 0);
    } else if (type === "toolbox") {
      const body = new THREE.MeshStandardMaterial({ color: 0xf09a2f, metalness: 0.5, roughness: 0.35, flatShading: true });
      addBox(group, 0.62, 0.38, 0.42, body, 0, 0, 0);
      addBox(group, 0.66, 0.08, 0.46, shared.chrome, 0, 0.22, 0);
      addBox(group, 0.36, 0.08, 0.07, shared.chrome, 0, 0.32, 0);
      addBox(group, 0.07, 0.2, 0.07, shared.chrome, -0.16, 0.4, 0);
      addBox(group, 0.07, 0.2, 0.07, shared.chrome, 0.16, 0.4, 0);
    } else {
      const scrap = new THREE.MeshStandardMaterial({ color: 0x6a6572, metalness: 0.25, roughness: 0.85, flatShading: true });
      const chunkA = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 0), scrap);
      chunkA.position.set(-0.08, 0.02, 0);
      chunkA.rotation.set(0.5, 0.8, 0.2);
      group.add(chunkA);
      const chunkB = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.5), scrap);
      chunkB.position.set(0.16, 0.08, 0.04);
      chunkB.rotation.set(0.2, 0.3, -0.4);
      group.add(chunkB);
      addBox(group, 0.55, 0.05, 0.06, shared.chrome, 0, 0.18, 0.1, false);
    }
    const labelColor = type === "fuel" ? "#ffcf5a" : type === "toolbox" ? "#6cf4ff" : "#e6a3ff";
    const labelText = type === "fuel" ? "油箱" : type === "toolbox" ? "工具箱" : "杂物";
    const labelTexture = makePickupLabel(labelText, labelColor);
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: labelTexture,
        transparent: true,
        depthWrite: false
      })
    );
    label.material.userData.disposeMap = true;
    label.position.y = 0.8;
    label.scale.set(1.45, 0.45, 1);
    group.add(label);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: glowColor,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    glow.scale.set(1.5, 1.5, 1);
    glow.position.y = 0.15;
    group.add(glow);
    return group;
  }

  function spawnPickup(type, x, z) {
    if (pickups.length >= 16) return null;
    const group = createPickupVisual(type);
    group.position.set(x, 0.62, z);
    scene.add(group);
    const pickup = {
      type,
      x,
      z,
      group,
      bob: rand(0, Math.PI * 2),
      spin: rand(1.4, 3),
      age: 0
    };
    pickups.push(pickup);
    return pickup;
  }

  function removePickup(index) {
    const pickup = pickups[index];
    if (!pickup) return;
    if (pickup.group.parent) pickup.group.parent.remove(pickup.group);
    disposeObject(pickup.group);
    pickups.splice(index, 1);
  }

  function applyPickup(pickup) {
    if (pickup.type === "fuel") {
      game.fuel = clamp(game.fuel + 26, 0, 100);
      showToast("拾取油箱 · 燃油 +26", "", 1100);
      spawnFloat("+26 燃油", "cyan", -20, 4);
      playSound("near");
    } else if (pickup.type === "toolbox") {
      game.integrity = clamp(game.integrity + 28, 0, 100);
      showToast("拾取工具箱 · 车况 +28", "", 1100);
      spawnFloat("+28 车况", "cyan", 20, 4);
      playSound("near");
    } else {
      game.integrity = clamp(game.integrity - 18, 0, 100);
      game.speed *= 0.55;
      game.shake = Math.min(1.2, game.shake + 0.32);
      spawnSparks(new THREE.Vector3(game.playerX, 0.7, 0.8), 0xffb04a, 7);
      showToast("轧到杂物！车况 -18，速度骤降", "alert", 1400);
      spawnFloat("车况 -18", "red", 0, 3);
      playSound("bump");
      if (game.integrity <= 0) endGame("crash");
    }
  }

  function updatePickups(dt, speed) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pickup = pickups[i];
      pickup.age += dt;
      pickup.z += (speed / 3.6) * dt;
      pickup.group.position.z = pickup.z;
      pickup.group.position.y = 0.62 + Math.sin(time * 4 + pickup.bob) * 0.1;
      pickup.group.rotation.y += pickup.spin * dt;
      if (game.state === "running" && game.playerY < 1.5 && Math.abs(pickup.z) < 2.2 && Math.abs(pickup.x - game.playerX) < 1.25) {
        applyPickup(pickup);
        removePickup(i);
        continue;
      }
      if (pickup.z > 18) removePickup(i);
    }
  }

  function wreckNPC(npc) {
    if (!npc || npc.wreck) return false;
    npc.wreck = true;
    npc.wreckAge = 0;
    npc.smokeTimer = 0;
    npc.signalOn = false;
    npc.targetX = npc.x;
    npc.speed = Math.max(7, npc.speed * 0.42);
    npc.group.rotation.z = rand(-0.16, 0.16);
    npc.group.rotation.y += rand(-0.25, 0.25);
    npc.group.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (sharedMaterials.has(material)) return;
        if (material.color) material.color.multiplyScalar(0.24);
        if (material.emissive) material.emissive.multiplyScalar(0.08);
        if ("emissiveIntensity" in material) material.emissiveIntensity = 0;
        material.needsUpdate = true;
      });
    });
    return true;
  }

  function damageIntegrity(amount) {
    game.integrity = clamp(game.integrity - amount, 0, 100);
    if (game.integrity <= 0) {
      endGame("crash");
      return true;
    }
    return false;
  }

  function destroyNPC(npc, points, options) {
    if (!npc || npc.wreck) return;
    const opts = options || {};
    const position = npc.group.position.clone();
    position.y = 1.1;
    const isTanker = npc.special === "tanker";
    wreckNPC(npc);
    if (isTanker) {
      chainExplosion(position, 2.15);
    } else {
      spawnExplosion(position, opts.scale || 1, { big: false });
    }
    if (points) {
      award(points, { energy: true, floatText: opts.label || `+${points}`, floatType: "cyan", offsetY: opts.offsetY || 0 });
    }
    if (opts.silent !== true) playSound("explosion");
  }

  function chainExplosion(position, scale) {
    spawnExplosion(position, scale || 1.4, { big: true });
    const victims = npcs.filter((npc) => {
      return !npc.wreck && npc.group.parent && npc.group.position.distanceTo(position) < 21;
    });
    for (const npc of victims) {
      addEvent(rand(0.16, 0.72), () => {
        if (!npc.group.parent || npc.wreck) return;
        const delayedPosition = npc.group.position.clone();
        delayedPosition.y = 1.1;
        wreckNPC(npc);
        spawnExplosion(delayedPosition, rand(0.9, 1.5), { silent: true });
        award(120, { energy: false, floatText: "+120", floatType: "cyan", offsetY: -18 });
      });
    }
  }

  function collideRegularCar(npc) {
    const damage = Math.round(24 + game.speed * 0.045);
    const position = new THREE.Vector3(game.playerX, 0.72, 0.7);
    game.speed = Math.max(16, game.speed * 0.54);
    game.invulnerable = 1.6;
    game.shake = Math.min(1.5, game.shake + 0.85);
    const explosionPosition = npc.group.position.clone();
    explosionPosition.y = 1.1;
    wreckNPC(npc);
    spawnExplosion(explosionPosition, 1.12, { big: false });
    spawnSparks(position, 0xffb257, 12);
    playSound("crash");
    triggerFlash();
    const failed = damageIntegrity(damage);
    if (!failed) {
      showToast(`撞上私家车！车况 -${damage}，NPC 已报废`, "alert", 1500);
      spawnFloat(`车况 -${damage}`, "red", -18, 8);
    }
  }

  function checkNPCCollisions() {
    for (let i = 0; i < npcs.length; i++) {
      const a = npcs[i];
      if (a.wreck || !a.group.parent) continue;
      for (let j = i + 1; j < npcs.length; j++) {
        const b = npcs[j];
        if (b.wreck || !b.group.parent) continue;
        const dx = Math.abs(a.x - b.x);
        const dz = Math.abs(a.z - b.z);
        if (dx >= (a.halfW + b.halfW) * 0.88) continue;
        if (dz >= (a.halfL + b.halfL) * 0.84) continue;
        const position = new THREE.Vector3((a.x + b.x) * 0.5, 1.1, (a.z + b.z) * 0.5);
        const hasTanker = a.special === "tanker" || b.special === "tanker";
        wreckNPC(a);
        wreckNPC(b);
        if (hasTanker) {
          chainExplosion(position, 1.9);
        } else {
          spawnExplosion(position, 1.05, { big: false });
        }
        break;
      }
    }
  }

  function triggerRamp(npc) {
    game.jumpMode = "ramp";
    game.jumpTimer = 0;
    game.playerY = Math.max(game.playerY, 0.15);
    game.airVy = 14.6;
    game.invulnerable = 2.1;
    game.speed = clamp(game.speed + 14, 0, MAX_SPEED);
    game.shake = Math.min(1.2, game.shake + 0.45);
    award(620, { energy: true, energyRate: 0.2, floatText: "飞坡 +620", floatType: "", offsetY: -8 });
    showToast("飞坡成功！", "", 1200);
    playSound("ramp");
    for (let i = 0; i < 8; i++) {
      spawnDust(new THREE.Vector3(game.playerX + rand(-0.9, 0.9), 0.2, 2.2));
    }
    if (npc) npc.hintShown = true;
  }

  function explodeBattery(battery) {
    const position = battery.group.position.clone();
    position.y = 1;
    spawnExplosion(position, 0.75, { big: false });
    playSound("explosion");
  }

  function updateBatteries(dt) {
    for (let i = batteries.length - 1; i >= 0; i--) {
      const battery = batteries[i];
      battery.life -= dt;
      battery.trail -= dt;
      battery.group.position.addScaledVector(battery.velocity, dt);
      battery.velocity.y -= 3.2 * dt;
      battery.group.rotation.x += battery.spin * dt;
      battery.group.rotation.z += battery.spin * 0.7 * dt;
      if (battery.trail <= 0) {
        battery.trail = 0.026;
        createSpriteEffect({
          map: sparkTexture,
          color: 0x56efff,
          position: battery.group.position.clone(),
          scale: rand(0.2, 0.45),
          velocity: new THREE.Vector3(rand(-0.2, 0.2), rand(-0.1, 0.3), rand(-0.2, 0.2)),
          life: 0.22,
          grow: 0.1,
          opacity: 0.75
        });
      }
      let hit = false;
      for (const npc of npcs.slice()) {
        if (!npc.group.parent || npc.wreck) continue;
        const dx = Math.abs(battery.group.position.x - npc.group.position.x);
        const dz = Math.abs(battery.group.position.z - npc.group.position.z);
        if (dx < npc.halfW + 0.5 && dz < npc.halfL + 0.5) {
          explodeBattery(battery);
          destroyNPC(npc, 320, { label: "电池命中 +320", offsetY: -12 });
          hit = true;
          break;
        }
      }
      if (hit || battery.life <= 0 || battery.group.position.z < -190 || Math.abs(battery.group.position.x) > 28) {
        if (battery.group.parent) battery.group.parent.remove(battery.group);
        disposeObject(battery.group);
        batteries.splice(i, 1);
      }
    }
  }

  function updateEffects(dt) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const effect = effects[i];
      effect.age += dt;
      const progress = effect.age / effect.life;
      if (progress >= 1) {
        if (effect.object.parent) effect.object.parent.remove(effect.object);
        disposeObject(effect.object);
        effects.splice(i, 1);
        continue;
      }
      if (effect.type === "sprite") {
        effect.object.position.addScaledVector(effect.velocity, dt);
        effect.velocity.y -= effect.gravity * dt;
        const scale = effect.startScale + effect.grow * progress;
        effect.object.scale.set(scale, scale, 1);
        effect.object.material.opacity = effect.opacity * (1 - Math.pow(progress, 1.7));
      } else if (effect.type === "debris") {
        effect.object.position.addScaledVector(effect.velocity, dt);
        effect.velocity.y -= effect.gravity * dt;
        effect.object.rotation.x += effect.spin.x * dt;
        effect.object.rotation.y += effect.spin.y * dt;
        effect.object.rotation.z += effect.spin.z * dt;
        effect.object.material.opacity = 1;
        effect.object.visible = true;
        if (effect.object.position.y < 0.08) {
          effect.object.position.y = 0.08;
          effect.velocity.y *= -0.35;
          effect.velocity.x *= 0.72;
          effect.velocity.z *= 0.72;
        }
      } else if (effect.type === "flash") {
        const scale = effect.scale * (0.4 + progress * 2.8);
        effect.object.scale.setScalar(scale);
        effect.object.material.opacity = 1 - progress;
      } else if (effect.type === "ring") {
        const scale = effect.scale * (0.8 + progress * 4.4);
        effect.object.scale.setScalar(scale);
        effect.object.material.opacity = 0.72 * (1 - progress);
      }
    }
  }

  function updatePlayerJump(dt) {
    if (game.jumpMode === null) {
      game.playerY = 0;
      return;
    }
    if (game.jumpMode === "jump" || game.jumpMode === "ramp") {
      game.playerY += game.airVy * dt;
      game.airVy -= (game.jumpMode === "ramp" ? 17.2 : 13.2) * dt;
      if (game.playerY <= 0) {
        game.playerY = 0;
        const wasRamp = game.jumpMode === "ramp";
        game.jumpMode = null;
        game.airVy = 0;
        game.shake = Math.min(1.1, game.shake + (wasRamp ? 0.45 : 0.18));
        playSound("land");
        for (let i = 0; i < (wasRamp ? 9 : 4); i++) {
          spawnDust(new THREE.Vector3(game.playerX + rand(-0.8, 0.8), 0.14, rand(1.6, 3.2)));
        }
        if (wasRamp) award(120, { energy: false, floatText: "完美落地 +120", floatType: "", offsetY: 6 });
      }
      return;
    }
    if (game.jumpMode === "jet") {
      game.jumpTimer += dt;
      if (game.jumpTimer < 0.75) {
        game.playerY = damp(game.playerY, 4.3, 5.8, dt);
      } else if (game.jumpTimer < 3.9) {
        game.playerY = 4.3 + Math.sin(game.jumpTimer * 2.1) * 0.13;
      } else {
        game.playerY -= 8.4 * dt;
        if (game.playerY <= 0) {
          game.playerY = 0;
          game.jumpMode = null;
          game.shake = Math.min(1, game.shake + 0.22);
          playSound("land");
          for (let i = 0; i < 7; i++) {
            spawnDust(new THREE.Vector3(game.playerX + rand(-0.8, 0.8), 0.14, rand(1.5, 3.2)));
          }
        }
      }
    }
  }

  function updatePlayerVisual(dt) {
    const targetX = game.targetX;
    game.playerX = damp(game.playerX, targetX, 8.5, dt);
    game.playerX = clamp(game.playerX, -PLAYER_LIMIT, PLAYER_LIMIT);
    const laneDelta = targetX - game.playerX;
    game.steerPulse = damp(game.steerPulse, 0, 8, dt);

    if (game.state === "running") {
      playerRoot.position.set(game.playerX, game.playerY, 0);
      const lean = clamp(laneDelta * 0.14, -0.17, 0.17);
      playerRoot.rotation.z = damp(playerRoot.rotation.z, -lean, 8, dt);
      playerRoot.rotation.y = damp(playerRoot.rotation.y, laneDelta * 0.06, 8, dt);
      let pitch = 0;
      if (game.jumpMode === "jump" || game.jumpMode === "ramp") pitch = clamp(game.airVy * 0.014, -0.2, 0.22);
      else if (game.jumpMode === "jet") pitch = game.jumpTimer < 0.75 ? 0.08 : -0.02;
      playerRoot.rotation.x = damp(playerRoot.rotation.x, pitch, 6, dt);
    }

    const wheelSpin = (game.speed / 3.6) * dt / 0.36;
    for (const wheel of playerVehicle.wheels) {
      wheel.rotation.x += wheelSpin;
    }

    const jetActive = game.jumpMode === "jet" && game.state === "running";
    for (let i = 0; i < jetFlames.length; i++) {
      const flame = jetFlames[i];
      flame.visible = jetActive;
      if (jetActive) {
        const flicker = rand(0.75, 1.3);
        flame.scale.set(rand(0.55, 0.9), rand(1.5, 2.6) * flicker, 1);
        flame.material.opacity = rand(0.65, 1);
      }
    }
    playerGlowLight.intensity = jetActive ? 2.2 : 0;
    for (const indicator of playerVehicle.indicators) {
      indicator.material.emissiveIntensity = game.steerPulse > 0.08 || game.steerPulse < -0.08 ? 0.8 + Math.sin(time * 20) * 0.6 : 0.05;
    }
    dom.steeringWheel.style.setProperty("--wheel-angle", `${game.wheelAngle}deg`);
    game.wheelAngle = damp(game.wheelAngle, game.steerPulse * 48, 11, dt);
  }

  function updateSurfaceEffects(dt) {
    if (game.state !== "running") return;
    if (Math.abs(game.playerX) > RAIL_SPARK_X && game.jumpMode === null) {
      game.railSparkTimer -= dt;
      if (game.railSparkTimer <= 0) {
        const side = Math.sign(game.playerX);
        game.railSparkTimer = rand(0.055, 0.09);
        const position = new THREE.Vector3(side * (PLAYER_LIMIT + PLAYER_HALF_W - 0.12), 0.34, rand(0.25, 1.35));
        spawnSparks(position, 0xff9d3d, 3);
        game.shake = Math.min(0.34, game.shake + 0.035);
      }
    } else {
      game.railSparkTimer = 0;
    }
    if (game.integrity < 45) {
      game.damageSmokeTimer -= dt;
      if (game.damageSmokeTimer <= 0) {
        game.damageSmokeTimer = game.integrity < 22 ? 0.12 : 0.27;
        createSpriteEffect({
          map: smokeTexture,
          color: 0x4c4952,
          position: new THREE.Vector3(game.playerX + rand(-0.45, 0.45), 1.05, -1.45),
          scale: rand(0.34, 0.7),
          velocity: new THREE.Vector3(rand(-0.4, 0.4), rand(0.7, 1.6), rand(-0.4, 0.3)),
          gravity: -0.2,
          life: rand(0.7, 1.4),
          grow: 1.7,
          opacity: 0.34,
          additive: false
        });
      }
    }
  }

  function updatePlayerSpeed(dt) {
    const fuelBefore = game.fuel;
    if (game.throttle) {
      const acceleration = 27.5 - game.speed * 0.018;
      game.speed += acceleration * dt;
    } else {
      game.speed -= (3.2 + game.speed * 0.012) * dt;
    }
    if (game.brake) {
      const deceleration = 18 + game.brakeForce / 58;
      game.speed -= deceleration * dt;
      game.brakeForce += (470 + game.speed * 2.05) * dt;
    } else {
      game.brakeForce = Math.max(0, game.brakeForce - 106 * dt);
    }
    game.speed = clamp(game.speed, 0, MAX_SPEED);
    game.topSpeed = Math.max(game.topSpeed, game.speed);
    game.distance += (game.speed / 3.6) * dt;
    game.fuel -= (0.2 + game.speed * 0.0029 + (game.throttle ? 0.54 : 0) + (game.brake ? 0.12 : 0)) * dt;
    game.fuel = clamp(game.fuel, 0, 100);
    const overdriveBonus = Math.max(0, game.speed - SPEEDO_MAX) * 0.14;
    const drivingScore = (3 + game.speed * 0.077 + overdriveBonus) * dt;
    award(drivingScore, { energy: true, energyRate: 0.34 });
    if (game.speed > SPEEDO_MAX && !game.overdriveHintShown) {
      game.overdriveHintShown = true;
      showToast("突破表盘上限！极速状态得分额外提升", "", 1800);
    }
    const wheelDustChance = game.speed > 105 ? 0.55 : 0.16;
    if (Math.random() < wheelDustChance * dt * 6) {
      spawnDust(new THREE.Vector3(game.playerX + (Math.random() < 0.5 ? -0.85 : 0.85), 0.12, 1.5));
    }
    if (game.brakeForce >= BRAKE_LIMIT) {
      endGame("brake");
      return;
    }
    if (game.fuel <= 0 || fuelBefore <= 0) {
      endGame("fuel");
      return;
    }
    if (game.fuel < 22 && !game.fuelHintShown) {
      game.fuelHintShown = true;
      showToast("燃料偏低，保持速度冲刺", "alert", 1600);
    }
  }

  function npcDoAction(npc) {
    const provoked = time < npc.aggressionUntil;
    const roll = Math.random();
    if (roll < (provoked ? 0.7 : 0.48)) {
      if (npc.targetLane !== npc.lane) return;
      const options = [];
      if (npc.lane > 0) options.push(npc.lane - 1);
      if (npc.lane < 2) options.push(npc.lane + 1);
      if (!options.length) return;
      const nextLane = pick(options);
      npc.lane = nextLane;
      npc.targetX = LANE_X[nextLane];
      npc.signalOn = Math.random() < (provoked ? 0.66 : 0.5);
      npc.signalSide = nextLane < npc.targetLane ? 1 : -1;
      if (!npc.signalOn) npc.signalSide = 0;
    } else {
      const change = rand(12, provoked ? 38 : 26) * (Math.random() < 0.5 ? 1 : -1);
      npc.speed = clamp(npc.speed + change, 24, 165);
      npc.baseSpeed = npc.speed;
      npc.braking = change < 0 ? 1 : 0;
    }
  }

  function updateFlatbed(npc, dt) {
    if (!npc.rampPivot) return;
    const close = npc.z > -82 && npc.z < 22;
    const targetAngle = close ? 0.39 : -0.035;
    npc.rampPivot.rotation.x = damp(npc.rampPivot.rotation.x, targetAngle, 2.5, dt);
    npc.rampReady = npc.rampPivot.rotation.x > 0.27;
    if (npc.rampReady && !npc.hintShown && game.state === "running" && npc.z > -70 && npc.z < -25 && Math.abs(npc.x - game.playerX) < 1.6) {
      npc.hintShown = true;
      showToast("平板挂车已放下斜坡，全速冲上去！", "", 2100);
    }
  }

  function updateNPCs(dt, activeSpeed) {
    const active = game.state === "running";
    for (let i = npcs.length - 1; i >= 0; i--) {
      const npc = npcs[i];
      npc.lastZ = npc.z;
      const relativeSpeed = (activeSpeed - npc.speed) / 3.6;
      npc.z += relativeSpeed * dt;
      if (!npc.wreck) npc.x = damp(npc.x, npc.targetX, npc.signalOn ? 4.2 : 5.5, dt);
      npc.group.position.x = npc.x;
      npc.group.position.z = npc.z;
      if (npc.wreck) {
        npc.wreckAge += dt;
        npc.smokeTimer -= dt;
        if (npc.smokeTimer <= 0) {
          npc.smokeTimer = rand(0.12, 0.28);
          createSpriteEffect({
            map: smokeTexture,
            color: pick([0x34313b, 0x4b4650, 0x25232c]),
            position: new THREE.Vector3(npc.x + rand(-0.5, 0.5), 1.05 + rand(0, 1.2), npc.z + rand(-0.7, 0.7)),
            scale: rand(0.45, 1.05),
            velocity: new THREE.Vector3(rand(-0.5, 0.5), rand(0.5, 1.5), rand(-0.3, 0.5)),
            gravity: -0.22,
            life: rand(0.7, 1.5),
            grow: 1.9,
            opacity: 0.34,
            additive: false
          });
        }
        if (npc.z > 56 || npc.z < -210) removeNPC(npc);
        continue;
      }
      const wheelSpin = (npc.speed / 3.6) * dt / 0.42;
      for (const wheel of npc.wheels) wheel.rotation.x += wheelSpin;
      updateFlatbed(npc, dt);
      npc.braking = Math.max(0, npc.braking - dt);
      for (const material of npc.tailMats) {
        material.emissiveIntensity = npc.braking > 0 ? 2.8 : 1.0;
      }
      if (npc.signalOn) {
        const blink = Math.sin(time * 17) > 0;
        npc.indicators[0].material.emissiveIntensity = npc.signalSide === 1 && blink ? 3.6 : 0.05;
        npc.indicators[1].material.emissiveIntensity = npc.signalSide === -1 && blink ? 3.6 : 0.05;
        if (Math.abs(npc.x - npc.targetX) < 0.12) npc.signalOn = false;
      } else {
        npc.indicators[0].material.emissiveIntensity = 0.05;
        npc.indicators[1].material.emissiveIntensity = 0.05;
      }
      if (active && npc.type === "hopper") {
        npc.dropTimer -= dt;
        if (npc.dropTimer <= 0 && npc.z < -14 && npc.z > -158) {
          npc.dropTimer = rand(3.1, 5.5);
          const roll = Math.random();
          const dropType = roll < 0.4 ? "fuel" : roll < 0.72 ? "toolbox" : "junk";
          spawnPickup(dropType, npc.x + rand(-0.24, 0.24), npc.z + npc.halfL * 0.74);
        }
      }
      if (active) {
        npc.actionTimer -= dt;
        if (npc.actionTimer <= 0) {
          npc.actionTimer = rand(1.3, 3.1) - (time < npc.aggressionUntil ? 0.5 : 0);
          const chance = time < npc.aggressionUntil ? 0.82 : 0.13;
          if (Math.random() < chance) npcDoAction(npc);
        }
      } else {
        npc.actionTimer -= dt;
        if (npc.actionTimer <= 0) {
          npc.actionTimer = rand(2.4, 5.5);
          if (Math.random() < 0.08) npcDoAction(npc);
        }
      }
      if (npc.z > 56 || npc.z < -210) {
        removeNPC(npc);
      }
    }
  }

  function detectNearMiss(npc) {
    if (npc.passed || npc.wreck) return;
    if (npc.lastZ < 0 && npc.z >= 0) {
      npc.passed = true;
      const lateral = Math.abs(npc.x - game.playerX);
      const collisionLateral = npc.halfW + PLAYER_HALF_W * 0.88;
      const gap = lateral - collisionLateral;
      if (gap > 0.01 && gap < 0.62 && npc.z < 3.5) {
        const points = Math.round(60 + game.speed * 0.15 + (0.62 - gap) * 70);
        award(points, { energy: true, energyRate: 0.22, floatText: `擦肩 +${points}`, floatType: "cyan", offsetY: rand(-12, 12) });
        playSound("near");
      }
    }
  }

  function checkCollisions() {
    if (game.state !== "running") return;
    for (let i = npcs.length - 1; i >= 0; i--) {
      const npc = npcs[i];
      if (!npc.group.parent || npc.wreck) continue;
      detectNearMiss(npc);
      if (game.invulnerable > 0 || game.playerY > 1.2) continue;
      const dx = Math.abs(npc.x - game.playerX);
      const dz = Math.abs(npc.z);
      if (dx >= npc.halfW + PLAYER_HALF_W * 0.88) continue;
      if (npc.special === "flatbed" && npc.z < 0 && npc.rampReady && game.speed > 94 && dz < npc.halfL + 4.2) {
        triggerRamp(npc);
        continue;
      }
      if (dz >= npc.halfL + PLAYER_HALF_L) continue;
      if (npc.z > 0.25) {
        endGame("rear", { npc });
        return;
      }
      if (npc.type === "sedan") {
        collideRegularCar(npc);
        if (game.state !== "running") return;
        continue;
      }
      endGame("crash", { npc });
      return;
    }
  }

  function updateRearWarning() {
    let danger = false;
    let nearest = null;
    for (const npc of npcs) {
      if (!npc.wreck && npc.z > 2.5 && npc.z < 34 && Math.abs(npc.x - game.playerX) < 2.4) {
        const closing = npc.speed > game.speed + 6;
        if (closing && (!nearest || npc.z < nearest.z)) {
          nearest = npc;
          danger = true;
        }
      }
    }
    game.rearDanger = danger;
    dom.rearWarning.classList.toggle("is-active", danger && game.state === "running");
  }

  function triggerHorn() {
    if (game.state !== "running") return;
    if (game.hornCooldown > 0) {
      showToast("鸣笛冷却中", "alert", 700);
      return;
    }
    game.hornCooldown = 2.2;
    let target = null;
    let distance = Infinity;
    for (const npc of npcs) {
      if (!npc.wreck && npc.z < -2 && npc.z > -105) {
        const candidateDistance = -npc.z;
        if (candidateDistance < distance) {
          distance = candidateDistance;
          target = npc;
        }
      }
    }
    playSound("horn");
    dom.hornBtn.classList.add("is-pressed");
    setTimeout(() => dom.hornBtn.classList.remove("is-pressed"), 180);
    if (target) {
      target.aggressionUntil = time + 7;
      target.actionTimer = Math.min(target.actionTimer, rand(0.3, 0.8));
      showToast("鸣笛！前方车辆开始躁动", "", 1400);
    } else {
      showToast("前方空旷，无人理会你的鸣笛", "", 1300);
    }
  }

  function startDemoTraffic() {
    if (npcs.length > 0) return;
    makeNPC("sedan", 1, -26, 36);
    makeNPC("truck", 0, -58, 31);
    makeNPC("sedan", 2, -86, 41);
    makeNPC("tanker", 1, -124, 29);
    makeNPC("flatbed", 2, -164, 27);
    makeNPC("sedan", 0, -198, 38);
  }

  function resetGame() {
    clearNPCs();
    clearEffects();
    clearPickups();
    resetBatteries();
    pendingEvents = [];
    game.elapsed = 0;
    game.score = 0;
    game.distance = 0;
    game.speed = 74;
    game.displaySpeed = 74;
    game.fuel = 100;
    game.integrity = 100;
    game.brakeForce = 0;
    game.skill = 22;
    game.topSpeed = 74;
    game.skillsUsed = 0;
    game.throttle = false;
    game.brake = false;
    game.targetX = 0;
    game.playerX = 0;
    game.playerY = 0;
    game.jumpMode = null;
    game.jumpTimer = 0;
    game.airVy = 0;
    game.invulnerable = 1.5;
    game.steerPulse = 0;
    game.wheelAngle = 0;
    game.shake = 0;
    game.endType = null;
    game.endTimer = 0;
    game.endDelay = 3.4;
    game.endLaunchVy = 0;
    game.endSpinX = 0;
    game.endSpinY = 0;
    game.endSpinZ = 0;
    game.endDriftX = 0;
    game.endDriftZ = 0;
    game.hornCooldown = 0;
    game.fuelHintShown = false;
    game.rearDanger = false;
    game.rearSpawnTimer = rand(8, 11);
    game.spawnTimer = 1.1;
    game.railSparkTimer = 0;
    game.damageSmokeTimer = 0;
    game.overdriveHintShown = false;
    game.hudCache = {};
    game.newBest = false;
    playerRoot.position.set(0, 0, 0);
    playerRoot.rotation.set(0, 0, 0);
    for (const flame of jetFlames) flame.visible = false;
    playerGlowLight.intensity = 0;
    playerVehicle.group.visible = true;
    setThrottle(false);
    setBrake(false);
    dom.rearWarning.classList.remove("is-active");
    dom.brakeGauge.classList.remove("is-danger");
    dom.fuelGauge.classList.remove("is-low", "is-critical");
    dom.integrityGauge.classList.remove("is-low", "is-critical");
    dom.speedo.classList.remove("is-overdrive");
    updateSkillButtons(true);
  }

  function startGame() {
    setupAudio();
    resetGame();
    game.state = "running";
    spawnInitialTraffic();
    dom.welcome.classList.add("is-hidden");
    dom.results.classList.add("is-hidden");
    dom.endingBanner.classList.add("is-hidden");
    dom.hud.classList.remove("is-hidden", "is-ending");
    dom.hud.style.opacity = "";
    dom.hud.style.visibility = "";
    game.speed = 74;
    game.displaySpeed = 74;
    updateSkillButtons(true);
    playSound("jump");
    showToast("踩下油门，活下去", "", 1400);
    spawnFloat("GO", "", 0, -6);
  }

  function endGame(type, options) {
    if (game.state !== "running") return;
    const opts = options || {};
    const info = ENDINGS[type] || ENDINGS.crash;
    game.state = "ending";
    game.endType = type;
    game.endTimer = 0;
    game.endDelay = info.delay;
    game.throttle = false;
    game.brake = false;
    setPedalVisual(dom.throttlePedal, false);
    setPedalVisual(dom.brakePedal, false);
    dom.hud.classList.add("is-ending");
    dom.endingTag.textContent = info.tag;
    dom.endingTag.classList.toggle("is-special", info.special);
    dom.endingTitle.textContent = info.title;
    dom.endingSub.textContent = info.sub;
    dom.endingBanner.classList.remove("is-hidden");
    dom.rearWarning.classList.remove("is-active");
    game.shake = Math.min(1.6, game.shake + 0.8);
    let description = info.desc;
    if (type === "brake") {
      game.endLaunchVy = 15.2;
      game.endSpinX = 2.8;
      game.endSpinY = 1.1;
      game.endSpinZ = 4.2;
      game.endDriftX = rand(-1.5, 1.5);
      game.endDriftZ = rand(-1, 1);
      const position = new THREE.Vector3(game.playerX, 1.2 + game.playerY, 0);
      spawnExplosion(position, 1.7, { big: true });
      playSound("explosion");
      triggerFlash();
    } else if (type === "crash") {
      game.endLaunchVy = 7.5;
      game.endSpinX = 1.4;
      game.endSpinY = 2.1;
      game.endSpinZ = 2.8;
      game.endDriftX = rand(-1, 1);
      game.endDriftZ = rand(-1, 1);
      const position = new THREE.Vector3(game.playerX, 1 + game.playerY, 0);
      if (opts.npc) {
        const npcPosition = opts.npc.group.position.clone();
        npcPosition.y = 1.1;
        const isTanker = opts.npc.special === "tanker";
        wreckNPC(opts.npc);
        if (isTanker) {
          description = "你撞上了油罐车，爆炸点燃了整条公路。";
          chainExplosion(npcPosition, 2.1);
        } else {
          spawnExplosion(npcPosition, 1.2, { silent: true });
        }
      }
      spawnExplosion(position, 1.25, { big: false });
      playSound("crash");
      triggerFlash();
    } else if (type === "rear") {
      game.endSpinX = 0.9;
      game.endSpinY = 2.8;
      game.endSpinZ = 1.4;
      game.endDriftX = rand(-1.8, 1.8);
      game.endDriftZ = rand(-1, 1);
      const position = new THREE.Vector3(game.playerX, 1.1 + game.playerY, 0);
      spawnSparks(position, 0xffc166);
      game.shake = 1.2;
      playSound("crash");
      triggerFlash();
      if (opts.npc) {
        const source = opts.npc.group.position.clone();
        source.y = 1;
        wreckNPC(opts.npc);
        spawnExplosion(source, 0.8, { silent: true });
      }
    } else if (type === "rail") {
      const side = opts.side || (game.playerX >= 0 ? 1 : -1);
      game.endLaunchVy = 10.8;
      game.endSpinX = 3.4;
      game.endSpinY = 2.5;
      game.endSpinZ = 5.6;
      game.endDriftX = side * 7.5;
      game.endDriftZ = 0;
      spawnSparks(new THREE.Vector3(game.playerX + side * 0.7, 0.5, 0.7), 0xffa542, 18);
      addEvent(0.24, () => {
        const explosionPosition = new THREE.Vector3(game.playerX, 1.2 + game.playerY, 0);
        spawnExplosion(explosionPosition, 1.55, { big: true });
        playSound("explosion");
      });
    } else if (type === "fuel") {
      game.endLaunchVy = 0;
      game.endSpinX = 0;
      game.endSpinY = 0;
      game.endSpinZ = 0;
      game.endDriftX = 0;
      game.endDriftZ = 0;
      showToast("引擎熄火了", "alert", 1300);
      playSound("deny");
    }
    game.endDescription = description;
    spawnFloat(info.title, "", 0, -18);
  }

  function showResults() {
    if (game.state !== "ending") return;
    game.state = "results";
    game.endTimer = 0;
    const info = ENDINGS[game.endType] || ENDINGS.crash;
    const finalScore = Math.floor(game.score);
    game.newBest = finalScore > highScore;
    if (game.newBest) {
      highScore = finalScore;
      try {
        localStorage.setItem("highwayKingHighScore", String(highScore));
      } catch (error) {
        highScore = finalScore;
      }
    }
    dom.best.textContent = Math.floor(highScore).toLocaleString("en-US");
    dom.welcomeBest.textContent = Math.floor(highScore).toLocaleString("en-US");
    dom.finalScore.textContent = finalScore.toLocaleString("en-US");
    dom.newBest.classList.toggle("is-hidden", !game.newBest);
    dom.resultTitle.textContent = info.title;
    dom.resultEndingType.textContent = info.tag;
    dom.resultEndingType.style.color = info.special ? "#ffabab" : "rgba(255,210,105,.74)";
    dom.resultDesc.textContent = game.endDescription || info.desc;
    dom.resultDistance.textContent = game.distance >= 1000 ? `${(game.distance / 1000).toFixed(2)} km` : `${Math.floor(game.distance)} m`;
    const totalSeconds = Math.floor(game.elapsed);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    dom.resultTime.textContent = `${minutes}:${seconds}`;
    dom.resultSpeed.textContent = `${Math.round(game.topSpeed)} km/h`;
    dom.resultSkills.textContent = `${game.skillsUsed} 次`;
    dom.endingBanner.classList.add("is-hidden");
    dom.hud.classList.add("is-hidden");
    dom.results.classList.remove("is-hidden");
  }

  function returnHome() {
    resetGame();
    game.state = "welcome";
    startDemoTraffic();
    dom.results.classList.add("is-hidden");
    dom.endingBanner.classList.add("is-hidden");
    dom.hud.classList.add("is-hidden");
    dom.hud.classList.remove("is-ending");
    dom.welcome.classList.remove("is-hidden");
    dom.best.textContent = Math.floor(highScore).toLocaleString("en-US");
    dom.welcomeBest.textContent = Math.floor(highScore).toLocaleString("en-US");
    if (audio) audio.engineGain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.1);
  }

  function updateEnding(dt) {
    game.endTimer += dt;
    if (game.endType === "brake" || game.endType === "crash" || game.endType === "rail") {
      if (game.endType === "rail") game.endDriftX = damp(game.endDriftX, 0, 0.9, dt);
      if (game.endLaunchVy > 0 || game.playerY > 0) {
        game.playerY += game.endLaunchVy * dt;
        game.endLaunchVy -= 7.6 * dt;
        game.playerX += game.endDriftX * dt;
        playerRoot.rotation.x += game.endSpinX * dt;
        playerRoot.rotation.y += game.endSpinY * dt;
        playerRoot.rotation.z += game.endSpinZ * dt;
        if (game.playerY < 0) {
          game.playerY = 0;
          game.endLaunchVy = 0;
        }
      }
      playerRoot.position.set(game.playerX, game.playerY, 0);
    } else if (game.endType === "rear") {
      game.playerX += game.endDriftX * dt * Math.max(0, 1 - game.endTimer * 0.5);
      playerRoot.position.set(game.playerX, game.playerY, 0);
      playerRoot.rotation.y += game.endSpinY * dt;
      playerRoot.rotation.z += game.endSpinZ * dt;
    } else if (game.endType === "fuel") {
      game.speed = Math.max(0, game.speed - 16 * dt);
      if (Math.random() < dt * 10) {
        createSpriteEffect({
          map: smokeTexture,
          color: 0x4f4b57,
          position: new THREE.Vector3(game.playerX + rand(-0.4, 0.4), 1.1, -1.6),
          scale: rand(0.4, 0.8),
          velocity: new THREE.Vector3(rand(-0.3, 0.3), rand(0.6, 1.4), rand(-0.5, 0.3)),
          gravity: -0.4,
          life: rand(0.9, 1.7),
          grow: 1.6,
          opacity: 0.35,
          additive: false
        });
      }
    }
    if (game.endTimer >= game.endDelay) showResults();
  }

  function updateHud() {
    const score = Math.floor(game.score);
    if (game.hudCache.score !== score) {
      game.hudCache.score = score;
      dom.score.textContent = score.toLocaleString("en-US");
    }
    game.displaySpeed = damp(game.displaySpeed, game.speed, 8, 1 / 60);
    const overdrive = game.displaySpeed > SPEEDO_MAX + 0.5;
    const speed = Math.round(Math.min(game.displaySpeed, SPEEDO_MAX));
    if (game.hudCache.speed !== speed) {
      game.hudCache.speed = speed;
      dom.speed.textContent = speed;
      const ratio = clamp(speed / SPEEDO_MAX, 0, 1);
      dom.speedNeedle.style.setProperty("--angle", `${-140 + ratio * 280}deg`);
      dom.speedo.style.setProperty("--sweep", `${ratio * 280}deg`);
    }
    dom.speedo.classList.toggle("is-overdrive", overdrive);
    dom.speedUnit.textContent = overdrive ? "OVERDRIVE" : "km/h";
    dom.speedFx.style.opacity = String(clamp((game.displaySpeed - 118) / 200, 0, 0.42) + (overdrive ? 0.12 : 0));
    const fuel = Math.max(0, game.fuel);
    const fuelPercent = Math.round(fuel);
    if (game.hudCache.fuel !== fuelPercent) {
      game.hudCache.fuel = fuelPercent;
      dom.fuelValue.textContent = `${fuelPercent}%`;
      dom.fuelFill.style.width = `${fuelPercent}%`;
      dom.fuelGauge.classList.toggle("is-low", fuelPercent <= 32);
      dom.fuelGauge.classList.toggle("is-critical", fuelPercent <= 13);
    }
    const integrity = Math.round(game.integrity);
    if (game.hudCache.integrity !== integrity) {
      game.hudCache.integrity = integrity;
      dom.integrityValue.textContent = `${integrity}%`;
      dom.integrityFill.style.width = `${integrity}%`;
      dom.integrityGauge.classList.toggle("is-low", integrity <= 50);
      dom.integrityGauge.classList.toggle("is-critical", integrity <= 22);
    }
    const brake = Math.round(game.brakeForce);
    if (game.hudCache.brake !== brake) {
      game.hudCache.brake = brake;
      dom.brakeValue.innerHTML = `${brake}<small>N</small>`;
      dom.brakeFill.style.height = `${clamp((game.brakeForce / BRAKE_MAX) * 100, 0, 100)}%`;
      dom.brakeGauge.classList.toggle("is-danger", game.brakeForce > BRAKE_LIMIT * 0.73);
    }
    const skill = Math.round(game.skill);
    if (game.hudCache.skill !== skill) {
      game.hudCache.skill = skill;
      dom.skillPercent.innerHTML = `${skill}<small>%</small>`;
      dom.skillFill.style.height = `${skill}%`;
    }
    updateSkillButtons();
    animateUnlockPulse();
    if (game.hornCooldown > 0) {
      game.hornCooldown = Math.max(0, game.hornCooldown - 1 / 60);
      dom.hornBtn.style.opacity = game.hornCooldown > 0 ? "0.55" : "";
    }
  }

  function updateRoad(dt, speed) {
    const meters = (speed / 3.6) * dt;
    for (const dash of laneDashes) {
      dash.position.z += meters;
      if (dash.position.z > 44) dash.position.z -= 449;
    }
    for (const segment of railSegments) {
      segment.position.z += meters;
      if (segment.position.z > 44) segment.position.z -= 457;
    }
    for (const reflector of reflectors) {
      reflector.position.z += meters;
      if (reflector.position.z > 40) reflector.position.z -= 433;
    }
    for (const prop of props) {
      prop.position.z += meters;
      if (prop.position.z > 48) {
        prop.position.z -= 437 + rand(0, 48);
        const side = Math.random() < 0.5 ? -1 : 1;
        prop.position.x = side * rand(7.8, 15.5);
        prop.rotation.y = side < 0 ? rand(-0.2, 0.4) : Math.PI + rand(-0.4, 0.2);
      }
    }
    asphaltTexture.offset.y -= meters * 0.029;
    skyDome.rotation.y += dt * 0.002;
  }

  function updateCamera(dt) {
    const shake = game.shake;
    const shakeX = (Math.random() - 0.5) * shake * 0.75;
    const shakeY = (Math.random() - 0.5) * shake * 0.55;
    game.shake = Math.max(0, game.shake - dt * 2.4);
    const speedRatio = clamp(game.displaySpeed / SPEEDO_MAX, 0, 1);
    if (game.state === "welcome") {
      const targetX = Math.sin(time * 0.18) * 1.2;
      camera.position.x = damp(camera.position.x, targetX, 1.6, dt);
      camera.position.y = damp(camera.position.y, 4.35 + Math.sin(time * 0.33) * 0.08, 2, dt);
      camera.position.z = damp(camera.position.z, 13.8, 2, dt);
      camera.lookAt(0, 1.0 + Math.sin(time * 0.4) * 0.03, -17);
      if (Math.abs(camera.fov - 56) > 0.01) {
        camera.fov = damp(camera.fov, 56, 2, dt);
        camera.updateProjectionMatrix();
      }
      return;
    }
    if (game.state === "ending" || game.state === "results") {
      const targetX = game.playerX * 0.5;
      const targetY = 4.95 + game.playerY * 0.47;
      const targetZ = 14.4 + game.playerY * 0.12;
      camera.position.x = damp(camera.position.x, targetX + shakeX, 4.4, dt);
      camera.position.y = damp(camera.position.y, targetY + shakeY, 4.2, dt);
      camera.position.z = damp(camera.position.z, targetZ, 3.4, dt);
      camera.lookAt(game.playerX * 0.7 + shakeX * 1.5, 1.05 + game.playerY * 0.68, -15);
      camera.fov = damp(camera.fov, 58, 2.5, dt);
      camera.updateProjectionMatrix();
      return;
    }
    const targetX = game.playerX * 0.56;
    const targetY = 5.15 + game.playerY * 0.55 + speedRatio * 0.06;
    const targetZ = 14.2 + speedRatio * 1.55;
    camera.position.x = damp(camera.position.x, targetX + shakeX, 6.2, dt);
    camera.position.y = damp(camera.position.y, targetY + shakeY, 5.2, dt);
    camera.position.z = damp(camera.position.z, targetZ, 4, dt);
    camera.lookAt(game.playerX * 0.72 + shakeX * 1.4, 1.05 + game.playerY * 0.64, -17 - speedRatio * 5);
    camera.fov = damp(camera.fov, 57 + speedRatio * 8.5, 3.4, dt);
    camera.updateProjectionMatrix();
  }

  function update(dt) {
    time += dt;
    processEvents();
    if (game.state === "running") {
      game.elapsed += dt;
      game.invulnerable = Math.max(0, game.invulnerable - dt);
      updatePlayerSpeed(dt);
      if (game.state !== "running") {
        updatePlayerVisual(dt);
        updateNPCs(dt, game.speed);
        updateBatteries(dt);
        updateEffects(dt);
        updateRoad(dt, game.speed);
        updateCamera(dt);
        updateHud();
        updateEngine();
        return;
      }
      updatePlayerJump(dt);
      updatePlayerVisual(dt);
      updateSurfaceEffects(dt);
      updateNPCs(dt, game.speed);
      checkNPCCollisions();
      game.spawnTimer -= dt;
      if (game.spawnTimer <= 0) {
        game.spawnTimer = rand(0.82, 1.55) * clamp(1.2 - game.elapsed * 0.008, 0.72, 1.15);
        const aheadCount = npcs.filter((npc) => npc.z < -6 && !npc.wreck).length;
        if (aheadCount < 9) spawnNPC();
      }
      game.rearSpawnTimer -= dt;
      if (game.rearSpawnTimer <= 0) {
        game.rearSpawnTimer = rand(12, 17);
        const rearExists = npcs.some((npc) => npc.z > 4 && npc.z < 46 && !npc.wreck);
        if (!rearExists) {
          let playerLane = 0;
          for (let i = 1; i < LANE_X.length; i++) {
            if (Math.abs(LANE_X[i] - game.playerX) < Math.abs(LANE_X[playerLane] - game.playerX)) playerLane = i;
          }
          const lane = Math.random() < 0.62 ? playerLane : randInt(0, 2);
          const rearCar = spawnNPC({ rear: true, lane, z: rand(24, 36) });
          if (rearCar) {
            rearCar.isRear = true;
            showToast("后方快车逼近", "alert", 1300);
          }
        }
      }
      checkCollisions();
      updateBatteries(dt);
      updatePickups(dt, game.speed);
      updateRearWarning();
      updateRoad(dt, game.speed);
    } else if (game.state === "ending") {
      game.invulnerable = 0;
      updateEnding(dt);
      updatePlayerVisual(dt);
      updateNPCs(dt, Math.max(0, game.speed * 0.62));
      updateBatteries(dt);
      updatePickups(dt, Math.max(0, game.speed * 0.62));
      updateRoad(dt, Math.max(8, game.speed * 0.55));
      if (game.endType !== "rear") {
        game.speed = Math.max(0, game.speed - 6 * dt);
      }
    } else if (game.state === "results") {
      updateBatteries(dt);
      updatePickups(dt, 8);
      updateNPCs(dt, 8);
      updateRoad(dt, 8);
      game.shake = Math.max(0, game.shake - dt * 2);
    } else if (game.state === "welcome") {
      game.demoTrafficTimer -= dt;
      if (game.demoTrafficTimer <= 0) {
        game.demoTrafficTimer = rand(2.8, 5.6);
        if (npcs.length < 7) spawnNPC({ z: rand(-190, -150), speed: rand(26, 46) });
      }
      updatePlayerVisual(dt);
      updateNPCs(dt, 34);
      updateBatteries(dt);
      updateRoad(dt, 34);
      updateRearWarning();
    }
    updateEffects(dt);
    updateCamera(dt);
    updateHud();
    updateEngine();
  }

  function onResize() {
    const width = dom.game.clientWidth;
    const height = dom.game.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", onResize);
  if (window.ResizeObserver) {
    new ResizeObserver(onResize).observe(dom.game);
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(key)) {
      event.preventDefault();
    }
    if (game.state !== "running") {
      if (key === "Enter" && (game.state === "welcome" || game.state === "results")) {
        if (game.state === "welcome") startGame();
        else startGame();
      }
      return;
    }
    if (key === "a" || key === "A" || key === "ArrowLeft") changeLane(-1);
    else if (key === "d" || key === "D" || key === "ArrowRight") changeLane(1);
    else if (key === "w" || key === "W" || key === "ArrowUp") setThrottle(true);
    else if (key === "s" || key === "S" || key === "ArrowDown") setBrake(true);
    else if (key === " ") triggerHorn();
    else if (key === "1") useSkill("battery");
    else if (key === "2") useSkill("jump");
    else if (key === "3") useSkill("jet");
  });

  window.addEventListener("keyup", (event) => {
    const key = event.key;
    if (key === "w" || key === "W" || key === "ArrowUp") setThrottle(false);
    if (key === "s" || key === "S" || key === "ArrowDown") setBrake(false);
  });

  window.addEventListener("blur", () => {
    setThrottle(false);
    setBrake(false);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      setThrottle(false);
      setBrake(false);
      if (audio && audio.ctx.state === "running") audio.ctx.suspend();
    } else if (audio && audio.ctx.state === "suspended") {
      audio.ctx.resume();
    }
  });

  dom.startBtn.addEventListener("click", startGame);
  dom.restartBtn.addEventListener("click", startGame);
  dom.homeBtn.addEventListener("click", returnHome);
  dom.hornBtn.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    triggerHorn();
  });
  dom.skillBattery.addEventListener("click", () => useSkill("battery"));
  dom.skillJump.addEventListener("click", () => useSkill("jump"));
  dom.skillJet.addEventListener("click", () => useSkill("jet"));
  dom.muteBtn.addEventListener("click", () => {
    muted = !muted;
    try {
      localStorage.setItem("highwayKingMuted", muted ? "1" : "0");
    } catch (error) {
      muted = muted;
    }
    updateMuteButton();
  });

  dom.best.textContent = Math.floor(highScore).toLocaleString("en-US");
  dom.welcomeBest.textContent = Math.floor(highScore).toLocaleString("en-US");
  updateMuteButton();
  startDemoTraffic();
  onResize();
  updateSkillButtons(true);

  let lastFrame = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const rawDt = (now - lastFrame) / 1000;
    lastFrame = now;
    const dt = Math.min(rawDt, 0.05);
    update(dt);
    renderer.render(scene, camera);
  }

  requestAnimationFrame(animate);
})();
