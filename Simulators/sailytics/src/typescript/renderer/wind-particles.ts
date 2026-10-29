import {
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  AdditiveBlending,
  LineSegments,
} from 'three';

/**
 * Wind visualized as directional streaks (LineSegments).
 * Each particle is a short line: head (bright) → tail (transparent),
 * creating motion-streak effect in the wind direction.
 */
export class WindParticles {
  points: LineSegments;
  private geometry: BufferGeometry;
  private material: ShaderMaterial;
  private windDir = { x: 0, z: -1 };
  private count: number;

  // Per-particle data (stored flat, indexed by particle index)
  private headPos: Float32Array;   // x,y,z per particle
  private velocities: Float32Array; // vx,vy,vz per particle
  private lifetimes: Float32Array;  // 0..1 per particle

  constructor(particleCount: number = 500) {
    this.count = particleCount;
    this.geometry = new BufferGeometry();

    // Two vertices per particle (head + tail) = particleCount * 2 vertices
    const vertexCount = particleCount * 2;
    const positions = new Float32Array(vertexCount * 3);
    const alphas = new Float32Array(vertexCount); // 1 = head, 0 = tail

    this.headPos = new Float32Array(particleCount * 3);
    this.velocities = new Float32Array(particleCount * 3);
    this.lifetimes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Random position in a large volume
      this.headPos[i3]     = (Math.random() - 0.5) * 200;
      this.headPos[i3 + 1] = Math.random() * 35 + 3;
      this.headPos[i3 + 2] = (Math.random() - 0.5) * 200;

      this.velocities[i3]     = (Math.random() - 0.5) * 0.4;
      this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.08;
      this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.4;

      this.lifetimes[i] = Math.random();

      // Head vertex
      const hi = i * 6; // 2 vertices * 3 components
      positions[hi]     = this.headPos[i3];
      positions[hi + 1] = this.headPos[i3 + 1];
      positions[hi + 2] = this.headPos[i3 + 2];
      alphas[i * 2] = 1.0;

      // Tail vertex (slightly behind)
      positions[hi + 3] = this.headPos[i3] - 1.0;
      positions[hi + 4] = this.headPos[i3 + 1];
      positions[hi + 5] = this.headPos[i3 + 2] - 1.0;
      alphas[i * 2 + 1] = 0.0;
    }

    this.geometry.setAttribute('position', new BufferAttribute(positions, 3));
    this.geometry.setAttribute('alpha', new BufferAttribute(alphas, 1));

    this.material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {},
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          float a = vAlpha * 0.4;
          vec3 col = mix(vec3(0.6, 0.75, 0.9), vec3(0.9, 0.95, 1.0), vAlpha);
          gl_FragColor = vec4(col, a);
        }
      `,
    });

    this.points = new LineSegments(this.geometry, this.material);
  }

  setWindDirection(directionDeg: number, speed: number): void {
    const rad = (directionDeg * Math.PI) / 180;
    this.windDir.x = Math.sin(rad) * speed * 0.3;
    this.windDir.z = Math.cos(rad) * speed * 0.3;
  }

  update(dt: number): void {
    const pos = this.geometry.attributes.position;
    const arr = pos.array as Float32Array;
    const trailLen = 2.5;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;

      // Move head position
      const vx = this.windDir.x + this.velocities[i3];
      const vy = this.velocities[i3 + 1];
      const vz = this.windDir.z + this.velocities[i3 + 2];

      this.headPos[i3]     += vx * dt * 18;
      this.headPos[i3 + 1] += vy * dt * 2;
      this.headPos[i3 + 2] += vz * dt * 18;

      this.lifetimes[i] += dt * 0.22;

      // Respawn if expired or out of bounds
      if (
        this.lifetimes[i] > 1.0 ||
        Math.abs(this.headPos[i3]) > 140 ||
        Math.abs(this.headPos[i3 + 2]) > 140
      ) {
        this.headPos[i3]     = (Math.random() - 0.5) * 200;
        this.headPos[i3 + 1] = Math.random() * 35 + 3;
        this.headPos[i3 + 2] = (Math.random() - 0.5) * 200;
        this.velocities[i3]     = (Math.random() - 0.5) * 0.4;
        this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.08;
        this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.4;
        this.lifetimes[i] = 0;
      }

      // Head vertex = current position
      const hi = i * 6;
      arr[hi]     = this.headPos[i3];
      arr[hi + 1] = this.headPos[i3 + 1];
      arr[hi + 2] = this.headPos[i3 + 2];

      // Tail vertex = behind head in velocity direction
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
      const tl = speed > 0.01 ? trailLen / speed : trailLen;
      arr[hi + 3] = this.headPos[i3]     - vx * tl;
      arr[hi + 4] = this.headPos[i3 + 1] - vy * tl;
      arr[hi + 5] = this.headPos[i3 + 2] - vz * tl;
    }

    pos.needsUpdate = true;
  }

  destroy(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
