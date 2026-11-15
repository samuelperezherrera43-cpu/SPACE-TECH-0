import * as THREE from 'three';
import {
  makeGlowTexture,
  makeEarthTextures,
  makeSpaceEnvironmentTexture,
} from './Textures.js';

/**
 * Entorno espacial: estrellas 3D, Tierra procedural, sol, luces y
 * environment map para los reflejos de los materiales PBR.
 */
export class Environment {
  constructor(scene, renderer, preset) {
    this.scene = scene;
    this.renderer = renderer;
    this.preset = preset;
    this.time = 0;
    this.inside = false;
    this.destination = 'station';

    this.group = new THREE.Group();
    this.group.name = 'environment';
    scene.add(this.group);

    this._buildLights();
    this._buildStars();
    this._buildEarth();
    this._buildSun();
    this._buildEnvironmentMap();

    this.setQuality(preset);
  }

  /* ------------------------------------------------------------------ luces */

  _buildLights() {
    // Sol: luz direccional principal, con sombras selectivas.
    this.sunLight = new THREE.DirectionalLight(0xfff1dd, 2.7);
    this.sunLight.position.set(60, 80, 40);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.left = -26;
    this.sunLight.shadow.camera.right = 26;
    this.sunLight.shadow.camera.top = 26;
    this.sunLight.shadow.camera.bottom = -26;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 240;
    this.sunLight.shadow.bias = -0.0006;
    this.sunLight.shadow.normalBias = 0.025;
    this.sunLight.shadow.camera.updateProjectionMatrix();
    this.group.add(this.sunLight);
    this.group.add(this.sunLight.target);

    // Relleno azul desde el lado opuesto (rebote de la Tierra).
    this.rimLight = new THREE.DirectionalLight(0x3f7fbf, 0.8);
    this.rimLight.position.set(-80, -50, -60);
    this.group.add(this.rimLight);

    this.fillLight = new THREE.DirectionalLight(0x7fb6ff, 0.45);
    this.fillLight.position.set(-60, 20, 90);
    this.group.add(this.fillLight);

    // Ambiente: evita negros absolutos en las sombras.
    this.hemiLight = new THREE.HemisphereLight(0x2a4a70, 0x04060d, 1.0);
    this.group.add(this.hemiLight);

    this.ambientLight = new THREE.AmbientLight(0x0a1420, 0.3);
    this.group.add(this.ambientLight);

    // Luz de la estación; se apaga en el preset de rendimiento.
    this.stationLight = new THREE.PointLight(0x66d8ff, 70, 55, 1.8);
    this.stationLight.position.set(0, 1, 0);
    this.group.add(this.stationLight);
  }

  /* --------------------------------------------------------------- estrellas */

