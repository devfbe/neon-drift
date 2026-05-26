// Web Audio engine: FFT analysis + synthesized placeholder beat + file loader.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.freq = null;
    this.levels = { bass: 0, mid: 0, treble: 0, beat: 0, drop: 0 };
    this._bassAvg = 0;
    this._beat = 0;
    this._prevSpectrum = null;
    this._fluxAvg = 0;
    this._drop = 0;
    this._placeholder = null;   // { timer }
    this._source = null;        // active file BufferSource
    this.trackName = null;
  }

  async start() {
    if (this.ctx) { await this.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    await this.ctx.resume();

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.analyser.connect(this.master);
    this.master.connect(this.ctx.destination);

    // default to the baked-in track; only fall back to the synth beat if it fails
    try {
      await this._loadDefaultTrack();
    } catch (e) {
      console.warn("Default-Track nicht ladbar, nutze Synth-Beat:", e);
      this._startPlaceholder();
    }
  }

  async _loadDefaultTrack() {
    const res = await fetch("./assets/track.ogg");
    if (!res.ok) throw new Error("track.ogg HTTP " + res.status);
    const audioBuf = await this.ctx.decodeAudioData(await res.arrayBuffer());
    const src = this.ctx.createBufferSource();
    src.buffer = audioBuf;
    src.loop = true;
    src.connect(this.analyser);
    src.start();
    this._source = src;
    this.trackName = "Polar Byte Drift";
  }

  // ---- synthesized placeholder: 125 BPM 4/4 with kick, hat and bass synth ----
  _startPlaceholder() {
    const bpm = 125, spb = 60 / bpm;
    let step = 0;
    let nextTime = this.ctx.currentTime + 0.1;
    const lookahead = () => {
      while (nextTime < this.ctx.currentTime + 0.2) {
        this._scheduleStep(step, nextTime);
        nextTime += spb / 2;   // eighth notes
        step = (step + 1) % 8;
      }
    };
    this._placeholder = { timer: setInterval(lookahead, 25) };
  }

  _scheduleStep(step, t) {
    const ctx = this.ctx;
    // kick on every quarter (even eighths)
    if (step % 2 === 0) this._kick(t);
    // hat on offbeats
    if (step % 2 === 1) this._hat(t);
    // bass synth: simple pattern
    const notes = [55, 0, 55, 65, 49, 0, 55, 73]; // Hz, 0 = rest
    if (notes[step]) this._bass(t, notes[step]);
  }

  _kick(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    g.gain.setValueAtTime(1.0, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g); g.connect(this.analyser);
    o.start(t); o.stop(t + 0.22);
  }

  _hat(t) {
    const ctx = this.ctx;
    const len = 0.05, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.connect(hp); hp.connect(g); g.connect(this.analyser);
    src.start(t);
  }

  _bass(t, hz) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600;
    o.type = "sawtooth"; o.frequency.value = hz;
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(lp); lp.connect(g); g.connect(this.analyser);
    o.start(t); o.stop(t + 0.3);
  }

  _stopPlaceholder() {
    if (this._placeholder) { clearInterval(this._placeholder.timer); this._placeholder = null; }
  }

  // ---- load a user track, replacing the placeholder ----
  async loadFile(file) {
    if (!this.ctx) await this.start();
    const buf = await file.arrayBuffer();
    const audioBuf = await this.ctx.decodeAudioData(buf);
    this._stopPlaceholder();
    if (this._source) { try { this._source.stop(); } catch (e) {} }
    const src = this.ctx.createBufferSource();
    src.buffer = audioBuf;
    src.loop = true;
    src.connect(this.analyser);
    src.start();
    this._source = src;
    this.trackName = file.name;
  }

  getSpectrum(n) {
    const out = new Array(n).fill(0);
    if (!this.analyser) return out;
    this.analyser.getByteFrequencyData(this.freq);
    const bins = 256, per = Math.max(1, Math.floor(bins / n));
    for (let i = 0; i < n; i++) {
      let s = 0; for (let j = 0; j < per; j++) s += this.freq[i*per+j] || 0;
      out[i] = s / per / 255;
    }
    return out;
  }

  // ---- per-frame analysis ----
  getLevels() {
    if (!this.analyser) return this.levels;
    this.analyser.getByteFrequencyData(this.freq);
    const f = this.freq;
    const avg = (lo, hi) => {
      let s = 0; for (let i = lo; i < hi; i++) s += f[i];
      return s / (hi - lo) / 255;
    };
    const bass = avg(1, 8);
    const mid = avg(12, 60);
    const treble = avg(80, 300);

    // beat detection on bass energy vs running average
    this._bassAvg = this._bassAvg * 0.92 + bass * 0.08;
    if (bass > this._bassAvg * 1.35 && bass > 0.25) this._beat = 1.0;
    this._beat *= 0.86;

    // drop/onset detection via spectral flux (sum of positive bin changes)
    if (!this._prevSpectrum) this._prevSpectrum = new Uint8Array(f.length);
    let flux = 0;
    for (let i = 0; i < 256; i++) {
      const d = f[i] - this._prevSpectrum[i];
      if (d > 0) flux += d;
      this._prevSpectrum[i] = f[i];
    }
    flux /= 256 * 255;
    this._fluxAvg = this._fluxAvg * 0.95 + flux * 0.05;
    if (flux > this._fluxAvg * 2.2 && flux > 0.04) this._drop = 1.0;
    this._drop *= 0.90;

    // smooth bands
    const L = this.levels;
    L.bass = L.bass * 0.6 + bass * 0.4;
    L.mid = L.mid * 0.6 + mid * 0.4;
    L.treble = L.treble * 0.6 + treble * 0.4;
    L.beat = this._beat;
    L.drop = this._drop;
    return L;
  }
}
