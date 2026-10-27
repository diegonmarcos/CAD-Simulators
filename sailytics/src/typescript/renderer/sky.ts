import {
  Mesh,
  SphereGeometry,
  ShaderMaterial,
  BackSide,
  Vector3,
} from 'three';

export class SkyDome {
  mesh: Mesh;
  private material: ShaderMaterial;

  constructor() {
    const geometry = new SphereGeometry(480, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2);

    this.material = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        uniform vec3 uZenithColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        varying vec3 vWorldPosition;
        varying vec3 vPosition;

        void main() {
          vec3 dir = normalize(vWorldPosition);
          float h = max(dir.y, 0.0);

          // Sky gradient: horizon → zenith
          vec3 col = mix(uHorizonColor, uZenithColor, pow(h, 0.45));

          // Atmospheric scattering — warm glow near horizon
          float horizonGlow = exp(-h * 6.0);
          col += vec3(0.25, 0.15, 0.08) * horizonGlow * 0.35;

          // Sun disc
          float sunDot = dot(dir, uSunDir);
          float sunDisc = smoothstep(0.9994, 0.9998, sunDot);
          col = mix(col, uSunColor, sunDisc);

          // Sun corona (wide glow)
          float corona = pow(max(sunDot, 0.0), 256.0);
          col += uSunColor * corona * 0.8;

          // Sun halo (softer, wider glow)
          float halo = pow(max(sunDot, 0.0), 16.0);
          col += vec3(1.0, 0.85, 0.5) * halo * 0.15;

          // Slight haze at very low angles
          float haze = exp(-h * 12.0);
          col = mix(col, vec3(0.7, 0.8, 0.9), haze * 0.2);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      uniforms: {
        uZenithColor:  { value: new Vector3(0.18, 0.45, 0.85) },  // bright blue
        uHorizonColor: { value: new Vector3(0.55, 0.75, 0.95) },  // pale blue
        uSunColor:     { value: new Vector3(1.0, 0.98, 0.92) },   // warm white
        uSunDir:       { value: new Vector3(0.4, 0.65, 0.3).normalize() },
      },
    });

    this.mesh = new Mesh(geometry, this.material);
    this.mesh.position.y = -5;
  }

  setSunPosition(azimuth: number, elevation: number): void {
    const az = azimuth * Math.PI / 180;
    const el = elevation * Math.PI / 180;
    this.material.uniforms.uSunDir.value.set(
      Math.cos(el) * Math.sin(az),
      Math.sin(el),
      Math.cos(el) * Math.cos(az),
    ).normalize();
  }

  destroy(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
