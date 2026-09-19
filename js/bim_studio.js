/**
 * FinGo BIM Studio — Controlador 3D WebGL / PBR com Three.js
 * Visualização fotorrealista de alta fidelidade com texturas procedurais PBR,
 * cortes arquitetônicos dinâmicos (Clipping Planes X, Y, Z), iluminação solar/noturna,
 * água animada da piscina e vínculo direto ao SINAPI e custos do FinGo.
 */

const BIMStudio = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  raycaster: null,
  mouse: null,
  sunLight: null,
  hemiLight: null,
  ambientLight: null,
  interiorLights: [],
  elements: [],
  groupsByDiscipline: {},
  selectedMesh: null,
  originalMaterial: null,
  activeObra: null,

  // Texturas Procedurais PBR
  woodTexture: null,
  poolTileTexture: null,
  waterTexture: null,
  grassTexture: null,
  stoneTexture: null,
  concreteTexture: null,

  // Sistema de Cortes Dinâmicos (Clipping Planes)
  clipPlanes: null,
  activeClip: 'none', // 'none' | 'x' | 'y' | 'z'
  planeHelper: null,
  allMaterials: [],

  init() {
    const container = document.getElementById('viewport-container');
    const canvas = document.getElementById('webgl-canvas');
    if (!container || !canvas || typeof THREE === 'undefined') {
      console.error('[BIM Studio] Three.js ou elementos do DOM não encontrados.');
      return;
    }

    // 1. Configurar Cena com Atmosfera Suave
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060E08);
    this.scene.fog = new THREE.FogExp2(0x060E08, 0.0009);

    // 2. Configurar Câmera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(40, aspect, 1, 3500);
    this.camera.position.set(340, 240, 360);

    // 3. Configurar Renderer WebGL com Sombras Suaves, ACES Tone Mapping e Local Clipping
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.localClippingEnabled = true; // Habilita cortes em tempo real

    // 4. OrbitControls
    this.controls = new THREE.OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // Não permitir câmera abaixo do solo
    this.controls.minDistance = 50;
    this.controls.maxDistance = 1400;
    this.controls.target.set(0, 35, 0);
    this.controls.update();

    // 5. Gerar Texturas Procedurais PBR
    this._generateProceduralTextures();

    // 6. Configurar Cortes Arquitetônicos (Clipping Planes)
    this._setupClippingPlanes();

    // 7. Iluminação Solar & Céu PBR
    this._setupLighting();

    // 8. Grid Técnico do Solo & Platô
    this._setupGroundGrid();

    // 9. Raycaster para Seleção
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // 10. Construir a Mansão de Alto Padrão (480 m²) com as 8 Disciplinas
    this._buildMansionModel();

    // 11. Construir a Interface Lateral
    this._buildProjectTree();

    // 12. Vincular Eventos de Interação
    this._bindEvents();

    // 13. Loop de Renderização 60 FPS
    this._startLoop();
  },

  // =========================================================================
  // GERADOR DE TEXTURAS PROCEDURAIS PBR (CANVAS 2D)
  // =========================================================================
  _generateProceduralTextures() {
    // 1. Textura de Madeira Nobre Cumaru (Deck, Portas e Pergolados)
    const cWood = document.createElement('canvas');
    cWood.width = 512;
    cWood.height = 512;
    const ctxWood = cWood.getContext('2d');
    ctxWood.fillStyle = '#854D0E';
    ctxWood.fillRect(0, 0, 512, 512);

    // Pranchas de madeira com ranhuras e veios
    const plankH = 64;
    for (let y = 0; y < 512; y += plankH) {
      ctxWood.fillStyle = y % 128 === 0 ? '#9A3412' : '#78350F';
      ctxWood.fillRect(0, y, 512, plankH - 3);
      // Ranhura escura entre ripas
      ctxWood.fillStyle = '#1A0D03';
      ctxWood.fillRect(0, y + plankH - 3, 512, 3);
      // Veios sutis de madeira
      for (let i = 0; i < 18; i++) {
        const vy = y + Math.random() * (plankH - 6);
        ctxWood.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)';
        ctxWood.fillRect(0, vy, 512, 2 + Math.random() * 2);
      }
    }
    this.woodTexture = new THREE.CanvasTexture(cWood);
    this.woodTexture.wrapS = THREE.RepeatWrapping;
    this.woodTexture.wrapT = THREE.RepeatWrapping;
    this.woodTexture.repeat.set(4, 4);

    // 2. Pastilhas Vitrificadas da Piscina (Mosaico Azul Cobalto/Turquesa)
    const cTile = document.createElement('canvas');
    cTile.width = 256;
    cTile.height = 256;
    const ctxTile = cTile.getContext('2d');
    ctxTile.fillStyle = '#082F49';
    ctxTile.fillRect(0, 0, 256, 256);
    const tileSize = 16;
    for (let x = 0; x < 256; x += tileSize) {
      for (let y = 0; y < 256; y += tileSize) {
        const blues = ['#0284C7', '#0369A1', '#0EA5E9', '#06B6D4', '#0891B2'];
        ctxTile.fillStyle = blues[Math.floor(Math.random() * blues.length)];
        ctxTile.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
        ctxTile.fillStyle = 'rgba(255,255,255,0.18)';
        ctxTile.fillRect(x + 1, y + 1, tileSize - 2, 2);
      }
    }
    this.poolTileTexture = new THREE.CanvasTexture(cTile);
    this.poolTileTexture.wrapS = THREE.RepeatWrapping;
    this.poolTileTexture.wrapT = THREE.RepeatWrapping;
    this.poolTileTexture.repeat.set(8, 6);

    // 3. Ondulações da Água (Caustics / Normal)
    const cWater = document.createElement('canvas');
    cWater.width = 256;
    cWater.height = 256;
    const ctxWater = cWater.getContext('2d');
    ctxWater.fillStyle = '#06B6D4';
    ctxWater.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 40; i++) {
      ctxWater.beginPath();
      ctxWater.arc(Math.random() * 256, Math.random() * 256, 15 + Math.random() * 30, 0, Math.PI * 2);
      ctxWater.fillStyle = 'rgba(255,255,255,0.08)';
      ctxWater.fill();
    }
    this.waterTexture = new THREE.CanvasTexture(cWater);
    this.waterTexture.wrapS = THREE.RepeatWrapping;
    this.waterTexture.wrapT = THREE.RepeatWrapping;
    this.waterTexture.repeat.set(4, 3);

    // 4. Grama Natural do Terreno
    const cGrass = document.createElement('canvas');
    cGrass.width = 512;
    cGrass.height = 512;
    const ctxGrass = cGrass.getContext('2d');
    ctxGrass.fillStyle = '#166534';
    ctxGrass.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4000; i++) {
      const gx = Math.random() * 512;
      const gy = Math.random() * 512;
      const tones = ['#15803D', '#14532D', '#16A34A', '#1E3A1A'];
      ctxGrass.fillStyle = tones[Math.floor(Math.random() * tones.length)];
      ctxGrass.fillRect(gx, gy, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    this.grassTexture = new THREE.CanvasTexture(cGrass);
    this.grassTexture.wrapS = THREE.RepeatWrapping;
    this.grassTexture.wrapT = THREE.RepeatWrapping;
    this.grassTexture.repeat.set(16, 16);

    // 5. Parede de Destaque em Pedra Moledo / Filetada
    const cStone = document.createElement('canvas');
    cStone.width = 512;
    cStone.height = 512;
    const ctxStone = cStone.getContext('2d');
    ctxStone.fillStyle = '#1E293B';
    ctxStone.fillRect(0, 0, 512, 512);
    const stoneH = 32;
    for (let y = 0; y < 512; y += stoneH) {
      let x = 0;
      while (x < 512) {
        const sw = 40 + Math.random() * 70;
        const stones = ['#334155', '#475569', '#1E293B', '#2D3748', '#3F3F46'];
        ctxStone.fillStyle = stones[Math.floor(Math.random() * stones.length)];
        ctxStone.fillRect(x + 1, y + 1, sw - 2, stoneH - 2);
        ctxStone.fillStyle = 'rgba(255,255,255,0.08)';
        ctxStone.fillRect(x + 1, y + 1, sw - 2, 2);
        x += sw;
      }
    }
    this.stoneTexture = new THREE.CanvasTexture(cStone);
    this.stoneTexture.wrapS = THREE.RepeatWrapping;
    this.stoneTexture.wrapT = THREE.RepeatWrapping;
    this.stoneTexture.repeat.set(3, 2);

    // 6. Concreto Aparente com Micro-Ruído
    const cConc = document.createElement('canvas');
    cConc.width = 256;
    cConc.height = 256;
    const ctxConc = cConc.getContext('2d');
    ctxConc.fillStyle = '#64748B';
    ctxConc.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2000; i++) {
      ctxConc.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
      ctxConc.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    this.concreteTexture = new THREE.CanvasTexture(cConc);
    this.concreteTexture.wrapS = THREE.RepeatWrapping;
    this.concreteTexture.wrapT = THREE.RepeatWrapping;
    this.concreteTexture.repeat.set(4, 4);
  },

  // =========================================================================
  // SISTEMA DE CORTES ARQUITETÔNICOS (CLIPPING PLANES)
  // =========================================================================
  _setupClippingPlanes() {
    this.clipPlanes = {
      x: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),
      y: new THREE.Plane(new THREE.Vector3(0, -1, 0), 58), // Corta no meio do 1º pavimento por padrão
      z: new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)
    };

    // Helper visual com contorno neon para indicar a lâmina do corte
    this.planeHelper = new THREE.PlaneHelper(this.clipPlanes.x, 340, 0xC6FF00);
    this.planeHelper.visible = false;
    this.scene.add(this.planeHelper);
  },

  _getActiveClippingPlanes() {
    if (this.activeClip === 'none') return [];
    return [this.clipPlanes[this.activeClip]];
  },

  _updateAllMaterialsClipping() {
    const planes = this._getActiveClippingPlanes();
    this.allMaterials.forEach(mat => {
      mat.clippingPlanes = planes;
      mat.clipShadows = true;
      mat.needsUpdate = true;
    });
  },

  _setClipMode(mode) {
    this.activeClip = mode;
    const slider = document.getElementById('clip-slider');
    const label = document.getElementById('clip-val-label');

    if (mode === 'none') {
      this.planeHelper.visible = false;
      if (slider) slider.disabled = true;
      if (label) label.textContent = 'OFF';
    } else {
      this.planeHelper.plane = this.clipPlanes[mode];
      this.planeHelper.visible = true;
      if (slider) {
        slider.disabled = false;
        if (mode === 'x') {
          slider.min = -130;
          slider.max = 130;
          slider.value = this.clipPlanes.x.constant;
        } else if (mode === 'y') {
          slider.min = -20;
          slider.max = 130;
          slider.value = this.clipPlanes.y.constant;
        } else if (mode === 'z') {
          slider.min = -160;
          slider.max = 160;
          slider.value = this.clipPlanes.z.constant;
        }
        if (label) label.textContent = `${Number(slider.value).toFixed(0)}m`;
      }
    }

    this._updateAllMaterialsClipping();
  },

  _setClipPosition(val) {
    if (this.activeClip === 'none') return;
    const num = Number(val);
    this.clipPlanes[this.activeClip].constant = num;
    const label = document.getElementById('clip-val-label');
    if (label) label.textContent = `${num.toFixed(0)}m`;
  },

  // =========================================================================
  // ILUMINAÇÃO SOLAR, ATMOSFERA & LUZES INTERNAS
  // =========================================================================
  _setupLighting() {
    // 1. Luz Hemisférica (Céu azul suave / Solo escuro)
    this.hemiLight = new THREE.HemisphereLight(0xBAE6FD, 0x142210, 0.9);
    this.hemiLight.position.set(0, 500, 0);
    this.scene.add(this.hemiLight);

    // 2. Luz Ambiente de Preenchimento
    this.ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.45);
    this.scene.add(this.ambientLight);

    // 3. Luz Solar Direcional com Sombras Suaves
    this.sunLight = new THREE.DirectionalLight(0xFFFAED, 2.0);
    this.sunLight.position.set(220, 340, 180);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 50;
    this.sunLight.shadow.camera.far = 1100;
    const d = 280;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0004;
    this.scene.add(this.sunLight);

    // 4. Luzes Internas Quentes (2700K - Efeito de Estúdio Arquitetônico)
    // Sala de Estar Térreo
    const lightSala = new THREE.PointLight(0xFFA834, 1.4, 180);
    lightSala.position.set(-35, 28, 40);
    this.scene.add(lightSala);
    this.interiorLights.push(lightSala);

    // Varanda Gourmet
    const lightGourmet = new THREE.PointLight(0xFFA834, 1.2, 160);
    lightGourmet.position.set(40, 26, -45);
    this.scene.add(lightGourmet);
    this.interiorLights.push(lightGourmet);

    // Suíte Master 1º Pavimento
    const lightSuite = new THREE.PointLight(0xFFCC80, 1.3, 160);
    lightSuite.position.set(-30, 85, 30);
    this.scene.add(lightSuite);
    this.interiorLights.push(lightSuite);

    // Luz Subaquática da Piscina (Ciano Brilhante)
    const lightPool = new THREE.PointLight(0x22D3EE, 2.4, 140);
    lightPool.position.set(-60, -18, -160);
    this.scene.add(lightPool);
    this.interiorLights.push(lightPool);
  },

  _setLightingMode(mode) {
    if (mode === 'day') {
      this.sunLight.color.setHex(0xFFFAED);
      this.sunLight.intensity = 2.0;
      this.hemiLight.intensity = 0.9;
      this.ambientLight.intensity = 0.45;
      this.scene.background.setHex(0x060E08);
      this.scene.fog.color.setHex(0x060E08);
      this.interiorLights.forEach(l => { l.intensity = 0.4; });
    } else if (mode === 'sunset') {
      this.sunLight.color.setHex(0xF97316);
      this.sunLight.intensity = 1.6;
      this.hemiLight.intensity = 0.6;
      this.ambientLight.intensity = 0.35;
      this.scene.background.setHex(0x1F1106);
      this.scene.fog.color.setHex(0x1F1106);
      this.interiorLights.forEach(l => { l.intensity = 1.6; });
    } else if (mode === 'night') {
      this.sunLight.color.setHex(0x38BDF8);
      this.sunLight.intensity = 0.25;
      this.hemiLight.intensity = 0.2;
      this.ambientLight.intensity = 0.15;
      this.scene.background.setHex(0x020508);
      this.scene.fog.color.setHex(0x020508);
      this.interiorLights.forEach(l => { l.intensity = 2.8; });
    }
  },

  _setupGroundGrid() {
    const grid = new THREE.GridHelper(900, 45, 0x243518, 0x0F1A0E);
    grid.position.y = -48.1;
    this.scene.add(grid);
  },

  // =========================================================================
  // MODELO 3D DA MANSÃO (480 m²) COM AS 8 DISCIPLINAS & MATERIAIS PBR
  // =========================================================================
  _buildMansionModel() {
    const W = 200;
    const L = 260;
    const H = 56;
    const yPav1 = H + 6;
    const yRoofBase = yPav1 + H + 4;

    // Grid de Pilares / Sapatas
    const cols = [-W/2 + 16, 0, W/2 - 16];
    const rows = [-L/2 + 16, -L/6, L/6, L/2 - 16];
    const sapataCoords = [];
    cols.forEach(x => rows.forEach(z => sapataCoords.push({ x, z })));

    // MATERIAIS PBR DE ALTO PADRÃO COM TEXTURAS
    const matConcrete = new THREE.MeshStandardMaterial({
      color: 0x64748B,
      map: this.concreteTexture,
      roughness: 0.82,
      metalness: 0.1
    });

    const matConcreteLight = new THREE.MeshStandardMaterial({
      color: 0x94A3B8,
      map: this.concreteTexture,
      roughness: 0.78,
      metalness: 0.08
    });

    const matSlab = new THREE.MeshStandardMaterial({
      color: 0xCBD5E1,
      roughness: 0.75,
      metalness: 0.05
    });

    const matBrick = new THREE.MeshStandardMaterial({
      color: 0xC2410C,
      roughness: 0.88,
      metalness: 0.0
    });

    const matStoneWall = new THREE.MeshStandardMaterial({
      map: this.stoneTexture,
      roughness: 0.9,
      metalness: 0.1
    });

    const matWallLight = new THREE.MeshStandardMaterial({
      color: 0xF8FAFC,
      roughness: 0.85,
      metalness: 0.0
    });

    const matWoodCumaru = new THREE.MeshStandardMaterial({
      map: this.woodTexture,
      roughness: 0.45,
      metalness: 0.05
    });

    const matDeck = new THREE.MeshStandardMaterial({
      map: this.woodTexture,
      roughness: 0.5,
      metalness: 0.05
    });

    const matFrameBlack = new THREE.MeshStandardMaterial({
      color: 0x0F172A,
      roughness: 0.3,
      metalness: 0.85
    });

    const matInox = new THREE.MeshStandardMaterial({
      color: 0xF8FAFC,
      roughness: 0.15,
      metalness: 0.95
    });

    const matGranite = new THREE.MeshStandardMaterial({
      color: 0x1E293B,
      roughness: 0.25,
      metalness: 0.2
    });

    const matGrass = new THREE.MeshStandardMaterial({
      map: this.grassTexture,
      roughness: 0.95,
      metalness: 0.0
    });

    const matPoolBottom = new THREE.MeshStandardMaterial({
      map: this.poolTileTexture,
      roughness: 0.3,
      metalness: 0.1
    });

    // Vidro Duplo Arquitetônico com Alta Transparência e Reflexos
    const matGlass = new THREE.MeshPhysicalMaterial({
      color: 0xBAE6FD,
      transparent: true,
      opacity: 0.38,
      roughness: 0.03,
      transmission: 0.94,
      ior: 1.52,
      reflectivity: 0.8
    });

    // Água Translúcida da Piscina com Ondulações
    const matWater = new THREE.MeshPhysicalMaterial({
      color: 0x06B6D4,
      map: this.waterTexture,
      transparent: true,
      opacity: 0.78,
      roughness: 0.06,
      transmission: 0.92,
      ior: 1.333,
      reflectivity: 0.85
    });

    // Instalações MEP
    const matPipeCold = new THREE.MeshStandardMaterial({ color: 0x2563EB, roughness: 0.35, metalness: 0.4 });
    const matPipeHot = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.35, metalness: 0.4 });
    const matPipeSewage = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.5, metalness: 0.1 });
    const matDuct = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.25, metalness: 0.85 });
    const matTray = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.8 });
    const matElectric = new THREE.MeshStandardMaterial({ color: 0xFACC15, roughness: 0.4, metalness: 0.2 });
    const matRoofTile = new THREE.MeshStandardMaterial({ color: 0x9A3412, roughness: 0.75, metalness: 0.05 });

    // Registrar materiais para cortes automáticos
    this.allMaterials = [
      matConcrete, matConcreteLight, matSlab, matBrick, matStoneWall, matWallLight,
      matWoodCumaru, matDeck, matFrameBlack, matInox, matGranite, matGrass, matPoolBottom,
      matGlass, matWater, matPipeCold, matPipeHot, matPipeSewage, matDuct, matTray, matElectric, matRoofTile
    ];

    const createBox = (w, h, d, x, y, z, mat, name, cat, sinapi, orcado) => {
      const geom = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x + w/2, y + h/2, z + d/2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { name, category: cat, sinapi, orcado, originalMaterial: mat };
      return mesh;
    };

    // =========================================================================
    // 0. TERRENO, PLATÔ & IMPLANTAÇÃO
    // =========================================================================
    const groupSite = new THREE.Group();
    groupSite.name = 'Terreno & Implantação';
    groupSite.userData = { id: 'site', sinapi: '98462', orcado: 35000, desc: 'Platô nivelado, calçadas perimetrais e grama natural esmeralda.' };
    groupSite.add(createBox(W + 120, 6, L + 160, -W/2 - 60, -48, -L/2 - 90, matGrass, 'Grama Natural Esmeralda', 'Terreno', '98462', 15000));
    groupSite.add(createBox(W + 40, 4, L + 50, -W/2 - 20, -42, -L/2 - 25, matConcrete, 'Calçada de Acesso Concreto Usinado', 'Terreno', '98462', 20000));

    // =========================================================================
    // 1. FUNDAÇÕES, RADIER, PISCINA & DECK
    // =========================================================================
    const groupFundacao = new THREE.Group();
    groupFundacao.name = 'Fundações & Piscina';
    groupFundacao.userData = { id: 'fundacao', sinapi: '96538', orcado: 145000, desc: '12 sapatas isoladas CA-50, baldrames, radier e piscina de concreto armado.' };
    sapataCoords.forEach(pos => {
      groupFundacao.add(createBox(36, 16, 36, pos.x - 18, -44, pos.z - 18, matConcrete, 'Sapata Isolada CA-50', 'Fundações', '96538', 4000));
      groupFundacao.add(createBox(18, 14, 18, pos.x - 9, -28, pos.z - 9, matConcreteLight, 'Arranque de Pilar', 'Fundações', '96538', 1500));
    });
    cols.forEach(x => groupFundacao.add(createBox(16, 14, L - 24, x - 8, -14, -L/2 + 12, matConcreteLight, 'Viga Baldrame Long.', 'Fundações', '96538', 8000)));
    rows.forEach(z => groupFundacao.add(createBox(W - 24, 14, 16, -W/2 + 12, -14, z - 8, matConcreteLight, 'Viga Baldrame Trans.', 'Fundações', '96538', 6000)));
    groupFundacao.add(createBox(W - 12, 4, L - 12, -W/2 + 6, -2, -L/2 + 6, matSlab, 'Contrapiso Radier', 'Fundações', '96538', 15000));
    
    // Piscina com Revestimento Pastilhado, Espelho d'Água e Deck de Cumaru
    groupFundacao.add(createBox(80, 36, 60, -W/2 + 20, -36, -L/2 - 70, matPoolBottom, 'Estrutura e Pastilhas da Piscina', 'Lazer', '96538', 25000));
    groupFundacao.add(createBox(72, 4, 52, -W/2 + 24, -4, -L/2 - 66, matWater, "Espelho d'Água Translúcido", 'Lazer', '96538', 12000));
    groupFundacao.add(createBox(100, 3, 80, -W/2 + 12, -1, -L/2 - 80, matDeck, 'Deck Madeira Nobre Cumaru', 'Lazer', '96538', 18000));

    // =========================================================================
    // 2. SUPERESTRUTURA DE CONCRETO
    // =========================================================================
    const groupEstrutura = new THREE.Group();
    groupEstrutura.name = 'Superestrutura de Concreto';
    groupEstrutura.userData = { id: 'estrutura', sinapi: '103670', orcado: 230000, desc: '24 pilares 30x30 cm, vigas de cinta e lajes maciças protendidas.' };
    sapataCoords.forEach(pos => {
      groupEstrutura.add(createBox(16, H, 16, pos.x - 8, 2, pos.z - 8, matConcreteLight, 'Pilar Térreo (30x30)', 'Estrutural', '103670', 3500));
      groupEstrutura.add(createBox(16, H, 16, pos.x - 8, yPav1 + 2, pos.z - 8, matConcreteLight, 'Pilar 1º Pavimento', 'Estrutural', '103670', 3500));
    });
    groupEstrutura.add(createBox(W - 4, 8, L + 30, -W/2 + 2, yPav1 - 6, -L/2 + 2, matSlab, 'Laje Maciça Protendida Intermediária', 'Estrutural', '103670', 45000));
    groupEstrutura.add(createBox(W - 4, 8, L - 4, -W/2 + 2, yRoofBase - 6, -L/2 + 2, matSlab, 'Laje Forro Superior', 'Estrutural', '103670', 38000));

    // =========================================================================
    // 3. ARQUITETURA & ALVENARIA (PAREDES DECORATIVAS & VIDRO)
    // =========================================================================
    const groupArq = new THREE.Group();
    groupArq.name = 'Arquitetura & Alvenaria';
    groupArq.userData = { id: 'arquitetura', sinapi: '104658', orcado: 180000, desc: 'Alvenaria com pedra decorativa, pele de vidro duplo, esquadrias pretas e porta pivotante monumental.' };
    
    // Parede de Destaque em Pedra Moledo na Fachada
    groupArq.add(createBox(70, H, 8, -W/2 + 10, 2, L/2 - 14, matStoneWall, 'Parede Revestida em Pedra Moledo', 'Arquitetura', '104658', 16000));
    groupArq.add(createBox(58, 38, 3, -W/2 + 16, 12, L/2 - 13, matGlass, 'Pele de Vidro Duplo Laminado', 'Arquitetura', '104658', 25000));
    groupArq.add(createBox(62, 42, 1, -W/2 + 14, 10, L/2 - 14, matFrameBlack, 'Caixilharia Linha Gold Anodizada', 'Arquitetura', '104658', 10000));
    
    // Porta Pivotante Monumental Cumaru com Puxador Inox
    groupArq.add(createBox(34, 50, 5, -6, 2, L/2 - 13, matWoodCumaru, 'Porta Pivotante Cumaru 3,20m', 'Arquitetura', '104658', 15000));
    groupArq.add(createBox(3, 22, 3, 22, 16, L/2 - 8, matInox, 'Puxador Inox Escovado 1,50m', 'Arquitetura', '104658', 1800));
    
    // Paredes Laterais e Espaço Gourmet
    groupArq.add(createBox(8, H, L - 24, -W/2 + 10, 2, -L/2 + 10, matWallLight, 'Parede Lateral Esquerda', 'Arquitetura', '104658', 18000));
    groupArq.add(createBox(8, H, L - 24, W/2 - 18, 2, -L/2 + 10, matWallLight, 'Parede Lateral Direita', 'Arquitetura', '104658', 18000));
    groupArq.add(createBox(60, 20, 18, 20, 2, -L/2 + 20, matGranite, 'Bancada Granito São Gabriel', 'Arquitetura', '104658', 8500));
    groupArq.add(createBox(18, 52, 18, 62, 2, -L/2 + 18, matBrick, 'Churrasqueira Alvenaria Refratária', 'Arquitetura', '104658', 6000));
    
    // 1º Pavimento
    groupArq.add(createBox(W - 16, 22, 2, -W/2 + 8, yPav1 + 6, L/2 + 30, matGlass, 'Guarda-corpo Sacada Vidro Laminado', 'Arquitetura', '104658', 14000));
    groupArq.add(createBox(W - 12, 3, 4, -W/2 + 6, yPav1 + 28, L/2 + 29, matFrameBlack, 'Corrimão Alumínio Preto Fosco', 'Arquitetura', '104658', 4500));
    groupArq.add(createBox(90, H, 8, -W/2 + 10, yPav1 + 2, L/2 - 14, matWallLight, 'Parede Suíte Master', 'Arquitetura', '104658', 16000));
    groupArq.add(createBox(56, 46, 3, -36, yPav1 + 2, L/2 - 12, matGlass, 'Porta-Balcão 4 Folhas Vidro', 'Arquitetura', '104658', 12000));

    // =========================================================================
    // 4. INSTALAÇÕES HIDROSSANITÁRIAS & ESGOTO
    // =========================================================================
    const groupHid = new THREE.Group();
    groupHid.name = 'Instalações Hidrossanitárias';
    groupHid.userData = { id: 'hidraulica', sinapi: '89985', orcado: 115000, desc: '2 Caixas de 1.500L, barrilete 50mm, colunas de água fria/quente PPR e tubos de queda 100mm.' };
    groupHid.add(createBox(32, 28, 32, -44, yRoofBase + 8, -20, matPipeCold, "Caixa d'Água 1.500 L (1)", 'Hidráulica', '89985', 3800));
    groupHid.add(createBox(32, 28, 32, 12, yRoofBase + 8, -20, matPipeCold, "Caixa d'Água 1.500 L (2)", 'Hidráulica', '89985', 3800));
    groupHid.add(createBox(92, 5, 6, -46, yRoofBase + 2, -24, matPipeCold, 'Barrilete Geral 50mm Soldável', 'Hidráulica', '89985', 4500));
    const pipesCol = [{ x: -W/2 + 28, z: 20 }, { x: W/2 - 36, z: 20 }, { x: 0, z: -L/2 + 30 }];
    pipesCol.forEach(col => {
      groupHid.add(createBox(4, yRoofBase + 4, 4, col.x, 2, col.z, matPipeCold, 'Coluna Água Fria Soldável (Azul)', 'Hidráulica', '89985', 2800));
      groupHid.add(createBox(4, yRoofBase + 4, 4, col.x + 6, 2, col.z, matPipeHot, 'Coluna Água Quente PPR (Verde)', 'Hidráulica', '89985', 3500));
      groupHid.add(createBox(7, yRoofBase + 2, 7, col.x + 14, -16, col.z, matPipeSewage, 'Tubo de Queda Esgoto 100mm (Branco)', 'Hidráulica', '89985', 4200));
      groupHid.add(createBox(40, 4, 4, col.x - 20, yPav1 - 2, col.z, matPipeCold, 'Ramal Distribuição', 'Hidráulica', '89985', 1800));
    });
    groupHid.add(createBox(W - 40, 8, 8, -W/2 + 20, -18, -L/2 + 10, matPipeSewage, 'Coletor Predial Esgoto 150mm', 'Hidráulica', '89985', 12000));

    // =========================================================================
    // 5. INSTALAÇÕES ELÉTRICAS & AUTOMAÇÃO
    // =========================================================================
    const groupEle = new THREE.Group();
    groupEle.name = 'Instalações Elétricas';
    groupEle.userData = { id: 'eletrica', sinapi: '91834', orcado: 125000, desc: 'QDG 48 disjuntores, eletrocalhas perfuradas, eletrodutos PEAD e spots LED de embutir.' };
    groupEle.add(createBox(6, 28, 24, -W/2 + 14, 18, 40, matElectric, 'Quadro QDG 48 Disjuntores', 'Elétrica', '91834', 12000));
    groupEle.add(createBox(6, 24, 20, -W/2 + 14, yPav1 + 18, 40, matElectric, 'Quadro QDC 1º Pavimento', 'Elétrica', '91834', 8500));
    groupEle.add(createBox(8, 5, L - 60, -W/2 + 18, H - 4, -L/2 + 30, matTray, 'Eletrocalha Perfurada Térreo', 'Elétrica', '91834', 9500));
    groupEle.add(createBox(8, 5, L - 60, -W/2 + 18, yPav1 + H - 4, -L/2 + 30, matTray, 'Eletrocalha Perfurada 1º Pav.', 'Elétrica', '91834', 9500));
    const circuits = [{ x: -40, z: 60 }, { x: 40, z: 60 }, { x: -40, z: -40 }, { x: 40, z: -40 }];
    circuits.forEach(pt => {
      groupEle.add(createBox(3, H - 8, 3, pt.x, 4, pt.z, matElectric, 'Eletroduto PEAD Antichamas', 'Elétrica', '91834', 1200));
      groupEle.add(createBox(12, 2, 12, pt.x - 6, H - 1, pt.z - 6, matInox, 'Painel LED Embutir 24W', 'Elétrica', '91834', 650));
      groupEle.add(createBox(12, 2, 12, pt.x - 6, yPav1 + H - 1, pt.z - 6, matInox, 'Painel LED 1º Pav.', 'Elétrica', '91834', 650));
    });

    // =========================================================================
    // 6. CLIMATIZAÇÃO CENTRAL & HVAC
    // =========================================================================
    const groupHvac = new THREE.Group();
    groupHvac.name = 'Climatização & HVAC';
    groupHvac.userData = { id: 'mecanica', sinapi: '98512', orcado: 85000, desc: 'Sistema VRF 16 HP, rede de dutos galvanizados e evaporadoras cassete 4 vias.' };
    groupHvac.add(createBox(26, 32, 20, W/2 - 40, yRoofBase + 2, -L/2 + 20, matConcrete, 'Condensadora VRF 8 HP (1)', 'HVAC', '98512', 22000));
    groupHvac.add(createBox(26, 32, 20, W/2 - 40, yRoofBase + 2, -L/2 + 50, matConcrete, 'Condensadora VRF 8 HP (2)', 'HVAC', '98512', 22000));
    groupHvac.add(createBox(40, 8, L - 60, -20, H - 8, -L/2 + 30, matDuct, 'Duto Principal Galvanizado Térreo', 'HVAC', '98512', 12000));
    groupHvac.add(createBox(40, 8, L - 60, -20, yPav1 + H - 8, -L/2 + 30, matDuct, 'Duto Climatização 1º Pav.', 'HVAC', '98512', 12000));
    groupHvac.add(createBox(32, 6, 32, -16, H - 6, 20, matWallLight, 'Evaporadora Cassete 4 Vias Sala', 'HVAC', '98512', 4500));
    groupHvac.add(createBox(32, 6, 32, -16, H - 6, -60, matWallLight, 'Evaporadora Cassete Gourmet', 'HVAC', '98512', 4500));
    groupHvac.add(createBox(32, 6, 32, -16, yPav1 + H - 6, 20, matWallLight, 'Evaporadora Cassete Suíte', 'HVAC', '98512', 4500));

    // =========================================================================
    // 7. COBERTURA & TELHADO COLONIAL
    // =========================================================================
    const groupCob = new THREE.Group();
    groupCob.name = 'Cobertura & Telhado';
    groupCob.userData = { id: 'cobertura', sinapi: '94213', orcado: 120000, desc: 'Telhado colonial cerâmico de 2 águas com cumeeira e calhas galvanizadas.' };
    
    // Geometria de Telhado Inclinado 2 Águas
    const roofGeom = new THREE.ConeGeometry(W/2 + 20, 44, 4);
    const roofMesh = new THREE.Mesh(roofGeom, matRoofTile);
    roofMesh.position.set(0, yRoofBase + 24, 0);
    roofMesh.rotation.y = Math.PI / 4;
    roofMesh.scale.set(1.15, 1, 1.4);
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    roofMesh.userData = { name: 'Telhado Colonial 2 Águas', category: 'Cobertura', sinapi: '94213', orcado: 110000, originalMaterial: matRoofTile };
    groupCob.add(roofMesh);

    groupCob.add(createBox(6, 6, L + 28, -W/2 - 14, yRoofBase - 2, -L/2 - 14, matConcrete, 'Calha Pluvial Galvanizada Esq.', 'Cobertura', '94213', 5000));
    groupCob.add(createBox(6, 6, L + 28, W/2 + 8, yRoofBase - 2, -L/2 - 14, matConcrete, 'Calha Pluvial Galvanizada Dir.', 'Cobertura', '94213', 5000));

    // Adicionar Grupos à Cena
    const groups = [groupSite, groupFundacao, groupEstrutura, groupArq, groupHid, groupEle, groupHvac, groupCob];
    groups.forEach(grp => {
      this.scene.add(grp);
      this.groupsByDiscipline[grp.userData.id] = grp;
    });

    this.elements = groups;
  },

  // =========================================================================
  // ÁRVORE DE PROJETO & INSPEÇÃO
  // =========================================================================
  _buildProjectTree() {
    const list = document.getElementById('studio-tree-list');
    if (!list) return;

    const icons = {
      site: '🌿',
      fundacao: '🧱',
      estrutura: '🏗️',
      arquitetura: '🏛️',
      hidraulica: '💧',
      eletrica: '⚡',
      mecanica: '🧊',
      cobertura: '🏠'
    };

    list.innerHTML = this.elements.map((grp, idx) => {
      const id = grp.userData.id;
      const icon = icons[id] || '📦';
      const count = grp.children.length;
      const isSelected = idx === 1;

      return `
        <div class="bim-tree-item ${isSelected ? 'selected' : ''}" data-tree-id="${id}">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.0rem;">${icon}</span>
            <div>
              <div class="elem-title" style="font-size:.76rem;font-weight:700;color:#F0EAD6;">${grp.name}</div>
              <div style="font-size:.62rem;color:#94A3B8;">${count} peças &middot; R$ ${Number(grp.userData.orcado || 0).toLocaleString('pt-BR')}</div>
            </div>
          </div>
          <button type="button" class="btn-eye" data-discipline="${id}" style="background:transparent;border:none;color:#C6FF00;font-size:.9rem;cursor:pointer;padding:2px 4px;" title="Ligar/Desligar Camada">
            👁️
          </button>
        </div>
      `;
    }).join('');

    // Eventos de clique na árvore
    list.querySelectorAll('.bim-tree-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-eye')) return;
        list.querySelectorAll('.bim-tree-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        const id = item.getAttribute('data-tree-id');
        this._selectDisciplineGroup(id);
      });
    });

    // Eventos de ligar/desligar visibilidade
    list.querySelectorAll('.btn-eye').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-discipline');
        const grp = this.groupsByDiscipline[id];
        if (grp) {
          grp.visible = !grp.visible;
          btn.textContent = grp.visible ? '👁️' : '👁️‍🗨️';
          btn.style.color = grp.visible ? '#C6FF00' : '#64748B';
          btn.style.opacity = grp.visible ? '1' : '0.45';
        }
      });
    });
  },

  _selectDisciplineGroup(id) {
    const grp = this.groupsByDiscipline[id];
    if (!grp) return;

    const nameEl = document.getElementById('inspected-name');
    const descEl = document.getElementById('inspected-desc');
    const sinapiEl = document.getElementById('inspected-sinapi');
    const orcadoEl = document.getElementById('inspected-orcado');

    if (nameEl) nameEl.textContent = grp.name;
    if (descEl) descEl.textContent = grp.userData.desc || '';
    if (sinapiEl) sinapiEl.textContent = grp.userData.sinapi || '—';
    if (orcadoEl) orcadoEl.textContent = `R$ ${Number(grp.userData.orcado || 0).toLocaleString('pt-BR')}`;
  },

  // =========================================================================
  // VINCULAÇÃO DE EVENTOS DO USUÁRIO
  // =========================================================================
  _bindEvents() {
    const canvas = document.getElementById('webgl-canvas');
    const container = document.getElementById('viewport-container');

    // Redimensionamento de Janela
    window.addEventListener('resize', () => {
      if (!this.camera || !this.renderer || !container) return;
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    });

    // Clique no Canvas para Raycasting e Inspeção de Peças
    canvas.addEventListener('pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.scene.children, true);

      if (intersects.length > 0) {
        const hit = intersects.find(i => i.object.isMesh && i.object.userData.name);
        if (hit) {
          this._selectMesh(hit.object);
        }
      }
    });

    // Vistas de Câmera
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const view = e.currentTarget.getAttribute('data-view');
        this._setCameraView(view);
      });
    });

    // Cortes Arquitetônicos (Clipping Planes)
    document.querySelectorAll('[data-clip]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-clip]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const clipMode = e.currentTarget.getAttribute('data-clip');
        this._setClipMode(clipMode);
      });
    });

    // Slider de Posição do Corte
    const clipSlider = document.getElementById('clip-slider');
    if (clipSlider) {
      clipSlider.addEventListener('input', (e) => {
        this._setClipPosition(e.target.value);
      });
    }

    // Presets de Iluminação (Dia / Tarde / Noite)
    document.querySelectorAll('[data-light]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-light]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const lightMode = e.currentTarget.getAttribute('data-light');
        this._setLightingMode(lightMode);
      });
    });

    // Shading PBR vs Wireframe
    document.querySelectorAll('[data-shading]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-shading]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const mode = e.currentTarget.getAttribute('data-shading');
        this._setShadingMode(mode);
      });
    });

    // Slider Solar
    const sunSlider = document.getElementById('sun-slider');
    if (sunSlider) {
      sunSlider.addEventListener('input', (e) => {
        const angle = (Number(e.target.value) * Math.PI) / 180;
        const radius = 380;
        this.sunLight.position.x = Math.cos(angle) * radius;
        this.sunLight.position.z = Math.sin(angle) * radius;
      });
    }

    // Botão Alternar Todas Visibilidade
    const toggleAllBtn = document.getElementById('btn-toggle-all-vis');
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener('click', () => {
        const allVisible = Object.values(this.groupsByDiscipline).every(g => g.visible);
        Object.values(this.groupsByDiscipline).forEach(g => { g.visible = !allVisible; });
        document.querySelectorAll('.btn-eye').forEach(b => {
          b.textContent = !allVisible ? '👁️' : '👁️‍🗨️';
          b.style.color = !allVisible ? '#C6FF00' : '#64748B';
          b.style.opacity = !allVisible ? '1' : '0.45';
        });
      });
    }

    // Captura de Imagem 4K
    const btnSnapshot = document.getElementById('btn-snapshot');
    if (btnSnapshot) {
      btnSnapshot.addEventListener('click', () => {
        this._takeSnapshot();
      });
    }

    // Tela Cheia
    const btnFullscreen = document.getElementById('btn-fullscreen');
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }
  },

  _selectMesh(mesh) {
    if (this.selectedMesh && this.originalMaterial) {
      this.selectedMesh.material = this.originalMaterial;
    }

    this.selectedMesh = mesh;
    this.originalMaterial = mesh.material;

    // Destacar com Material Emissivo FinGo
    mesh.material = new THREE.MeshStandardMaterial({
      color: 0xC6FF00,
      emissive: 0x3F51B5,
      emissiveIntensity: 0.35,
      roughness: 0.2,
      metalness: 0.8
    });
    mesh.material.clippingPlanes = this._getActiveClippingPlanes();

    const data = mesh.userData;
    const nameEl = document.getElementById('inspected-name');
    const descEl = document.getElementById('inspected-desc');
    const sinapiEl = document.getElementById('inspected-sinapi');
    const orcadoEl = document.getElementById('inspected-orcado');

    if (nameEl) nameEl.textContent = data.name;
    if (descEl) descEl.textContent = `Componente 3D classificado na macroetapa de ${data.category}.`;
    if (sinapiEl) sinapiEl.textContent = data.sinapi || '96538';
    if (orcadoEl) orcadoEl.textContent = `R$ ${Number(data.orcado || 0).toLocaleString('pt-BR')}`;
  },

  _setCameraView(view) {
    const labelEl = document.getElementById('cam-view-label');
    switch (view) {
      case 'iso':
        this.camera.position.set(340, 240, 360);
        this.controls.target.set(0, 35, 0);
        if (labelEl) labelEl.textContent = 'ISOMÉTRICA NW';
        break;
      case 'top':
        this.camera.position.set(0, 520, 0.1);
        this.controls.target.set(0, 0, 0);
        if (labelEl) labelEl.textContent = 'PLANTA SUPERIOR';
        break;
      case 'front':
        this.camera.position.set(0, 70, 440);
        this.controls.target.set(0, 40, 0);
        if (labelEl) labelEl.textContent = 'FACHADA FRONTAL';
        break;
      case 'side':
        this.camera.position.set(440, 70, 0);
        this.controls.target.set(0, 40, 0);
        if (labelEl) labelEl.textContent = 'FACHADA LATERAL';
        break;
    }
    this.controls.update();
  },

  _setShadingMode(mode) {
    const planes = this._getActiveClippingPlanes();
    this.scene.traverse((obj) => {
      if (obj.isMesh && obj.userData.originalMaterial) {
        if (mode === 'wireframe') {
          obj.material = new THREE.MeshBasicMaterial({ color: 0xC6FF00, wireframe: true });
        } else {
          obj.material = obj.userData.originalMaterial;
        }
        obj.material.clippingPlanes = planes;
      }
    });
  },

  _takeSnapshot() {
    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `fingo_bim_studio_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  _startLoop() {
    let lastTime = performance.now();
    let frames = 0;
    const fpsEl = document.getElementById('fps-counter');

    const animate = () => {
      requestAnimationFrame(animate);

      // Atualizar controles de órbita
      if (this.controls) this.controls.update();

      // Animação sutil das ondas da água da piscina em tempo real
      if (this.waterTexture) {
        this.waterTexture.offset.x += 0.0006;
        this.waterTexture.offset.y += 0.0004;
      }

      // Renderizar Cena Three.js
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }

      // Contador de FPS
      frames++;
      const now = performance.now();
      if (now >= lastTime + 1000) {
        if (fpsEl) fpsEl.textContent = `${frames} FPS`;
        frames = 0;
        lastTime = now;
      }
    };

    animate();
  }
};

// Inicialização automática ao carregar o DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => BIMStudio.init());
} else {
  BIMStudio.init();
}
