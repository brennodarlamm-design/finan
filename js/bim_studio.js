/**
 * FinGo BIM Studio — Controlador 3D WebGL / PBR com Three.js
 * Visualização fotorrealista de alta fidelidade com iluminação solar, materiais PBR,
 * corte arquitetônico cutaway e vínculo direto ao banco de dados e SINAPI do FinGo.
 */

const BIMStudio = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  raycaster: null,
  mouse: null,
  sunLight: null,
  elements: [],
  groupsByDiscipline: {},
  selectedMesh: null,
  originalMaterial: null,
  activeObra: null,

  init() {
    const container = document.getElementById('viewport-container');
    const canvas = document.getElementById('webgl-canvas');
    if (!container || !canvas || typeof THREE === 'undefined') {
      console.error('[BIM Studio] Three.js ou elementos do DOM não encontrados.');
      return;
    }

    // 1. Configurar Cena
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050805);
    this.scene.fog = new THREE.FogExp2(0x050805, 0.0012);

    // 2. Configurar Câmera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(40, aspect, 1, 3000);
    this.camera.position.set(320, 260, 340);

    // 3. Configurar Renderer WebGL com Sombras Suaves e ACES Tone Mapping
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
    this.renderer.toneMappingExposure = 1.15;

    // 4. OrbitControls
    this.controls = new THREE.OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // Não deixar passar do chão
    this.controls.minDistance = 60;
    this.controls.maxDistance = 1200;
    this.controls.target.set(0, 35, 0);
    this.controls.update();

    // 5. Iluminação Solar & Céu PBR
    this._setupLighting();

    // 6. Grid Técnico do Solo
    this._setupGroundGrid();

    // 7. Raycaster para Seleção
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // 8. Construir a Mansão de Alto Padrão (480 m²) com as 8 Disciplinas
    this._buildMansionModel();

    // 9. Construir a Interface Lateral
    this._buildProjectTree();

    // 10. Vincular Eventos
    this._bindEvents();

    // 11. Loop de Renderização 60 FPS
    this._startLoop();
  },

  _setupLighting() {
    // Luz Hemisférica (Céu ciano suave / Solo escuro)
    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x142210, 0.85);
    hemiLight.position.set(0, 500, 0);
    this.scene.add(hemiLight);

    // Luz Ambiente suave de preenchimento
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(ambientLight);

    // Luz Solar Direcional com Sombras de Alta Resolução
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.8);
    this.sunLight.position.set(220, 340, 180);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 50;
    this.sunLight.shadow.camera.far = 1000;
    const d = 260;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0003;
    this.scene.add(this.sunLight);
  },

  _setupGroundGrid() {
    const grid = new THREE.GridHelper(800, 40, 0x243518, 0x142210);
    grid.position.y = -48.1;
    this.scene.add(grid);
  },

  _buildMansionModel() {
    const W = 200;
    const L = 260;
    const H = 56;
    const yPav1 = H + 6;
    const yRoofBase = yPav1 + H + 4;

    // Grid de 12 Pilares / Sapatas
    const cols = [-W/2 + 16, 0, W/2 - 16];
    const rows = [-L/2 + 16, -L/6, L/6, L/2 - 16];
    const sapataCoords = [];
    cols.forEach(x => rows.forEach(z => sapataCoords.push({ x, z })));

    // Materiais PBR
    const matConcrete = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85, metalness: 0.1 });
    const matConcreteLight = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8, metalness: 0.1 });
    const matSlab = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.75, metalness: 0.05 });
    const matBrick = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.9, metalness: 0.0 });
    const matWallLight = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.85, metalness: 0.0 });
    const matWoodCumaru = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6, metalness: 0.05 });
    const matDeck = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.65, metalness: 0.05 });
    const matFrameBlack = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.85 });
    const matInox = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15, metalness: 0.95 });
    const matGranite = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.2 });

    // Vidro Duplo com Transparência e Reflexo
    const matGlass = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.42,
      roughness: 0.05,
      transmission: 0.88,
      ior: 1.5,
      reflectivity: 0.7
    });

    // Água da Piscina com Efeito Translúcido e Refração
    const matWater = new THREE.MeshPhysicalMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.82,
      roughness: 0.08,
      metalness: 0.1,
      transmission: 0.65,
      ior: 1.333
    });

    // MEP: Tubulações, Dutos e Elétrica
    const matPipeCold = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.25, metalness: 0.3 });
    const matPipeHot = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.25, metalness: 0.3 });
    const matPipeSewage = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.1 });
    const matDuct = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.85 });
    const matElectric = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.5 });
    const matTray = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.35, metalness: 0.75 });
    const matRoofTile = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.75, metalness: 0.05 });
    const matGrass = new THREE.MeshStandardMaterial({ color: 0x143015, roughness: 0.95, metalness: 0.0 });

    const createBox = (w, h, d, x, y, z, mat, name, category, sinapi, orcado) => {
      const geom = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x + w / 2, y + h / 2, z + d / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { name, category, sinapi, orcado, originalMaterial: mat };
      return mesh;
    };

    // =========================================================================
    // 0. TERRENO & IMPLANTAÇÃO
    // =========================================================================
    const groupSite = new THREE.Group();
    groupSite.name = 'Terreno & Implantação';
    groupSite.userData = { id: 'site', sinapi: '98462', orcado: 35000, desc: 'Movimento de terra, platô gramado e calçadas de concreto.' };
    groupSite.add(createBox(W + 110, 4, L + 160, -W/2 - 55, -48, -L/2 - 110, matGrass, 'Platô Gramado', 'Terreno', '98462', 20000));
    groupSite.add(createBox(60, 3, 40, -30, -46, L/2 + 10, matConcrete, 'Calçada Social', 'Terreno', '98462', 5000));
    groupSite.add(createBox(W + 90, 28, 6, -W/2 - 45, -44, -L/2 - 105, matConcrete, 'Muro de Contenção Fundos', 'Terreno', '98462', 10000));

    // =========================================================================
    // 1. FUNDAÇÕES, BALDRAME & PISCINA
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
    // Piscina & Deck
    groupFundacao.add(createBox(80, 36, 60, -W/2 + 20, -36, -L/2 - 70, matConcrete, 'Estrutura Piscina', 'Lazer', '96538', 25000));
    groupFundacao.add(createBox(72, 4, 52, -W/2 + 24, -4, -L/2 - 66, matWater, "Espelho d'Água Translúcido", 'Lazer', '96538', 12000));
    groupFundacao.add(createBox(100, 3, 80, -W/2 + 12, -1, -L/2 - 80, matDeck, 'Deck Madeira Cumaru', 'Lazer', '96538', 18000));

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
    groupEstrutura.add(createBox(W - 4, 8, L + 30, -W/2 + 2, yPav1 - 6, -L/2 + 2, matSlab, 'Laje Maciça Protendida', 'Estrutural', '103670', 45000));
    groupEstrutura.add(createBox(W - 4, 8, L - 4, -W/2 + 2, yRoofBase - 6, -L/2 + 2, matSlab, 'Laje Forro Superior', 'Estrutural', '103670', 38000));

    // =========================================================================
    // 3. ARQUITETURA & ALVENARIA (CUTAWAY)
    // =========================================================================
    const groupArq = new THREE.Group();
    groupArq.name = 'Arquitetura & Alvenaria';
    groupArq.userData = { id: 'arquitetura', sinapi: '104658', orcado: 180000, desc: 'Alvenaria com meio-corte cutaway, pele de vidro duplo, esquadrias pretas e porta pivotante.' };
    // Fachada Térreo Esquerda
    groupArq.add(createBox(70, H, 8, -W/2 + 10, 2, L/2 - 14, matBrick, 'Parede Sala Estar', 'Arquitetura', '104658', 12000));
    groupArq.add(createBox(58, 38, 3, -W/2 + 16, 12, L/2 - 13, matGlass, 'Pele de Vidro Duplo Laminado', 'Arquitetura', '104658', 25000));
    groupArq.add(createBox(62, 42, 1, -W/2 + 14, 10, L/2 - 14, matFrameBlack, 'Caixilharia Linha Gold', 'Arquitetura', '104658', 10000));
    // Porta Pivotante Monumental
    groupArq.add(createBox(34, 50, 5, -6, 2, L/2 - 13, matWoodCumaru, 'Porta Pivotante Cumaru 3,20m', 'Arquitetura', '104658', 15000));
    groupArq.add(createBox(3, 22, 3, 22, 16, L/2 - 8, matInox, 'Puxador Inox Escovado 1,50m', 'Arquitetura', '104658', 1800));
    // Paredes Laterais e Gourmet
    groupArq.add(createBox(8, H, L - 24, -W/2 + 10, 2, -L/2 + 10, matBrick, 'Parede Lateral Esq.', 'Arquitetura', '104658', 18000));
    groupArq.add(createBox(8, H, L - 24, W/2 - 18, 2, -L/2 + 10, matBrick, 'Parede Lateral Dir.', 'Arquitetura', '104658', 18000));
    groupArq.add(createBox(60, 20, 18, 20, 2, -L/2 + 20, matGranite, 'Bancada Granito São Gabriel', 'Arquitetura', '104658', 8500));
    groupArq.add(createBox(18, 52, 18, 62, 2, -L/2 + 18, matBrick, 'Churrasqueira Refratária', 'Arquitetura', '104658', 6000));
    // 1º Pavimento
    groupArq.add(createBox(W - 16, 22, 2, -W/2 + 8, yPav1 + 6, L/2 + 30, matGlass, 'Guarda-corpo Sacada Vidro', 'Arquitetura', '104658', 14000));
    groupArq.add(createBox(W - 12, 3, 4, -W/2 + 6, yPav1 + 28, L/2 + 29, matFrameBlack, 'Corrimão Alumínio Preto', 'Arquitetura', '104658', 4500));
    groupArq.add(createBox(90, H, 8, -W/2 + 10, yPav1 + 2, L/2 - 14, matWallLight, 'Parede Suíte Master', 'Arquitetura', '104658', 16000));
    groupArq.add(createBox(56, 46, 3, -36, yPav1 + 2, L/2 - 12, matGlass, 'Porta-Balcão 4 Folhas', 'Arquitetura', '104658', 12000));

    // =========================================================================
    // 4. INSTALAÇÕES HIDROSSANITÁRIAS & ESGOTO
    // =========================================================================
    const groupHid = new THREE.Group();
    groupHid.name = 'Instalações Hidrossanitárias';
    groupHid.userData = { id: 'hidraulica', sinapi: '89985', orcado: 115000, desc: '2 Caixas de 1.500L, barrilete 50mm, colunas de água fria/quente PPR e tubos de queda 100mm.' };
    groupHid.add(createBox(32, 28, 32, -44, yRoofBase + 8, -20, matPipeCold, "Caixa d'Água 1.500 L (1)", 'Hidráulica', '89985', 3800));
    groupHid.add(createBox(32, 28, 32, 12, yRoofBase + 8, -20, matPipeCold, "Caixa d'Água 1.500 L (2)", 'Hidráulica', '89985', 3800));
    groupHid.add(createBox(92, 5, 6, -46, yRoofBase + 2, -24, matPipeCold, 'Barrilete Geral 50mm', 'Hidráulica', '89985', 4500));
    const pipesCol = [{ x: -W/2 + 28, z: 20 }, { x: W/2 - 36, z: 20 }, { x: 0, z: -L/2 + 30 }];
    pipesCol.forEach(col => {
      groupHid.add(createBox(4, yRoofBase + 4, 4, col.x, 2, col.z, matPipeCold, 'Coluna Água Fria Soldável', 'Hidráulica', '89985', 2800));
      groupHid.add(createBox(4, yRoofBase + 4, 4, col.x + 6, 2, col.z, matPipeHot, 'Coluna Água Quente PPR', 'Hidráulica', '89985', 3500));
      groupHid.add(createBox(7, yRoofBase + 2, 7, col.x + 14, -16, col.z, matPipeSewage, 'Tubo de Queda Esgoto 100mm', 'Hidráulica', '89985', 4200));
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
        <div class="bim-tree-item ${isSelected ? 'selected' : ''}" data-group-id="${id}">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
            <span style="font-size:1.05rem;">${icon}</span>
            <div style="min-width:0;flex:1;">
              <div class="elem-title" style="font-size:.76rem;font-weight:700;color:#F0EAD6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${grp.name}</div>
              <div style="font-size:.62rem;color:#94A3B8;">${count} peças 3D &middot; SINAPI ${grp.userData.sinapi}</div>
            </div>
          </div>
          <button type="button" class="btn-eye" data-group-id="${id}" style="background:transparent;border:none;color:#C6FF00;font-size:.85rem;cursor:pointer;padding:2px 6px;">
            👁️
          </button>
        </div>
      `;
    }).join('');

    // Eventos dos botões de olho
    document.querySelectorAll('.btn-eye').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute('data-group-id');
        const grp = this.groupsByDiscipline[id];
        if (grp) {
          grp.visible = !grp.visible;
          e.currentTarget.textContent = grp.visible ? '👁️' : '👁️‍🗨️';
          e.currentTarget.style.color = grp.visible ? '#C6FF00' : '#64748B';
          e.currentTarget.style.opacity = grp.visible ? '1' : '0.45';
        }
      });
    });

    // Evento de seleção de grupo na árvore
    document.querySelectorAll('.bim-tree-item').forEach(item => {
      item.addEventListener('click', (e) => {
        document.querySelectorAll('.bim-tree-item').forEach(it => it.classList.remove('selected'));
        item.classList.add('selected');
        const id = item.getAttribute('data-group-id');
        const grp = this.groupsByDiscipline[id];
        if (grp) {
          this._inspectGroup(grp);
        }
      });
    });
  },

  _inspectGroup(grp) {
    const nameEl = document.getElementById('inspected-name');
    const descEl = document.getElementById('inspected-desc');
    const sinapiEl = document.getElementById('inspected-sinapi');
    const orcadoEl = document.getElementById('inspected-orcado');

    if (nameEl) nameEl.textContent = grp.name;
    if (descEl) descEl.textContent = grp.userData.desc || '';
    if (sinapiEl) sinapiEl.textContent = grp.userData.sinapi || '—';
    if (orcadoEl) orcadoEl.textContent = `R$ ${Number(grp.userData.orcado || 0).toLocaleString('pt-BR')}`;
  },

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
        // Encontrar a primeira malha com userData válida
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

    // Destacar com Material Emissivo Dourado/Verde FinGo
    mesh.material = new THREE.MeshStandardMaterial({
      color: 0xc6ff00,
      emissive: 0x3f51b5,
      emissiveIntensity: 0.35,
      roughness: 0.2,
      metalness: 0.8
    });

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
        this.camera.position.set(320, 260, 340);
        this.controls.target.set(0, 35, 0);
        if (labelEl) labelEl.textContent = 'ISOMÉTRICA NW';
        break;
      case 'top':
        this.camera.position.set(0, 520, 0.1);
        this.controls.target.set(0, 0, 0);
        if (labelEl) labelEl.textContent = 'PLANTA SUPERIOR';
        break;
      case 'front':
        this.camera.position.set(0, 70, 420);
        this.controls.target.set(0, 40, 0);
        if (labelEl) labelEl.textContent = 'FACHADA FRONTAL';
        break;
      case 'side':
        this.camera.position.set(420, 70, 0);
        this.controls.target.set(0, 40, 0);
        if (labelEl) labelEl.textContent = 'FACHADA LATERAL';
        break;
    }
    this.controls.update();
  },

  _setShadingMode(mode) {
    this.scene.traverse((obj) => {
      if (obj.isMesh && obj.userData.originalMaterial) {
        if (mode === 'wireframe') {
          obj.material = new THREE.MeshBasicMaterial({ color: 0xc6ff00, wireframe: true });
        } else {
          obj.material = obj.userData.originalMaterial;
        }
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

      // Atualizar controles
      if (this.controls) this.controls.update();

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
