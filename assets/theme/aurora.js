/* 本地高清流光背景。按屏幕像素绘制，离开首屏或后台标签页时暂停。 */
(() => {
  const canvas = document.querySelector('.hero-aurora');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) return;

  const vertex = `attribute vec2 position;
  void main() { gl_Position = vec4(position, 0.0, 1.0); }`;
  const fragment = `precision highp float;
  uniform vec2 resolution;
  uniform float time;
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    vec2 h = vec2(127.1, 311.7);
    float a = fract(sin(dot(i, h)) * 43758.5453);
    float b = fract(sin(dot(i + vec2(1., 0.), h)) * 43758.5453);
    float c = fract(sin(dot(i + vec2(0., 1.), h)) * 43758.5453);
    float d = fract(sin(dot(i + vec2(1., 1.), h)) * 43758.5453);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float silk(vec2 p) {
    float v = 0.0, weight = .55;
    for (int i = 0; i < 3; i++) {
      v += noise(p) * weight;
      p = p * 2.03 + vec2(3.1, 7.3);
      weight *= .5;
    }
    return v;
  }
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution;
    float x = (uv.x - .5) * min(resolution.x / resolution.y, 1.9);
    float t = time * .075;
    float bend = .16 * sin(x * 3.6 + t) + .07 * sin(x * 6.0 - t * .7);
    float y = uv.y - .72 - bend;
    float folds = silk(vec2(x * 3.0 + t * .15, y * 2.0 - t * .2));
    float ribbon = exp(-abs(y + (folds - .5) * .21) * 13.0);
    float detail = .55 + .45 * sin(y * 72.0 + folds * 10.0 + t);
    float upper = ribbon * (.35 + .65 * detail);
    float lowerY = uv.y - .13 + .17 * sin(x * 3.0 - t * .8);
    float lower = exp(-abs(lowerY) * 20.0) * (.55 + .45 * sin(lowerY * 66.0 + folds * 4.0));
    vec3 violet = vec3(.48, .20, .94);
    vec3 blue = vec3(.18, .37, .92);
    vec3 color = mix(violet, blue, smoothstep(-.5, .6, x + .13 * sin(t)));
    float light = upper * .56 + lower * .32;
    float edge = .64 + .36 * smoothstep(.10, .48, abs(uv.x - .5));
    float fade = smoothstep(.0, .09, uv.y) * (1.0 - smoothstep(.91, 1.0, uv.y));
    gl_FragColor = vec4(color, clamp(light * edge * fade, 0.0, .67));
  }`;
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };
  const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
  if (!vs || !fs) return;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const resolution = gl.getUniformLocation(program, 'resolution');
  const time = gl.getUniformLocation(program, 'time');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.querySelector('.hero-motion-toggle');
  let paused = reduced.matches;
  let frame = 0, previous = 0, elapsed = 0, visible = true, lost = false;
  const draw = () => {
    if (lost) return;
    gl.uniform2f(resolution, canvas.width, canvas.height);
    gl.uniform1f(time, elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
  const tick = (now) => {
    frame = requestAnimationFrame(tick);
    if (now - previous < 1000 / 30) return;
    elapsed += previous ? Math.min((now - previous) / 1000, .1) : 0;
    previous = now;
    draw();
  };
  const sync = () => {
    cancelAnimationFrame(frame);
    previous = 0;
    const running = visible && !document.hidden && !paused && !lost;
    canvas.dataset.motion = running ? 'running' : 'paused';
    if (toggle) {
      toggle.hidden = lost;
      toggle.textContent = paused ? '播放背景' : '暂停背景';
      toggle.setAttribute('aria-pressed', String(!paused));
    }
    draw();
    if (running) frame = requestAnimationFrame(tick);
  };
  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    // 最高 4K 尺寸，避免高像素比设备分配不必要的大画布。
    const ratio = Math.min(devicePixelRatio || 1, 2, 3840 / Math.max(bounds.width, bounds.height));
    canvas.width = Math.max(1, Math.round(bounds.width * ratio));
    canvas.height = Math.max(1, Math.round(bounds.height * ratio));
    gl.viewport(0, 0, canvas.width, canvas.height);
    draw();
  };
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(canvas);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', () => { paused = reduced.matches; sync(); });
  toggle?.addEventListener('click', () => { paused = !paused; sync(); });
  canvas.addEventListener('webglcontextlost', () => {
    lost = true;
    canvas.parentElement.classList.remove('aurora-ready');
    sync();
  });
  resize();
  canvas.parentElement.classList.add('aurora-ready');
  sync();
})();
