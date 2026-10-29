const VERT = `
  attribute vec2 a_pos;
  void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform float u_t;
uniform vec2 u_res;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float caustic(vec2 uv, float t) {
  float c = 0.0;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  vec2 p = uv;
  for (int i = 0; i < 4; i++) {
    c += abs(sin(p.x + sin(p.y + t)));
    p = m * p * 0.5;
    t *= 1.12;
  }
  return c / 4.0;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 cen = uv - 0.5;
  float dist = length(cen);
  float ang = atan(cen.y, cen.x);

  // Deep ocean gradient
  vec3 deep = vec3(0.006, 0.022, 0.048);
  vec3 mid  = vec3(0.016, 0.050, 0.095);
  vec3 col  = mix(mid, deep, smoothstep(0.0, 0.55, dist));

  // Animated caustics
  float t = u_t * 0.25;
  float ca = caustic(uv * 5.0 + vec2(t * 0.3, t * 0.2), t);
  col += vec3(0.008, 0.030, 0.060) * ca * max(1.0 - dist * 1.3, 0.0);

  // Noise grain
  float n = noise(uv * 80.0 + u_t * 0.4);
  col += vec3(0.003) * (n - 0.5);

  // Radar concentric rings (fade towards edge)
  float fade = max(1.0 - dist * 1.6, 0.0);
  float ringR = mod(dist, 0.075);
  float ring = smoothstep(0.0025, 0.0, abs(ringR - 0.0375) - 0.0365);
  col += vec3(0.012, 0.040, 0.072) * ring * fade * 0.25;

  // 12 radial spokes
  float spoke = smoothstep(0.004, 0.0, abs(mod(ang / 6.2832 * 12.0 + 0.5, 1.0) - 0.5) - 0.497);
  col += vec3(0.008, 0.028, 0.050) * spoke * fade * 0.18;

  // Vignette
  float vig = 1.0 - dist * dist * 2.0;
  col *= max(vig, 0.08);

  // Subtle scan lines
  float scan = 0.5 + 0.5 * sin(gl_FragCoord.y * 1.5 + u_t * 3.0);
  col *= 0.97 + 0.03 * scan;

  gl_FragColor = vec4(col, 1.0);
}
`;

export class BGShader {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private uTime: WebGLUniformLocation;
  private uRes: WebGLUniformLocation;
  private t0: number;
  private raf = 0;
  private obs: ResizeObserver;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;';
    container.insertBefore(this.canvas, container.firstChild);

    const gl = this.canvas.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;

    const vs = this.compile(gl.VERTEX_SHADER, VERT);
    const fs = this.compile(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('Shader link: ' + gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    this.uTime = gl.getUniformLocation(prog, 'u_t')!;
    this.uRes = gl.getUniformLocation(prog, 'u_res')!;
    this.t0 = performance.now() / 1000;

    this.obs = new ResizeObserver(() => this.resize());
    this.obs.observe(container);
    this.resize();
    this.tick();
  }

  private compile(type: number, src: string): WebGLShader {
    const s = this.gl.createShader(type)!;
    this.gl.shaderSource(s, src);
    this.gl.compileShader(s);
    if (!this.gl.getShaderParameter(s, this.gl.COMPILE_STATUS))
      throw new Error('Shader: ' + this.gl.getShaderInfoLog(s));
    return s;
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio, 1.5);
    const w = Math.floor(this.canvas.clientWidth * dpr);
    const h = Math.floor(this.canvas.clientHeight * dpr);
    if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
  }

  private tick = (): void => {
    const gl = this.gl;
    gl.uniform1f(this.uTime, performance.now() / 1000 - this.t0);
    gl.uniform2f(this.uRes, this.canvas.width, this.canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.raf = requestAnimationFrame(this.tick);
  };

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.obs.disconnect();
    this.canvas.remove();
  }
}
