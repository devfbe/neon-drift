// Minimal WebGL2 renderer: scene pass -> framebuffer -> post pass -> screen.
import { VERT, DEMO_FRAG, POST_FRAG } from "./shaders.js";

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    console.error("Shader compile error:\n" + log + "\n---\n" + src);
    throw new Error("Shader compile failed: " + log);
  }
  return s;
}

function program(gl, vsrc, fsrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vsrc));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fsrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error("Program link failed: " + gl.getProgramInfoLog(p));
  }
  return p;
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
    if (!gl) throw new Error("WebGL2 nicht verfügbar in diesem Browser.");
    this.canvas = canvas;
    this.gl = gl;

    this.demoProg = program(gl, VERT, DEMO_FRAG);
    this.postProg = program(gl, VERT, POST_FRAG);

    // empty VAO — the fullscreen triangle is generated from gl_VertexID
    this.vao = gl.createVertexArray();

    // offscreen target for the scene
    this.fbo = gl.createFramebuffer();
    this.tex = gl.createTexture();

    this._locCache = new Map();
    this.resize();
  }

  _loc(prog, name) {
    const key = (prog === this.demoProg ? "d:" : "p:") + name;
    if (this._locCache.has(key)) return this._locCache.get(key);
    const l = this.gl.getUniformLocation(prog, name);
    this._locCache.set(key, l);
    return l;
  }

  resize() {
    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(this.canvas.clientWidth * dpr);
    const h = Math.floor(this.canvas.clientHeight * dpr);
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.canvas.width = w; this.canvas.height = h;

    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // u: flat object of uniform name -> number/array (without uRes/uScene which we manage)
  setUniforms(u) { this._uniforms = u; }

  _applyUniforms(prog, u) {
    const gl = this.gl;
    for (const name in u) {
      const loc = this._loc(prog, name);
      if (loc === null) continue;
      const v = u[name];
      if (typeof v === "number") gl.uniform1f(loc, v);
      else if (v.length === 2) gl.uniform2f(loc, v[0], v[1]);
      else if (v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]);
      else if (v.length === 4) gl.uniform4f(loc, v[0], v[1], v[2], v[3]);
    }
  }

  render() {
    const gl = this.gl;
    const u = this._uniforms || {};
    const res = [this.w, this.h];
    gl.bindVertexArray(this.vao);

    // --- scene -> fbo ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(this.demoProg);
    this._applyUniforms(this.demoProg, u);
    gl.uniform2f(this._loc(this.demoProg, "uRes"), res[0], res[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // --- post -> screen ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(this.postProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this._loc(this.postProg, "uScene"), 0);
    gl.uniform2f(this._loc(this.postProg, "uRes"), res[0], res[1]);
    gl.uniform1f(this._loc(this.postProg, "uTime"), u.uTime || 0);
    gl.uniform1f(this._loc(this.postProg, "uBeat"), u.uBeat || 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
