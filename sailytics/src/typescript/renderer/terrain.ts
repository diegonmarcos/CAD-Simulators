import {
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  DoubleSide,
  Vector3,
} from 'three';

export class UnderwaterTerrain {
  mesh: Mesh;
  private geometry: PlaneGeometry;
  private material: ShaderMaterial;

  constructor(size: number = 500, segments: number = 64) {
    this.geometry = new PlaneGeometry(size, size, segments, segments);
    this.generateHeightmap();

    this.material = new ShaderMaterial({
      side: DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uBaseColor: { value: new Vector3(0.16, 0.36, 0.48) },
        uDeepColor: { value: new Vector3(0.06, 0.18, 0.30) },
        uCausticColor: { value: new Vector3(0.12, 0.40, 0.55) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vNorm;
        varying float vDepth;
        void main() {
          vNorm = normalize(normalMatrix * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vDepth = position.z;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uBaseColor;
        uniform vec3 uDeepColor;
        uniform vec3 uCausticColor;
        varying vec3 vWorldPos;
        varying vec3 vNorm;
        varying float vDepth;

        float caustic(vec2 uv, float t) {
          float c = 0.0;
          mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
          vec2 p = uv;
          for (int i = 0; i < 3; i++) {
            c += abs(sin(p.x + sin(p.y + t)));
            p = m * p * 0.5;
            t *= 1.1;
          }
          return c / 3.0;
        }

        void main() {
          // Height-based color blending
          float h = clamp(vDepth * 0.08 + 0.5, 0.0, 1.0);
          vec3 col = mix(uDeepColor, uBaseColor, h);

          // Animated caustic pattern
          float ca = caustic(vWorldPos.xz * 0.12, uTime * 0.25);
          col += uCausticColor * ca * 0.2;

          // Diffuse lighting
          vec3 lightDir = normalize(vec3(0.3, 1.0, 0.2));
          float diff = max(dot(normalize(vNorm), lightDir), 0.0) * 0.4 + 0.6;
          col *= diff;

          // Emissive base glow
          col += vec3(0.05, 0.12, 0.18);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = -3;
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }

  private generateHeightmap(): void {
    const pos = this.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const s = 0.02;
      const h =
        this.noise2D(x * s, y * s) * 10 +
        this.noise2D(x * s * 2, y * s * 2) * 5 +
        this.noise2D(x * s * 4, y * s * 4) * 2.5 +
        this.noise2D(x * s * 8, y * s * 8) * 1;
      pos.setZ(i, h - 4);
    }
    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  private noise2D(x: number, y: number): number {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const sx = x - X;
    const sy = y - Y;
    const u = sx * sx * (3 - 2 * sx);
    const v = sy * sy * (3 - 2 * sy);
    const a = this.hash2D(X, Y);
    const b = this.hash2D(X + 1, Y);
    const c = this.hash2D(X, Y + 1);
    const d = this.hash2D(X + 1, Y + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  private hash2D(x: number, y: number): number {
    let h = x * 374761393 + y * 668265263;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h & 0xffffffff) / 0xffffffff;
  }

  destroy(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
