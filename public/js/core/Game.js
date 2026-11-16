import * as THREE from 'three';
import { Physics } from '../engine/Physics.js';
import { Controls } from '../engine/Controls.js';
import { ThirdPersonCamera } from '../engine/Camera.js';
import { AudioEngine } from '../engine/Audio.js';
import { ParticleSystem } from '../engine/Particles.js';
import { QualityManager } from '../engine/Quality.js';
import { MaterialLibrary } from '../engine/Materials.js';
import { Environment } from '../engine/Environment.js';
import { PostFX } from '../engine/PostFX.js';
import { Interior } from '../engine/Interior.js';
import { InteriorInteractions } from '../engine/InteriorInteractions.js';
import { Player } from '../entities/Player.js';
import { Station } from '../entities/Station.js';
import { ToolRig, TOOLS } from '../entities/Tool.js';
import { Tether } from '../entities/Tether.js';
import { ExteriorTasks } from '../entities/ExteriorTasks.js';
import { TransportShip } from '../entities/TransportShip.js';
import { PlanetWorld } from '../entities/PlanetWorld.js';
import { TravelScene } from '../entities/TravelScene.js';
import { MOON_CONFIG, MARS_CONFIG } from './Universe.js';
import { HUD } from '../ui/HUD.js';
import { TouchControls } from '../ui/TouchControls.js';
import { UserManual, zoneFor, zoneInfo } from '../ui/UserManual.js';
import { AcademyUI } from '../ui/AcademyUI.js';
import { DataCenterUI } from '../ui/DataCenterUI.js';
import { MissionDesignUI } from '../ui/MissionDesignUI.js';
import { MultiplayerUI } from '../ui/MultiplayerUI.js';
import { MultiplayerClient } from '../net/MultiplayerClient.js';
import { RemoteAvatar } from '../net/RemoteAvatar.js';
import { BalanceManager } from './Balance.js';
import { MissionManager, MISSION_CATEGORIES, MISSION_STATES } from './Missions.js';
import { MaintenanceManager } from './Maintenance.js';
import { readSave, writeSave, clearSave, hasSave } from './Save.js';
import { Academy } from './Academy.js';
import {
  newDesignState,
  goalById,
  implementationCost,
  buildMissionDefinition,
  buildReport,
} from './MissionDesign.js';

const CENTER = new THREE.Vector2(0, 0);
const REQUIRED_TOOL = { hull: 'SOLDADOR', valve: 'LLAVE' };
const DESIGN_STORAGE_KEY = 'spacetech.design.v1';

const NAV_POIS = [
  { id: 'airlock', name: 'Esclusa EVA-07', position: new THREE.Vector3(0, -9, 6.0) },
  { id: 'solar', name: 'Matriz solar este', position: new THREE.Vector3(12, 0, 0) },
  { id: 'antenna', name: 'Antena de banda X', position: new THREE.Vector3(0, 6.5, 0) },
  { id: 'lab', name: 'Laboratorio', position: new THREE.Vector3(-5, -9, -1.5) },
  { id: 'storage', name: 'Almacén', position: new THREE.Vector3(4.5, -9, -6.25) },
  { id: 'debris', name: 'Campo de escombros', position: new THREE.Vector3(0, 4, 22) },
];

const RESOURCE_LABELS = {
  regolith: 'Regolito',
  waterIce: 'Hielo de agua',
  minerals: 'Minerales',
  metals: 'Metales',
  electronics: 'Electrónica',
  industrial: 'Material industrial',
};

const RESOURCE_EVENT = {
  regolith: 'collect',
  waterIce: 'collect_ice',
  minerals: 'collect_minerals',
  metals: 'collect_minerals',
  electronics: 'collect',
  industrial: 'collect',
};

const ACTION_LABELS = {
  activate: 'Aceptar misión',
  'request-maintenance': 'Solicitar mantenimiento',
  'build-module': 'Construir módulo',
  mine: 'Extraer recurso',
  geology: 'Análisis geológico',
  'repair-equipment': 'Reparar equipo',
  'antenna-install': 'Calibrar antena',
  'explore-cave': 'Registrar cueva',
  'enter-rover': 'Conducir rover',
  'exit-ship': 'Salir de la nave',
  travel: 'Iniciar viaje',
  'unload-cargo': 'Descargar carga',
  nav: 'Marcar destino',
  comms: 'Transmitir informe',
  circuit: 'Restablecer circuito',
  sample: 'Analizar muestra',
  calibrate: 'Calibrar espectrómetro',
  filter: 'Sustituir filtro',
  'equip-suit': 'Equipar traje',
  'unequip-suit': 'Guardar traje',
  'repair-suit': 'Reparar casco del traje',
  medkit: 'Estabilizar',
  rest: 'Descansar',
  eat: 'Consumir ración',
  drink: 'Beber agua',
  'power-on': 'Reactivar reactor',
  'craft-filter': 'Fabricar filtro',
  'craft-component': 'Fabricar kit',
  'save-game': 'Guardar partida',
  'repair-hull': 'Reparar casco',
  diagnose: 'Diagnóstico',
  'take-component': 'Recoger kit',
  'take-filter': 'Recoger filtro',
  'take-sample': 'Recoger muestra',
  'refill-o2': 'Recargar O2',
  'refill-rcs': 'Recargar RCS',
  'refuel-ship': 'Repostar nave',
  'repair-ship': 'Reparar nave',
  'board-ship': 'Preparar embarque',
  maintenance: 'Mantenimiento',
};

/**
 * Orquestador: estado de partida, loop, interacción, misiones, cable EVA y HUD.
 */
export class Game {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector('#scene');

