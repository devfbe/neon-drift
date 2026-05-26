// WebGL2 renderer: scene -> feedback (motion-blur trails) -> post -> screen.
// Scene/feedback run at a scalable internal resolution; post upscales to screen.
import { VERT, DEMO_FRAG, FEEDBACK_FRAG, POST_FRAG } from "./shaders.js";

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
    this.scale = 1.0;

    this.demoProg = program(gl, VERT, DEMO_FRAG);
    this.feedbackProg = program(gl, VERT, FEEDBACK_FRAG);
    this.postProg = program(gl, VERT, POST_FRAG);
    this.vao = gl.createVertexArray();

    this.scene = this._makeTarget();   // current raw frame
    this.accA = this._makeTarget();    // accumulation ping-pong
    this.accB = this._makeTarget();
    this._cur = this.accA;
    this._prev = this.accB;

    this._locCache = new Map();
    this.resize();
  }

  _makeTarget() {
    const gl = this.gl;
    return { fbo: gl.createFramebuffer(), tex: gl.createTexture(), w: 0, h: 0 };
  }

  _sizeTarget(t, w, h) {
    const gl = this.gl;
    if (t.w === w && t.h === h) return;
    t.w = w; t.h = h;
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  setScale(s) { this.scale = Math.max(0.5, Math.min(1, s)); this.resize(true); }

  resize(force) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fw = Math.floor(this.canvas.clientWidth * dpr);
    const fh = Math.floor(this.canvas.clientHeight * dpr);
    const iw = Math.max(2, Math.floor(fw * this.scale));
    const ih = Math.max(2, Math.floor(fh * this.scale));
    if (!force && fw === this.fw && ih === this.iw) return;
    this.fw = fw; this.fh = fh; this.iw = iw; this.ih = ih;
    this.canvas.width = fw; this.canvas.height = fh;
    this._sizeTarget(this.scene, iw, ih);
    this._sizeTarget(this.accA, iw, ih);
    this._sizeTarget(this.accB, iw, ih);
  }

  _loc(prog, name) {
    const key = prog.__id + ":" + name;
    if (this._locCache.has(key)) return this._locCache.get(key);
    const l = this.gl.getUniformLocation(prog, name);
    this._locCache.set(key, l);
    return l;
  }

  setUniforms(u) { this._u = u; }

  _apply(prog, u) {
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
    const u = this._u || {};
    // tag programs once for the loc cache key
    this.demoProg.__id = "d"; this.feedbackProg.__id = "f"; this.postProg.__id = "p";
    gl.bindVertexArray(this.vao);

    // --- 1. scene -> scene fbo (internal res) ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fbo);
    gl.viewport(0, 0, this.iw, this.ih);
    gl.useProgram(this.demoProg);
    this._apply(this.demoProg, u);
    gl.uniform2f(this._loc(this.demoProg, "uRes"), this.iw, this.ih);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // --- 2. feedback: scene + prev -> cur accum ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._cur.fbo);
    gl.viewport(0, 0, this.iw, this.ih);
    gl.useProgram(this.feedbackProg);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.scene.tex);
    gl.uniform1i(this._loc(this.feedbackProg, "uScene"), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this._prev.tex);
    gl.uniform1i(this._loc(this.feedbackProg, "uPrev"), 1);
    gl.uniform2f(this._loc(this.feedbackProg, "uRes"), this.iw, this.ih);
    gl.uniform1f(this._loc(this.feedbackProg, "uTrail"), u.uTrail != null ? u.uTrail : 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // --- 3. post: cur accum -> screen (full res) ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.fw, this.fh);
    gl.useProgram(this.postProg);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this._cur.tex);
    gl.uniform1i(this._loc(this.postProg, "uScene"), 0);
    gl.uniform2f(this._loc(this.postProg, "uRes"), this.fw, this.fh);
    gl.uniform1f(this._loc(this.postProg, "uTime"), u.uTime || 0);
    gl.uniform1f(this._loc(this.postProg, "uBeat"), u.uBeat || 0);
    gl.uniform1f(this._loc(this.postProg, "uDof"), u.uDof || 0);
    gl.uniform1f(this._loc(this.postProg, "uCrt"), u.uCrt || 0);
    gl.uniform1f(this._loc(this.postProg, "uGlitch"), u.uGlitch || 0);
    gl.uniform1f(this._loc(this.postProg, "uDrop"), u.uDrop || 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // swap accumulation buffers
    const tmp = this._cur; this._cur = this._prev; this._prev = tmp;
  }
}
