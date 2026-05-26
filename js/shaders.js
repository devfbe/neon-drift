// All GLSL sources for NEON DRIFT (WebGL2 / GLSL ES 3.00)

// Fullscreen triangle — no vertex buffers needed.
export const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// ---------------------------------------------------------------------------
// Main scene: neon-cyberpunk raymarcher.
//  - analytic background: parallax starfield + fbm nebula
//  - SDF metaball "gel bubbles" (glassy, fresnel, refraction) raymarched in front
//  - additive laser beams
// Driven entirely by uniforms (time + audio + per-part weights).
// ---------------------------------------------------------------------------
export const DEMO_FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  uRes;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uBeat;
uniform float uNebula;   // 0..1 nebula presence
uniform float uBubbles;  // 0..1 bubble presence
uniform float uLasers;   // 0..1 laser presence
uniform float uStars;    // 0..1 starfield presence
uniform float uCamSpeed; // flight speed
uniform float uFade;     // global fade (intro / loop)

#define PI 3.14159265

// --- hashing / noise -------------------------------------------------------
float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash13(vec3 p){
  p = fract(p*0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
vec3 hash33(vec3 p){
  p = fract(p*vec3(0.1031,0.1030,0.0973));
  p += dot(p, p.yxz+33.33);
  return fract((p.xxy+p.yxx)*p.zyx);
}
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x);
  f = f*f*(3.0-2.0*f);
  float n000=hash13(i+vec3(0,0,0)), n100=hash13(i+vec3(1,0,0));
  float n010=hash13(i+vec3(0,1,0)), n110=hash13(i+vec3(1,1,0));
  float n001=hash13(i+vec3(0,0,1)), n101=hash13(i+vec3(1,0,1));
  float n011=hash13(i+vec3(0,1,1)), n111=hash13(i+vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),
             mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y), f.z);
}
float fbm(vec3 p){
  float a=0.5, s=0.0;
  for(int i=0;i<5;i++){ s += a*noise(p); p*=2.02; a*=0.5; }
  return s;
}

// --- background: stars + nebula -------------------------------------------
vec3 starfield(vec3 rd){
  vec3 col = vec3(0.0);
  // layered parallax grids
  for(int L=0; L<3; L++){
    float scale = 60.0 + float(L)*90.0;
    vec3 p = rd*scale + vec3(0.0,0.0,uTime*(0.6+float(L)*0.4));
    vec3 c = floor(p);
    vec3 h = hash33(c + float(L)*17.0);
    if(h.x > 0.88){
      vec3 fp = fract(p)-0.5;
      float d = length(fp - (h.yzx-0.5)*0.7);
      float tw = 0.6 + 0.4*sin(uTime*3.0 + h.y*30.0);
      float star = smoothstep(0.08, 0.0, d) * tw;
      vec3 tint = mix(vec3(0.6,0.9,1.0), vec3(1.0,0.6,1.0), h.z);
      col += tint * star * (1.1 + 0.7*float(2-L));
    }
  }
  return col * uStars;
}

vec3 nebula(vec3 rd){
  vec3 acc = vec3(0.0);
  // a few depth slices sampled along the view direction (cheap volumetric look)
  for(int i=0;i<6;i++){
    float t = 2.0 + float(i)*1.6;
    vec3 p = rd*t + vec3(0.0,0.0, uTime*0.25);
    float d = fbm(p*0.6 + 12.0);
    d = pow(smoothstep(0.32, 0.95, d), 1.5);
    // two-tone magenta/cyan mixing
    float m = fbm(p*0.3 - 4.0);
    vec3 tint = mix(vec3(1.0,0.15,0.85), vec3(0.15,0.85,1.0), smoothstep(0.3,0.7,m));
    acc += tint * d * (1.7/float(i+2));
  }
  acc *= 1.35 + uMid*1.6;
  return acc * uNebula;
}

vec3 background(vec3 rd){
  return nebula(rd) + starfield(rd);
}

// --- gel bubbles : SDF metaballs ------------------------------------------
float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}

float bubbleField(vec3 p){
  // flow the field toward the camera
  vec3 q = p;
  q.z += uTime * uCamSpeed;
  float cell = 5.0;
  float zid = floor(q.z / cell);
  q.z = mod(q.z, cell) - cell*0.5;

  float r = 0.55 * (0.75 + uBass*1.1 + uBeat*0.35);
  float k = 0.7;
  float d = 1e9;
  // three wobbling balls per cell
  for(int i=0;i<3;i++){
    vec3 rnd = hash33(vec3(zid, float(i)*7.0, 3.0)) - 0.5;
    float ph = uTime*0.8 + float(i)*2.1 + zid;
    vec3 off = vec3(
      rnd.x*2.6 + sin(ph)*0.8,
      rnd.y*2.0 + cos(ph*1.3)*0.8,
      rnd.z*1.2);
    float rr = r * (0.7 + 0.6*hash11(zid*13.0+float(i)));
    float ds = length(q - off) - rr;
    d = smin(d, ds, k);
  }
  // gentle surface wobble
  d += 0.06 * sin(p.x*4.0 + uTime) * sin(p.y*4.0 + uTime*1.3);
  return d;
}

vec3 calcNormal(vec3 p){
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(
    bubbleField(p+e.xyy) - bubbleField(p-e.xyy),
    bubbleField(p+e.yxy) - bubbleField(p-e.yxy),
    bubbleField(p+e.yyx) - bubbleField(p-e.yyx)));
}

