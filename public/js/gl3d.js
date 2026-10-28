/* =====================================================================
   gl3d.js  —  Monster Arena 3D engine (dependency-free WebGL2)
   ---------------------------------------------------------------------
   * mat4 math, shader programs, mesh/geometry builders
   * PBR-style forward lighting (sun + hemisphere + dynamic point lights)
   * PCF shadow map, MSAA HDR target, bloom, ACES tonemap, grading
   * instanced billboard / ground-decal particle batch + ribbon batch
   * "inflated sprite" mesh generator (turns 2D art into 3D relief)
   ===================================================================== */
(function (G) {
  'use strict';

  // ------------------------------------------------------------------ math
  const M = {
    ident(o) { o = o || new Float32Array(16); o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; },
    mul(o, a, b) {
      const t = M._t;
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        t[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
      o.set(t); return o;
    },
    persp(o, fovy, asp, n, f) {
      const t = 1 / Math.tan(fovy / 2); o.fill(0);
      o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o;
    },
    ortho(o, l, r, b, t, n, f) {
      o.fill(0); o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
      o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1; return o;
    },
    lookAt(o, e, c, u) {
      let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
      let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
      let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx;
      l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
      o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
      o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
      o[12] = -(xx * e[0] + xy * e[1] + xz * e[2]);
      o[13] = -(yx * e[0] + yy * e[1] + yz * e[2]);
      o[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); o[15] = 1; return o;
    },
    inv(o, m) {
      const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7],
        a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
      const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!d) return M.ident(o); d = 1 / d;
      o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d;
      o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
      o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d;
      o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
      o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d;
      o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
      o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d;
      o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
      return o;
    },
    // model matrix: translate * rotY(a) * rotX(pitch)? * scale   (rotY maps local +x -> (cos a, 0, sin a))
    trs(o, x, y, z, ry, sx, sy, sz, rx, rz) {
      const c = Math.cos(ry), s = Math.sin(ry);
      sy = sy === undefined ? sx : sy; sz = sz === undefined ? sx : sz;
      // base: R = Ry * Rz * Rx ; apply optional pitch (rx about local x) and roll (rz about local z)
      let r00 = c, r01 = 0, r02 = -s, r10 = 0, r11 = 1, r12 = 0, r20 = s, r21 = 0, r22 = c;
      if (rz) { // rotate about local z (tilt in x-y plane)
        const cz = Math.cos(rz), sz_ = Math.sin(rz);
        const a00 = r00 * cz + r01 * sz_, a01 = -r00 * sz_ + r01 * cz,
          a10 = r10 * cz + r11 * sz_, a11 = -r10 * sz_ + r11 * cz,
          a20 = r20 * cz + r21 * sz_, a21 = -r20 * sz_ + r21 * cz;
        r00 = a00; r01 = a01; r10 = a10; r11 = a11; r20 = a20; r21 = a21;
      }
      if (rx) { // rotate about local x
        const cx = Math.cos(rx), sx_ = Math.sin(rx);
        const a01 = r01 * cx + r02 * sx_, a02 = -r01 * sx_ + r02 * cx,
          a11 = r11 * cx + r12 * sx_, a12 = -r11 * sx_ + r12 * cx,
          a21 = r21 * cx + r22 * sx_, a22 = -r21 * sx_ + r22 * cx;
        r01 = a01; r02 = a02; r11 = a11; r12 = a12; r21 = a21; r22 = a22;
      }
      o[0] = r00 * sx; o[1] = r10 * sx; o[2] = r20 * sx; o[3] = 0;
      o[4] = r01 * sy; o[5] = r11 * sy; o[6] = r21 * sy; o[7] = 0;
      o[8] = r02 * sz; o[9] = r12 * sz; o[10] = r22 * sz; o[11] = 0;
      o[12] = x; o[13] = y; o[14] = z; o[15] = 1; return o;
    },
    _t: new Float32Array(16)
  };

  // ---------------------------------------------------------------- shaders
  function compile(gl, type, src, name) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      console.error('[gl3d] shader error in ' + name + ':\n' + log + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
      throw new Error('shader compile failed: ' + name + ' ' + log);
    }
    return s;
  }
  class Prog {
    constructor(gl, vs, fs, name) {
      this.gl = gl; this.name = name; this._u = {};
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs, name + '.vs'));
      gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs, name + '.fs'));
      gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aNrm');
      gl.bindAttribLocation(p, 2, 'aUV'); gl.bindAttribLocation(p, 3, 'aCol');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link failed ' + name + ': ' + gl.getProgramInfoLog(p));
      this.p = p;
    }
    use() { this.gl.useProgram(this.p); return this; }
    loc(n) { let l = this._u[n]; if (l === undefined) { l = this.gl.getUniformLocation(this.p, n); this._u[n] = l; } return l; }
    f1(n, a) { const l = this.loc(n); if (l) this.gl.uniform1f(l, a); return this; }
    i1(n, a) { const l = this.loc(n); if (l) this.gl.uniform1i(l, a); return this; }
    f2(n, a, b) { const l = this.loc(n); if (l) this.gl.uniform2f(l, a, b); return this; }
    f3(n, a, b, c) { const l = this.loc(n); if (l) this.gl.uniform3f(l, a, b, c); return this; }
    f4(n, a, b, c, d) { const l = this.loc(n); if (l) this.gl.uniform4f(l, a, b, c, d); return this; }
    v3(n, v) { const l = this.loc(n); if (l) this.gl.uniform3fv(l, v); return this; }
    v4(n, v) { const l = this.loc(n); if (l) this.gl.uniform4fv(l, v); return this; }
    m4(n, m) { const l = this.loc(n); if (l) this.gl.uniformMatrix4fv(l, false, m); return this; }
  }

  // ---------------------------------------------------------------- geometry
  const STRIDE = 12; // pos3 nrm3 uv2 col4
  class Geo {
    constructor() { this.v = []; this.i = []; }
    get vc() { return this.v.length / STRIDE; }
    vert(px, py, pz, nx, ny, nz, u, v, r, g, b, a) { this.v.push(px, py, pz, nx, ny, nz, u, v, r, g, b, a); return this.vc - 1; }
    tri(a, b, c) { this.i.push(a, b, c); }
    quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
    // append another Geo transformed by matrix m (Float32Array16), optional color override [r,g,b,a]
    append(g, m, col) {
      const base = this.vc, v = g.v;
      let n00, n01, n02, n10, n11, n12, n20, n21, n22;
      if (m) { // normal matrix = inverse transpose of upper 3x3
        const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], gg = m[2], h = m[6], k = m[10];
        const A = e * k - f * h, B = -(d * k - f * gg), C = d * h - e * gg, D = -(b * k - c * h), E = a * k - c * gg, F = -(a * h - b * gg),
          Gx = b * f - c * e, H = -(a * f - c * d), I = a * e - b * d;
        n00 = A; n01 = B; n02 = C; n10 = D; n11 = E; n12 = F; n20 = Gx; n21 = H; n22 = I;
      }
      for (let i = 0; i < v.length; i += STRIDE) {
        let x = v[i], y = v[i + 1], z = v[i + 2], nx = v[i + 3], ny = v[i + 4], nz = v[i + 5];
        if (m) {
          const X = m[0] * x + m[4] * y + m[8] * z + m[12], Y = m[1] * x + m[5] * y + m[9] * z + m[13], Z = m[2] * x + m[6] * y + m[10] * z + m[14];
          let NX = n00 * nx + n01 * ny + n02 * nz, NY = n10 * nx + n11 * ny + n12 * nz, NZ = n20 * nx + n21 * ny + n22 * nz;
          const l = Math.hypot(NX, NY, NZ) || 1; x = X; y = Y; z = Z; nx = NX / l; ny = NY / l; nz = NZ / l;
        }
        this.v.push(x, y, z, nx, ny, nz, v[i + 6], v[i + 7],
          col ? col[0] : v[i + 8], col ? col[1] : v[i + 9], col ? col[2] : v[i + 10], col ? (col[3] === undefined ? v[i + 11] : col[3]) : v[i + 11]);
      }
      for (const k of g.i) this.i.push(k + base);
      return this;
    }
  }
  const WHITE = [1, 1, 1, 0];
  Geo.box = function (sx = 1, sy = 1, sz = 1, col = WHITE, uvScale = 1) {
    const g = new Geo(), hx = sx / 2, hy = sy / 2, hz = sz / 2, c = col;
    const faces = [ // normal, and 4 corners
      [0, 0, 1, [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]],
      [0, 0, -1, [hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]],
      [1, 0, 0, [hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]],
      [-1, 0, 0, [-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]],
      [0, 1, 0, [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]],
      [0, -1, 0, [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]]];
    const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (const f of faces) {
      const b = g.vc;
      for (let k = 0; k < 4; k++) g.vert(f[3 + k][0], f[3 + k][1], f[3 + k][2], f[0], f[1], f[2], uv[k][0] * uvScale, uv[k][1] * uvScale, c[0], c[1], c[2], c[3]);
      g.quad(b, b + 1, b + 2, b + 3);
    }
    return g;
  };
  Geo.sphere = function (seg = 24, ring = 16, col = WHITE) {
    const g = new Geo();
    for (let y = 0; y <= ring; y++) {
      const v = y / ring, th = v * Math.PI;
      for (let x = 0; x <= seg; x++) {
        const u = x / seg, ph = u * Math.PI * 2;
        const nx = Math.sin(th) * Math.cos(ph), ny = Math.cos(th), nz = Math.sin(th) * Math.sin(ph);
        g.vert(nx, ny, nz, nx, ny, nz, u, v, col[0], col[1], col[2], col[3]);
      }
    }
    for (let y = 0; y < ring; y++) for (let x = 0; x < seg; x++) {
      const a = y * (seg + 1) + x, b = a + seg + 1;
      g.tri(a, a + 1, b); g.tri(a + 1, b + 1, b);
    }
    // winding fix: ensure outward by testing first tri
    return g;
  };
  // cylinder/cone along +Y from y=0..h (unit radius scaled by rb at bottom, rt at top)
  Geo.cyl = function (rt = 1, rb = 1, h = 1, seg = 16, col = WHITE, caps = true) {
    const g = new Geo();
    const slope = (rb - rt) / (h || 1);
    for (let i = 0; i <= seg; i++) {
      const u = i / seg, a = u * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const nl = Math.hypot(1, slope);
      g.vert(c * rb, 0, s * rb, c / nl, slope / nl, s / nl, u, 0, col[0], col[1], col[2], col[3]);
      g.vert(c * rt, h, s * rt, c / nl, slope / nl, s / nl, u, 1, col[0], col[1], col[2], col[3]);
    }
    for (let i = 0; i < seg; i++) { const a = i * 2; g.tri(a, a + 3, a + 1); g.tri(a, a + 2, a + 3); }
    if (caps) {
      for (const top of [0, 1]) {
        const r = top ? rt : rb; if (r <= 1e-5) continue;
        const cb = g.vert(0, top ? h : 0, 0, 0, top ? 1 : -1, 0, .5, .5, col[0], col[1], col[2], col[3]);
        const s0 = g.vc;
        for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; g.vert(Math.cos(a) * r, top ? h : 0, Math.sin(a) * r, 0, top ? 1 : -1, 0, .5 + Math.cos(a) * .5, .5 + Math.sin(a) * .5, col[0], col[1], col[2], col[3]); }
        for (let i = 0; i < seg; i++) top ? g.tri(cb, s0 + i + 1, s0 + i) : g.tri(cb, s0 + i, s0 + i + 1);
      }
    }
    return g;
  };
  Geo.torus = function (R = 1, r = .2, segR = 32, segr = 12, col = WHITE) { // lies in XZ plane
    const g = new Geo();
    for (let i = 0; i <= segR; i++) {
      const u = i / segR * Math.PI * 2, cu = Math.cos(u), su = Math.sin(u);
      for (let j = 0; j <= segr; j++) {
        const v = j / segr * Math.PI * 2, cv = Math.cos(v), sv = Math.sin(v);
        g.vert((R + r * cv) * cu, r * sv, (R + r * cv) * su, cv * cu, sv, cv * su, i / segR, j / segr, col[0], col[1], col[2], col[3]);
      }
    }
    for (let i = 0; i < segR; i++) for (let j = 0; j < segr; j++) {
      const a = i * (segr + 1) + j, b = a + segr + 1;
      g.tri(a, a + 1, b); g.tri(a + 1, b + 1, b);
    }
    return g;
  };
  Geo.plane = function (w = 1, d = 1, col = WHITE, sx = 1, sz = 1) { // XZ plane facing +Y
    const g = new Geo();
    for (let j = 0; j <= sz; j++) for (let i = 0; i <= sx; i++)
      g.vert((i / sx - .5) * w, 0, (j / sz - .5) * d, 0, 1, 0, i / sx, j / sz, col[0], col[1], col[2], col[3]);
    for (let j = 0; j < sz; j++) for (let i = 0; i < sx; i++) {
      const a = j * (sx + 1) + i, b = a + sx + 1; g.tri(a, b, a + 1); g.tri(a + 1, b, b + 1);
    }
    return g;
  };
  Geo.disc = function (r = 1, seg = 48, col = WHITE) {
    const g = new Geo(); g.vert(0, 0, 0, 0, 1, 0, .5, .5, col[0], col[1], col[2], col[3]);
    for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; g.vert(Math.cos(a) * r, 0, Math.sin(a) * r, 0, 1, 0, .5 + Math.cos(a) * .5, .5 + Math.sin(a) * .5, col[0], col[1], col[2], col[3]); }
    for (let i = 0; i < seg; i++) g.tri(0, i + 2, i + 1);
    return g;
  };
  // faceted noise-displaced boulder (flat shaded). radius 1.
  Geo.rock = function (seed, detail = 2, col = WHITE, squash = 1) {
    let s = seed >>> 0 || 1; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    // icosahedron subdivision
    const t = (1 + Math.sqrt(5)) / 2;
    let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(v => { const l = Math.hypot(...v); return v.map(c => c / l); });
    let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let d = 0; d < detail; d++) {
      const cache = {}, mid = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (cache[k] !== undefined) return cache[k]; const m = [(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2, (V[a][2] + V[b][2]) / 2]; const l = Math.hypot(...m); V.push(m.map(c => c / l)); return cache[k] = V.length - 1; };
      const NF = []; for (const [a, b, c] of F) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); NF.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); } F = NF;
    }
    const disp = V.map(v => 0.78 + rnd() * 0.34 + Math.sin(v[0] * 3.1 + seed) * 0.06 + Math.cos(v[2] * 2.7) * 0.05);
    const P = V.map((v, i) => [v[0] * disp[i], v[1] * disp[i] * squash, v[2] * disp[i]]);
    const g = new Geo();
    for (const [a, b, c] of F) {
      const A = P[a], B = P[b], C = P[c];
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const sh = 0.86 + rnd() * 0.28; // per-facet tint
      const i0 = g.vert(A[0], A[1], A[2], nx, ny, nz, 0, 0, col[0] * sh, col[1] * sh, col[2] * sh, col[3]);
      g.vert(B[0], B[1], B[2], nx, ny, nz, 1, 0, col[0] * sh, col[1] * sh, col[2] * sh, col[3]);
      g.vert(C[0], C[1], C[2], nx, ny, nz, 0, 1, col[0] * sh, col[1] * sh, col[2] * sh, col[3]);
      g.tri(i0, i0 + 1, i0 + 2);
    }
    return g;
  };

  class Mesh {
    constructor(gl, geo) {
      this.gl = gl; this.n = geo.i.length;
      this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
      this.vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.v), gl.STATIC_DRAW);
      this.ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(geo.i), gl.STATIC_DRAW);
      const S = STRIDE * 4;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, S, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, S, 24);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, S, 32);
      gl.bindVertexArray(null);
    }
    draw() { const gl = this.gl; gl.bindVertexArray(this.vao); gl.drawElements(gl.TRIANGLES, this.n, gl.UNSIGNED_INT, 0); }
    dispose() { const gl = this.gl; gl.deleteBuffer(this.vb); gl.deleteBuffer(this.ib); gl.deleteVertexArray(this.vao); }
  }

  // ---------------------------------------------------------------- textures
  function texFromImage(gl, img, opt = {}) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = opt.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    return t;
  }

  /* -------------------------------------------------------------------
     Inflated sprite: converts a 2D sprite into a 3D relief mesh.
     Returns {geo, tex(canvas), emis(canvas), aspect}. Mesh spans x,z in
     [-0.5,0.5] (scaled by aspect on x), y = height in units of "size".
     ------------------------------------------------------------------- */
  function inflateSprite(img, opt = {}) {
    const maxDim = opt.grid || 64, depth = opt.depth || 0.32, power = opt.power || 0.55;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const aspect = iw / ih;
    const gw = aspect >= 1 ? maxDim : Math.max(8, Math.round(maxDim * aspect));
    const gh = aspect >= 1 ? Math.max(8, Math.round(maxDim / aspect)) : maxDim;
    // texture canvas (cap 512 for memory)
    const tw = Math.min(512, iw), th = Math.round(tw * ih / iw);
    const cv = document.createElement('canvas'); cv.width = tw; cv.height = th;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, tw, th);
    const data = cx.getImageData(0, 0, tw, th).data;
    // bleed colour into transparent pixels so mip/bilinear edges don't halo dark
    const emc = document.createElement('canvas'); emc.width = tw; emc.height = th;
    const emx = emc.getContext('2d'); const ed = emx.createImageData(tw, th);
    for (let i = 0; i < tw * th; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
      let k = 0;
      if (a > 128) k = Math.max(0, Math.min(1, ((mx - 170) / 70))) * Math.max(0, Math.min(1, (sat - 0.35) / 0.35));
      if (opt.allEmissive) k = a > 128 ? 0.5 : 0;
      ed.data[i * 4] = r * k; ed.data[i * 4 + 1] = g * k; ed.data[i * 4 + 2] = b * k; ed.data[i * 4 + 3] = 255;
    }
    emx.putImageData(ed, 0, 0);
    // coverage grid
    const cov = new Float32Array(gw * gh);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const px = Math.min(tw - 1, Math.floor((x + .5) / gw * tw)), py = Math.min(th - 1, Math.floor((y + .5) / gh * th));
      cov[y * gw + x] = data[(py * tw + px) * 4 + 3] > 100 ? 1 : 0;
    }
    // distance transform (chamfer 2-pass) -> inside distance
    const D = new Float32Array(gw * gh); const INF = 1e9;
    for (let i = 0; i < D.length; i++) D[i] = cov[i] ? INF : 0;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const i = y * gw + x; if (!D[i]) continue; let d = D[i];
      if (x > 0) d = Math.min(d, D[i - 1] + 1); if (y > 0) d = Math.min(d, D[i - gw] + 1);
      if (x > 0 && y > 0) d = Math.min(d, D[i - gw - 1] + 1.414); if (x < gw - 1 && y > 0) d = Math.min(d, D[i - gw + 1] + 1.414); D[i] = d; }
    for (let y = gh - 1; y >= 0; y--) for (let x = gw - 1; x >= 0; x--) { const i = y * gw + x; if (!D[i]) continue; let d = D[i];
      if (x < gw - 1) d = Math.min(d, D[i + 1] + 1); if (y < gh - 1) d = Math.min(d, D[i + gw] + 1);
      if (x < gw - 1 && y < gh - 1) d = Math.min(d, D[i + gw + 1] + 1.414); if (x > 0 && y < gh - 1) d = Math.min(d, D[i + gw - 1] + 1.414); D[i] = d; }
    let mxd = 1; for (const d of D) if (d < INF && d > mxd) mxd = d;
    // height field + luminance bump
    const H = new Float32Array(gw * gh);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const i = y * gw + x; if (!cov[i]) { H[i] = 0; continue; }
      const k = Math.min(1, D[i] / mxd);
      const px = Math.min(tw - 1, Math.floor((x + .5) / gw * tw)), py = Math.min(th - 1, Math.floor((y + .5) / gh * th));
      const lum = (data[(py * tw + px) * 4] * .3 + data[(py * tw + px) * 4 + 1] * .59 + data[(py * tw + px) * 4 + 2] * .11) / 255;
      H[i] = Math.pow(Math.max(.02, k), power) * depth + lum * depth * 0.10 + 0.012;
    }
    // light blur of H for smoothness
    const H2 = new Float32Array(H);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) { const i = y * gw + x; if (!cov[i]) continue;
        let s = H[i] * 4, w = 4; for (const o of [-1, 1, -gw, gw]) { if (cov[i + o]) { s += H[i + o]; w++; } } H2[i] = s / w; }
      H.set(H2);
    }
    const g = new Geo(); const sx = aspect, sz = 1;
    for (let y = 0; y <= gh; y++) for (let x = 0; x <= gw; x++) {
      const gx = Math.min(gw - 1, x), gy = Math.min(gh - 1, y);
      // vertex height = avg of surrounding cells where covered (edge-aware)
      let hs = 0, hn = 0;
      for (const [ox, oy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) { const cx_ = x + ox, cy_ = y + oy; if (cx_ < 0 || cy_ < 0 || cx_ >= gw || cy_ >= gh) continue; if (cov[cy_ * gw + cx_]) { hs += H[cy_ * gw + cx_]; hn++; } }
      const h = hn ? hs / hn : 0;
      const hl = (xx, yy) => { xx = Math.max(0, Math.min(gw - 1, xx)); yy = Math.max(0, Math.min(gh - 1, yy)); return H[yy * gw + xx]; };
      const dx = (hl(x, gy) - hl(x - 2, gy)) * .5 * gw / sx, dz = (hl(gx, y) - hl(gx, y - 2)) * .5 * gh / sz; // dh per unit
      let nx = -dx, nz = -dz, ny = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      g.vert((x / gw - .5) * sx, h, (y / gh - .5) * sz, nx, ny, nz, x / gw, y / gh, 1, 1, 1, 0);
    }
    const W1 = gw + 1;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      if (!cov[y * gw + x]) continue;
      const a = y * W1 + x; g.tri(a, a + W1, a + 1); g.tri(a + 1, a + W1, a + W1 + 1);
    }
    // underside (flat, y=0) so the shadow / side view closes the silhouette
    const base = g.vc;
    for (let y = 0; y <= gh; y++) for (let x = 0; x <= gw; x++) g.vert((x / gw - .5) * sx, 0, (y / gh - .5) * sz, 0, -1, 0, x / gw, y / gh, .3, .3, .3, 0);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { if (!cov[y * gw + x]) continue; const a = base + y * W1 + x; g.tri(a, a + 1, a + W1); g.tri(a + 1, a + W1 + 1, a + W1); }
    // side skirts on silhouette edges to avoid see-through
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      if (!cov[y * gw + x]) continue;
      const a = y * W1 + x, b = base + y * W1 + x;
      if (x === 0 || !cov[y * gw + x - 1]) { g.tri(a, b, a + W1); g.tri(a + W1, b, b + W1); }
      if (x === gw - 1 || !cov[y * gw + x + 1]) { g.tri(a + 1, a + W1 + 1, b + 1); g.tri(a + W1 + 1, b + W1 + 1, b + 1); }
      if (y === 0 || !cov[(y - 1) * gw + x]) { g.tri(a, a + 1, b); g.tri(a + 1, b + 1, b); }
      if (y === gh - 1 || !cov[(y + 1) * gw + x]) { g.tri(a + W1, b + W1, a + W1 + 1); g.tri(a + W1 + 1, b + W1, b + W1 + 1); }
    }
    return { geo: g, albedo: cv, emis: emc, aspect };
  }

  // ----------------------------------------------------------- render target
  function makeRT(gl, w, h, o = {}) {
    const rt = { w, h, fbo: gl.createFramebuffer(), tex: null, depth: null, depthTex: null };
    gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo);
    if (!o.depthOnly) {
      rt.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, rt.tex);
      const fmt = o.float ? gl.RGBA16F : gl.RGBA8;
      gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, gl.RGBA, o.float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rt.tex, 0);
    }
    if (o.depthOnly) {
      rt.depthTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, rt.depthTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, rt.depthTex, 0);
      gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    } else if (o.depth) {
      rt.depth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rt.depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rt.depth);
    }
    rt.ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return rt;
  }
  function freeRT(gl, rt) { if (!rt) return; gl.deleteFramebuffer(rt.fbo); if (rt.tex) gl.deleteTexture(rt.tex); if (rt.depth) gl.deleteRenderbuffer(rt.depth); if (rt.depthTex) gl.deleteTexture(rt.depthTex); }

  G.GL3D = { M, Prog, Geo, Mesh, texFromImage, inflateSprite, makeRT, freeRT, STRIDE };
})(window);