  _buildStars() {
    const count = 2400;
    this.starCount = count;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const radius = 420 + Math.random() * 380;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      color.setHSL(0.55 + Math.random() * 0.12, 0.35 + Math.random() * 0.25, 0.72 + Math.random() * 0.25);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = 1.1 + Math.random() * 2.4;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uTime: { value: 0 },
      },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aPhase;
        uniform float uPixelRatio;
        uniform float uTime;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = aColor;
          vAlpha = 0.68 + 0.32 * sin(uTime * 1.6 + aPhase);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          float a = smoothstep(0.5, 0.0, d);
          a = pow(a, 1.7);
          gl_FragColor = vec4(vColor, a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });

    this.stars = new THREE.Points(geometry, material);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -1;
    this.group.add(this.stars);
  }

  /* ------------------------------------------------------------------ Tierra */

  _buildEarth() {
    const textures = makeEarthTextures(512, 256);
    this.earthTextures = textures;

    const anisotropy = Math.min(
      this.preset.anisotropy ?? 4,
      this.renderer.capabilities.getMaxAnisotropy()
    );
    for (const texture of [textures.map, textures.normalMap, textures.clouds]) {
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
    }

    this.earthMaterial = new THREE.MeshPhongMaterial({
      map: textures.map,
      normalMap: textures.normalMap,
      normalScale: new THREE.Vector2(0.7, 0.7),
      shininess: 14,
      specular: new THREE.Color(0x0b1a2c),
      emissive: 0x061426,
      emissiveIntensity: 0.28,
      fog: false,
    });

    this.earth = new THREE.Mesh(
      new THREE.SphereGeometry(115, 40, 28),
      this.earthMaterial
    );
    this.earth.position.set(-280, -110, -360);
    this.earth.rotation.y = 0.6;
    this.group.add(this.earth);

    // Nubes: Lambert es mucho más barato que Standard y a esta distancia
    // el resultado es equivalente.
    this.cloudMaterial = new THREE.MeshLambertMaterial({
      map: textures.clouds,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      fog: false,
    });

    this.clouds = new THREE.Mesh(
      new THREE.SphereGeometry(115.7, 40, 28),
      this.cloudMaterial
    );
    this.clouds.position.copy(this.earth.position);
    this.clouds.rotation.y = 0.62;
    this.group.add(this.clouds);

    // Atmósfera: Fresnel sobre una esfera ligeramente mayor (3D, no billboard).
    this.atmosphereMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x3d8fe0) },
        uIntensity: { value: 0.85 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uIntensity;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.4);
          gl_FragColor = vec4(uColor, fresnel * uIntensity);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });

    this.atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(119, 32, 24),
      this.atmosphereMaterial
    );
    this.atmosphere.position.copy(this.earth.position);
    this.group.add(this.atmosphere);
  }

  /* --------------------------------------------------------------------- sol */

  _buildSun() {
    const glow = makeGlowTexture();

    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow,
      color: 0xffd9a0,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }));
    this.sunHalo.scale.setScalar(340);
    this.sunHalo.position.set(320, 190, 260);
    this.group.add(this.sunHalo);

    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow,
      color: 0xfff0d0,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }));
    this.sunSprite.scale.setScalar(150);
    this.sunSprite.position.copy(this.sunHalo.position);
    this.group.add(this.sunSprite);
  }

  /* --------------------------------------------------------- environment map */

  _buildEnvironmentMap() {
    const source = makeSpaceEnvironmentTexture();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();

    this.envMap = pmrem.fromEquirectangular(source).texture;
    pmrem.dispose();
    source.dispose();

    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.75;
  }

  /* ---------------------------------------------------------------- calidad */

  setQuality(preset) {
    this.preset = preset;

    this.stars.geometry.setDrawRange(0, Math.min(preset.stars, this.starCount));
    this.stars.material.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();

    this.sunLight.castShadow = !!preset.shadows;
    this.sunLight.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
    if (this.sunLight.shadow.map) {
      this.sunLight.shadow.map.dispose();
      this.sunLight.shadow.map = null;
    }
    this.sunLight.shadow.camera.updateProjectionMatrix();

    this.stationLight.visible = !!preset.pointLights;
    this.stationLight.intensity = preset.id === 'high' || preset.id === 'standard' ? 70 : 40;

    this.hemiLight.intensity = preset.id === 'high' || preset.id === 'standard' ? 1.0 : 1.1;
    this.ambientLight.intensity = preset.id === 'high' || preset.id === 'standard' ? 0.3 : 0.38;

    const anisotropy = Math.min(
      preset.anisotropy ?? 4,
      this.renderer.capabilities.getMaxAnisotropy()
    );
    for (const texture of [this.earthTextures.map, this.earthTextures.normalMap, this.earthTextures.clouds]) {
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
    }

    this.setInterior(this.inside);
  }

  /**
   * Dentro del habitáculo, el sol no debe iluminar el interior. En el preset
   * con sombras la propia estructura lo bloquea; sin sombras se atenúa la
   * luz direccional para que manden las luces interiores.
   */
  setInterior(inside) {
    this.inside = inside;
    if (this.destination !== 'station') return;
    const dim = inside && !this.preset.shadows ? 0.22 : 1;
    this.sunLight.intensity = 2.7 * dim;
    this.rimLight.intensity = 0.8 * dim;
    this.fillLight.intensity = 0.45 * dim;
  }

  /** Cambia el cielo y la iluminación según el destino. */
  setDestination(id) {
    this.destination = id;

    const station = id === 'station';
    const moon = id === 'moon';
    const mars = id === 'mars';

    this.stars.visible = station || moon;
    this.earth.visible = station || moon;
    this.clouds.visible = station || moon;
    this.atmosphere.visible = station || moon;
    this.sunHalo.visible = true;
    this.sunSprite.visible = true;

    if (station) {
      this.scene.background.setHex(0x04060d);
      this.scene.fog.color.setHex(0x04060d);
      this.scene.fog.density = 0.0014;
      this.sunLight.color.setHex(0xfff1dd);
      this.sunLight.intensity = 2.7;
      this.sunLight.position.set(60, 80, 40);
      this.rimLight.color.setHex(0x3f7fbf);
      this.rimLight.intensity = 0.8;
      this.fillLight.color.setHex(0x7fb6ff);
      this.fillLight.intensity = 0.45;
      this.hemiLight.color.setHex(0x2a4a70);
      this.hemiLight.groundColor.setHex(0x04060d);
      this.hemiLight.intensity = this.preset.id === 'high' || this.preset.id === 'standard' ? 1.0 : 1.1;
      this.ambientLight.color.setHex(0x0a1420);
      this.ambientLight.intensity = this.preset.id === 'high' || this.preset.id === 'standard' ? 0.3 : 0.38;
      this.earth.position.set(-280, -110, -360);
      this.clouds.position.copy(this.earth.position);
      this.atmosphere.position.copy(this.earth.position);
      this.earth.scale.setScalar(1);
      this.clouds.scale.setScalar(1);
      this.atmosphere.scale.setScalar(1);
      this.sunSprite.material.color.setHex(0xfff0d0);
    } else if (moon) {
      this.scene.background.setHex(0x000000);
      this.scene.fog.color.setHex(0x000000);
      this.scene.fog.density = 0.0006;
      this.sunLight.color.setHex(0xffffff);
      this.sunLight.intensity = 3.1;
      // Sol bajo desde el sureste: ilumina las fachadas que se ven al llegar
      // desde la plataforma y proyecta las sombras hacia el fondo.
      this.sunLight.position.set(62, 92, -58);
      this.rimLight.color.setHex(0x2a3f66);
      this.rimLight.intensity = 0.35;
      this.fillLight.color.setHex(0x8fb6e8);
      this.fillLight.intensity = 0.55;
      this.hemiLight.color.setHex(0x1a2433);
      this.hemiLight.groundColor.setHex(0x05070a);
      this.hemiLight.intensity = 0.6;
      this.ambientLight.color.setHex(0x05070a);
      this.ambientLight.intensity = 0.22;
      this.earth.position.set(210, 150, -300);
      this.clouds.position.copy(this.earth.position);
      this.atmosphere.position.copy(this.earth.position);
      // Desde la Luna la Tierra ocupa ~1,9° (NSSDC: 1,8–2,0°). Escala
      // comprimida respecto al radio real para no romper la escena.
      const moonEarthScale = 0.057;
      this.earth.scale.setScalar(moonEarthScale);
      this.clouds.scale.setScalar(moonEarthScale);
      this.atmosphere.scale.setScalar(moonEarthScale);
      this.sunSprite.material.color.setHex(0xffffff);
    } else if (mars) {
      this.scene.background.setHex(0x2a120a);
      this.scene.fog.color.setHex(0x6b2a14);
      this.scene.fog.density = 0.009;
      this.sunLight.color.setHex(0xffb080);
      this.sunLight.intensity = 2.2;
      this.sunLight.position.set(48, 68, -52);
      this.rimLight.color.setHex(0x8a3a1a);
      this.rimLight.intensity = 0.5;
      this.fillLight.color.setHex(0xff8a4a);
      this.fillLight.intensity = 0.6;
      this.hemiLight.color.setHex(0x6b2a14);
      this.hemiLight.groundColor.setHex(0x1a0a05);
      this.hemiLight.intensity = 0.88;
      this.ambientLight.color.setHex(0x2a1008);
      this.ambientLight.intensity = 0.35;
      this.sunSprite.material.color.setHex(0xffb080);
      // Desde Marte la Tierra es un punto distante. Escala muy reducida y
      // posición lejana (distancia real 54,6–400,2 M km).
      this.earth.position.set(420, 210, -620);
      this.clouds.position.copy(this.earth.position);
      this.atmosphere.position.copy(this.earth.position);
      const marsEarthScale = 0.004;
      this.earth.scale.setScalar(marsEarthScale);
      this.clouds.scale.setScalar(marsEarthScale);
      this.atmosphere.scale.setScalar(marsEarthScale);
    }

    this.sunSprite.material.opacity = 0.95;

    // En superficie la sombra debe cubrir la base y la plataforma, no el
    // origen del sistema: sin esto la instalación queda fuera del mapa de
    // sombras y se ve plana.
    const shadowZ = station ? 0 : 24;
    this.sunLight.target.position.set(0, 0, shadowZ);
    this.sunLight.target.updateMatrixWorld();

    // El disco solar acompaña a la luz para que los reflejos cuadren.
    if (!station) {
      const sun = this.sunLight.position;
      const scale = 460 / sun.length();
      this.sunHalo.position.set(sun.x * scale, sun.y * scale, sun.z * scale);
      this.sunSprite.position.copy(this.sunHalo.position);
    } else {
      this.sunHalo.position.set(320, 190, 260);
      this.sunSprite.position.copy(this.sunHalo.position);
    }

    const extent = station ? 26 : 34;
    const shadowCamera = this.sunLight.shadow.camera;
    if (shadowCamera.right !== extent) {
      shadowCamera.left = -extent;
      shadowCamera.right = extent;
      shadowCamera.top = extent;
      shadowCamera.bottom = -extent;
      shadowCamera.updateProjectionMatrix();
    }
  }

  setPixelRatio(ratio) {
    this.stars.material.uniforms.uPixelRatio.value = ratio;
  }

  /* ----------------------------------------------------------------- update */

  update(dt) {
    this.time += dt;
    this.stars.material.uniforms.uTime.value = this.time;
    this.earth.rotation.y += dt * 0.008;
    this.clouds.rotation.y += dt * 0.011;
    this.sunSprite.material.opacity = 0.9 + 0.08 * Math.sin(this.time * 0.8);
  }

  dispose() {
    this.group.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material.dispose();
      }
    });
    this.scene.environment = null;
    this.envMap?.dispose();
    this.scene.remove(this.group);
  }
}