// --- lasers ----------------------------------------------------------------
// distance from ray origin/dir to an infinite line (point a, dir u)
float rayLineDist(vec3 ro, vec3 rd, vec3 a, vec3 u){
  vec3 w0 = ro - a;
  float b = dot(rd, u);
  float d = dot(rd, w0);
  float e = dot(u, w0);
  float den = 1.0 - b*b;
  den = max(den, 1e-4);
  float sc = (b*e - d) / den;       // along ray
  float tc = (e - b*d) / den;       // along line
  vec3 pc = ro + max(sc,0.0)*rd;
  vec3 qc = a + tc*u;
  return length(pc - qc);
}

vec3 lasers(vec3 ro, vec3 rd){
  vec3 col = vec3(0.0);
  float pulse = uLasers * (0.35 + uTreble*1.6 + uBeat*0.8);
  for(int i=0;i<5;i++){
    float fi = float(i);
    float t = uTime*1.4 + fi*1.7;
    vec3 a = vec3(sin(t*0.7+fi)*3.0, cos(t*0.9+fi*2.0)*2.0, 6.0 + sin(t)*2.0);
    vec3 u = normalize(vec3(sin(t*1.3+fi), cos(t*1.1+fi*3.0), 0.25));
    float dist = rayLineDist(ro, rd, a, u);
    float glow = pulse * 0.015 / (dist*dist + 0.0006);
    vec3 tint = mix(vec3(1.0,0.1,0.8), vec3(0.2,1.0,1.0), fract(fi*0.37));
    // flicker so beams fire in bursts
    float fire = smoothstep(0.3, 0.9, sin(t*3.0)*0.5+0.5);
    col += tint * glow * fire;
  }
  return col;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;

  // camera with subtle sway
  vec3 ro = vec3(0.0, 0.0, 0.0);
  vec3 rd = normalize(vec3(uv, 1.25));
  float sw = uTime*0.2;
  float ca = cos(sw*0.5)*0.05, sa = sin(sw*0.5)*0.05;
  rd.xy = mat2(cos(sa),-sin(sa),sin(sa),cos(sa)) * rd.xy;
  rd.xz = mat2(cos(ca),-sin(ca),sin(ca),cos(ca)) * rd.xz;

  vec3 bg = background(rd);
  vec3 color = bg;

  // raymarch the bubbles in front
  if(uBubbles > 0.001){
    float t = 0.0;
    float hit = -1.0;
    for(int i=0;i<80;i++){
      vec3 p = ro + rd*t;
      float d = bubbleField(p);
      if(d < 0.001){ hit = t; break; }
      t += d * 0.85;
      if(t > 18.0) break;
    }
    if(hit > 0.0){
      vec3 p = ro + rd*hit;
      vec3 n = calcNormal(p);
      float fres = pow(clamp(1.0 - dot(n, -rd), 0.0, 1.0), 3.0);
      // refracted background lookup
      vec3 refr = refract(rd, n, 0.86);
      vec3 behind = background(normalize(refr + rd*0.2));
      // neon body tint shifting over space/time
      vec3 body = mix(vec3(0.9,0.1,0.7), vec3(0.1,0.8,1.0),
                      0.5+0.5*sin(p.z*0.6 + uTime + p.x));
      vec3 spec = vec3(1.0) * pow(max(dot(reflect(rd,n), normalize(vec3(0.4,0.6,-1.0))),0.0), 40.0);
      vec3 glass = behind*0.7 + body*(0.35 + uBass*0.5) + fres*body*2.0 + spec*1.5;
      glass *= 0.6 + uBeat*0.6;
      float cover = uBubbles;
      color = mix(color, glass, cover);
    }
  }

  // additive lasers on top
  color += lasers(ro, rd);

  // tone + fade
  color *= uFade;
  color = 1.0 - exp(-color*1.3);            // soft tonemap
  fragColor = vec4(color, 1.0);
}`;

// ---------------------------------------------------------------------------
// Post pass: cheap bloom (thresholded radial taps) + chromatic aberration
// + vignette + film grain. Reads the scene texture rendered by DEMO_FRAG.
// ---------------------------------------------------------------------------
export const POST_FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform sampler2D uScene;
uniform vec2  uRes;
uniform float uTime;
uniform float uBeat;

float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 center = uv - 0.5;

  // chromatic aberration toward edges (kicks on beat)
  float ca = (0.0025 + uBeat*0.006) * length(center);
  vec3 base;
  base.r = texture(uScene, uv + center*ca).r;
  base.g = texture(uScene, uv).g;
  base.b = texture(uScene, uv - center*ca).b;

  // bloom: radial bright-pass taps
  vec3 bloom = vec3(0.0);
  float total = 0.0;
  const int N = 24;
  float radius = (2.2 + uBeat*2.0) / uRes.y;
  for(int i=0;i<N;i++){
    float a = float(i)/float(N) * 6.2831853;
    for(int r=1;r<=3;r++){
      vec2 off = vec2(cos(a),sin(a)) * radius * float(r) * 6.0;
      vec3 s = texture(uScene, uv + off).rgb;
      float b = max(luma(s)-0.55, 0.0);
      float w = 1.0/float(r);
      bloom += s*b*w; total += w;
    }
  }
  bloom /= max(total, 1.0);

  vec3 col = base + bloom*1.6;

  // vignette
  col *= smoothstep(1.15, 0.35, length(center));

  // film grain
  float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)) + uTime*60.0) * 43758.5453);
  col += (g-0.5)*0.04;

  fragColor = vec4(col, 1.0);
}`;
