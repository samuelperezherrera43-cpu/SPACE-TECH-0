import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Pipeline de postprocesado moderado.
 * - Calidad alta: bloom suave + SMAA + OutputPass (tone mapping / sRGB).
 * - Rendimiento: render directo, sin composer.
 *
 * SMAA va después de OutputPass: detecta bordes sobre la imagen ya mapeada,
 * que es como están calibrados sus umbrales, y cuesta mucho menos que MSAA
 * sobre un render target HalfFloat en GPUs integradas.
 */
export class PostFX {
  constructor(renderer, scene, camera, preset) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.smaaPass = null;
    this.outputPass = null;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.setQuality(preset);
  }

  _build(preset) {
    const composer = new EffectComposer(this.renderer);

    this.renderPass = new RenderPass(this.scene, this.camera);
    composer.addPass(this.renderPass);

    if (preset.bloom) {
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(this.width, this.height),
        preset.bloomStrength,
        preset.bloomRadius,
        preset.bloomThreshold
      );
      composer.addPass(this.bloomPass);
    }

    this.outputPass = new OutputPass();
    composer.addPass(this.outputPass);

    if (preset.aa === 'smaa') {
      this.smaaPass = new SMAAPass(this.width, this.height);
      composer.addPass(this.smaaPass);
    }

    this.composer = composer;
  }

  _dispose() {
    this.bloomPass?.dispose?.();
    this.renderPass?.dispose?.();
    this.smaaPass?.dispose?.();
    this.outputPass?.dispose?.();
    this.composer?.dispose?.();
    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.smaaPass = null;
    this.outputPass = null;
  }

  setQuality(preset) {
    this.preset = preset;
    this._dispose();

    if (preset.bloom || preset.aa === 'smaa') {
      this._build(preset);
      this.setSize(this.width, this.height);
    }
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;
    if (!this.composer) return;

    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);

    // Bloom a menor resolución: el desenfoque no necesita el detalle del frame.
    if (this.bloomPass && this.preset.bloomResolutionScale) {
      const ratio = this.renderer.getPixelRatio() * this.preset.bloomResolutionScale;
      this.bloomPass.setSize(
        Math.max(1, Math.round(width * ratio)),
        Math.max(1, Math.round(height * ratio))
      );
    }
  }

  setPixelRatio() {
    this.setSize(this.width, this.height);
  }

  render(dt) {
    if (this.composer) {
      this.composer.render(dt);
      return;
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this._dispose();
  }
}
