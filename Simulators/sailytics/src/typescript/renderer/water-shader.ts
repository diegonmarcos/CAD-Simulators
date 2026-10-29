import {
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  DoubleSide,
  Clock,
  Vector2,
  Vector3,
} from 'three';

export class AnimatedWater {
  mesh: Mesh;
  private material: ShaderMaterial;
  private clock: Clock;

  constructor(size: number = 500, segments: number = 128) {
    this.clock = new Clock();

    this.material = new ShaderMaterial({
      side: DoubleSide,
      transparent: false, // opaque ocean — no alpha artifacts
      uniforms: {
        uTime: { value: 0 },
        uWaveA: { value: new Vector2(1.0, 0.5) },
        uWaveB: { value: new Vector2(0.5, 1.2) },
        uWaveC: { value: new Vector2(-0.7, 0.8) },
        uWaveD: { value: new Vector2(-1.0, -0.6) },
        uSunDir: { value: new Vector3(0.4, 0.65, 0.3).normalize() },
      },
      vertexShader: `
        uniform float uTime;
        uniform vec2 uWaveA, uWaveB, uWaveC, uWaveD;
        varying float vHeight;
        varying vec3 vNormal;
        varying vec3 vWorldPos;

        // Lower steepness values to prevent self-intersection (the cause of black patches)
        vec3 gerstnerWave(vec2 dir, float steepness, float wl, vec3 p, float t,
                          inout vec3 tang, inout vec3 binorm) {
          float k = 6.2832 / wl;
          float c = sqrt(9.8 / k);
          vec2 d = normalize(dir);
          float f = k * (dot(d, p.xz) - c * t);
          float a = steepness / k;
          float sf = sin(f);
          float cf = cos(f);
          tang += vec3(
            -d.x * d.x * steepness * sf,
             d.x * steepness * cf,
            -d.x * d.y * steepness * sf);
          binorm += vec3(
            -d.x * d.y * steepness * sf,
             d.y * steepness * cf,
            -d.y * d.y * steepness * sf);
          return vec3(d.x * a * cf, a * sf, d.y * a * cf);
        }

        void main() {
          vec3 p = position;
          vec3 tang = vec3(1.0, 0.0, 0.0);
          vec3 binorm = vec3(0.0, 0.0, 1.0);

          // Reduced steepness to prevent wave self-intersection
          p += gerstnerWave(uWaveA, 0.18, 22.0, position, uTime, tang, binorm);
          p += gerstnerWave(uWaveB, 0.12, 14.0, position, uTime, tang, binorm);
          p += gerstnerWave(uWaveC, 0.08,  9.0, position, uTime, tang, binorm);
          p += gerstnerWave(uWaveD, 0.04,  6.0, position, uTime, tang, binorm);

          // Robust normal: fallback to up-vector if cross product degenerates
          vec3 rawN = cross(binorm, tang);
          float nLen = length(rawN);
          vNormal = nLen > 0.001 ? rawN / nLen : vec3(0.0, 1.0, 0.0);

          vHeight = p.y;
          vWorldPos = (modelMatrix * vec4(p, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        varying float vHeight;
        varying vec3 vNormal;
        varying vec3 vWorldPos;

        void main() {
          // Ensure normal is valid (protect against NaN)
          vec3 N = normalize(vNormal);
          if (any(isnan(N))) N = vec3(0.0, 1.0, 0.0);

          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 H = normalize(uSunDir + V);

          // Ocean base color — always visible, never black
          vec3 deep    = vec3(0.02, 0.12, 0.28);
          vec3 mid     = vec3(0.04, 0.22, 0.42);
          vec3 shallow = vec3(0.08, 0.35, 0.52);
          float hFac = smoothstep(-1.0, 1.5, vHeight);
          vec3 col = mix(deep, mid, smoothstep(0.0, 0.35, hFac));
          col = mix(col, shallow, smoothstep(0.35, 1.0, hFac));

          // Foam on crests
          float foam = smoothstep(0.3, 0.9, vHeight);
          col = mix(col, vec3(0.82, 0.92, 1.0), foam * 0.5);

          // Diffuse lighting (soft, prevents hard black)
          float NdotL = dot(N, uSunDir);
          float diffuse = NdotL * 0.35 + 0.65; // half-lambert: never goes below 0.65
          col *= diffuse;

          // Specular highlight
          float NdotH = max(dot(N, H), 0.0);
          float spec = pow(NdotH, 200.0);
          col += vec3(1.0, 0.97, 0.90) * spec * 0.55;

          // Secondary softer specular (broader highlight)
          float spec2 = pow(NdotH, 20.0);
          col += vec3(0.6, 0.75, 0.9) * spec2 * 0.08;

          // Fresnel — sky reflection at grazing angles
          float NdotV = max(dot(N, V), 0.0);
          float fres = pow(1.0 - NdotV, 4.0);
          vec3 skyReflect = vec3(0.35, 0.55, 0.75);
          col = mix(col, skyReflect, fres * 0.4);

          // Subsurface scattering (green-blue glow when looking towards sun through waves)
          float sss = pow(max(dot(V, -uSunDir), 0.0), 5.0);
          col += vec3(0.03, 0.18, 0.28) * sss * 0.3 * (1.0 - foam);

          // Distance fade to horizon color
          float dist = length(vWorldPos.xz);
          float distFade = smoothstep(180.0, 250.0, dist);
          col = mix(col, vec3(0.40, 0.60, 0.80), distFade * 0.6);

          // Final clamp — NEVER allow black
          col = max(col, vec3(0.02, 0.08, 0.18));

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.mesh = new Mesh(new PlaneGeometry(size, size, segments, segments), this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0;
  }

  update(): void {
    this.material.uniforms.uTime.value = this.clock.getElapsedTime() * 0.5;
  }

  setWindDirection(directionDeg: number, speed: number): void {
    const rad = (directionDeg * Math.PI) / 180;
    const s = Math.min(speed / 15, 2);
    this.material.uniforms.uWaveA.value.set(Math.sin(rad) * s, Math.cos(rad) * 0.5);
    this.material.uniforms.uWaveB.value.set(Math.sin(rad + 0.5) * s, Math.cos(rad + 0.5) * 0.8);
  }

  destroy(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
