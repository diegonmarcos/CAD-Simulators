import {
  InstancedMesh,
  BufferGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
  Matrix4,
  Vector3,
  Quaternion,
} from 'three';

interface Boid {
  position: Vector3;
  velocity: Vector3;
}

/**
 * Build a simple fish-shaped BufferGeometry:
 * streamlined body (elongated diamond) + forked tail fin.
 */
function createFishGeometry(): BufferGeometry {
  // Vertices: x = lateral, y = vertical, z = forward
  const v = [
    // Body
    [ 0,     0,     0.6 ],  // 0: nose
    [ 0.08,  0.05,  0.1 ],  // 1: body right-top
    [ 0.08, -0.05,  0.1 ],  // 2: body right-bottom
    [-0.08,  0.05,  0.1 ],  // 3: body left-top
    [-0.08, -0.05,  0.1 ],  // 4: body left-bottom
    [ 0,     0.07,  0.1 ],  // 5: body dorsal
    [ 0,    -0.07,  0.1 ],  // 6: body ventral
    // Tail section
    [ 0.04,  0.02, -0.25],  // 7: tail-right-top
    [ 0.04, -0.02, -0.25],  // 8: tail-right-bottom
    [-0.04,  0.02, -0.25],  // 9: tail-left-top
    [-0.04, -0.02, -0.25],  // 10: tail-left-bottom
    [ 0,     0.03, -0.25],  // 11: tail dorsal
    [ 0,    -0.03, -0.25],  // 12: tail ventral
    // Tail fork
    [ 0,     0,    -0.32],  // 13: peduncle
    [ 0,     0.12, -0.45],  // 14: tail tip top
    [ 0,    -0.12, -0.45],  // 15: tail tip bottom
    // Dorsal fin
    [ 0,     0.12,  0.05],  // 16: dorsal fin tip
  ];

  const faces = [
    // Nose to body (front cone)
    [0, 1, 5], [0, 5, 3], [0, 3, 4], [0, 4, 6],
    [0, 6, 2], [0, 2, 1],
    // Body sides
    [1, 7, 11], [1, 11, 5], [5, 11, 9], [5, 9, 3],
    [3, 9, 10], [3, 10, 4], [4, 10, 12], [4, 12, 6],
    [6, 12, 8], [6, 8, 2], [2, 8, 7], [2, 7, 1],
    // Body to tail taper
    [7, 8, 13], [9, 7, 13], [10, 9, 13], [8, 10, 13],
    [11, 7, 9], [12, 10, 8],
    // Tail fork
    [13, 14, 15],
    [13, 15, 14], // back face
    // Dorsal fin (thin triangles)
    [5, 16, 11],
    [11, 16, 5],
  ];

  const positions: number[] = [];
  for (const f of faces) {
    for (const vi of f) {
      positions.push(v[vi][0], v[vi][1], v[vi][2]);
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(positions), 3));
  geo.computeVertexNormals();
  return geo;
}

export class FishSystem {
  mesh: InstancedMesh;
  private boids: Boid[];
  private count: number;
  private bounds: { min: Vector3; max: Vector3 };

  constructor(fishCount: number = 200) {
    this.count = fishCount;
    this.boids = [];

    this.bounds = {
      min: new Vector3(-70, -6, -70),
      max: new Vector3(70, -1.5, 70),
    };

    for (let i = 0; i < fishCount; i++) {
      this.boids.push({
        position: new Vector3(
          Math.random() * 80 - 40,
          Math.random() * -4 - 2,
          Math.random() * 80 - 40,
        ),
        velocity: new Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 2,
        ),
      });
    }

    const geometry = createFishGeometry();
    // Scale up for visibility
    geometry.scale(3, 3, 3);

    const material = new MeshStandardMaterial({
      color: 0x48c8f0,
      roughness: 0.5,
      metalness: 0.3,
      emissive: 0x1890b8,
      emissiveIntensity: 0.5,
    });

    this.mesh = new InstancedMesh(geometry, material, fishCount);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
  }

  update(dt: number): void {
    const separationDist = 2.5;
    const alignmentDist = 5.5;
    const cohesionDist = 9.0;
    const maxSpeed = 3.5;
    const maxForce = 0.5;

    const _mat = new Matrix4();
    const _quat = new Quaternion();
    const _up = new Vector3(0, 0, 1); // fish points along +z in local space
    const _dir = new Vector3();
    const _scale = new Vector3();

    for (let i = 0; i < this.count; i++) {
      const boid = this.boids[i];
      const separation = new Vector3();
      const alignment = new Vector3();
      const cohesion = new Vector3();
      let sepC = 0, aliC = 0, cohC = 0;

      for (let j = 0; j < this.count; j++) {
        if (i === j) continue;
        const other = this.boids[j];
        const dist = boid.position.distanceTo(other.position);

        if (dist < separationDist && dist > 0) {
          separation.add(new Vector3().subVectors(boid.position, other.position).normalize().divideScalar(dist));
          sepC++;
        }
        if (dist < alignmentDist) {
          alignment.add(other.velocity);
          aliC++;
        }
        if (dist < cohesionDist) {
          cohesion.add(other.position);
          cohC++;
        }
      }

      if (sepC > 0) {
        separation.divideScalar(sepC).normalize().multiplyScalar(maxSpeed)
          .sub(boid.velocity).clampLength(0, maxForce);
        boid.velocity.add(separation.multiplyScalar(1.5));
      }
      if (aliC > 0) {
        alignment.divideScalar(aliC).normalize().multiplyScalar(maxSpeed)
          .sub(boid.velocity).clampLength(0, maxForce);
        boid.velocity.add(alignment);
      }
      if (cohC > 0) {
        cohesion.divideScalar(cohC).sub(boid.position).normalize().multiplyScalar(maxSpeed)
          .sub(boid.velocity).clampLength(0, maxForce);
        boid.velocity.add(cohesion);
      }

      // Boundary avoidance
      const bf = 0.3;
      if (boid.position.x < this.bounds.min.x) boid.velocity.x += bf;
      if (boid.position.x > this.bounds.max.x) boid.velocity.x -= bf;
      if (boid.position.y < this.bounds.min.y) boid.velocity.y += bf;
      if (boid.position.y > this.bounds.max.y) boid.velocity.y -= bf;
      if (boid.position.z < this.bounds.min.z) boid.velocity.z += bf;
      if (boid.position.z > this.bounds.max.z) boid.velocity.z -= bf;

      boid.velocity.clampLength(0, maxSpeed);
      boid.position.add(boid.velocity.clone().multiplyScalar(dt));

      // Orient fish along velocity
      _dir.copy(boid.velocity).normalize();
      if (_dir.lengthSq() > 0.001) {
        _quat.setFromUnitVectors(_up, _dir);
      }

      // Vary size per fish (deterministic from index)
      const sizeVar = 0.7 + ((i * 7 + 3) % 10) * 0.06;
      _scale.set(sizeVar, sizeVar, sizeVar);

      _mat.compose(boid.position, _quat, _scale);
      this.mesh.setMatrixAt(i, _mat);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  setPositions(data: { x: number; y: number; z: number; size: number }[]): void {
    for (let i = 0; i < Math.min(data.length, this.count); i++) {
      this.boids[i].position.set(data[i].x, data[i].y, data[i].z);
    }
  }

  destroy(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshStandardMaterial).dispose();
  }
}