    // Calidad antes que el renderer: define resolución, sombras y postproceso.
    this.quality = new QualityManager();
    const preset = this.quality.preset;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.pixelRatio));
    this.renderPixelRatio = this.renderer.getPixelRatio();
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = !!preset.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Las draw calls se acumulan por frame; el composer hace varias pasadas.
    this.renderer.info.autoReset = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x04060d);
    this.scene.fog = new THREE.FogExp2(0x04060d, 0.0014);

    this.camera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.1,
      1400
    );
    // Capa 0: exterior (sol). Capa 1: interior (luces propias).
    this.camera.layers.enable(1);

    this.clock = new THREE.Clock();
    this.state = 'entry';
    this.hadLock = false;
    this.ignoreUnlock = false;
    this.time = 0;
    this.guided = false;
    this.overlayFrom = null;
    this.settingsReturn = 'menu';
    this.integrity = 100;
    this.toolIndex = 0;
    this.repairing = false;
    this.revealUntil = 0;
    this.scanCooldown = 0;
    this.alarmTimer = 0;
    this.sparkAccum = 0;
    this.center = CENTER;
    this.raycaster = new THREE.Raycaster();
    this.needsRender = true;
    this.debugColliders = false;
    this.actionLog = [];
    this.lastActionResult = null;
    // Calidad adaptativa: sólo baja un escalón si el FPS se mantiene bajo.
    this.adaptiveQuality = true;
    this.qualityAccum = 0;
    this.qualitySamples = 0;
    this.qualityCooldown = 0;

    this.panelOpen = null;
    this.panelSource = null;
    this.job = null;
    this.seated = false;
    this.navTarget = null;
    this.visitedPois = new Set();
    this.commsSent = false;
    this.repairCooldown = 0;
    this.lastDamageToast = 0;
    this.scienceData = 0;
    // Estado de la nave de transporte (consola del hangar y cabina).
    this.shipFuel = 100;
    this.shipIntegrity = 100;
    this.moduleInspections = 0;

    this.inventory = { component: 0, filter: 0, sample: 0, tools: 0 };
    this.engineering = { circuits: [false, false, false] };
    this.lifeSupport = { filters: [false, false] };
    this.lab = { samples: [false, false, false], calibrated: false };

    // Traje EVA y recursos del universo.
    this.suit = { equipped: true, helmet: 100 };
    this.resources = {
      regolith: 0,
      waterIce: 0,
      minerals: 0,
      metals: 0,
      electronics: 0,
      industrial: 0,
    };
    this.cargo = {
      regolith: 0,
      waterIce: 0,
      minerals: 0,
      metals: 0,
      electronics: 0,
      industrial: 0,
    };
    this.marsSystems = { geology: false, equipment: false, antenna: false };
    this.lastPlayerMode = 'zero';

    // Universo transitable: estación orbital, Luna y Marte.
    this.destination = 'station';
    this.shipLocation = 'station';
    this.travel = null;
    this.travelScene = null;
    this.vehicle = null;
    this.visitedDestinations = new Set(['station']);
    this.panelPoint = null;
    this.autosaveTimer = 0;
    this.destinations = {
      station: { id: 'station', name: 'Estación Orbital EVA-07', short: 'Estación' },
      moon: { id: 'moon', name: 'Luna · Base Selene', short: 'Luna' },
      mars: { id: 'mars', name: 'Marte · Puesto Ares', short: 'Marte' },
    };

    this.balance = new BalanceManager();
    this.balance.onChange = (values, id) => {
      this.tether?.setConfig(values);
      this._syncDifficultyUI();
      this.hud.toast(`Dificultad: ${values.name}`, 'good', 2.4);
      void id;
    };

    this.hud = new HUD(root);
    this.audio = new AudioEngine();

    // Multijugador cooperativo: cliente de red, avatares remotos e interfaz.
    // No crea renderer ni bucle: reutiliza el del juego.
    this.multiplayerActive = false;
    this.remoteAvatars = new Map();
    this.multiplayer = new MultiplayerClient();
    this.multiplayerUI = new MultiplayerUI(root, this);
    this.physics = new Physics();

    // Materiales y entorno compartidos (texturas procedurales PBR).
    this.materials = new MaterialLibrary(this.renderer, preset);
    this.environment = new Environment(this.scene, this.renderer, preset);
    this.postFX = new PostFX(this.renderer, this.scene, this.camera, preset);

    // Partículas: propulsores, chispas de soldadura y fugas de aire.
    const particleRatio = this.renderer.getPixelRatio();
    this.thrusterParticles = new ParticleSystem(this.scene, {
      count: 260, color: 0xbfefff, size: 0.09, drag: 2.4, pixelRatio: particleRatio,
    });
    this.sparkParticles = new ParticleSystem(this.scene, {
      count: 200, color: 0xffb060, size: 0.075, drag: 1.1, pixelRatio: particleRatio,
    });
    this.leakParticles = new ParticleSystem(this.scene, {
      count: 220, color: 0xdff6ff, size: 0.11, drag: 1.6, opacity: 0.55, pixelRatio: particleRatio,
    });

    this.station = new Station(this.scene, this.physics, this.leakParticles, this.materials);
    this.player = new Player(
      this.scene,
      this.physics,
      this.thrusterParticles,
      this.materials,
      this.balance
    );
    this.player.co2 = 0;
    this.player.filterLife = 1.0;
    this.toolRig = new ToolRig(this.player.hand, this.materials);

    this.player.onDamage = (damage, impact) => {
      if (this.time - this.lastDamageToast < 1.2) return;
      this.lastDamageToast = this.time;
      this.cameraRig?.addShake(Math.min(0.22, damage * 0.012));
      this.hud.toast(
        `Impacto · casco -${Math.round(damage)}% (${impact.toFixed(1)} m/s)`,
        'bad',
        2.2
      );
    };

    // Interior habitable: GLB optimizados + colisiones + esclusa.
    this.interior = new Interior(this.scene, this.physics, this.materials, preset);
    this.interior.onEvent = (type) => this._onInteriorEvent(type);

    // Consolas interiores y tareas exteriores.
    this.interiorSystems = new InteriorInteractions(this.scene, this.materials);
    this.exteriorTasks = new ExteriorTasks(this.scene, this.materials);

    // Nave de transporte: interior caminable en el hangar y viaje a planetas.
    this.ship = new TransportShip(
      this.scene,
      this.physics,
      this.materials,
      this.interiorSystems
    );

    // Destinos planetarios: terreno, bases, recursos y cuevas.
    this.moon = new PlanetWorld(
      this.scene,
      this.physics,
      this.materials,
      this.interiorSystems,
      MOON_CONFIG
    );
    this.mars = new PlanetWorld(
      this.scene,
      this.physics,
      this.materials,
      this.interiorSystems,
      MARS_CONFIG
    );
    this.planet = null;

    // Visualización del tránsito interplanetario.
    this.travelScene = new TravelScene(this);

    // Misiones: una activa a la vez.
    this.missions = new MissionManager();
    this.missions.onComplete = (mission) => this._onMissionComplete(mission);
    this.maintenance = new MaintenanceManager();

    // Academia, manual, centro de datos y mesa de diseño (Prompt 3.7).
    this.academy = new Academy();
    this.manual = new UserManual(root);
    this.academyUI = new AcademyUI(root, this.academy);
    this.dataCenter = new DataCenterUI(root);
    this.designState = this._readDesignState();
    this.designUI = new MissionDesignUI(root, {
      state: this.designState,
      onChange: (state) => this._saveDesignState(state),
      onImplement: (state) => this._implementDesign(state),
    });

    // Cable de seguridad: anclado a la esclusa, activo en EVA.
    this.tether = new Tether(this.scene, this.player, this.balance.values);

    this.cameraRig = new ThirdPersonCamera(this.camera);
    this.cameraRig.occluders = this.station.occluders;
    this.cameraRig.occluders.push(...this.ship.occluders.map((item) => item.mesh));
    this.interior.ready.then(() => {
      this.cameraRig.occluders.push(...this.interior.occluders);
    });

    this.controls = new Controls(this.canvas);
    this.touch = new TouchControls(this.root, this.controls);
    this.touch.onPause = () => this.pause();
    this.touch.onTool = () => this.selectTool((this.toolIndex + 1) % TOOLS.length);
    this.hud.touchMode = this.touch.enabled;
    this._bindEvents();
    this._syncQualityUI();
    this._syncDifficultyUI();

    this.quality.onChange = (nextPreset) => this.applyQuality(nextPreset);

    this.hud.setTool(0);
    this.hud.setStats(100, 100, 100, this.player.co2, this.player.filterLife);
    this.hud.setMission(this.missions.active);
    this.hud.setTether({ active: false, distance: 0, max: this.tether.max, tension: 0 });
    this.hud.setPressure(this.interior.getAirlockStatus());
    this.hud.setWarnings([]);
    this.hud.setDestination(this.destinations.station.name);

    const continueButton = this.root.querySelector('#btn-menu-continue');
    if (continueButton) continueButton.classList.toggle('hidden', !hasSave());
    this._syncMenuStatus();
    this._syncSensitivityUI();

    this.hud.screen('entry');
    this.cameraRig.updateMenu(0);
  }

  /* ---------------------------------------------------------------- calidad */

  /**
   * El perfil gráfico es único desde la versión 3.7. Se conserva este método
   * para poder aplicar el perfil al redimensionar sin recrear la escena.
   */
  applyQuality(preset) {
    const ratio = Math.min(window.devicePixelRatio || 1, preset.pixelRatio);
    this.renderPixelRatio = ratio;

    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = !!preset.shadows;

    this.materials.setQuality(preset);
    this.environment.setQuality(preset);
    this.postFX.setQuality(preset);
    this.interior.setQuality(preset);

    this.thrusterParticles.setPixelRatio(ratio);
    this.sparkParticles.setPixelRatio(ratio);
    this.leakParticles.setPixelRatio(ratio);

    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this._syncQualityUI();
    this.needsRender = true;
  }

  _syncQualityUI() {
    // Sin selector visible: el perfil estándar es único.
  }

  /**
   * Calidad adaptativa para móviles: conserva el perfil estándar (único) y sólo
   * reduce la resolución de render cuando el dispositivo no sostiene el frame.
   */
  _adaptQuality(dt) {
    if (!this.adaptiveQuality || !this.controls.coarsePointer) return;

    this.qualityCooldown = Math.max(0, this.qualityCooldown - dt);
    if (this.state !== 'playing') {
      this.qualityAccum = 0;
      this.qualitySamples = 0;
      return;
    }

    this.qualityAccum += dt;
    this.qualitySamples += 1;
    if (this.qualityAccum < 1.5) return;

    const average = this.qualityAccum / Math.max(1, this.qualitySamples);
    this.qualityAccum = 0;
    this.qualitySamples = 0;
    if (this.qualityCooldown > 0) return;

    const base = Math.min(window.devicePixelRatio || 1, this.quality.preset.pixelRatio);
    const current = this.renderer.getPixelRatio();
    let next = current;

    if (average > 0.028 && current > 0.56) next = Math.max(0.56, current - 0.16);
    else if (average < 0.0175 && current < base) next = Math.min(base, current + 0.08);

    if (Math.abs(next - current) < 0.001) return;

    this._setRenderPixelRatio(next);
    this.qualityCooldown = 2.5;
  }

  _setRenderPixelRatio(ratio) {
    this.renderPixelRatio = ratio;
    this.renderer.setPixelRatio(ratio);
    this.postFX.setPixelRatio();
    this.environment.setPixelRatio(ratio);
    this.thrusterParticles.setPixelRatio(ratio);
    this.sparkParticles.setPixelRatio(ratio);
    this.leakParticles.setPixelRatio(ratio);
    this.needsRender = true;
  }

  _syncDifficultyUI() {
    const buttons = this.root.querySelectorAll('[data-difficulty]');
    for (const button of buttons) {
      const active = button.dataset.difficulty === this.balance.id;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }

  /* --------------------------------------------------------------- eventos */

  _bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      // Conserva la resolución adaptativa (móvil): un resize no debe devolver
      // el pixel ratio al máximo y provocar oscilación de rendimiento.
      const base = Math.min(window.devicePixelRatio || 1, this.quality.preset.pixelRatio);
      const ratio = Math.min(base, this.renderPixelRatio || base);
      this.renderer.setPixelRatio(ratio);
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      this.postFX.setSize(window.innerWidth, window.innerHeight);
      this.environment.setPixelRatio(ratio);
      this.thrusterParticles.setPixelRatio(ratio);
      this.sparkParticles.setPixelRatio(ratio);
      this.leakParticles.setPixelRatio(ratio);
      this.needsRender = true;
    });

    for (const button of this.root.querySelectorAll('[data-difficulty]')) {
      button.addEventListener('click', () => this.balance.set(button.dataset.difficulty));
    }

    const sensitivity = this.root.querySelector('#sensitivity');
    sensitivity?.addEventListener('input', () => {
      const value = Number(sensitivity.value) || 0.0024;
      this.controls.sensitivity = value;
      this.cameraRig.sensitivity = value;
      const label = this.root.querySelector('#sensitivity-value');
      if (label) label.textContent = value.toFixed(4);
    });

    this.controls.onTool = (index) => this.selectTool(index);

    this.controls.onLockChange = (locked) => {
      if (locked) {
        this.hadLock = true;
        this.ignoreUnlock = false;
        return;
      }
      if (this.panelOpen) return;
      if (!this.hadLock) return;
      if (this.ignoreUnlock) {
        this.ignoreUnlock = false;
        return;
      }
      if (this.state === 'playing') this.pause();
    };

    // Entrada y menú principal.
    this.root.querySelector('#btn-enter')?.addEventListener('click', () => this.enterMenu());
    this.root.querySelector('#btn-menu-new')?.addEventListener('click', () => this.startNewGame());
    this.root.querySelector('#btn-menu-explore')?.addEventListener('click', () => this.startExploration());
    this.root.querySelector('#btn-menu-multiplayer')?.addEventListener('click', () => this.openMultiplayer());
    this.root.querySelector('#btn-menu-continue')?.addEventListener('click', () => this.continueGame());
    this.root.querySelector('#btn-menu-design')?.addEventListener('click', () => this.openDesign());
    this.root.querySelector('#btn-menu-academy')?.addEventListener('click', () => this.openAcademy());
    this.root.querySelector('#btn-menu-data')?.addEventListener('click', () => this.openDataCenter());
    this.root.querySelector('#btn-menu-manual')?.addEventListener('click', () => this.openManual());
    this.root.querySelector('#btn-menu-settings')?.addEventListener('click', () => this.openSettings('menu'));
    this.root.querySelector('#btn-settings-back')?.addEventListener('click', () => this.closeSettings());

    // Pausa.
    this.root.querySelector('#btn-resume')?.addEventListener('click', () => this.resume());
    this.root.querySelector('#btn-pause-manual')?.addEventListener('click', () => this.openManual({ from: 'pause' }));
    this.root.querySelector('#btn-pause-objectives')?.addEventListener('click', () => this.openObjectives());
    this.root.querySelector('#btn-pause-design')?.addEventListener('click', () => this.openDesign());
    this.root.querySelector('#btn-pause-academy')?.addEventListener('click', () => this.openAcademy());
    this.root.querySelector('#btn-pause-settings')?.addEventListener('click', () => this.openSettings('pause'));
    this.root.querySelector('#btn-pause-save')?.addEventListener('click', () => {
      if (this.saveGame(false)) this.audio.ui();
    });
    this.root.querySelector('#btn-pause-exit')?.addEventListener('click', () => this.exitToMenu());

    this.root.querySelector('#btn-restart-win')?.addEventListener('click', () => this.startNewGame());
    this.root.querySelector('#btn-restart-lose')?.addEventListener('click', () => this.startNewGame());
    this.root.querySelector('#panel-close').addEventListener('click', () => this.closePanel());
    this.root.querySelector('#panel-body').addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      this.handlePanelAction(button.dataset.action, button.dataset.id);
    });

    window.addEventListener('keydown', (event) => {
      if (event.code === 'Enter' && this.state === 'entry') this.enterMenu();

      if (event.code === 'KeyH' && this.state === 'playing') {
        event.preventDefault();
        this.openManual({ from: 'playing', contextual: true });
        return;
      }

      if (event.code === 'Escape') {
        if (this.settingsOpen) {
          event.preventDefault();
          this.closeSettings();
          return;
        }
        if (this._anyOverlayOpen()) {
          event.preventDefault();
          this.closeOverlays();
          return;
        }
        if (this.panelOpen) {
          event.preventDefault();
          this.closePanel();
          return;
        }
      }

      if (event.code === 'F3') {
        event.preventDefault();
        this.debugColliders = !this.debugColliders;
        this.interior.setDebugColliders(this.debugColliders);
        this.hud.toast(
          this.debugColliders ? 'Colliders visibles (F3)' : 'Colliders ocultos (F3)',
          'good',
          1.8
        );
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });

    window.addEventListener('beforeunload', () => {
      if (this.state === 'playing' || this.state === 'paused') this.saveGame();
    });
  }

  _onInteriorEvent(type) {
    const messages = {
      airlockOpen: 'Esclusa: compuerta en movimiento',
      pressurizing: 'Esclusa: presurizando...',
      pressurized: 'Esclusa presurizada · a bordo',
      depressurizing: 'Esclusa: despresurizando...',
      depressurized: 'Esclusa despresurizada · al exterior',
      entered: 'A bordo · oxígeno recuperándose',
      exited: 'EVA · cable de seguridad conectado',
    };
    if (messages[type]) this.hud.toast(messages[type], 'good', 2.6);
    if (type === 'entered' || type === 'exited') this.audio.ui();
  }

  /** Alterna locomoción a pie (interior/planeta) y EVA de gravedad cero. */
  _syncPlayerMode(inside, planet = null) {
    const mode = planet || inside ? 'walk' : 'zero';
    const key = planet ? `planet:${planet.config.id}` : mode === 'walk' ? 'station-walk' : 'station-zero';
    if (this.lastPlayerMode === key) return;
    this.lastPlayerMode = key;

    if (mode === 'walk') {
      if (planet) {
        this.player.setMode('walk', {
          gravity: planet.config.gravity,
          floorY: 0,
          groundHeight: (x, z, y) =>
            this.ship.groundHeightAt(x, z, y) ?? planet.groundHeightAt(x, z, y),
          walkSpeed: 3.4,
          jumpSpeed: planet.config.gravity < 2 ? 3.0 : 4.4,
        });
      } else {
        this.player.setMode('walk', {
          gravity: 9.80665,
          floorY: this.interior.floor,
          groundHeight: (x, z, y) =>
            this.ship.groundHeightAt(x, z, y) ?? this.interior.floor,
          walkSpeed: 3.4,
          jumpSpeed: 4.4,
        });
      }
    } else {
      this.player.setMode('zero');
    }
  }

  /* ------------------------------------------------------------ tránsito */

  _hideOriginWorld() {
    const origin = this.destination;
    if (origin === 'station') {
      this.station.group.visible = false;
      this.interior.group.visible = false;
      this.exteriorTasks.group.visible = false;
      this.ship.group.visible = false;
    } else if (origin === 'moon') {
      this.moon.setVisible(false);
    } else if (origin === 'mars') {
      this.mars.setVisible(false);
    }
  }

  travelTo(id) {
    if (!this.destinations[id]) return;
    if (this.travel) return;
    if (this.destination === id) {
      this.hud.toast(`Ya estás en ${this.destinations[id].short}`, 'warn', 2.2);
      return;
    }

    // Consumo real de combustible: sin margen no se puede iniciar el salto.
    const cost = id === 'mars' ? 16 : 10;
    if (this.shipFuel < cost) {
      this.hud.toast(
        `Combustible insuficiente · necesitas ${cost}% y quedan ${Math.round(this.shipFuel)}%. Reposta en la consola del hangar.`,
        'warn',
        4
      );
      this.audio.alarm?.();
      return;
    }
    this.shipFuel = Math.max(0, this.shipFuel - cost);
    this.shipIntegrity = Math.max(20, this.shipIntegrity - 3);

    this.closePanel();
    this.hud.hidePrompt();
    this.hud.setCrosshair('none');

    // Duración en tiempo de juego (acelerado) y referencia científica.
    const isMars = id === 'mars';
    const gameDuration = isMars ? 24 : 18; // 15-25 s de presentación
    const refDays = isMars ? 270 : 3; // ~9 meses Marte, ~3 días Luna
    const distanceKm = isMars ? 225000000 : 384400;
    const velocityKms = distanceKm / (refDays * 86400);

    // Datos del tránsito para el panel y las pruebas.
    this.travel = {
      id,
      elapsed: 0,
      duration: gameDuration,
      switched: false,
      distanceKm,
      refDays,
      velocityKms,
      origin: this.destination,
    };
    this.state = 'travel';

    // Ocultar el mundo de origen y mostrar la escena de tránsito.
    this._hideOriginWorld();
    this.travelScene.setup(this.destination, id);
    this.travelScene.show();

    this.hud.showTravel(
      `Rumbo a ${this.destinations[id].name}`,
      'La nave se separa de la estructura. Mantén la trayectoria.'
    );
    this.hud.setTravelStats({
      distanceKm,
      velocityKms,
      fuel: this.shipFuel,
      energy: this.shipIntegrity,
      refDays,
      elapsed: 0,
      duration: gameDuration,
      phase: 'Preparación y salida',
      correction: false,
    });
    this.audio.ui();
  }

  _updateTravel(dt) {
    if (!this.travel) return;

    // Velocidad de presentación: Shift acelera 2x.
    const speedMul = this.controls.down('ShiftLeft') || this.controls.down('ShiftRight') ? 2 : 1;
    // Saltar animación con X.
    if ((this.controls.down('KeyX')) && this.travel.elapsed > 0.8 && !this.travel.skipPending) {
      this.travel.skipPending = true;
    }
    if (this.travel.skipPending) {
      // Avanzar rápidamente hasta la llegada.
      this.travel.elapsed = this.travel.duration;
    } else {
      this.travel.elapsed += dt * speedMul;
    }

    const ratio = Math.min(1, this.travel.elapsed / this.travel.duration);
    this.hud.setTravelProgress(ratio);

    // Fase del viaje (estados explícitos de la cinemática).
    const phase = this.travelScene.state || 'CRUISE';
    const correction = (ratio > 0.35 && ratio < 0.6);

    this.travelScene.update(ratio);

    // Audio de motores.
    if (this.audio && this.travelScene.thrust !== undefined) {
      this.audio.setThruster(this.travelScene.thrust);
    }

    // Tiempo simulado acelerado.
    const refSeconds = this.travel.refDays * 86400;
    const factor = refSeconds / this.travel.duration;
    const simElapsed = this.travel.elapsed * factor;
    const simRemaining = (this.travel.duration - this.travel.elapsed) * factor;
    const etaDays = simRemaining / 86400;

    this.hud.setTravelStats({
      distanceKm: this.travel.distanceKm,
      velocityKms: this.travel.velocityKms,
      fuel: this.shipFuel,
      energy: this.shipIntegrity,
      refDays: this.travel.refDays,
      elapsed: simElapsed,
      duration: this.travel.duration,
      remaining: simRemaining,
      etaDays,
      phase,
      correction,
    });

    // Etiqueta de depuración temporal.
    if (this.hud.dom.travelDebug) {
      const sp = this.travelScene.ship.position;
      this.hud.dom.travelDebug.textContent =
        `TRAVEL SCENE: ACTIVE · progress=${ratio.toFixed(3)} · phase=${phase} · ` +
        `ship=(${sp.x.toFixed(1)}, ${sp.y.toFixed(1)}, ${sp.z.toFixed(1)}) · ` +
        `cam=${this.camera.position.x.toFixed(1)},${this.camera.position.y.toFixed(1)},${this.camera.position.z.toFixed(1)} · ` +
        `renderCount=${this.renderer.info.render.calls}`;
    }

    this.travelScene.updateCamera(this.camera);

    if (ratio >= 1) {
      const destination = this.destinations[this.travel.id];
      const arrived = this.travel.id;
      this.travelScene.hide();
      if (this.audio) this.audio.setThruster(0);
      // Aplicar el destino correctamente: posicionar jugador, cargar escena,
      // actualizar HUD y conservar progreso.
      this._applyDestination(arrived, { spawn: true, announce: true });
      this.travel = null;
      this.state = 'playing';
      this.hud.hideTravel();
      this.hud.toast(`Llegada a ${destination.name}`, 'good', 3.2);
      this.visitedDestinations.add(arrived);
      this.missions.notify(`travel_${arrived}`, 1, arrived);
      this.saveGame();
      this.controls.requestLock();
      // Reposicionar la cámara sobre el jugador.
      this.cameraRig.snap(this.player.group.position);
      this.cameraRig.yaw = 0;
      this.cameraRig.pitch = 0.16;
    }
  }

  /** Activa el conjunto de colisionadores visibles para la cámara. */
  _setCameraOccluders(station) {
    if (station) {
      this.cameraRig.occluders = [
        ...this.station.occluders,
        ...this.ship.occluders.map((item) => item.mesh),
        ...this.interior.occluders,
      ];
    } else {
      this.cameraRig.occluders = [
        ...this.planet.occluders,
        ...this.ship.occluders.map((item) => item.mesh),
      ];
    }
  }

  /** Coloca la nave y activa sólo las colisiones del destino actual. */
  _applyDestination(id, { spawn = true, announce = true } = {}) {
    const station = id === 'station';
    this.destination = id;
    this.shipLocation = id;
    this.ship.dockedAt = station ? 'station' : 'surface';
    this.planet = station ? null : id === 'moon' ? this.moon : this.mars;

    this.station.group.visible = station;
    this.interior.group.visible = station;
    this.exteriorTasks.group.visible = station;
    this.interiorSystems.setStationVisible(station);
    this.moon.setVisible(id === 'moon');
    this.mars.setVisible(id === 'mars');
    this.environment.setDestination(id);

    this.station.setCollisionActive(station);
    this.interior.setCollisionActive(station);

    this.ship.setVisible(true);
    this.ship.group.visible = true;
    this.ship.setInteriorActive(true);
    this.vehicle = null;
    this.player.group.visible = true;

    if (station) {
      this.ship.setPosition(20, this.interior.floor, -3);
    } else {
      this.planet.setShip(this.ship);
    }

    if (spawn) {
      if (station) {
        this.player.body.position.set(12.8, this.interior.floor + this.player.halfHeight, -3);
      } else {
        const x = this.planet.spawn.x;
        const z = this.planet.spawn.z;
        const y = this.planet.groundHeightAt(x, z) + this.player.halfHeight;
        this.player.body.position.set(x, y, z);
      }
    }

    this.player.body.velocity.setZero();
    this.player.group.position.copy(this.player.body.position);
    this.lastPlayerMode = null;
    this.tether.reset();
    this._refreshZone(false);
    this.player.sync(0.016, this.camera);
    this.cameraRig.seated = false;
    this.cameraRig.inside = false;
    this.cameraRig.snap(this.player.group.position);
    this._setCameraOccluders(station);
    this.navTarget = null;
    this.hud.setNavigation(null);
    this.hud.setDestination(this.destinations[id].name);
    this.updateHUD();
    if (announce) this.audio.success();
  }

  /** Recalcula modo de movimiento, zona segura y capa de iluminación. */
  _refreshZone(snapCamera = false) {
    const position = this.player.group.position;
    const station = this.destination === 'station';
    const inShip = this.ship.contains(position);

    let inside = false;
    let safe = false;

    if (station) {
      inside = this.interior.contains(position) || inShip;
      safe = this.interior.isSafe(position) || inShip;
    } else {
      safe = this.planet.contains(position) || inShip;
    }

    this.player.setInterior(station ? inside : false);
    this.player.setSafe(safe);
    this._syncPlayerMode(station ? inside : false, station ? null : this.planet);
    this.environment.setInterior(station && inside);
    this.cameraRig.inside = station && inside;

    // El GLB del interior es también la arquitectura visible del casco, así
    // que la estación debe seguir dibujándose en EVA. Sólo se oculta el
    // detalle interior (suelos, props, puertas) lejos de la esclusa.
    const airlock = this.interior.airlock?.outer?.group?.position;
    const nearAirlock = airlock ? airlock.distanceTo(position) < 13 : false;
    const showDetail = inside || nearAirlock;
    this.interior.setVisible(station);
    this.interior.setDetailVisible(station && showDetail);
    if (station) this.ship.setVisible(showDetail);

    if (station) {
      const module = this.ship.getModuleAt(position) ?? this.interior.getModuleAt(position);
      if (module) {
        this.cameraRig.floor = module.min[1];
        this.cameraRig.ceil = module.max[1];
      } else {
        this.cameraRig.floor = this.interior.floor;
        this.cameraRig.ceil = this.interior.ceil;
      }
    } else {
      const ground = this.planet.groundHeightAt(position.x, position.z, position.y);
      this.cameraRig.floor = ground;
      this.cameraRig.ceil = ground + 30;
    }

    if (snapCamera) this.cameraRig.snap(position);
    return { inside, safe, inShip };
  }

  /** Sube al jugador a la nave (acción de escotilla desde la superficie). */
  _boardShip() {
    const board = this.ship.boardPosition();
    this.player.body.position.set(board.x, board.y + this.player.halfHeight, board.z);
    this.player.body.velocity.setZero();
    this.player.sync(0.016, this.camera);
    this.lastPlayerMode = null;
    this._refreshZone(true);
    this.seated = true;
    this._setShipSeat();
    this.openPanel('ship', 'ship_seat');
    this.hud.toast('A bordo de la nave de transporte', 'good', 2.6);
    this.audio.ui();
  }

  /** Baja de la nave a la superficie o al hangar. */
  _exitShip() {
    if (this.destination !== 'station' && !this.suit.equipped) {
      this.hud.toast('NO PUEDES SALIR SIN TRAJE ESPACIAL.', 'bad', 3.6);
      this.audio.alarm?.();
      return;
    }
    const ship = this.ship;
    let target;
    if (this.destination === 'station') {
      target = new THREE.Vector3(ship.group.position.x - 7.6, this.interior.floor, ship.group.position.z);
    } else {
      target = ship.hatchPosition();
      target.y = this.planet.groundHeightAt(target.x, target.z) + 0.2;
    }
    this.player.body.position.set(target.x, target.y + this.player.halfHeight, target.z);
    this.player.body.velocity.setZero();
    this.player.sync(0.016, this.camera);
    this.lastPlayerMode = null;
    this._refreshZone(true);
    this.closePanel();
    this.hud.toast('Has salido de la nave', 'good', 2.4);
    this.saveGame(true);
  }

  _setShipSeat() {
    const seat = this.ship.seatPosition();
    seat.y += 0.55;
    const look = seat.clone().add(new THREE.Vector3(5.0, -0.6, 0));
    this.cameraRig.setSeat(seat, look);
  }

  /* ------------------------------------------------------------------ rover */

  _enterRover() {
    if (!this.planet?.rover) return;
    this.closePanel();
    this.vehicle = { type: 'rover', planet: this.planet };
    this.planet.rover.occupied = true;
    this.player.group.visible = false;
    this.player.setSafe(true);
    this.player.setSeated(true);
    this.seated = true;
    this.cameraRig.seated = true;
    const seat = this.planet.roverSeatPosition();
    const look = seat.clone().add(new THREE.Vector3(0, 0.2, 4));
    this.cameraRig.setSeat(seat, look);
    this.hud.toast('Rover en marcha · E para bajar', 'good', 3);
    this.audio.ui();
  }

  _exitRover() {
    if (!this.vehicle) return;
    if (!this.suit.equipped) {
      this.hud.toast('NO PUEDES SALIR SIN TRAJE ESPACIAL.', 'bad', 3.6);
      this.audio.alarm?.();
      return;
    }
    const planet = this.vehicle.planet;
    const rover = planet.rover;
    rover.occupied = false;
    rover.speed = 0;

    const side = rover.position.clone().add(
      new THREE.Vector3(Math.cos(rover.heading) * 2.2, 0, -Math.sin(rover.heading) * 2.2)
    );
    side.y = planet.groundHeightAt(side.x, side.z) + this.player.halfHeight + 0.1;
    this.player.body.position.copy(side);
    this.player.body.velocity.setZero();
    this.player.group.visible = true;
    this.player.sync(0.016, this.camera);
    this.vehicle = null;
    this.seated = false;
    this.cameraRig.seated = false;
    this.player.setSeated(false);
    this.lastPlayerMode = null;
    this._refreshZone(true);
    this.hud.toast('Has bajado del rover', 'good', 2.4);
    this.saveGame();
  }

  _updateVehicle(dt) {
    if (!this.vehicle) return;
    const planet = this.vehicle.planet;
    const move = this.controls.move;

    planet.updateRover(dt, { x: move.x, z: move.z });

    const seat = planet.roverSeatPosition();
    seat.y += 0.55;
    const look = seat.clone().add(
      new THREE.Vector3(Math.sin(planet.rover.heading) * 7, 0.1, Math.cos(planet.rover.heading) * 7)
    );
    this.cameraRig.setSeat(seat, look);
    this.cameraRig.updateSeated(dt);

    this.hud.setCrosshair('none');
    this.hud.showPrompt('Rover · E para bajar', 'E', 1);

    if (this.controls.consumeInteract()) this._exitRover();
  }

  /**
   * Comprobaciones reales de la esclusa: traje, casco, O2 y propulsores.
   * Devuelve { ok, reason } y bloquea la secuencia si algo falta.
   */
  _checkAirlock(action) {
    if (!action) return { ok: false, reason: 'Esclusa no disponible.' };
    if (!this.suit.equipped) {
      return {
        ok: false,
        reason:
          action.type === 'exit'
            ? 'NO PUEDES SALIR SIN TRAJE ESPACIAL.'
            : 'NO PUEDES ENTRAR SIN TRAJE ESPACIAL.',
      };
    }
    if (this.suit.helmet < 50) {
      return { ok: false, reason: 'CASCO DAÑADO · REPARA EL TRAJE EN INGENIERÍA.' };
    }
    if (action.type === 'exit') {
      if (this.player.o2 < 8) return { ok: false, reason: 'OXÍGENO INSUFICIENTE PARA LA EVA.' };
      if (this.player.energy < 8) return { ok: false, reason: 'PROPULSORES SIN COMBUSTIBLE.' };
      if (!this.tether?.anchor || this.tether.max <= 0) {
        return { ok: false, reason: 'CABLE DE SEGURIDAD NO ANCLADO.' };
      }
    }
    return { ok: true };
  }

  /* ----------------------------------------------------------------- ciclo */

  run() {
    this.renderer.setAnimationLoop(() => this.frame());
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.renderer.info.reset();
    this.environment.update(dt);
    this._adaptQuality(dt);

    // El overlay táctil sólo está activo durante la partida y sin paneles.
    this.touch.sync(this.state === 'playing' && !this.panelOpen, this.toolIndex);

    if (this.state === 'playing') {
      this.update(dt);
      this.postFX.render(dt);
    } else if (this.state === 'travel') {
      this._updateTravel(dt);
      this.travelScene.updateCamera(this.camera);
      this.postFX.render(dt);
    } else if (this.state === 'menu' || this.state === 'entry') {
      this.cameraRig.updateMenu(dt);
      this.station.update(dt);
      this.interior.update(dt, this.player.group.position);
      this.interiorSystems.update(dt, this.player.group.position);
      this.exteriorTasks.update(dt, this.player.group.position, this.missions.activeId);
      this.leakParticles.update(dt);
      this.postFX.render(dt);
    } else if (this.needsRender) {
      // Pausa / victoria / derrota: congelar el render ahorra GPU.
      this.needsRender = false;
      this.postFX.render(dt);
    }
  }

  update(dt) {
    this.time += dt;
    // Presencia multijugador: envía el estado local a frecuencia limitada y
    // actualiza los avatares remotos. Es independiente del resto de la física.
    this._syncMultiplayer(dt);
    this.updateJobs(dt);

    if (this.vehicle) {
      this.controls.poll();
      const mouse = this.controls.consumeMouse();
      if (mouse.dx || mouse.dy) this.cameraRig.rotate(mouse.dx, mouse.dy);
      this._updateVehicle(dt);
      this.planet?.update(dt, this.player.group.position);
      this.updateMission(dt);
      this.updateHUD();
      this.autosave(dt);
      return;
    }

    if (this.panelOpen) {
      const station = this.destination === 'station';
      if (station) {
        this.interior.update(dt, this.player.group.position);
        this.station.update(dt);
        this.interiorSystems.update(dt, this.player.group.position);
        this.exteriorTasks.update(dt, this.player.group.position, this.missions.activeId);
        this.tether.updateVisual(false);
      } else {
        this.planet.update(dt, this.player.group.position);
        this.interiorSystems.update(dt, this.player.group.position);
      }
      if (this.seated) this.cameraRig.updateSeated(dt);
      this.updateHUD();
      this.autosave(dt);
      return;
    }

    this.controls.poll();

    const mouse = this.controls.consumeMouse();
    if (mouse.dx || mouse.dy) this.cameraRig.rotate(mouse.dx, mouse.dy);

    const wheel = this.controls.consumeWheel();
    if (wheel) this.cameraRig.zoom(wheel);

    const station = this.destination === 'station';
    const zone = this._refreshZone();
    const position = this.player.group.position;

    // Física
    this.player.update(dt, this.controls.move, this.camera, this.controls.boost);
    // === MÓDULO 1: SOPORTE VITAL MEJORADO ===
    // Consumo/regeneración O₂ ya lo gestiona Player.update(dt).
    // Añadimos: nivel CO₂, durabilidad de filtros y su efecto en la escala de regeneración.

    const filterCount = Math.max(0, this.inventory.filter);
    // La escala base ya viene calculada en Game.js línea 3488: 1 + filterCount * 0.25.
    // Ajustamos según vida útil del filtro (this.player.filterLife, 0.0-1.0).
    const filterLifeFactor = this.player.filterLife;
    this.player.o2RegenScale = 1 + filterCount * 0.25 * filterLifeFactor;

    // CO₂: nuevo indicador de calidad del aire en hábitats cerrados.
    // Se acumula en EVA, se reduce en zona segura.
    if (!this.player.safe) {
      this.player.co2 = Math.min(100, this.player.co2 + 0.1 * dt * (2 - filterCount));
    } else {
      this.player.co2 = Math.max(0, this.player.co2 - 0.05 * dt * (1 + filterCount));
    }

    // Vida útil de los filtros: se gasta con uso EVA, se recupera en hábitat.
    if (!this.player.safe && this.player.o2 < 80) {
      this.player.filterLife = Math.max(0.3, this.player.filterLife - 0.015 * dt);
    } else if (this.player.safe && this.player.o2 > 70) {
      this.player.filterLife = Math.min(1.0, this.player.filterLife + 0.008 * dt);
    }

    if (station) this.tether.applyPhysics(dt, !zone.safe);
    this.physics.step(dt);
    this.player.sync(dt, this.camera);
    if (station) this.tether.updateVisual(!zone.safe);

    this.cameraRig.update(dt, this.player.group.position);

    if (station) {
      this.station.update(dt);
      this.interior.update(dt, this.player.group.position);
      this.interiorSystems.update(dt, this.player.group.position);
      this.exteriorTasks.update(dt, this.player.group.position, this.missions.activeId);
    } else {
      this.planet.update(dt, this.player.group.position);
      this.interiorSystems.update(dt, this.player.group.position);
      this._checkPlanetExploration();
    }

    this.updateInteraction(dt);
    this.updateMission(dt);

    if (this.state !== 'playing') return;

    this.thrusterParticles.update(dt);
    this.sparkParticles.update(dt);
    this.leakParticles.update(dt);

    this.toolRig.update(dt, this.player.speed, this.repairing);
    this.updateAudio();
    this.updateHUD();
    this.autosave(dt);
  }

  /** Progreso de exploración persistente: cordillera y cueva. */
  _checkPlanetExploration() {
    const planet = this.planet;
    const position = this.player.group.position;

    if (!planet.mountainExplored && planet.isInMountain(position)) {
      planet.mountainExplored = true;
      this.missions.notify('mountain', 1, this.destination);
      this.hud.toast('Cordillera explorada · datos geológicos registrados', 'good', 3.4);
      this.audio.ping();
      this.saveGame();
    }

    if (!planet.caveExplored && planet.isInCave(position)) {
      planet.caveExplored = true;
      this.missions.notify('cave', 1, this.destination);
      this.hud.toast('Cueva explorada · túnel registrado', 'good', 3.4);
      this.audio.ping();
      this.saveGame();
    }
  }

  /* ------------------------------------------------------------ interacción */

  findTarget() {
    if (this.station.active.length === 0) return null;

    this.raycaster.setFromCamera(this.center, this.camera);
    this.raycaster.far = 80;
    this.raycaster.near = 0;

    const hits = this.raycaster.intersectObjects(this.station.hitMeshes, false);
    const playerPosition = this.player.group.position;

    for (const hit of hits) {
      const breach = hit.object.userData.breach;
      if (!breach || !breach.active) continue;
      if (breach.position.distanceTo(playerPosition) > 5.5) continue;
      return breach;
    }

    return null;
  }

  updateInteraction(dt) {
    const tool = TOOLS[this.toolIndex];
    const clicked = this.controls.consumeClick();
    const interact = this.controls.consumeInteract();
    const held = this.controls.interactHeld;
    const position = this.player.group.position;
    this.repairing = false;

    if (this.destination !== 'station') {
      this._planetInteraction(dt, interact);
      return;
    }

    // 1. Esclusa: siempre tiene prioridad.
    const airlockAction = this.interior.getAirlockAction(position);
    if (airlockAction) {
      this.hud.setCrosshair('none');
      this.hud.showPrompt(airlockAction.label, airlockAction.key, 1);
      if (interact) {
        const check = this._checkAirlock(airlockAction);
        if (!check.ok) {
          this.hud.toast(check.reason, 'bad', 3.6);
          this.audio.alarm?.();
        } else if (this.interior.requestAirlock(position)) {
          this.audio.ui();
        }
      }
      return;
    }

    // 2. Interior y cabina de la nave: consolas y puestos de mando.
    if (this.player.inside) {
      this.hud.setCrosshair('none');
      const inShip = this.ship.contains(position);
      let point = this.interiorSystems.getNearby(position, inShip ? 'ship' : 'station');
      if (!point && !inShip) {
        // La escotilla de la nave se puede usar desde el hangar.
        const hatch = this.interiorSystems.getNearby(position, 'ship');
        if (hatch?.id === 'ship_hatch') point = hatch;
      }
      if (point) {
        this.hud.showPrompt(point.label, 'E', 1);
        if (interact) this.openInteriorPoint(point);
      } else {
        this.hud.hidePrompt();
      }
      return;
    }

    // 3. Tareas EVA de la misión activa.
    const task = this.exteriorTasks.getNearby(position);
    if (task) {
      this.updateExteriorTask(task, interact, held, dt);
      return;
    }

    const nearPort = this.updateOxygenPort(dt);

    // Escáner: utilidad, no repara.
    if (!tool.repairs) {
      this.hud.setCrosshair('none');

      if (this.scanCooldown > 0) {
        if (!nearPort) {
          this.hud.showPrompt(
            'Escáner recargando',
            `LISTO EN ${this.scanCooldown.toFixed(1)}s`,
            1 - this.scanCooldown / this.balance.values.scanCooldown
          );
        }
      } else if (!nearPort) {
        this.hud.showPrompt(
          `Escanear fugas activas (${this.station.active.length})`,
          'CLIC IZQ',
          1
        );
      }

      if (clicked && this.scanCooldown <= 0) this.scan();
      return;
    }

    const target = this.findTarget();

    if (!target) {
      this.hud.setCrosshair('none');
      if (!nearPort) this.hud.hidePrompt();
      return;
    }

    const correct = tool.repairs === target.type;

    if (!correct) {
      this.hud.setCrosshair('wrong');
      this.hud.showPrompt(
        `Se necesita ${REQUIRED_TOOL[target.type]}`,
        'CAMBIA DE HERRAMIENTA (1 / 2)',
        target.progress
      );
      target.progress = Math.max(0, target.progress - dt * 0.4);
      return;
    }

    this.hud.setCrosshair('target');

    if (this.controls.repairHeld) {
      this.repairing = true;
      this.player.setAction('repair', 0.25);
      target.progress += dt / tool.repairTime;

      this.sparkAccum += dt;
      while (this.sparkAccum > 0.045) {
        this.sparkAccum -= 0.045;
        this.sparkParticles.spawn(target.position, target.normal, {
          speed: 4.2,
          spread: 1.2,
          life: 0.5,
          offset: 0.25,
        });
      }

      if (target.progress >= 1) {
        this.completeRepair(target);
        return;
      }
    } else {
      target.progress = Math.max(0, target.progress - dt * 0.3);
    }

    this.hud.showPrompt(
      target.type === 'hull' ? 'Sellar fisura del casco' : 'Apretar válvula',
      'MANTÉN CLIC IZQ',
      target.progress
    );
  }

  /** Interacción en superficie: nave, módulos, recursos, cueva y rover. */
  _planetInteraction(dt, interact) {
    const position = this.player.group.position;
    this.hud.setCrosshair('none');

    if (this.ship.contains(position)) {
      const point = this.interiorSystems.getNearby(position, 'ship');
      if (point) {
        this.hud.showPrompt(point.label, 'E', 1);
        if (interact) this.openInteriorPoint(point);
      } else {
        this.hud.hidePrompt();
      }
      return;
    }

    const point = this.planet.getNearby(position);
    if (point) {
      this.hud.showPrompt(point.label, 'E', 1);
      if (interact) this.openPlanetPoint(point);
      return;
    }

    // Escáner planetario: revela depósitos cercanos sin reparar nada.
    if (TOOLS[this.toolIndex].repairs === false && this.scanCooldown <= 0) {
      this.hud.showPrompt('Escanear depósitos de recursos', 'CLIC IZQ', 1);
    } else {
      this.hud.hidePrompt();
    }
    void dt;
  }

  updateExteriorTask(task, interact, held, dt) {
    this.hud.setCrosshair('none');

    if (task.tool != null && this.toolIndex !== task.tool) {
      this.hud.showPrompt(
        `Se necesita ${TOOLS[task.tool].name}`,
        'CAMBIA DE HERRAMIENTA (1 / 2 / 3)',
        0
      );
      return;
    }

    if (task.requires && this.inventory[task.requires] <= 0) {
      this.hud.showPrompt(
        task.requires === 'component' ? 'Falta el kit de repuesto' : 'Falta material',
        'ALMACÉN',
        0
      );
      return;
    }

    if (task.duration <= 0) {
      this.hud.showPrompt(task.label, 'E', 1);
      if (interact) this.completeExteriorTask(task);
      return;
    }

    if (held) {
      const scale = this.balance.values.repairTimeScale ?? 1;
      task.progress = Math.min(1, task.progress + dt / (task.duration * scale));

      this.sparkAccum += dt;
      while (this.sparkAccum > 0.06) {
        this.sparkAccum -= 0.06;
        this.sparkParticles.spawn(
          task.group.position,
          new THREE.Vector3(0, 1, 0),
          { speed: 3.0, spread: 0.9, life: 0.45, offset: 0.2 }
        );
      }

      if (task.progress >= 1) {
        this.completeExteriorTask(task);
        return;
      }
    } else {
      task.progress = Math.max(0, task.progress - dt * 0.9);
    }

    this.hud.showPrompt(task.label, 'MANTÉN E', task.progress);
  }

  completeExteriorTask(task) {
    const type = this.exteriorTasks.complete(task);
    if (!type) return;

    if (task.requires && this.inventory[task.requires] > 0) {
      this.inventory[task.requires] -= 1;
    }
    if (type === 'tool_pickup') {
      this.inventory.tools += 1;
      this.player.setAction('pickup', 1.0);
    }

    this.missions.notify(type, 1, 'station');

    this.sparkParticles.burst(task.group.position, new THREE.Vector3(0, 1, 0), 20, {
      speed: 4.5, spread: 1.1, life: 0.6, offset: 0.2,
    });
    this.audio.success();
    this.cameraRig.addShake(0.04);
    this.hud.toast(`${task.label} · completado`, 'good', 2.4);
  }

  updateOxygenPort(dt) {
    const distance = this.station.o2Port.distanceTo(this.player.group.position);
    if (distance > 4.2) return false;

    if (this.player.o2 >= 99.5) {
      this.hud.showPrompt('Oxígeno al máximo', 'PUERTO O2', 1);
      return true;
    }

    this.player.o2 = Math.min(100, this.player.o2 + 20 * dt);
    this.hud.showPrompt('Recargando oxígeno', 'PUERTO O2', this.player.o2 / 100);
    return true;
  }

  completeRepair(breach) {
    this.station.repair(breach);
    this.player.repairHull(2);
    this.player.o2 = Math.min(100, this.player.o2 + 6);
    this.missions.notify('leaks', 1, 'station');

    this.sparkParticles.burst(breach.position, breach.normal, 26, {
      speed: 5.5, spread: 1.3, life: 0.7, offset: 0.25,
    });

    this.audio.success();
    this.cameraRig.addShake(0.06);
    this.hud.toast(`Fuga sellada · ${this.station.repairedCount} / ${this.station.totalBreaches}`, 'good');

    if (this.station.repairedCount + this.station.active.length < this.station.totalBreaches) {
      this.station.spawn();
    }

    // La exploración libre continúa: reparar todas las fugas ya no termina
    // la partida ni reinicia misiones.
    if (this.station.repairedCount >= this.station.totalBreaches) {
      this.hud.toast('Casco asegurado · la estación sigue operativa', 'good', 3);
    }
  }

  scan() {
    this.scanCooldown = this.balance.values.scanCooldown;
    this.revealUntil = this.time + 12;
    this.audio.ping();
    this.cameraRig.addShake(0.02);

    const count = this.station.active.length;
    this.hud.toast(
      count === 0
        ? 'Escaneo: sin fugas activas'
        : `Escaneo: ${count} fuga${count === 1 ? '' : 's'} detectada${count === 1 ? '' : 's'}`,
      'good',
      3
    );
  }

  /* -------------------------------------------------------------- misiones */

  updateMission(dt) {
    this.scanCooldown = Math.max(0, this.scanCooldown - dt);
    this.repairCooldown = Math.max(0, this.repairCooldown - dt);
    this.integrity = this.player.hull;

    this.alarmTimer -= dt;
    if (this.alarmTimer <= 0 && (this.player.hull < 30 || this.player.o2 < 20)) {
      this.audio.alarm();
      this.alarmTimer = 2.4;
    }

    if (this.player.hull <= 0) {
      this.lose('Casco comprometido', 'La integridad del traje llegó a cero.');
      return;
    }

    if (this.player.o2 <= 0) {
      this.lose('Sin oxígeno', 'Tu reserva de O2 se agotó en el exterior.');
    }
  }

  _onMissionComplete(mission) {
    const reward = mission.reward ?? {};
    this.player.o2 = Math.min(100, this.player.o2 + (reward.o2 ?? 0));
    this.player.energy = Math.min(100, this.player.energy + (reward.rcs ?? 0));
    this.player.repairHull(reward.hull ?? 0);

    // Resultado educativo: qué se aprendió, qué se decidió y qué consecuencia
    // tuvo. La partida no se reinicia y se vuelve a la exploración libre.
    const report = {
      learned: [
        `Has completado «${mission.name}».`,
        ...mission.objectives.map((item) => `Objetivo registrado: ${item.label}.`),
      ],
      consequences: [
        `Recompensa aplicada: O2 +${reward.o2 ?? 0}, RCS +${reward.rcs ?? 0}, casco +${
          reward.hull ?? 0
        }.`,
        `El progreso se ha guardado y la misión no volverá a aparecer como pendiente.`,
        `Puedes seguir explorando, aceptar otra misión o viajar sin reiniciar.`,
      ],
      concepts: [
        MISSION_CATEGORIES[mission.category] ?? 'operaciones',
        'diagnóstico',
        'procedimiento',
        'consecuencias de recursos',
      ],
      improve:
        'Repite una misión de otra categoría o sube a la Academia para conectar esta práctica con el diseño de misiones.',
    };

    // Aviso grande y persistente: la partida no se reinicia.
    this.hud.showMissionComplete(mission, report);
    this.audio.success();
    this.cameraRig.addShake(0.05);

    // Mantener siempre trabajo disponible en la estación sin duplicar IDs.
    if (mission.location === 'station') {
      const pending = this.missions.pendingFor('station').length;
      if (pending < 3) this.missions.generateMaintenance(1);
    }

    this.saveGame(true);
    this.renderPanelIfOpen();
  }

  /* --------------------------------------------------------------- consolas */

  openInteriorPoint(point) {
    if (point?.id === 'ship_hatch') {
      this._boardShip();
      return;
    }
    this.panelPoint = point;
    this.seated = point.seat === true || point.owner === 'ship';
    if (this.seated && point.owner === 'ship') this._setShipSeat();
    this.player.setAction('interact', 0.7);
    this.openPanel(point.panel, point.id);
    this.audio.ui();
  }

  /** Abre un punto de la superficie (base, construcción, recurso, cueva). */
  openPlanetPoint(point) {
    if (!point) return;
    this.panelPoint = point;

    if (point.kind === 'ship') {
      this._boardShip();
      return;
    }
    if (point.kind === 'rover') {
      this._enterRover();
      return;
    }

    this.seated = false;
    this.player.setAction('interact', 0.6);
    this.openPanel(point.panel, point.id);
    this.audio.ui();
  }

  openPanel(kind, source = null) {
    if (!kind) return;
    this.panelOpen = kind;
    this.panelSource = source;
    if (kind === 'cockpit') this.seated = true;
    if (kind.startsWith('ship')) {
      this.seated = true;
      this._setShipSeat();
    }
    this.player.setSeated(this.seated);

    this.ignoreUnlock = true;
    if (document.pointerLockElement) document.exitPointerLock();
    this.controls.interactPressed = false;
    this.renderPanel();
    this.clock.getDelta();
    this.audio.ui();
  }

  closePanel() {
    if (!this.panelOpen) return;
    this.panelOpen = null;
    this.panelSource = null;
    this.panelPoint = null;
    this.seated = false;
    this.cameraRig.seated = false;
    this.player.setSeated(false);
    this.hud.hidePanel();
    this.controls.interactPressed = false;
    this.ignoreUnlock = true;
    this.controls.requestLock();
    this.clock.getDelta();
    this.cameraRig.snap(this.player.group.position);
    this.audio.ui();
  }

  renderPanelIfOpen() {
    if (this.panelOpen) this.renderPanel();
  }

  _jobHtml() {
    if (!this.job) return '';
    const ratio = Math.max(0, Math.min(1, this.job.elapsed / this.job.duration));
    return `
      <div class="job">
        <span id="job-label">${this.job.label}</span>
        <div class="bar thin"><i id="job-fill" class="fill prompt-fill" style="transform:scaleX(${ratio.toFixed(3)})"></i></div>
      </div>
    `;
  }

  _missionRows(location = 'station') {
    const missions = this.missions
      .pendingFor(location)
      .slice()
      .sort((a, b) => {
        if (a.id === this.missions.activeId) return -1;
        if (b.id === this.missions.activeId) return 1;
        return 0;
      });

    if (missions.length === 0) {
      return '<p class="panel-sub">No hay misiones pendientes en esta localización.</p>';
    }

    return missions
      .map((mission) => {
        const progress = this.missions.progress(mission);
        const active = mission.id === this.missions.activeId;
        const state = this.missions.stateLabel(mission);
        const chips = mission.objectives
          .map(
            (item) =>
              `<span class="objective-chip ${item.progress >= item.target ? 'done' : ''}">${item.label} ${Math.min(item.progress, item.target)}/${item.target}</span>`
          )
          .join('');
        const reward = mission.reward ?? {};
        const disabled = active;
        return `
          <article class="mission-row ${active ? 'is-active' : ''}">
            <div class="mission-row-head">
              <strong>${mission.name}</strong>
              <span>${MISSION_CATEGORIES[mission.category] ?? mission.category} · ${mission.difficulty} · ${state}</span>
            </div>
            <p>${mission.description}</p>
            <div class="mission-objectives">${chips}</div>
            <div class="mission-row-head">
              <span>Recompensa: O2 +${reward.o2 ?? 0} · RCS +${reward.rcs ?? 0} · Casco +${reward.hull ?? 0}</span>
              <span>${progress.done}/${progress.total}</span>
            </div>
            <div class="mission-actions">
              <button class="btn small ${disabled ? 'ghost' : ''}" type="button" data-action="activate" data-id="${mission.id}" ${disabled ? 'disabled' : ''}>
                ${active ? 'En curso' : 'Aceptar misión'}
              </button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  _historyRows(location = 'station') {
    const entries = this.missions.historyFor(location).slice(0, 6);
    if (entries.length === 0) {
      return '<p class="panel-sub">Sin misiones completadas todavía.</p>';
    }
    return entries
      .map((entry) => {
        const date = new Date(entry.completedAt);
        const stamp = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        const state = entry.failed ? 'Fallida' : 'Completada';
        const objectives = entry.objectives
          .map((item) => `${item.label} ${item.progress}/${item.target}`)
          .join(' · ');
        return `
          <div class="panel-row">
            <div class="grow">
              <strong>${entry.name}</strong>
              <span>${objectives}</span>
            </div>
            <span class="${entry.failed ? 'off' : 'ok'}">${state} · ${stamp}</span>
          </div>
        `;
      })
      .join('');
  }

  _costLabel(cost = {}) {
    const parts = Object.entries(cost).map(
      ([key, value]) => `${value} ${RESOURCE_LABELS[key] ?? key}`
    );
    return parts.length ? parts.join(' · ') : 'Sin coste';
  }

  _moduleRows(planet) {
    return [...planet.modules.values()]
      .map((module) => {
        const built = module.built;
        return `
          <div class="panel-row">
            <div class="grow">
              <strong>${module.label}</strong>
              <span>${built ? 'Estructura operativa' : `Pendiente · ${this._costLabel(module.cost)}`}</span>
            </div>
            <span class="${built ? 'ok' : 'warn'}">${built ? 'CONSTRUIDO' : 'ANDAMIO'}</span>
          </div>
        `;
      })
      .join('');
  }

  _mapRows() {
    const playerPosition = this.player.group.position;
    return NAV_POIS.map((poi) => {
      const distance = poi.position.distanceTo(playerPosition);
      const selected = this.navTarget?.id === poi.id;
      const visited = this.visitedPois.has(poi.id);
      return `
        <div class="panel-row">
          <div class="grow">
            <strong>${poi.name}</strong>
            <span>${distance.toFixed(1)} m · ${selected ? 'destino marcado' : visited ? 'revisado' : 'pendiente'}</span>
          </div>
          <button class="btn small ${selected ? '' : 'ghost'}" type="button" data-action="nav" data-id="${poi.id}">
            ${selected ? 'Destino' : 'Marcar'}
          </button>
        </div>
      `;
    }).join('');
  }

  _maintenanceRows() {
    return this.maintenance.tasks
      .map((task) => {
        const point = this.interiorSystems.points.find((item) => item.id === task.location);
        const distance = point
          ? point.group.position.distanceTo(this.player.group.position)
          : Infinity;
        const near = distance <= (point?.radius ?? 2.8) + 0.6;
        const done = task.state === 'done';
        const cost = task.cost
          ? Object.entries(task.cost)
              .map(([key, value]) => `${value} ${key === 'filter' ? 'filtro' : 'kit'}`)
              .join(' · ')
          : 'Sin consumibles';
        return `
          <div class="panel-row">
            <div class="grow">
              <strong>${task.label}</strong>
              <span>${task.objective} · ${task.locationLabel} · ${cost}${done && task.result ? ` · ${task.result}` : ''}</span>
            </div>
            <span class="${done ? 'ok' : near ? 'warn' : 'off'}">${done ? 'COMPLETADA' : near ? 'AQUÍ' : 'OTRA SALA'}</span>
            <button class="btn small ${near ? '' : 'ghost'}" type="button" data-action="maintenance" data-id="${task.id}" ${near ? '' : 'disabled'}>
              ${done ? 'Repetir' : 'Ejecutar'}
            </button>
          </div>
        `;
      })
      .join('');
  }

  _runMaintenance(id) {
    const task = this.maintenance.get(id);
    if (!task) return;

    const point = this.interiorSystems.points.find((item) => item.id === task.location);
    const distance = point
      ? point.group.position.distanceTo(this.player.group.position)
      : Infinity;
    if (!point || distance > (point.radius ?? 2.8) + 0.6) {
      this.hud.toast(`Ve a ${task.locationLabel} para ejecutar esta tarea`, 'warn', 3.2);
      return;
    }

    if (task.cost?.filter && this.inventory.filter <= 0) {
      this.hud.toast('No quedan filtros · recógelos en el almacén', 'warn', 3);
      return;
    }
    if (task.cost?.component && this.inventory.component <= 0) {
      this.hud.toast('No quedan kits de repuesto · recógelos en el almacén', 'warn', 3);
      return;
    }

    this.startJob({
      id: `maint-${task.id}`,
      action: 'maintenance',
      label: task.label,
      duration: task.duration,
      source: task.location,
      onComplete: () => {
        const result = this._applyMaintenance(task);
        this.maintenance.markDone(task.id, result);
        this.hud.toast(`${task.label} · ${result}`, 'good', 3.6);
        this.audio.success();
        this.saveGame(true);
      },
    });
  }

  /** Aplica el efecto real de una actividad de mantenimiento. */
  _applyMaintenance(task) {
    switch (task.effect) {
      case 'circuit': {
        const index = this.engineering.circuits.findIndex((done) => !done);
        if (index >= 0) {
          this.engineering.circuits[index] = true;
          const count = this.engineering.circuits.filter(Boolean).length;
          this.interior.setPower(0.72 + (count / 3) * 0.28);
          this.missions.notify('circuit', 1, 'station');
          return `Circuito ${index + 1} restablecido · potencia ${Math.round(this.interior.powerLevel * 100)}%`;
        }
        this.interior.setPower(1);
        return 'Red ya operativa · verificación completada';
      }
      case 'filter': {
        const index = this.lifeSupport.filters.findIndex((done) => !done);
        if (index >= 0) {
          this.inventory.filter = Math.max(0, this.inventory.filter - 1);
          this.lifeSupport.filters[index] = true;
          const count = this.lifeSupport.filters.filter(Boolean).length;
          this.player.o2RegenScale = 1 + count * 0.25;
          this.missions.notify('filter', 1, 'station');
          return `Filtro ${index + 1} sustituido · regeneración ${this.player.o2RegenScale.toFixed(2)}×`;
        }
        return 'Filtros ya operativos · revisión completada';
      }
      case 'leak': {
        const breach = this.station.active[0];
        if (!breach) return 'Sin fugas activas · inspección completada';
        this.station.repair(breach);
        this.missions.notify('hull', 1, 'station');
        return `Fuga sellada · ${this.station.repairedCount}/${this.station.totalBreaches} reparadas`;
      }
      case 'sensor': {
        const was = this.lab.calibrated;
        this.lab.calibrated = true;
        return was
          ? 'Sensor ya calibrado · lectura verificada'
          : 'Espectrómetro calibrado · deriva corregida';
      }
      case 'antenna': {
        const was = this.commsSent;
        this.commsSent = true;
        return was
          ? 'Enlace de banda X ya estable · inspección completada'
          : 'Antena inspeccionada · enlace con Tierra restablecido';
      }
      case 'cooling': {
        this.inventory.component = Math.max(0, this.inventory.component - 1);
        this.player.o2RegenScale = Math.min(2.5, this.player.o2RegenScale + 0.25);
        return `Refrigeración reparada · regeneración ${this.player.o2RegenScale.toFixed(2)}×`;
      }
      case 'module': {
        this.moduleInspections += 1;
        this.player.repairHull(5);
        return `Módulo inspeccionado · integridad verificada (${this.moduleInspections})`;
      }
      default:
        return 'Actividad completada';
    }
  }

  _statusRows() {
    const airlock = this.interior.getAirlockStatus();
    const leaks = this.station.active.length;
    return `
      <div class="panel-row"><div class="grow"><strong>Fugas activas</strong><span>${leaks} en el casco exterior</span></div><span class="${leaks ? 'off' : 'ok'}">${leaks ? 'ATENCIÓN' : 'OK'}</span></div>
      <div class="panel-row"><div class="grow"><strong>Integridad del traje</strong><span>Impactos y colisiones</span></div><span class="${this.player.hull < 40 ? 'off' : 'ok'}">${Math.round(this.player.hull)}%</span></div>
      <div class="panel-row"><div class="grow"><strong>Oxígeno</strong><span>${this.player.safe ? 'Recuperación en zona presurizada' : 'Consumo EVA'}</span></div><span class="${this.player.o2 < 25 ? 'off' : 'ok'}">${Math.round(this.player.o2)}%</span></div>
      <div class="panel-row"><div class="grow"><strong>RCS</strong><span>Combustible de propulsores</span></div><span class="${this.player.energy < 20 ? 'off' : 'ok'}">${Math.round(this.player.energy)}%</span></div>
      <div class="panel-row"><div class="grow"><strong>Esclusa</strong><span>Presión ${(airlock.pressure * 100).toFixed(0)}%</span></div><span class="${airlock.pressurized ? 'ok' : 'warn'}">${airlock.label}</span></div>
      <div class="panel-row"><div class="grow"><strong>Potencia del hábitat</strong><span>Circuitos restablecidos</span></div><span class="${this.interior.powerLevel > 0.9 ? 'ok' : 'warn'}">${Math.round(this.interior.powerLevel * 100)}%</span></div>
      <div class="panel-row"><div class="grow"><strong>Módulos</strong><span>${this.interior.stats.modules} habitables · ${this.interior.stats.doors} compuertas</span></div><span class="ok">OPERATIVO</span></div>
    `;
  }

  renderPanel() {
    if (!this.panelOpen) return;
    const kind = this.panelOpen;
    const airlock = this.interior.getAirlockStatus();

    if (kind === 'navigation' || kind === 'cockpit') {
      const seatNote =
        kind === 'cockpit'
          ? 'Puesto de mando · cámara fijada al asiento. Pulsa ESC para levantarte.'
          : 'Consola de navegación · selecciona una misión y marca un destino.';
      this._showPanel({
        eyebrow: 'PUENTE DE MANDO · EVA-07',
        title: 'Navegación y misiones',
        subtitle: seatNote,
        html: `
          <div class="panel-section">
            <h3>Misiones disponibles</h3>
            <p>Una sola misión puede estar activa. El progreso y las misiones completadas se conservan al guardar la partida.</p>
            ${this._missionRows('station')}
            <div class="panel-grid">
              <button class="btn small ghost" type="button" data-action="request-maintenance">Solicitar ronda de mantenimiento</button>
            </div>
          </div>
          <div class="panel-section">
            <h3>Historial de misiones</h3>
            <div class="panel-grid">${this._historyRows('station')}</div>
          </div>
          <div class="panel-section">
            <h3>Mapa y destinos</h3>
            <div class="panel-grid">${this._mapRows()}</div>
          </div>
          <div class="panel-section">
            <h3>Estado de la estación</h3>
            <div class="panel-grid">${this._statusRows()}</div>
          </div>
          <div class="panel-section">
            <h3>Comunicaciones</h3>
            <div class="panel-row">
              <div class="grow"><strong>Enlace con Tierra</strong><span>${this.commsSent ? 'Informe transmitido · esperando acuse' : 'Canal listo para transmitir'}</span></div>
              <button class="btn small ${this.commsSent ? 'ghost' : ''}" type="button" data-action="comms">${this.commsSent ? 'Reenviar' : 'Transmitir informe'}</button>
            </div>
          </div>
          ${this._jobHtml()}
        `,
      });
      return;
    }

    if (kind === 'ship' || kind === 'ship_nav' || kind === 'ship_cargo') {
      const destination = this.destinations[this.destination];
      const cargoRows = Object.entries(this.cargo)
        .map(
          ([key, value]) =>
            `<div class="panel-row"><div class="grow"><strong>${RESOURCE_LABELS[key] ?? key}</strong><span>Bodega de la nave</span></div><span class="ok">${value}</span></div>`
        )
        .join('');
      const travelRows = Object.values(this.destinations)
        .map((item) => {
          const current = item.id === this.destination;
          const disabled = current || this.travel;
          return `
            <div class="panel-row">
              <div class="grow"><strong>${item.name}</strong><span>${current ? 'Destino actual' : 'Trayectoria calculada'}</span></div>
              <button class="btn small ${disabled ? 'ghost' : ''}" type="button" data-action="travel" data-id="${item.id}" ${disabled ? 'disabled' : ''}>
                ${current ? 'AQUÍ' : 'VIAJAR'}
              </button>
            </div>
          `;
        })
        .join('');

      if (kind === 'ship_cargo') {
        this._showPanel({
          eyebrow: 'NAVE DE TRANSPORTE · BODEGA',
          title: 'Carga y suministros',
          subtitle: 'La carga viaja contigo entre la estación, la Luna y Marte. Descárgala en una base para usarla en construcción.',
          html: `
            <div class="panel-section">
              <h3>Carga actual</h3>
              <div class="panel-grid">${cargoRows || '<p>Bodega vacía.</p>'}</div>
            </div>
            <div class="panel-section">
              <h3>Transferencia</h3>
              <div class="panel-grid">
                <button class="btn small" type="button" data-action="unload-cargo">Descargar en ${destination.short}</button>
                <button class="btn small ghost" type="button" data-action="exit-ship">Salir de la nave</button>
              </div>
            </div>
          `,
        });
        return;
      }

      this._showPanel({
        eyebrow: kind === 'ship_nav' ? 'NAVE DE TRANSPORTE · NAVEGACIÓN' : 'NAVE DE TRANSPORTE · CABINA',
        title: 'Carguero interplanetario',
        subtitle: `Ubicación actual: ${destination.name}. Selecciona un destino para iniciar la transición.`,
        html: `
          <div class="panel-section">
            <h3>Destinos</h3>
            <div class="panel-grid">${travelRows}</div>
          </div>
          <div class="panel-section">
            <h3>Estado de la nave</h3>
            <div class="panel-grid">
              <div class="panel-row"><div class="grow"><strong>Combustible</strong><span>Depósito principal</span></div><span class="${this.shipFuel < 25 ? 'warn' : 'ok'}">${this.travel ? 'EN VUELO' : `${Math.round(this.shipFuel)}%`}</span></div>
              <div class="panel-row"><div class="grow"><strong>Integridad del casco</strong><span>Fatiga estructural</span></div><span class="${this.shipIntegrity < 50 ? 'off' : 'ok'}">${Math.round(this.shipIntegrity)}%</span></div>
              <div class="panel-row"><div class="grow"><strong>Oxígeno de cabina</strong><span>Suministro para la tripulación</span></div><span class="ok">100%</span></div>
              <div class="panel-row"><div class="grow"><strong>Carga</strong><span>Minerales y materiales</span></div><span class="ok">${Object.values(this.cargo).reduce((a, b) => a + b, 0)} uds.</span></div>
            </div>
          </div>
          <div class="panel-section">
            <h3>Bodega</h3>
            <div class="panel-grid">${cargoRows || '<p>Bodega vacía.</p>'}</div>
          </div>
          <div class="panel-section">
            <h3>Tripulación</h3>
            <div class="panel-grid">
              <button class="btn small ghost" type="button" data-action="exit-ship">Salir de la nave</button>
            </div>
          </div>
        `,
      });
      return;
    }

    if (kind === 'base') {
      const planet = this.planet;
      const cargoTotal = Object.values(this.cargo).reduce((a, b) => a + b, 0);
      const buildRows = [...planet.modules.values()]
        .filter((module) => !module.built)
        .map(
          (module) => `
            <div class="panel-row">
              <div class="grow"><strong>${module.label}</strong><span>${this._costLabel(module.cost)}</span></div>
              <button class="btn small" type="button" data-action="build-module" data-id="${module.id}">Construir</button>
            </div>
          `
        )
        .join('');

      const marsActions =
        planet.config.id === 'mars'
          ? `
            <div class="panel-section">
              <h3>Sistemas del puesto Ares</h3>
              <div class="panel-grid">
                <div class="panel-row">
                  <div class="grow"><strong>Análisis geológico</strong><span>Estratigrafía de la zona de aterrizaje</span></div>
                  <button class="btn small ${this.marsSystems.geology ? 'ghost' : ''}" type="button" data-action="geology">${this.marsSystems.geology ? 'Registrado' : 'Analizar'}</button>
                </div>
                <div class="panel-row">
                  <div class="grow"><strong>Equipo dañado</strong><span>Rover y sistemas de superficie</span></div>
                  <button class="btn small ${this.marsSystems.equipment ? 'ghost' : ''}" type="button" data-action="repair-equipment">${this.marsSystems.equipment ? 'Reparado' : 'Reparar'}</button>
                </div>
                <div class="panel-row">
                  <div class="grow"><strong>Antena de Ares</strong><span>Enlace con la estación orbital</span></div>
                  <button class="btn small ${this.marsSystems.antenna ? 'ghost' : ''}" type="button" data-action="antenna-install">${this.marsSystems.antenna ? 'Calibrada' : 'Instalar'}</button>
                </div>
              </div>
            </div>
          `
          : '';

      this._showPanel({
        eyebrow: `${planet.config.name.toUpperCase()} · BASE`,
        title: 'Base modular y suministros',
        subtitle: 'Construye módulos reales, gestiona recursos y acepta misiones de la superficie.',
        html: `
          <div class="panel-section">
            <h3>Módulos</h3>
            <div class="panel-grid">${this._moduleRows(planet)}</div>
          </div>
          ${
            buildRows
              ? `<div class="panel-section"><h3>Construcción pendiente</h3><div class="panel-grid">${buildRows}</div></div>`
              : ''
          }
          <div class="panel-section">
            <h3>Recursos</h3>
            <div class="panel-grid">
              ${Object.entries(this.resources)
                .map(
                  ([key, value]) =>
                    `<div class="panel-row"><div class="grow"><strong>${RESOURCE_LABELS[key] ?? key}</strong><span>Stock de la base</span></div><span class="ok">${value}</span></div>`
                )
                .join('')}
              <div class="panel-row"><div class="grow"><strong>Carga en la nave</strong><span>Transportable entre destinos</span></div><span class="ok">${cargoTotal} uds.</span></div>
            </div>
            <div class="panel-grid">
              <button class="btn small" type="button" data-action="unload-cargo">Descargar carga en ${planet.config.short}</button>
              <button class="btn small ghost" type="button" data-action="save-game">Guardar partida</button>
            </div>
          </div>
          ${marsActions}
          <div class="panel-section">
            <h3>Misiones en ${planet.config.short}</h3>
            ${this._missionRows(planet.config.id)}
          </div>
          <div class="panel-section">
            <h3>Historial</h3>
            <div class="panel-grid">${this._historyRows(planet.config.id)}</div>
          </div>
          ${this._jobHtml()}
        `,
      });
      return;
    }

    if (kind === 'build') {
      const planet = this.planet;
      const moduleId = this.panelPoint?.module ?? this.panelSource;
      const module = planet?.modules.get(moduleId);
      if (!module) {
        this._showPanel({
          eyebrow: 'CONSTRUCCIÓN',
          title: 'Módulo no disponible',
          subtitle: 'La estructura ya no existe en este emplazamiento.',
          html: '<p class="panel-sub">Vuelve a la consola de la base.</p>',
        });
        return;
      }

      const built = module.built;
      const costRows = Object.entries(module.cost ?? {})
        .map(([key, value]) => {
          const have = this.resources[key] ?? 0;
          return `<div class="panel-row"><div class="grow"><strong>${RESOURCE_LABELS[key] ?? key}</strong><span>Necesario ${value}</span></div><span class="${have >= value ? 'ok' : 'off'}">${have}</span></div>`;
        })
        .join('');

      this._showPanel({
        eyebrow: 'CONSTRUCCIÓN MODULAR',
        title: module.label,
        subtitle: built
          ? 'La estructura ya está construida y operativa.'
          : 'Los materiales se consumen al iniciar la obra. El módulo aparece en el mundo al completarse.',
        html: `
          <div class="panel-section">
            <h3>Materiales</h3>
            <div class="panel-grid">${costRows || '<p class="panel-sub">Sin coste de materiales.</p>'}</div>
          </div>
          <div class="panel-section">
            <h3>Obra</h3>
            <div class="panel-grid">
              <button class="btn small ${built ? 'ghost' : ''}" type="button" data-action="build-module" data-id="${module.id}" ${built ? 'disabled' : ''}>
                ${built ? 'Módulo construido' : 'Construir módulo'}
              </button>
            </div>
          </div>
        `,
      });
      return;
    }

    if (kind === 'resource') {
      const point = this.panelPoint;
      const planet = this.planet;
      const collected = !point || point.collected;
      const label = point?.label ?? 'Depósito';
      const resource = point?.resource ?? 'regolith';

      this._showPanel({
        eyebrow: 'RECURSOS DE SUPERFICIE',
        title: label,
        subtitle: collected
          ? 'El depósito está agotado. Busca otro punto de extracción.'
          : 'La extracción carga el material en la bodega de la nave.',
        html: `
          <div class="panel-section">
            <h3>Depósito</h3>
            <div class="panel-grid">
              <div class="panel-row"><div class="grow"><strong>${RESOURCE_LABELS[resource] ?? resource}</strong><span>Cantidad disponible</span></div><span class="ok">${collected ? 0 : point?.amount ?? 0}</span></div>
              <div class="panel-row"><div class="grow"><strong>Bodega</strong><span>${RESOURCE_LABELS[resource] ?? resource}</span></div><span class="ok">${this.cargo[resource] ?? 0}</span></div>
              <div class="panel-row"><div class="grow"><strong>Stock de la base</strong><span>${planet?.config.short ?? ''}</span></div><span class="ok">${this.resources[resource] ?? 0}</span></div>
            </div>
            <div class="panel-grid">
              <button class="btn small ${collected ? 'ghost' : ''}" type="button" data-action="mine" ${collected ? 'disabled' : ''}>Extraer y cargar</button>
            </div>
          </div>
        `,
      });
      return;
    }

    if (kind === 'cave') {
      const planet = this.planet;
      this._showPanel({
        eyebrow: 'CUEVA SUBTERRÁNEA',
        title: 'Túnel de hielo',
        subtitle: 'Recorre el túnel hasta el depósito de hielo subsuperficial.',
        html: `
          <div class="panel-section">
            <h3>Exploración</h3>
            <div class="panel-grid">
              <div class="panel-row"><div class="grow"><strong>Estado del túnel</strong><span>${planet.caveExplored ? 'Cartografiado' : 'Sin cartografiar'}</span></div><span class="${planet.caveExplored ? 'ok' : 'warn'}">${planet.caveExplored ? 'EXPLORADO' : 'PENDIENTE'}</span></div>
              <div class="panel-row"><div class="grow"><strong>Hielo subsuperficial</strong><span>Depósito al fondo del túnel</span></div><span class="ok">LOCALIZADO</span></div>
            </div>
            <div class="panel-grid">
              <button class="btn small ${planet.caveExplored ? 'ghost' : ''}" type="button" data-action="explore-cave">${planet.caveExplored ? 'Registrado' : 'Registrar exploración'}</button>
            </div>
          </div>
        `,
      });
      return;
    }

    if (kind === 'rover') {
      const planet = this.planet;
      const rover = planet?.rover;
      this._showPanel({
        eyebrow: 'VEHÍCULO DE SUPERFICIE',
        title: 'Rover presurizado',
        subtitle: 'Conduce por el terreno, sube pendientes y recorre cráteres. Pulsa E para bajar.',
        html: `
          <div class="panel-section">
            <h3>Estado</h3>
            <div class="panel-grid">
              <div class="panel-row"><div class="grow"><strong>Posición</strong><span>Coordenadas locales</span></div><span class="ok">${rover ? `${rover.position.x.toFixed(0)}, ${rover.position.z.toFixed(0)}` : '—'}</span></div>
              <div class="panel-row"><div class="grow"><strong>Velocidad</strong><span>${rover?.occupied ? 'En marcha' : 'Estacionado'}</span></div><span class="ok">${Math.abs(rover?.speed ?? 0).toFixed(1)} m/s</span></div>
            </div>
            <div class="panel-grid">
              <button class="btn small" type="button" data-action="enter-rover">Conducir rover</button>
            </div>
          </div>
        `,
      });
      return;
    }

    if (kind === 'engineering') {
      const circuits = this.engineering.circuits
        .map(
          (done, index) => `
            <div class="panel-row">
              <div class="grow"><strong>Circuito ${index + 1}</strong><span>${done ? 'Restablecido' : 'Caído · sin tensión'}</span></div>
              ${done ? '<span class="ok">OK</span>' : `<button class="btn small" type="button" data-action="circuit" data-id="${index}">Restablecer</button>`}
            </div>
          `
        )
        .join('');
      this._showPanel({
        eyebrow: 'SALA DE INGENIERÍA',
        title: 'Distribución de potencia',
        subtitle: 'Restablece los circuitos, diagnostica averías y repara el traje.',
        html: `
          <div class="panel-section">
            <h3>Circuitos</h3>
            ${circuits}
          </div>
          <div class="panel-section">
            <h3>Mantenimiento</h3>
            <div class="panel-grid">
              <div class="panel-row">
                <div class="grow"><strong>Reparar casco</strong><span>+${this.balance.values.hullRepair}% · ${this.repairCooldown > 0 ? `espera ${this.repairCooldown.toFixed(1)}s` : 'listo'}</span></div>
                <button class="btn small ${this.repairCooldown > 0 ? 'ghost' : ''}" type="button" data-action="repair-hull" ${this.repairCooldown > 0 ? 'disabled' : ''}>Reparar</button>
              </div>
              <div class="panel-row">
                <div class="grow"><strong>Diagnóstico</strong><span>Lectura de sistemas y recursos</span></div>
                <button class="btn small ghost" type="button" data-action="diagnose">Escanear</button>
              </div>
            </div>
          </div>
          <div class="panel-section">
            <h3>Actividades de mantenimiento</h3>
            <p>Cada tarea indica objetivo, ubicación y resultado. Debes estar en la consola indicada para ejecutarla.</p>
            <div class="panel-grid">${this._maintenanceRows()}</div>
          </div>
          ${this._jobHtml()}
        `,
      });
      return;
    }

    if (kind === 'lab') {
      const samples = this.lab.samples
        .map(
          (done, index) => `
            <div class="panel-row">
              <div class="grow"><strong>Muestra ${index + 1}</strong><span>${done ? 'Analizada · resultados registrados' : 'Pendiente de análisis'}</span></div>
              ${done ? '<span class="ok">OK</span>' : `<button class="btn small" type="button" data-action="sample" data-id="${index}">Analizar</button>`}
            </div>
          `
        )
        .join('');
      this._showPanel({
        eyebrow: 'LABORATORIO CIENTÍFICO',
        title: 'Análisis y experimentos',
        subtitle: 'Analiza muestras, calibra instrumentos y registra resultados.',
        html: `
          <div class="panel-section">
            <h3>Muestras</h3>
            ${samples}
          </div>
          <div class="panel-section">
            <h3>Instrumentación</h3>
            <div class="panel-grid">
              <div class="panel-row">
                <div class="grow"><strong>Calibrar espectrómetro</strong><span>${this.lab.calibrated ? 'Calibrado' : 'Deriva detectada'}</span></div>
                <button class="btn small ${this.lab.calibrated ? 'ghost' : ''}" type="button" data-action="calibrate">${this.lab.calibrated ? 'Revisar' : 'Calibrar'}</button>
              </div>
              <div class="panel-row">
                <div class="grow"><strong>Resultados registrados</strong><span>Informe científico</span></div>
                <span class="ok">${this.scienceData}</span>
              </div>
            </div>
          </div>
          ${this._jobHtml()}
        `,
      });
      return;
    }

    if (kind === 'storage') {
      this._showPanel({
        eyebrow: 'ALMACÉN Y EQUIPAMIENTO',
        title: 'Preparación EVA',
        subtitle: 'Recoge componentes, filtros y muestras; recarga recursos antes de salir.',
        html: `
          <div class="panel-section">
            <h3>Inventario</h3>
            <div class="panel-grid">
              <div class="panel-row"><div class="grow"><strong>Kits de repuesto</strong><span>Regulador de potencia</span></div><span class="${this.inventory.component ? 'ok' : 'warn'}">${this.inventory.component}</span></div>
              <div class="panel-row"><div class="grow"><strong>Filtros de O2</strong><span>Soporte vital</span></div><span class="${this.inventory.filter ? 'ok' : 'warn'}">${this.inventory.filter}</span></div>
              <div class="panel-row"><div class="grow"><strong>Muestras</strong><span>Laboratorio</span></div><span class="${this.inventory.sample ? 'ok' : 'warn'}">${this.inventory.sample}</span></div>
              <div class="panel-row"><div class="grow"><strong>Herramientas recuperadas</strong><span>EVA</span></div><span class="ok">${this.inventory.tools}</span></div>
            </div>
          </div>
          <div class="panel-section">
            <h3>Recoger material</h3>
            <div class="panel-grid">
              <button class="btn small ghost" type="button" data-action="take-component">Kit de repuesto +1</button>
              <button class="btn small ghost" type="button" data-action="take-filter">Filtro de O2 +1</button>
              <button class="btn small ghost" type="button" data-action="take-sample">Muestra +1</button>
            </div>
          </div>
          <div class="panel-section">
            <h3>Recarga y reparación</h3>
            <div class="panel-grid">
              <div class="panel-row"><div class="grow"><strong>Oxígeno</strong><span>${Math.round(this.player.o2)}%</span></div><button class="btn small ghost" type="button" data-action="refill-o2">Recargar</button></div>
              <div class="panel-row"><div class="grow"><strong>RCS</strong><span>${Math.round(this.player.energy)}%</span></div><button class="btn small ghost" type="button" data-action="refill-rcs">Recargar</button></div>
              <div class="panel-row"><div class="grow"><strong>Casco</strong><span>${Math.round(this.player.hull)}% · ${this.repairCooldown > 0 ? 'en espera' : 'listo'}</span></div><button class="btn small ghost" type="button" data-action="repair-hull" ${this.repairCooldown > 0 ? 'disabled' : ''}>Reparar</button></div>
            </div>
          </div>
        `,
      });
      return;
    }

    if (kind === 'life') {
      const filters = this.lifeSupport.filters
        .map(
          (done, index) => `
            <div class="panel-row">
              <div class="grow"><strong>Filtro ${index + 1}</strong><span>${done ? 'Sustituido' : 'Saturado'}</span></div>
              ${done ? '<span class="ok">OK</span>' : `<button class="btn small" type="button" data-action="filter" data-id="${index}">Sustituir</button>`}
            </div>
          `
        )
        .join('');
      this._showPanel({
        eyebrow: 'SOPORTE VITAL · PASILLO',
        title: 'Control ambiental',
        subtitle: 'Sustituye los filtros de O2 y revisa la presión de los módulos.',
        html: `
          <div class="panel-section">
            <h3>Filtros de oxígeno</h3>
            ${filters}
          </div>
          <div class="panel-section">
            <h3>Estado</h3>
            <div class="panel-grid">
              <div class="panel-row"><div class="grow"><strong>Filtros en inventario</strong><span>Recoge más en el almacén</span></div><span class="${this.inventory.filter ? 'ok' : 'warn'}">${this.inventory.filter}</span></div>
              <div class="panel-row"><div class="grow"><strong>Recuperación de O2</strong><span>Eficiencia del sistema</span></div><span class="ok">${this.player.o2RegenScale.toFixed(1)}×</span></div>
              <div class="panel-row"><div class="grow"><strong>Presión de esclusa</strong><span>${airlock.label}</span></div><span class="${airlock.pressurized ? 'ok' : 'warn'}">${(airlock.pressure * 100).toFixed(0)}%</span></div>
            </div>
          </div>
          ${this._jobHtml()}
        `,
      });
      return;
    }

    if (kind === 'suit') {
      this._showPanel({
        eyebrow: 'ZONA DE PREPARACIÓN EVA',
        title: 'Armario de trajes',
        subtitle: 'Equipa el traje antes de entrar en la esclusa. El casco y los propulsores deben estar operativos.',
        html: `
          <div class="panel-section">
            <h3>Estado del traje</h3>
            <div class="panel-grid">
              <div class="panel-row"><div class="grow"><strong>Traje EVA</strong><span>${this.suit.equipped ? 'Puesto y presurizado' : 'Guardado en el armario'}</span></div><span class="${this.suit.equipped ? 'ok' : 'warn'}">${this.suit.equipped ? 'EQUIPADO' : 'GUARDADO'}</span></div>
              <div class="panel-row"><div class="grow"><strong>Integridad del casco</strong><span>Visera y juntas</span></div><span class="${this.suit.helmet < 50 ? 'off' : 'ok'}">${Math.round(this.suit.helmet)}%</span></div>
              <div class="panel-row"><div class="grow"><strong>Oxígeno</strong><span>Reserva del traje</span></div><span class="${this.player.o2 < 25 ? 'off' : 'ok'}">${Math.round(this.player.o2)}%</span></div>
              <div class="panel-row"><div class="grow"><strong>Propulsores RCS</strong><span>Combustible</span></div><span class="${this.player.energy < 20 ? 'off' : 'ok'}">${Math.round(this.player.energy)}%</span></div>
              <div class="panel-row"><div class="grow"><strong>Cable de seguridad</strong><span>Anclaje automático en esclusa</span></div><span class="ok">LISTO</span></div>
            </div>
          </div>
          <div class="panel-section">
            <h3>Preparación</h3>
            <div class="panel-grid">
              <button class="btn small" type="button" data-action="equip-suit">EQUIPAR TRAJE EVA</button>
              <button class="btn small ghost" type="button" data-action="unequip-suit">Guardar traje</button>
              <button class="btn small ghost" type="button" data-action="repair-suit">Reparar casco</button>
              <button class="btn small ghost" type="button" data-action="refill-o2">Recargar O2</button>
              <button class="btn small ghost" type="button" data-action="refill-rcs">Recargar RCS</button>
            </div>
          </div>
        `,
      });
      return;
    }

    if (kind === 'medbay') {
      this._showPanel({
        eyebrow: 'ENFERMERÍA',
        title: 'Control médico y del traje',
        subtitle: 'Repara el casco, estabiliza constantes y revisa el estado del astronauta.',
        html: `
          <div class="panel-section">
            <h3>Constantes</h3>
            <div class="panel-grid">
              <div class="panel-row"><div class="grow"><strong>Integridad del traje</strong><span>Casco y placas</span></div><span class="${this.player.hull < 40 ? 'off' : 'ok'}">${Math.round(this.player.hull)}%</span></div>
              <div class="panel-row"><div class="grow"><strong>Oxígeno</strong><span>Saturación</span></div><span class="${this.player.o2 < 25 ? 'off' : 'ok'}">${Math.round(this.player.o2)}%</span></div>
              <div class="panel-row"><div class="grow"><strong>Ritmo cardiaco</strong><span>Telemetría del traje</span></div><span class="ok">${this.player.safe ? '72' : '96'} lpm</span></div>
            </div>
          </div>
          <div class="panel-section">
            <h3>Tratamiento</h3>
            <div class="panel-grid">
              <button class="btn small" type="button" data-action="medkit">Estabilizar y reparar casco</button>
              <button class="btn small ghost" type="button" data-action="refill-o2">Oxígeno</button>
              <button class="btn small ghost" type="button" data-action="diagnose">Diagnóstico</button>
            </div>
          </div>
          ${this._jobHtml()}
        `,
      });
      return;
    }

    if (kind === 'dorms') {
      this._showPanel({
        eyebrow: 'DORMITORIOS',
        title: 'Descanso de tripulación',
        subtitle: 'Recupera recursos y guarda la partida. El descanso no reinicia misiones.',
        html: `
          <div class="panel-section">
            <h3>Descanso</h3>
            <div class="panel-grid">
              <div class="panel-row"><div class="grow"><strong>Oxígeno</strong><span>${Math.round(this.player.o2)}%</span></div><span class="ok">${Math.round(this.player.o2)}%</span></div>
              <div class="panel-row"><div class="grow"><strong>RCS</strong><span>${Math.round(this.player.energy)}%</span></div><span class="ok">${Math.round(this.player.energy)}%</span></div>
            </div>
            <div class="panel-grid">
              <button class="btn small" type="button" data-action="rest">Descansar y recargar</button>
              <button class="btn small ghost" type="button" data-action="save-game">Guardar partida</button>
            </div>
          </div>
        `,
      });
      return;
    }

    if (kind === 'mess') {
      this._showPanel({
        eyebrow: 'COMEDOR',
        title: 'Cocina y suministros',
        subtitle: 'Raciones calientes y agua reciclada para mantener la misión en marcha.',
        html: `
          <div class="panel-section">
            <h3>Suministros</h3>
            <div class="panel-grid">
              <div class="panel-row"><div class="grow"><strong>Ración caliente</strong><span>Recupera O2 y RCS</span></div><button class="btn small" type="button" data-action="eat">Consumir</button></div>
              <div class="panel-row"><div class="grow"><strong>Agua reciclada</strong><span>Recupera RCS</span></div><button class="btn small ghost" type="button" data-action="drink">Beber</button></div>
              <div class="panel-row"><div class="grow"><strong>Inventario de cocina</strong><span>Agua helada procesada</span></div><span class="ok">${this.resources.waterIce}</span></div>
            </div>
          </div>
        `,
      });
      return;
    }

    if (kind === 'power') {
      this._showPanel({
        eyebrow: 'GENERACIÓN ELÉCTRICA',
        title: 'Reactor y baterías',
        subtitle: 'Gestiona la potencia del hábitat y recarga los propulsores del traje.',
        html: `
          <div class="panel-section">
            <h3>Reactor</h3>
            <div class="panel-grid">
              <div class="panel-row"><div class="grow"><strong>Salida del reactor</strong><span>Potencia del hábitat</span></div><span class="${this.interior.powerLevel > 0.9 ? 'ok' : 'warn'}">${Math.round(this.interior.powerLevel * 100)}%</span></div>
              <div class="panel-row"><div class="grow"><strong>Baterías</strong><span>Reserva de emergencia</span></div><span class="ok">${Math.round(this.player.energy)}%</span></div>
            </div>
            <div class="panel-grid">
              <button class="btn small" type="button" data-action="power-on">Reactivar reactor</button>
              <button class="btn small ghost" type="button" data-action="refill-rcs">Recargar RCS</button>
            </div>
          </div>
          ${this._jobHtml()}
        `,
      });
      return;
    }

    if (kind === 'workshop') {
      this._showPanel({
        eyebrow: 'TALLER MECÁNICO',
        title: 'Fabricación y repuestos',
        subtitle: 'Convierte metales y componentes en piezas útiles para la estación y las bases.',
        html: `
          <div class="panel-section">
            <h3>Materiales</h3>
            <div class="panel-grid">
              <div class="panel-row"><div class="grow"><strong>Metales</strong><span>Aleaciones y chatarra procesada</span></div><span class="ok">${this.resources.metals}</span></div>
              <div class="panel-row"><div class="grow"><strong>Electrónica</strong><span>Circuitos y sensores</span></div><span class="ok">${this.resources.electronics}</span></div>
              <div class="panel-row"><div class="grow"><strong>Material industrial</strong><span>Estructuras y paneles</span></div><span class="ok">${this.resources.industrial}</span></div>
            </div>
          </div>
          <div class="panel-section">
            <h3>Fabricar</h3>
            <div class="panel-grid">
              <div class="panel-row"><div class="grow"><strong>Filtro de O2</strong><span>1 metal + 1 industrial</span></div><button class="btn small" type="button" data-action="craft-filter">Fabricar</button></div>
              <div class="panel-row"><div class="grow"><strong>Kit de repuesto</strong><span>2 metales + 1 electrónica</span></div><button class="btn small ghost" type="button" data-action="craft-component">Fabricar</button></div>
              <div class="panel-row"><div class="grow"><strong>Reparar casco</strong><span>+${this.balance.values.hullRepair}%</span></div><button class="btn small ghost" type="button" data-action="repair-hull" ${this.repairCooldown > 0 ? 'disabled' : ''}>Reparar</button></div>
            </div>
          </div>
          ${this._jobHtml()}
        `,
      });
      return;
    }

    if (kind === 'hangar') {
      const travelRows = Object.values(this.destinations)
        .map((item) => {
          const current = item.id === this.destination;
          const cost = item.id === 'mars' ? 16 : 10;
          const enough = this.shipFuel >= cost;
          const disabled = current || this.travel || !enough;
          return `
            <div class="panel-row">
              <div class="grow"><strong>${item.name}</strong><span>${current ? 'Destino actual' : `Coste ${cost}% de combustible`}</span></div>
              <button class="btn small ${disabled ? 'ghost' : ''}" type="button" data-action="travel" data-id="${item.id}" ${disabled ? 'disabled' : ''}>
                ${current ? 'AQUÍ' : enough ? 'VIAJAR' : 'SIN COMBUSTIBLE'}
              </button>
            </div>
          `;
        })
        .join('');

      this._showPanel({
        eyebrow: 'HANGAR · NAVE DE TRANSPORTE',
        title: 'Preparación de vuelo',
        subtitle: 'Revisa el estado del carguero, reposta combustible y prepara el embarque antes de despegar.',
        html: `
          <div class="panel-section">
            <h3>Estado de la nave</h3>
            <div class="panel-grid">
              <div class="panel-row"><div class="grow"><strong>Combustible</strong><span>Depósito principal</span></div><span class="${this.shipFuel < 25 ? 'warn' : 'ok'}">${Math.round(this.shipFuel)}%</span></div>
              <div class="panel-row"><div class="grow"><strong>Integridad del casco</strong><span>Fatiga estructural</span></div><span class="${this.shipIntegrity < 50 ? 'off' : 'ok'}">${Math.round(this.shipIntegrity)}%</span></div>
              <div class="panel-row"><div class="grow"><strong>Ubicación</strong><span>${this.ship.dockedAt === 'station' ? 'Cuna del hangar' : 'Superficie'}</span></div><span class="ok">${this.destinations[this.destination]?.short ?? '—'}</span></div>
              <div class="panel-row"><div class="grow"><strong>Carga</strong><span>Bodega de la nave</span></div><span class="ok">${Object.values(this.cargo).reduce((a, b) => a + b, 0)} uds.</span></div>
            </div>
          </div>
          <div class="panel-section">
            <h3>Mantenimiento de la nave</h3>
            <div class="panel-grid">
              <div class="panel-row"><div class="grow"><strong>Repostar combustible</strong><span>1 material industrial → depósito al 100%</span></div><button class="btn small" type="button" data-action="refuel-ship">Repostar</button></div>
              <div class="panel-row"><div class="grow"><strong>Reparar casco de la nave</strong><span>2 metales + 1 electrónica → integridad al 100%</span></div><button class="btn small ghost" type="button" data-action="repair-ship">Reparar</button></div>
            </div>
          </div>
          <div class="panel-section">
            <h3>Destinos disponibles</h3>
            <div class="panel-grid">${travelRows}</div>
          </div>
          <div class="panel-section">
            <h3>Embarque</h3>
            <div class="panel-grid">
              <button class="btn small" type="button" data-action="board-ship">Preparar embarque y subir a bordo</button>
              <button class="btn small ghost" type="button" data-action="exit-ship">Salir de la nave</button>
            </div>
          </div>
        `,
      });
      return;
    }
  }

  /**
   * Punto único de entrada de las acciones de panel. Registra el estado
   * anterior, la acción ejecutada, el estado posterior y los recursos
   * consumidos, de modo que ninguna consola sea decorativa.
   */
  handlePanelAction(action, id) {
    if (!action) return;
    const before = this._snapshotState();
    const jobBefore = this.job;
    this._runPanelAction(action, id);
    const jobStarted = this.job && this.job !== jobBefore;
    if (!jobStarted) {
      this._recordAction(action, id, before, this._snapshotState());
      this.renderPanelIfOpen();
    }
  }

  _runPanelAction(action, id) {
    if (!action) return;

    if (action === 'activate') {
      const result = this.missions.activate(id);
      if (!result.ok) {
        this.hud.toast(result.reason, 'warn', 2.4);
        return;
      }
      // Si el jugador ya llevaba el kit, el objetivo de recogida cuenta.
      if (id === 'component_swap' && this.inventory.component > 0) {
        this.missions.setProgress('component_pickup', 1);
      }
      // Los objetivos de viaje se reconocen si el destino ya se visitó.
      for (const item of result.mission.objectives) {
        if (!item.type.startsWith('travel_')) continue;
        const destination = item.type.slice('travel_'.length);
        if (this.visitedDestinations.has(destination)) this.missions.setProgress(item.type, 1);
      }
      this.audio.ui();
      this.hud.toast(`Misión activa · ${result.mission.name}`, 'good', 3);
      this.renderPanel();
      return;
    }

    if (action === 'request-maintenance') {
      const created = this.missions.generateMaintenance(1);
      this.hud.toast(
        created.length ? `Nueva ronda: ${created[0].name}` : 'No se pudo generar la ronda',
        'good',
        2.8
      );
      this.audio.ui();
      this.renderPanel();
      return;
    }

    if (action === 'build-module') {
      const planet = this.planet;
      const module = planet?.modules.get(id);
      if (!planet || !module) return;
      if (module.built) {
        this.hud.toast('El módulo ya está construido', 'warn', 2.2);
        return;
      }
      if (!this._spend(module.cost ?? {})) {
        this.hud.toast(`Faltan materiales · ${this._costLabel(module.cost)}`, 'warn', 3.4);
        return;
      }
      planet.completeModule(module.id);
      this.missions.notify('build', 1, this.destination);
      this.hud.toast(`${module.label} construido y operativo`, 'good', 3.4);
      this.audio.success();
      this.saveGame();
      this.panelOpen = 'base';
      this.panelPoint = null;
      this.renderPanel();
      return;
    }

    if (action === 'mine') {
      const point = this.panelPoint;
      const planet = this.planet;
      if (!planet || !point || point.collected) {
        this.hud.toast('El depósito está agotado', 'warn', 2.2);
        return;
      }
      const node = planet.collectNode(point.node);
      if (!node) {
        this.hud.toast('El depósito está agotado', 'warn', 2.2);
        return;
      }
      this.cargo[node.resource] = (this.cargo[node.resource] ?? 0) + node.amount;
      this.missions.notify(RESOURCE_EVENT[node.resource] ?? 'collect', node.amount, this.destination);
      this.hud.toast(
        `${node.amount} × ${RESOURCE_LABELS[node.resource] ?? node.resource} cargados en la nave`,
        'good',
        3
      );
      this.audio.success();
      this.saveGame();
      this.renderPanel();
      return;
    }

    if (action === 'geology') {
      if (this.marsSystems.geology) return;
      this.marsSystems.geology = true;
      this.missions.notify('geology', 1, 'mars');
      this.hud.toast('Análisis geológico registrado · estratigrafía de Ares', 'good', 3.2);
      this.audio.success();
      this.saveGame();
      this.renderPanel();
      return;
    }

    if (action === 'repair-equipment') {
      if (this.marsSystems.equipment) return;
      this.marsSystems.equipment = true;
      this.player.repairHull(15);
      this.missions.notify('repair_equipment', 1, 'mars');
      this.hud.toast('Equipo marciano reparado · rover y sistemas operativos', 'good', 3.2);
      this.audio.success();
      this.saveGame();
      this.renderPanel();
      return;
    }

    if (action === 'antenna-install') {
      if (this.marsSystems.antenna) return;
      this.marsSystems.antenna = true;
      this.missions.notify('antenna_install', 1, 'mars');
      this.hud.toast('Antena de Ares calibrada · enlace con la estación establecido', 'good', 3.4);
      this.audio.success();
      this.saveGame();
      this.renderPanel();
      return;
    }

    if (action === 'explore-cave') {
      const planet = this.planet;
      if (!planet) return;
      planet.caveExplored = true;
      this.missions.notify('cave', 1, this.destination);
      this.hud.toast('Cueva cartografiada · hielo subsuperficial registrado', 'good', 3.2);
      this.audio.success();
      this.saveGame();
      this.renderPanel();
      return;
    }

    if (action === 'enter-rover') {
      this._enterRover();
      return;
    }

    if (action === 'exit-ship') {
      this._exitShip();
      return;
    }

    if (action === 'travel') {
      this.travelTo(id);
      return;
    }

    if (action === 'unload-cargo') {
      let total = 0;
      for (const key of Object.keys(this.cargo)) {
        total += this.cargo[key];
        this.resources[key] += this.cargo[key];
        this.cargo[key] = 0;
      }
      if (total === 0) {
        this.hud.toast('La bodega ya está vacía', 'warn', 2.2);
      } else {
        this.hud.toast(`Carga descargada en ${this.destinations[this.destination].short} · ${total} uds.`, 'good', 3);
        this.audio.success();
        this.saveGame(true);
      }
      this.renderPanel();
      return;
    }

    if (action === 'nav') {
      const poi = NAV_POIS.find((item) => item.id === id);
      if (!poi) return;
      this.navTarget = poi;
      if (this.missions.activeId === 'navigation_survey' && !this.visitedPois.has(id)) {
        this.visitedPois.add(id);
        this.missions.notify('poi', 1);
      }
      this.hud.toast(`Destino marcado · ${poi.name}`, 'good', 2.4);
      this.audio.ui();
      this.renderPanel();
      return;
    }

    if (action === 'comms') {
      this.commsSent = true;
      this.hud.toast('Informe transmitido a Tierra · enlace estable', 'good', 3);
      this.audio.ping();
      this.renderPanel();
      return;
    }

    if (action === 'circuit') {
      const index = Number(id);
      if (this.engineering.circuits[index]) return;
      this.startJob({
        id: `circuit-${index}`,
        label: `Restableciendo circuito ${index + 1}`,
        duration: 2.6,
        source: 'engineering',
        onComplete: () => {
          this.engineering.circuits[index] = true;
          const count = this.engineering.circuits.filter(Boolean).length;
          this.interior.setPower(0.72 + (count / 3) * 0.28);
          this.missions.notify('circuit', 1, 'station');
          this.hud.toast(`Circuito ${index + 1} restablecido`, 'good', 2.6);
        },
      });
      return;
    }

    if (action === 'sample') {
      const index = Number(id);
      if (this.lab.samples[index]) return;
      this.startJob({
        id: `sample-${index}`,
        label: `Analizando muestra ${index + 1}`,
        duration: 2.2,
        source: 'lab',
        onComplete: () => {
          this.lab.samples[index] = true;
          this.scienceData += 1;
          this.missions.notify('sample', 1, 'station');
          this.hud.toast(`Muestra ${index + 1} analizada`, 'good', 2.6);
        },
      });
      return;
    }

    if (action === 'calibrate') {
      this.startJob({
        id: 'calibrate',
        label: 'Calibrando espectrómetro',
        duration: 2.0,
        source: 'lab',
        onComplete: () => {
          this.lab.calibrated = true;
          this.hud.toast('Espectrómetro calibrado', 'good', 2.6);
        },
      });
      return;
    }

    if (action === 'filter') {
      const index = Number(id);
      if (this.lifeSupport.filters[index]) return;
      if (this.inventory.filter <= 0) {
        this.hud.toast('No quedan filtros · recógelos en el almacén', 'warn', 3);
        return;
      }
      this.startJob({
        id: `filter-${index}`,
        label: `Sustituyendo filtro ${index + 1}`,
        duration: 2.4,
        source: 'life_support',
        onComplete: () => {
          this.inventory.filter -= 1;
          this.lifeSupport.filters[index] = true;
          const count = this.lifeSupport.filters.filter(Boolean).length;
          this.player.o2RegenScale = 1 + count * 0.25;
          this.missions.notify('filter', 1, 'station');
          this.hud.toast(`Filtro ${index + 1} sustituido`, 'good', 2.6);
        },
      });
      return;
    }

    if (action === 'equip-suit') {
      this.suit.equipped = true;
      this.hud.toast('Traje EVA equipado · esclusa habilitada', 'good', 3);
      this.audio.ui();
      this.renderPanel();
      return;
    }

    if (action === 'unequip-suit') {
      if (!this.player.safe) {
        this.hud.toast('NO PUEDES QUITARTE EL TRAJE EN EL EXTERIOR.', 'bad', 3.2);
        return;
      }
      this.suit.equipped = false;
      this.hud.toast('Traje guardado en el armario', 'good', 2.6);
      this.audio.ui();
      this.renderPanel();
      return;
    }

    if (action === 'repair-suit') {
      this.suit.helmet = 100;
      this.player.repairHull(100);
      this.hud.toast('Casco reparado al 100%', 'good', 2.6);
      this.audio.success();
      this.renderPanel();
      return;
    }

    if (action === 'medkit') {
      this.player.repairHull(100);
      this.player.o2 = Math.min(100, this.player.o2 + 20);
      this.suit.helmet = Math.min(100, this.suit.helmet + 40);
      this.hud.toast('Estabilizado · casco y constantes recuperados', 'good', 3);
      this.audio.success();
      this.renderPanel();
      return;
    }

    if (action === 'rest') {
      this.player.o2 = 100;
      this.player.energy = 100;
      this.player.repairHull(10);
      this.hud.toast('Descanso completado · recursos al 100%', 'good', 3);
      this.saveGame?.();
      this.renderPanel();
      return;
    }

    if (action === 'eat') {
      this.player.o2 = Math.min(100, this.player.o2 + 18);
      this.player.energy = Math.min(100, this.player.energy + 12);
      this.hud.toast('Ración consumida · O2 y RCS recuperados', 'good', 2.6);
      this.renderPanel();
      return;
    }

    if (action === 'drink') {
      this.player.energy = Math.min(100, this.player.energy + 20);
      this.hud.toast('Agua reciclada consumida · RCS recuperado', 'good', 2.6);
      this.renderPanel();
      return;
    }

    if (action === 'power-on') {
      this.interior.setPower(1);
      this.engineering.circuits = [true, true, true];
      this.hud.toast('Reactor a plena potencia · hábitat estabilizado', 'good', 3);
      this.audio.success();
      this.renderPanel();
      return;
    }

    if (action === 'craft-filter') {
      if (!this._spend({ metals: 1, industrial: 1 })) {
        this.hud.toast('Faltan materiales · 1 metal + 1 industrial', 'warn', 3);
        return;
      }
      this.inventory.filter += 1;
      this.hud.toast('Filtro de O2 fabricado', 'good', 2.6);
      this.renderPanel();
      return;
    }

    if (action === 'craft-component') {
      if (!this._spend({ metals: 2, electronics: 1 })) {
        this.hud.toast('Faltan materiales · 2 metales + 1 electrónica', 'warn', 3);
        return;
      }
      this.inventory.component += 1;
      this.hud.toast('Kit de repuesto fabricado', 'good', 2.6);
      this.renderPanel();
      return;
    }

    if (action === 'refuel-ship') {
      if (this.shipFuel >= 99.5) {
        this.hud.toast('El depósito ya está lleno', 'warn', 2.2);
        return;
      }
      if (!this._spend({ industrial: 1 })) {
        this.hud.toast('Falta 1 material industrial para repostar', 'warn', 3.2);
        return;
      }
      this.shipFuel = 100;
      this.hud.toast('Depósito de la nave repostado al 100%', 'good', 2.8);
      this.audio.success();
      this.saveGame(true);
      this.renderPanel();
      return;
    }

    if (action === 'repair-ship') {
      if (this.shipIntegrity >= 99.5) {
        this.hud.toast('El casco de la nave ya está intacto', 'warn', 2.2);
        return;
      }
      if (!this._spend({ metals: 2, electronics: 1 })) {
        this.hud.toast('Faltan materiales · 2 metales + 1 electrónica', 'warn', 3.2);
        return;
      }
      this.shipIntegrity = 100;
      this.hud.toast('Casco de la nave reparado al 100%', 'good', 2.8);
      this.audio.success();
      this.saveGame(true);
      this.renderPanel();
      return;
    }

    if (action === 'board-ship') {
      this._boardShip();
      return;
    }

    if (action === 'maintenance') {
      this._runMaintenance(id);
      return;
    }

    if (action === 'save-game') {
      this.saveGame();
      return;
    }

    if (action === 'repair-hull') {
      if (this.repairCooldown > 0) return;
      this.player.repairHull(this.balance.values.hullRepair);
      this.repairCooldown = this.balance.values.hullRepairCooldown;
      this.hud.toast(`Casco reparado · ${Math.round(this.player.hull)}%`, 'good', 2.4);
      this.audio.success();
      this.renderPanel();
      return;
    }

    if (action === 'diagnose') {
      this.hud.toast(
        `Diagnóstico · O2 ${Math.round(this.player.o2)}% · RCS ${Math.round(this.player.energy)}% · Casco ${Math.round(this.player.hull)}%`,
        'good',
        4
      );
      this.audio.ping();
      return;
    }

    if (action === 'take-component') {
      this.inventory.component += 1;
      if (this.missions.activeId === 'component_swap') this.missions.notify('component_pickup', 1);
      this.hud.toast('Kit de repuesto recogido', 'good', 2.2);
      this.renderPanel();
      return;
    }

    if (action === 'take-filter') {
      this.inventory.filter += 1;
      this.hud.toast('Filtro de O2 recogido', 'good', 2.2);
      this.renderPanel();
      return;
    }

    if (action === 'take-sample') {
      this.inventory.sample += 1;
      this.hud.toast('Muestra recogida', 'good', 2.2);
      this.renderPanel();
      return;
    }

    if (action === 'refill-o2') {
      this.player.o2 = 100;
      this.hud.toast('Oxígeno al 100%', 'good', 2.2);
      this.renderPanel();
      return;
    }

    if (action === 'refill-rcs') {
      this.player.energy = 100;
      this.hud.toast('RCS al 100%', 'good', 2.2);
      this.renderPanel();
    }
  }

  _spend(cost) {
    for (const [key, value] of Object.entries(cost)) {
      if ((this.resources[key] ?? 0) < value) return false;
    }
    for (const [key, value] of Object.entries(cost)) {
      this.resources[key] -= value;
    }
    return true;
  }

  /* --------------------------------------------------- registro de acciones */

  _snapshotState() {
    return {
      o2: Math.round(this.player.o2),
      rcs: Math.round(this.player.energy),
      hull: Math.round(this.player.hull),
      helmet: Math.round(this.suit.helmet),
      suit: this.suit.equipped,
      component: this.inventory.component,
      filter: this.inventory.filter,
      sample: this.inventory.sample,
      circuits: this.engineering.circuits.filter(Boolean).length,
      filters: this.lifeSupport.filters.filter(Boolean).length,
      samples: this.lab.samples.filter(Boolean).length,
      calibrated: this.lab.calibrated,
      science: this.scienceData,
      power: Math.round(this.interior.powerLevel * 100),
      shipFuel: Math.round(this.shipFuel),
      shipHull: Math.round(this.shipIntegrity),
      inspections: this.moduleInspections,
      destination: this.destination,
      cargo: Object.values(this.cargo).reduce((a, b) => a + b, 0),
      comms: this.commsSent,
      nav: this.navTarget?.id ?? null,
      mission: this.missions.activeId ?? null,
      resources: { ...this.resources },
    };
  }

  _diffState(before, after) {
    const changes = [];
    const add = (label, b, a, unit = '') => {
      if (b === a) return;
      const delta = typeof a === 'number' && typeof b === 'number' ? a - b : null;
      changes.push({ label, before: `${b}${unit}`, after: `${a}${unit}`, delta });
    };

    add('Oxígeno', before.o2, after.o2, '%');
    add('RCS', before.rcs, after.rcs, '%');
    add('Casco', before.hull, after.hull, '%');
    add('Casco del traje', before.helmet, after.helmet, '%');
    add('Potencia del hábitat', before.power, after.power, '%');
    add('Combustible de la nave', before.shipFuel, after.shipFuel, '%');
    add('Integridad de la nave', before.shipHull, after.shipHull, '%');
    add('Inspecciones de módulo', before.inspections, after.inspections, '');
    add('Circuitos', before.circuits, after.circuits, '/3');
    add('Filtros instalados', before.filters, after.filters, '/3');
    add('Muestras analizadas', before.samples, after.samples, '/3');
    add('Datos científicos', before.science, after.science, '');
    add('Kits de repuesto', before.component, after.component, '');
    add('Filtros en inventario', before.filter, after.filter, '');
    add('Muestras en inventario', before.sample, after.sample, '');
    add('Carga de la nave', before.cargo, after.cargo, ' uds.');
    if (before.suit !== after.suit) {
      changes.push({
        label: 'Traje EVA',
        before: before.suit ? 'EQUIPADO' : 'GUARDADO',
        after: after.suit ? 'EQUIPADO' : 'GUARDADO',
        delta: null,
      });
    }
    if (before.calibrated !== after.calibrated) {
      changes.push({
        label: 'Espectrómetro',
        before: before.calibrated ? 'CALIBRADO' : 'SIN CALIBRAR',
        after: after.calibrated ? 'CALIBRADO' : 'SIN CALIBRAR',
        delta: null,
      });
    }
    if (before.destination !== after.destination) {
      changes.push({
        label: 'Destino',
        before: before.destination,
        after: after.destination,
        delta: null,
      });
    }
    if (before.comms !== after.comms) {
      changes.push({
        label: 'Enlace con Tierra',
        before: before.comms ? 'TRANSMITIDO' : 'PENDIENTE',
        after: after.comms ? 'TRANSMITIDO' : 'PENDIENTE',
        delta: null,
      });
    }
    if (before.nav !== after.nav) {
      changes.push({ label: 'Destino marcado', before: before.nav ?? '—', after: after.nav ?? '—', delta: null });
    }
    if (before.mission !== after.mission) {
      changes.push({ label: 'Misión activa', before: before.mission ?? '—', after: after.mission ?? '—', delta: null });
    }

    const keys = new Set([
      ...Object.keys(before.resources ?? {}),
      ...Object.keys(after.resources ?? {}),
    ]);
    for (const key of keys) {
      add(
        RESOURCE_LABELS[key] ?? key,
        before.resources?.[key] ?? 0,
        after.resources?.[key] ?? 0,
        ''
      );
    }
    return changes;
  }

  _recordAction(action, id, before, after, result = '') {
    const changes = this._diffState(before, after);
    const consumed = changes
      .filter((item) => item.delta !== null && item.delta < 0)
      .map((item) => `${item.label} ${item.before}→${item.after}`);
    const gained = changes
      .filter((item) => item.delta !== null && item.delta > 0)
      .map((item) => `${item.label} ${item.before}→${item.after}`);

    const entry = {
      action: ACTION_LABELS[action] ?? action,
      id: id ?? '',
      at: Date.now(),
      changes,
      consumed,
      gained,
      result:
        result ||
        (changes.length ? 'Estado de la estación actualizado' : 'Sin cambios en el estado'),
    };

    this.actionLog.unshift(entry);
    if (this.actionLog.length > 6) this.actionLog.pop();
    this.lastActionResult = entry;
    return entry;
  }

  _actionLogHtml() {
    const entry = this.actionLog[0];
    if (!entry) {
      return `
        <div class="panel-section action-log">
          <h3>Registro de acciones</h3>
          <p class="panel-sub">Cada acción mostrará aquí el estado anterior, la acción ejecutada, el estado posterior y los recursos consumidos.</p>
        </div>
      `;
    }

    const rows = entry.changes.length
      ? entry.changes
          .map(
            (item) =>
              `<div class="action-change"><span>${item.label}</span><b>${item.before}</b><i>→</i><b>${item.after}</b></div>`
          )
          .join('')
      : '<p class="panel-sub">La acción no modificó valores numéricos.</p>';

    return `
      <div class="panel-section action-log">
        <h3>Registro de acciones</h3>
        <div class="action-head">
          <strong>${entry.action}${entry.id ? ` · ${entry.id}` : ''}</strong>
          <span class="ok">EJECUTADA</span>
        </div>
        <div class="action-grid">${rows}</div>
        <div class="action-meta">
          <span><b>Consumido:</b> ${entry.consumed.length ? entry.consumed.join(' · ') : 'nada'}</span>
          <span><b>Resultado:</b> ${entry.result}</span>
        </div>
      </div>
    `;
  }

  /** Envuelve showPanel para adjuntar siempre el registro de la última acción. */
  _showPanel(options) {
    this.hud['showPanel']({ ...options, footer: this._actionLogHtml() });
  }

  startJob({ id, label, duration, source, onComplete, action }) {
    if (this.job) {
      this.hud.toast('Ya hay una tarea en curso', 'warn', 2);
      return;
    }
    const before = this._snapshotState();
    this.job = {
      id,
      label,
      duration,
      source,
      elapsed: 0,
      onComplete: () => {
        onComplete?.();
        this._recordAction(action ?? id.split('-')[0], id, before, this._snapshotState(), label);
      },
    };
    this.hud.toast(label, 'good', 2.4);
    this.player.setAction(id.startsWith('maint-') ? 'repair' : 'interact', 1.0);
    this.renderPanel();
  }

  updateJobs(dt) {
    if (!this.job) return;

    const point = this.interiorSystems.points.find((item) => item.id === this.job.source);
    if (point && point.group.position.distanceTo(this.player.group.position) > 3.8) {
      this.hud.toast('Tarea cancelada · vuelve a la consola', 'warn', 2.6);
      this.job = null;
      this.renderPanelIfOpen();
      return;
    }

    this.job.elapsed += dt;
    const ratio = Math.min(1, this.job.elapsed / this.job.duration);
    this.hud.setJobProgress(ratio, this.job.label);

    if (ratio >= 1) {
      const job = this.job;
      this.job = null;
      job.onComplete?.();
      this.audio.success();
      this.renderPanelIfOpen();
    }
  }

  /* -------------------------------------------------------------- audio/HUD */

  updateAudio() {
    this.audio.setThruster(
      this.player.thrusting ? (this.controls.boost ? 1 : 0.6) : 0
    );
    this.audio.setWelder(this.repairing);

    const ratio = this.player.o2 / 100;
    this.audio.setBreathing(0.9 + (1 - ratio) * 1.3);
  }

  updateHUD() {
    const station = this.destination === 'station';
    const inShip = this.ship.contains(this.player.group.position);

    this.integrity = this.player.hull;
    this.hud.setStats(this.player.o2, this.player.energy, this.player.hull, this.player.co2, this.player.filterLife);
    this.hud.setClock(this.time);
    this.hud.setMission(this.missions.active);
    if (this.guided && this.missions.active) {
      this.guided = false;
      this.hud.setGuide(null);
    }
    this.hud.setDestination(this.destinations[this.destination]?.name ?? '');
    this.hud.setTether(
      station
        ? this.tether.status
        : { active: false, distance: 0, max: this.tether.max, tension: 0 }
    );

    if (station) {
      this.hud.setPressure(this.interior.getAirlockStatus());
    } else if (inShip) {
      this.hud.setPressure({ label: 'NAVE PRESURIZADA', pressurized: true });
    } else {
      this.hud.setPressure({ label: 'SUPERFICIE · TRAJE EVA', pressurized: false });
    }

    this.hud.setSuit({
      equipped: this.suit.equipped,
      helmet: this.suit.helmet,
      zone: this.player.safe ? 'inside' : 'outside',
      damaged: this.player.hull < 40,
    });

    if (station && this.navTarget) {
      this.hud.setNavigation({
        name: this.navTarget.name,
        distance: this.navTarget.position.distanceTo(this.player.group.position),
      });
    } else {
      this.hud.setNavigation(null);
    }

    const warnings = [];
    if (this.player.o2 < 25) warnings.push('OXÍGENO BAJO');
    if (this.player.hull < 35) warnings.push('CASCO DAÑADO · REPARA EN INGENIERÍA');
    if (this.player.energy < 15) warnings.push('RCS BAJO');
    if (station && this.tether.tension > 0.8) warnings.push('CABLE AL LÍMITE');
    if (!this.suit.equipped && !this.player.safe) warnings.push('SIN TRAJE ESPACIAL');
    if (
      station &&
      !this.interior.getAirlockStatus().pressurized &&
      this.interior._inAirlock(this.player.group.position)
    ) {
      warnings.push('ESCLUSA DESPRESURIZADA');
    }
    this.hud.setWarnings(warnings);

    this.hud.updateMarkers(
      station ? this.station.active : [],
      this.camera,
      this.player.group.position,
      this.time < this.revealUntil
    );
  }

  /* --------------------------------------------------------------- guardado */

  /** Autoguardado periódico mientras se juega. */
  autosave(dt) {
    this.autosaveTimer += dt;
    if (this.autosaveTimer < 25) return;
    this.autosaveTimer = 0;
    this.saveGame(true);
  }

  /** Instantánea completa y reconstruible del universo. */
  serializeState() {
    const position = this.player.body.position;
    const rover = this.planet?.rover ?? null;

    return {
      destination: this.destination,
      shipLocation: this.shipLocation,
      visitedDestinations: [...this.visitedDestinations],
      visitedPois: [...this.visitedPois],
      time: this.time,
      scienceData: this.scienceData,
      commsSent: this.commsSent,
      shipFuel: this.shipFuel,
      shipIntegrity: this.shipIntegrity,
      moduleInspections: this.moduleInspections,
      player: {
        position: { x: position.x, y: position.y, z: position.z },
        o2: this.player.o2,
        energy: this.player.energy,
        hull: this.player.hull,
      },
      suit: { ...this.suit },
      inventory: { ...this.inventory },
      engineering: { circuits: [...this.engineering.circuits] },
      lifeSupport: { filters: [...this.lifeSupport.filters] },
      lab: { samples: [...this.lab.samples], calibrated: this.lab.calibrated },
      resources: { ...this.resources },
      cargo: { ...this.cargo },
      marsSystems: { ...this.marsSystems },
      station: this.station.serialize(),
      missions: this.missions.serialize(),
      maintenance: this.maintenance.serialize(),
      moon: this.moon.serialize(),
      mars: this.mars.serialize(),
      vehicle: this.vehicle ? this.vehicle.type : null,
      rover: rover ? { x: rover.position.x, z: rover.position.z } : null,
      design: this.designState,
      academy: this.academy.serialize(),
      guided: this.guided,
    };
  }

  /** Guarda la partida (silencioso para autoguardados). */
  saveGame(silent = false) {
    if (this.multiplayerActive) {
      // El progreso de una sesión en línea no debe sobrescribir el perfil individual.
      if (!silent) {
        this.hud.toast('El progreso multijugador no se guarda en el perfil individual', 'warn', 3.2);
      }
      return false;
    }
    if (this.state === 'menu' || this.state === 'entry') return false;
    const ok = writeSave(this.serializeState());
    if (ok && !silent) this.hud.toast('Partida guardada', 'good', 2);
    if (ok) {
      this._syncMenuStatus();
      this._refreshContinueButton();
    }
    return ok;
  }

  /** Restaura una instantánea sobre un mundo recién reiniciado. */
  restoreState(data) {
    if (!data) return;

    this.time = Number(data.time) || 0;
    this.scienceData = Number(data.scienceData) || 0;
    this.commsSent = !!data.commsSent;
    this.shipFuel = Number(data.shipFuel ?? 100);
    this.shipIntegrity = Number(data.shipIntegrity ?? 100);
    this.moduleInspections = Number(data.moduleInspections ?? 0);

    this.suit = {
      equipped: data.suit?.equipped !== false,
      helmet: Number(data.suit?.helmet ?? 100),
    };

    this.inventory = { ...this.inventory, ...(data.inventory ?? {}) };
    this.engineering = {
      circuits: Array.isArray(data.engineering?.circuits)
        ? [...data.engineering.circuits]
        : [false, false, false],
    };
    this.lifeSupport = {
      filters: Array.isArray(data.lifeSupport?.filters)
        ? [...data.lifeSupport.filters]
        : [false, false],
    };
    this.lab = {
      samples: Array.isArray(data.lab?.samples) ? [...data.lab.samples] : [false, false, false],
      calibrated: !!data.lab?.calibrated,
    };
    this.resources = { ...this.resources, ...(data.resources ?? {}) };
    this.cargo = { ...this.cargo, ...(data.cargo ?? {}) };
    this.marsSystems = { ...this.marsSystems, ...(data.marsSystems ?? {}) };

    const filterCount = this.lifeSupport.filters.filter(Boolean).length;
    this.player.o2RegenScale = 1 + filterCount * 0.25;

    this.missions.restore(data.missions);
    this.maintenance.restore(data.maintenance);
    this.station.restore(data.station);
    this.moon.restore(data.moon);
    this.mars.restore(data.mars);

    this.visitedDestinations = new Set(data.visitedDestinations ?? ['station']);
    this.visitedPois = new Set(data.visitedPois ?? []);

    this._restoreDesignState(data.design);
    if (data.academy) this.academy.restore(data.academy);
    this.guided = !!data.guided;
    if (this.guided && !this.missions.active) {
      this.hud.setGuide(
        '<b>Guía:</b> 1. Recorre la estación · 2. Abre una consola con <kbd>E</kbd> · 3. Acepta una misión. <kbd>H</kbd> abre la ayuda de la zona.'
      );
    } else {
      this.hud.setGuide(null);
    }

    const destination = this.destinations[data.destination] ? data.destination : 'station';
    this._applyDestination(destination, { spawn: false, announce: false });

    const stats = data.player ?? {};
    this.player.o2 = Number(stats.o2 ?? 100);
    this.player.energy = Number(stats.energy ?? 100);
    this.player.hull = Number(stats.hull ?? 100);

    let position = stats.position ?? null;
    if (data.vehicle === 'rover' && this.planet?.rover) {
      const rover = this.planet.rover;
      const x = rover.position.x + 2.2;
      const z = rover.position.z;
      position = {
        x,
        y: this.planet.groundHeightAt(x, z) + this.player.halfHeight + 0.1,
        z,
      };
    }

    if (position) {
      this.player.body.position.set(position.x, position.y, position.z);
      this.player.body.velocity.setZero();
      this.player.body.angularVelocity.setZero();
      this.player.group.position.set(position.x, position.y, position.z);
    }

    this.lastPlayerMode = null;
    this._refreshZone(false);
    this.player.sync(0.016, this.camera);
    this.cameraRig.snap(this.player.group.position);
    this.toolRig.set(this.toolIndex);
    this.hud.setTool(this.toolIndex);
    this.updateHUD();
  }

  /** Carga la partida guardada; si no existe, empieza una nueva. */
  continueGame() {
    const save = readSave();
    if (!save) {
      this.start();
      return;
    }

    this.audio.init();
    this.reset();
    this.restoreState(save.data);

    this.state = 'playing';
    this.hud.screen(null);
    this.hud.show();
    this.hud.hideMissionComplete();
    this.ignoreUnlock = true;
    this.controls.requestLock();
    this.clock.getDelta();
    this.hud.toast('Partida recuperada', 'good', 2.6);
  }

  /* ------------------------------------------------------- entrada y menú */

  enterMenu() {
    if (this.state !== 'entry') return;
    this.audio.init();
    this.audio.ui();
    this.state = 'menu';
    this.hud.screen('menu');
    this._syncMenuStatus();
    this._refreshContinueButton();
  }

  _refreshContinueButton() {
    const button = this.root.querySelector('#btn-menu-continue');
    button?.classList.toggle('hidden', !hasSave());
  }

  _syncMenuStatus() {
    const element = this.root.querySelector('#menu-status');
    if (!element) return;
    const save = readSave();
    if (!save) {
      element.textContent = 'Estación orbital EVA-07 · Sin progreso guardado';
      return;
    }
    const when = new Date(save.savedAt);
    element.textContent = `Estación orbital EVA-07 · Progreso guardado el ${when.toLocaleString(
      'es-ES'
    )}`;
  }

  _syncSensitivityUI() {
    const input = this.root.querySelector('#sensitivity');
    const label = this.root.querySelector('#sensitivity-value');
    if (!input) return;
    const value = Number(this.controls?.sensitivity ?? 0.0024);
    input.value = String(value);
    if (label) label.textContent = value.toFixed(4);
  }

  openSettings(returnTo = 'menu') {
    this.settingsReturn = returnTo;
    this.settingsOpen = true;
    this.hud.screen('settings');
    this._syncSensitivityUI();
    this.audio.ui();
  }

  closeSettings() {
    if (!this.settingsOpen) return;
    this.settingsOpen = false;
    if (this.settingsReturn === 'pause') {
      this.state = 'paused';
      this.hud.screen('pause');
    } else {
      this.state = 'menu';
      this.hud.screen('menu');
      this._syncMenuStatus();
    }
    this.audio.ui();
  }

  /* ------------------------------------------------------------- overlays */

  _overlayList() {
    return [this.manual, this.academyUI, this.dataCenter, this.designUI, this.objectives].filter(
      Boolean
    );
  }

  _anyOverlayOpen() {
    return this._overlayList().some((ui) => ui.isOpen);
  }

  _closeOverlaysSilent() {
    for (const ui of this._overlayList()) {
      if (!ui.isOpen) continue;
      ui.onClose = null;
      ui.close();
    }
  }

  closeOverlays() {
    let closed = false;
    for (const ui of this._overlayList()) {
      if (!ui.isOpen) continue;
      ui.onClose = null;
      ui.close();
      closed = true;
    }
    if (closed) this._closeOverlay();
  }

  _prepareOverlay() {
    this._closeOverlaysSilent();
    if (this.state === 'playing') {
      this.overlayFrom = 'playing';
      this.state = 'overlay';
      this.audio.silenceLoops();
      this.ignoreUnlock = true;
      if (document.pointerLockElement) document.exitPointerLock();
    } else if (this.state !== 'overlay') {
      this.overlayFrom = this.state;
    }
    this.needsRender = true;
  }

  _closeOverlay() {
    const from = this.overlayFrom ?? 'menu';
    this.overlayFrom = null;
    this.needsRender = true;

    if (from === 'playing') {
      this.state = 'playing';
      this.ignoreUnlock = true;
      this.controls.requestLock();
      this.clock.getDelta();
      return;
    }
    if (from === 'paused') {
      this.state = 'paused';
      this.hud.screen('pause');
      return;
    }
    this.state = from === 'entry' ? 'entry' : 'menu';
    this.hud.screen(this.state);
    if (this.state === 'menu') {
      this._syncMenuStatus();
      this._refreshContinueButton();
    }
  }

  _currentZone() {
    if (this.destination === 'moon' || this.destination === 'mars') return this.destination;
    const module = this.interior.getModuleAt(this.player.group.position);
    return zoneFor(module?.id ?? null, this.destination);
  }

  openManual({ from = null, contextual = false } = {}) {
    void from;
    this._prepareOverlay();
    const zone = contextual ? this._currentZone() : null;
    const section = contextual ? 'zona' : 'primeros-pasos';
    this.manual.open({
      section,
      zone,
      onClose: () => this._closeOverlay(),
    });
    this.audio.ui();
  }

  openAcademy({ lessonId = null } = {}) {
    this._prepareOverlay();
    this.academyUI.open({
      lessonId,
      onClose: () => this._closeOverlay(),
    });
    this.audio.ui();
  }

  openDataCenter({ tab = 'data' } = {}) {
    this._prepareOverlay();
    this.dataCenter.open({
      tab,
      onClose: () => this._closeOverlay(),
    });
    this.audio.ui();
  }

  openDesign({ phase = null } = {}) {
    this._prepareOverlay();
    this.designUI.state = this.designState;
    this.designUI.open({
      phase,
      onClose: () => this._closeOverlay(),
    });
    this.audio.ui();
  }

  _ensureObjectives() {
    if (this.objectives) return;
    const el = document.createElement('div');
    el.id = 'overlay-objectives';
    el.className = 'overlay hidden';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Objetivos de la misión');
    el.innerHTML = `
      <div class="overlay-card objectives-card">
        <header class="overlay-head">
          <div>
            <p class="eyebrow">Objetivos</p>
            <h2 class="title small">Misión activa y progreso</h2>
          </div>
          <button class="btn ghost small objectives-close" type="button">Cerrar · ESC</button>
        </header>
        <div class="objectives-body"></div>
      </div>
    `;
    this.root.appendChild(el);
    el.querySelector('.objectives-close').addEventListener('click', () => this.objectives.close());
    el.addEventListener('click', (event) => {
      if (event.target === el) this.objectives.close();
    });

    this.objectives = {
      el,
      onClose: null,
      get isOpen() {
        return !el.classList.contains('hidden');
      },
      open() {
        el.classList.remove('hidden');
        el.setAttribute('aria-hidden', 'false');
        el.querySelector('.objectives-close')?.focus();
      },
      close() {
        if (el.classList.contains('hidden')) return;
        el.classList.add('hidden');
        el.setAttribute('aria-hidden', 'true');
        const callback = this.onClose;
        this.onClose = null;
        callback?.();
      },
    };
  }

  openObjectives() {
    this._prepareOverlay();
    this._ensureObjectives();
    this._renderObjectives();
    this.objectives.onClose = () => this._closeOverlay();
    this.objectives.open();
    this.audio.ui();
  }

  _renderObjectives() {
    if (!this.objectives) return;
    const body = this.objectives.el.querySelector('.objectives-body');
    const mission = this.missions.active;
    if (!mission) {
      body.innerHTML = `
        <p class="data-intro">No hay una misión activa. La partida nueva no activa misiones automáticamente.</p>
        <ol class="objectives-steps">
          <li>Recorre la estación con <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>.</li>
          <li>Acércate a una consola y pulsa <kbd>E</kbd>.</li>
          <li>Elige <strong>Aceptar misión</strong> en el panel.</li>
        </ol>
        <p class="manual-note">También puedes abrir el manual con <kbd>H</kbd> para ver la información de la zona.</p>
      `;
      return;
    }

    const objectives = mission.objectives
      .map(
        (item) => `<li class="${item.progress >= item.target ? 'done' : ''}">
          <span>${item.label}</span>
          <b>${Math.min(item.progress, item.target)} / ${item.target}</b>
        </li>`
      )
      .join('');

    body.innerHTML = `
      <p class="eyebrow">${MISSION_CATEGORIES[mission.category] ?? mission.category ?? 'Misión'}</p>
      <h3>${mission.name}</h3>
      <p>${mission.description ?? ''}</p>
      <ul class="objectives-list">${objectives}</ul>
      <p class="manual-note">Estado: ${this.missions.stateLabel(mission)} · Ubicación: ${
        mission.location ?? 'station'
      }.</p>
      <p class="manual-note">Recompensa: O2 +${mission.reward?.o2 ?? 0} · RCS +${
        mission.reward?.rcs ?? 0
      } · Casco +${mission.reward?.hull ?? 0}.</p>
    `;
  }

  /* ------------------------------------------------------- mesa de diseño */

  _readDesignState() {
    const base = newDesignState();
    try {
      const raw = localStorage.getItem(DESIGN_STORAGE_KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return base;
      return {
        ...base,
        ...parsed,
        requirements: { ...base.requirements, ...(parsed.requirements ?? {}) },
        instrumentIds: Array.isArray(parsed.instrumentIds) ? parsed.instrumentIds : [],
        compared: Array.isArray(parsed.compared) ? parsed.compared : [],
      };
    } catch {
      return base;
    }
  }

  _saveDesignState(state) {
    this.designState = state;
    try {
      localStorage.setItem(DESIGN_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Sin persistencia la mesa sigue funcionando en memoria.
    }
  }

  _restoreDesignState(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;
    const base = newDesignState();
    this._saveDesignState({
      ...base,
      ...snapshot,
      requirements: { ...base.requirements, ...(snapshot.requirements ?? {}) },
      instrumentIds: Array.isArray(snapshot.instrumentIds) ? snapshot.instrumentIds : [],
      compared: Array.isArray(snapshot.compared) ? snapshot.compared : [],
    });
    if (this.designUI) this.designUI.state = this.designState;
  }

  /**
   * Implementa un diseño verificado: consume recursos reales del simulador y
   * añade una misión al MissionManager existente.
   */
  _implementDesign(state) {
    const fromMenu = this.state === 'menu' || this.state === 'entry';
    if (fromMenu) {
      this.startNewGame({ keepOverlays: true, requestLock: false });
      this.overlayFrom = 'playing';
      // Mantener la mesa abierta sin dejar al jugador en movimiento detrás.
      this.state = 'overlay';
    }

    if (!['playing', 'paused', 'overlay'].includes(this.state)) {
      return { ok: false, message: 'No hay una partida activa para implementar la misión.' };
    }

    const cost = implementationCost(state);
    const missing = [];
    if (this.shipFuel < cost.fuel) missing.push(`combustible (${cost.fuel}%)`);
    if (this.resources.industrial < cost.industrial) missing.push(`industrial (${cost.industrial})`);
    if (this.resources.electronics < cost.electronics)
      missing.push(`electrónica (${cost.electronics})`);
    if (this.resources.metals < cost.metals) missing.push(`metales (${cost.metals})`);
    if (missing.length) {
      return {
        ok: false,
        message: `Faltan recursos: ${missing.join(', ')}. Reposta o recoge materiales y vuelve a intentarlo.`,
      };
    }

    const definition = buildMissionDefinition(state);
    if (!definition) {
      return { ok: false, message: 'El diseño no tiene un objetivo científico válido.' };
    }

    this.shipFuel = Math.max(0, this.shipFuel - cost.fuel);
    this.shipIntegrity = Math.max(1, this.shipIntegrity - cost.integrity);
    this.resources.industrial -= cost.industrial;
    this.resources.electronics -= cost.electronics;
    this.resources.metals -= cost.metals;

    const mission = this.missions.addMission(definition);
    if (!mission) return { ok: false, message: 'No se pudo registrar la misión diseñada.' };
    this.missions.activate(mission.id);

    const report = buildReport(state, {
      fuelSpent: cost.fuel,
      missionName: mission.name,
    });
    this._saveDesignState({ ...state, implemented: true, report });
    this.hud.setMission(this.missions.active);
    this.hud.setGuide(null);
    this.guided = false;
    this.hud.toast(`Misión implementada · ${mission.name}`, 'good', 4);
    this.saveGame(true);
    this.updateHUD();
    return { ok: true, report, missionName: mission.name };
  }

  /* ---------------------------------------------------------------- estados */

  selectTool(index) {
    if (index < 0 || index >= TOOLS.length) return;
    this.toolIndex = index;
    this.toolRig.set(index);
    this.hud.setTool(index);
    this.audio.ui();
  }

  /* ----------------------------------------------------------- multijugador */

  /** Abre la pantalla MULTIJUGADOR sin reconstruir el menú principal. */
  openMultiplayer() {
    if (this.state === 'playing' || this.state === 'travel' || this.state === 'paused') {
      this.exitToMenu();
    }
    this._closeOverlaysSilent();
    this.settingsOpen = false;
    this.state = 'menu';
    this.hud.screen('multiplayer');
    this.multiplayerUI.open();
    this.audio.ui();
  }

  /**
   * Entra al mundo compartido reutilizando el motor existente.
   * NO borra el guardado individual ni escribe en el perfil.
   */
  enterMultiplayerWorld() {
    if (this.multiplayerActive) return;
    this.multiplayerActive = true;
    this.audio.init();
    this._closeOverlaysSilent();
    this.settingsOpen = false;
    this.reset({ guided: false });
    this.state = 'playing';
    this.hud.screen(null);
    this.hud.show();
    this.hud.setGuide(
      '<b>Cooperativo:</b> explora con tu tripulación · <kbd>ESC</kbd> pausa sólo tu control · el resto sigue en línea.'
    );
    const count = this.multiplayer.players.size;
    this.hud.toast(
      `Sesión ${this.multiplayer.code} · ${count} tripulante${count === 1 ? '' : 's'}`,
      'good',
      4
    );
    this.ignoreUnlock = true;
    this.controls.requestLock();
    this.clock.getDelta();
    this._updateMultiplayerHud();
  }

  /** Sale del mundo compartido y limpia los avatares remotos. */
  exitMultiplayerWorld() {
    if (!this.multiplayerActive) return;
    this.multiplayerActive = false;
    for (const avatar of this.remoteAvatars.values()) avatar.dispose();
    this.remoteAvatars.clear();
    this.hud.hidePanel();
    this.hud.hideMissionComplete();
    this.hud.hideTravel();
    this.hud.hide();
    this.state = 'menu';
    this.audio.silenceLoops();
    this.ignoreUnlock = true;
    if (document.pointerLockElement) document.exitPointerLock();
    this.hud.screen(this.multiplayerUI.visible ? 'multiplayer' : 'menu');
    this.cameraRig.updateMenu(0);
    this.needsRender = true;
    this.root.querySelector('#mp-hud')?.classList.add('hidden');
  }

  /** El anfitrión cambió el destino: todos viajan al mismo mundo. */
  applyMultiplayerDestination(destination) {
    if (!this.multiplayerActive) return;
    if (!this.destinations?.[destination] || this.destination === destination) return;
    this._applyDestination(destination, { spawn: true, announce: true });
    this.hud.toast(`Destino compartido: ${this.destinations[destination].name}`, 'good', 3.6);
  }

  /**
   * Presencia en red: envía el estado local limitado a ~15 Hz y actualiza los
   * avatares remotos por interpolación. Sin física ni bucles adicionales.
   */
  _syncMultiplayer(dt) {
    if (!this.multiplayerActive || !this.player) return;

    const player = this.player;
    const position = player.group.position;
    const quaternion = player.group.quaternion;
    const baseSpeed = player.mode === 'walk' ? player.walkSpeed || 3.6 : 4.2;
    const anim = Math.min(1, Math.max(0, (player.speed || 0) / baseSpeed));

    this.multiplayer.sendLocalState({
      x: position.x,
      y: position.y,
      z: position.z,
      qx: quaternion.x,
      qy: quaternion.y,
      qz: quaternion.z,
      qw: quaternion.w,
      mode: player.mode,
      anim,
      location: this.destination,
      interior: player.inside === true,
    });

    const players = this.multiplayer.players;
    const sessionId = this.multiplayer.sessionId;
    const inside = player.inside === true;

    for (const [id, data] of players) {
      if (id === sessionId) continue;

      let avatar = this.remoteAvatars.get(id);
      if (!avatar) {
        avatar = new RemoteAvatar(this.scene, data);
        this.remoteAvatars.set(id, avatar);
      }

      // Sólo se ve a quien comparte mundo e interior/exterior con el jugador local.
      const sameSpace = data.location === this.destination && (data.interior === true) === inside;
      avatar.group.visible = sameSpace;
      if (!sameSpace) continue;

      avatar.setData(data);
      avatar.update(dt);
    }

    for (const [id, avatar] of this.remoteAvatars) {
      if (!players.has(id)) {
        avatar.dispose();
        this.remoteAvatars.delete(id);
      }
    }

    this._mpHudAccum = (this._mpHudAccum || 0) + dt;
    if (this._mpHudAccum > 0.5) {
      this._mpHudAccum = 0;
      this._updateMultiplayerHud();
    }
  }

  _updateMultiplayerHud() {
    const chip = this.root.querySelector('#mp-hud');
    if (!chip) return;
    chip.classList.toggle('hidden', !this.multiplayerActive);
    if (!this.multiplayerActive) return;
    chip.dataset.state = this.multiplayer.status;
    const code = this.root.querySelector('#mp-hud-code');
    const count = this.root.querySelector('#mp-hud-players');
    const latency = this.root.querySelector('#mp-hud-latency');
    if (code) code.textContent = this.multiplayer.code || '—';
    if (count) count.textContent = `${this.multiplayer.players.size}/${this.multiplayer.maxClients}`;
    if (latency) latency.textContent = this.multiplayer.latency ? `${this.multiplayer.latency} ms` : '—';
  }

  /* ---------------------------------------------------------------- estados */

  start() {
    this.startNewGame();
  }

  /**
   * Nueva partida guiada: entra en la estación sin activar una misión.
   * El estado de la Academia y de la mesa de diseño se conserva.
   */
  startNewGame({ keepOverlays = false, requestLock = true } = {}) {
    this.audio.init();
    clearSave();
    if (!keepOverlays) this._closeOverlaysSilent();
    this.settingsOpen = false;
    this.reset({ guided: true });

    // Kit inicial mínimo para que la mesa de diseño pueda implementar una
    // misión desde el menú sin obligar a recolectar antes de empezar.
    this.resources.metals = 40;
    this.resources.electronics = 20;
    this.resources.industrial = 30;

    // La cinemática de introducción (Prompt 4) fue CANCELADA por decisión del
    // proyecto: toda partida nueva entra directamente al juego.
    this.state = 'playing';
    this.hud.screen(null);
    this.hud.show();
    this.hud.setGuide(
      '<b>Guía:</b> 1. Recorre la estación · 2. Abre una consola con <kbd>E</kbd> · 3. Acepta una misión. <kbd>H</kbd> abre la ayuda de la zona.'
    );
    this.hud.toast(
      'Nueva partida · sin misión automática. Explora la estación y acepta una misión desde una consola.',
      'good',
      4.4
    );
    this.ignoreUnlock = true;
    if (requestLock) this.controls.requestLock();
    this.clock.getDelta();
  }
  startExploration() {
    this.startNewGame();
  }

  reset({ guided = false } = {}) {
    this.guided = !!guided;
    this.time = 0;
    this.integrity = 100;
    this.toolIndex = 0;
    this.repairing = false;
    this.revealUntil = 0;
    this.scanCooldown = 0;
    this.alarmTimer = 0;
    this.sparkAccum = 0;
    this.hadLock = false;
    this.panelOpen = null;
    this.panelSource = null;
    this.panelPoint = null;
    this.job = null;
    this.seated = false;
    this.navTarget = null;
    this.visitedPois.clear();
    this.commsSent = false;
    this.repairCooldown = 0;
    this.lastDamageToast = 0;
    this.scienceData = 0;
    this.shipFuel = 100;
    this.shipIntegrity = 100;
    this.moduleInspections = 0;

    this.inventory = { component: 0, filter: 0, sample: 0, tools: 0 };
    this.engineering = { circuits: [false, false, false] };
    this.lifeSupport = { filters: [false, false] };
    this.lab = { samples: [false, false, false], calibrated: false };
    this.suit = { equipped: true, helmet: 100 };
    this.resources = {
      regolith: 0, waterIce: 0, minerals: 0, metals: 0, electronics: 0, industrial: 0,
    };
    this.cargo = {
      regolith: 0, waterIce: 0, minerals: 0, metals: 0, electronics: 0, industrial: 0,
    };
    this.marsSystems = { geology: false, equipment: false, antenna: false };
    this.lastPlayerMode = 'zero';

    this.destination = 'station';
    this.shipLocation = 'station';
    this.travel = null;
    this.vehicle = null;
    this.planet = null;
    this.autosaveTimer = 0;
    this.visitedDestinations = new Set(['station']);

    this.missions.reset({ autoActivate: !guided });
    this.maintenance.reset();
    this.player.reset();
    this.station.reset();
    this.interior.reset();
    this.interior.setPower(0.72);
    this.exteriorTasks.reset();
    this.tether.reset();
    this.moon.reset();
    this.mars.reset();

    this.environment.setInterior(false);
    this.cameraRig.inside = false;
    this.cameraRig.seated = false;
    this.toolRig.set(0);
    this.hud.setTool(0);
    this.hud.setStats(100, 100, 100, this.player.co2, this.player.filterLife);
    this.hud.setMission(this.missions.active);
    this.hud.setGuide(null);
    this.hud.setTether({ active: false, distance: 0, max: this.tether.max, tension: 0 });
    this.hud.setPressure(this.interior.getAirlockStatus());
    this.hud.setNavigation(null);
    this.hud.setWarnings([]);
    this.hud.setClock(0);
    this.hud.setCrosshair('none');
    this.hud.hidePrompt();
    this.hud.hidePanel();
    this.hud.hideMissionComplete();
    this.hud.hideTravel();
    this.hud.screen(null);

    // La partida nueva empieza en EVA junto a la esclusa, como siempre.
    this._applyDestination('station', { spawn: false, announce: false });
    this.lastPlayerMode = null;
    this._refreshZone(true);

    this.cameraRig.yaw = 0;
    this.cameraRig.pitch = 0.16;
    this.cameraRig.distance = 6.2;
    this.cameraRig.targetDistance = 6.2;
    this.cameraRig.snap(this.player.group.position);

    this.audio.silenceLoops();
    this.audio.setBreathing(1);
  }

  pause() {
    if (this.state !== 'playing') return;
    if (this.panelOpen) {
      this.closePanel();
      return;
    }
    this.saveGame(true);
    this.state = 'paused';
    this.needsRender = true;
    this.audio.silenceLoops();
    this.hud.screen('pause');
    this._refreshContinueButton();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.settingsOpen = false;
    this.state = 'playing';
    this.hud.screen(null);
    this.ignoreUnlock = true;
    this.controls.requestLock();
    this.clock.getDelta();
  }

  /** Guarda y vuelve al menú principal sin borrar el progreso. */
  exitToMenu() {
    if (this.multiplayerActive) {
      this.exitMultiplayerWorld();
      void this.multiplayer.leave();
    }
    if (this.state === 'playing' || this.state === 'paused' || this.state === 'overlay') {
      this.saveGame(true);
    }
    this._closeOverlaysSilent();
    this.settingsOpen = false;
    this.state = 'menu';
    this.hud.hidePanel();
    this.hud.hideMissionComplete();
    this.hud.hideTravel();
    this.hud.hide();
    this.hud.screen('menu');
    this.audio.silenceLoops();
    this.ignoreUnlock = true;
    if (document.pointerLockElement) document.exitPointerLock();
    this._syncMenuStatus();
    this._refreshContinueButton();
    this.cameraRig.updateMenu(0);
    this.needsRender = true;
  }

  win() {
    if (this.state !== 'playing') return;
    this.state = 'won';
    this.needsRender = true;
    this.audio.silenceLoops();
    this.audio.victory();
    this.hud.hidePanel();

    this.hud.setWinStats({
      repairs: this.station.repairedCount,
      time: this.time,
      integrity: this.player.hull,
      o2: this.player.o2,
    });
    this.hud.screen('win');
    this.hud.hide();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  lose(title, reason) {
    if (this.state !== 'playing') return;
    this.state = 'lost';
    this.needsRender = true;
    this.audio.silenceLoops();
    this.audio.fail();
    this.hud.hidePanel();

    this.hud.setLoseStats({
      title,
      reason,
      repairs: this.station.repairedCount,
      time: this.time,
    });
    this.hud.screen('lose');
    this.hud.hide();
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
