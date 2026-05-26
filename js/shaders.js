// All GLSL sources for NEON DRIFT (WebGL2 / GLSL ES 3.00)

// Fullscreen triangle — no vertex buffers needed.
export const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// ---------------------------------------------------------------------------
// Main scene: neon-cyberpunk raymarcher with multiple weighted "scenes".
// Active scene(s) are selected by the director through the weight uniforms;
// only the active raymarch runs (gated by `if (weight > 0)`), so cost stays
// bounded even though many effects live in one shader.
//   background : parallax starfield + fbm nebula           (uStars / uNebula)
//   bubbles    : glassy SDF metaballs, slow gel wobble      (uBubbles)
//   tunnel     : analytic neon grid tunnel flight           (uTunnel)
//   mega       : giant rotating grid-sphere + ring          (uMega)
//   lasers     : additive beams                             (uLasers)
//   kaleido    : screen-space mirror fold over everything   (uKaleido)
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
uniform float uNebula;
uniform float uBubbles;
uniform float uLasers;
uniform float uStars;
uniform float uTunnel;
uniform float uWorm;
uniform float uMega;
uniform float uKaleido;
uniform float uFloor;
uniform float uFigures;
uniform float uCity;
uniform vec2  uMouse;
uniform float uDrop;
uniform float uCamSpeed;
uniform float uFade;

#define PI 3.14159265

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

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
  float fly = uTime * (0.9 + uCamSpeed*0.6);   // forward motion
  for(int i=0;i<8;i++){
    float t = 1.5 + float(i)*1.4;
    vec3 p = rd*t + vec3(sin(uTime*0.1)*1.5, cos(uTime*0.08)*1.0, fly);
    float d = fbm(p*0.55 + 12.0);
    d = pow(smoothstep(0.32, 0.95, d), 1.5);
    float m = fbm(p*0.3 - 4.0);
    vec3 tint = mix(vec3(1.0,0.15,0.85), vec3(0.15,0.85,1.0), smoothstep(0.3,0.7,m));
    acc += tint * d * (1.6/float(i+2));
  }
  acc *= 1.3 + uMid*1.6;
  return acc * uNebula;
}

vec3 background(vec3 rd){ return nebula(rd) + starfield(rd); }

// --- gel bubbles : SDF metaballs ------------------------------------------
float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}

float bubbleField(vec3 p){
  vec3 q = p;
  q.z += uTime * uCamSpeed;
  float cell = 8.0;                              // larger cell -> fewer bubbles
  float zid = floor(q.z / cell);
  q.z = mod(q.z, cell) - cell*0.5;

  float r = 0.3 * (0.85 + uBass*0.5 + uBeat*0.2);  // small, only gently audio-scaled
  float k = 0.35;                                  // keep bubbles distinct, not one blob
  float d = 1e9;
  for(int i=0;i<2;i++){                             // only two per cell
    vec3 rnd = hash33(vec3(zid, float(i)*7.0, 3.0)) - 0.5;
    float ph = uTime*0.13 + float(i)*2.1 + zid;     // very slow lava-lamp drift
    vec3 off = vec3(
      rnd.x*3.0 + sin(ph)*0.6,
      rnd.y*2.4 + cos(ph*1.1)*0.6,
      rnd.z*1.5);
    float rr = r * (0.7 + 0.5*hash11(zid*13.0+float(i)));
    d = smin(d, length(q - off) - rr, k);
  }
  // slow, gel-like surface wobble
  d += 0.04 * sin(p.x*3.5 + uTime*0.18) * sin(p.y*3.5 + uTime*0.24);
  return d;
}

vec3 bubbleNormal(vec3 p){
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(
    bubbleField(p+e.xyy) - bubbleField(p-e.xyy),
    bubbleField(p+e.yxy) - bubbleField(p-e.yxy),
    bubbleField(p+e.yyx) - bubbleField(p-e.yyx)));
}

// --- mega structure : giant rotating grid-sphere + neon ring --------------
float megaField(vec3 wp){
  vec3 p = wp - vec3(0.0, 0.0, 9.0);
  p.xz *= rot(uTime*0.14);
  p.xy *= rot(uTime*0.06);
  float core = length(p) - 3.0;
  float ring = 1e9;
  for(int i=0;i<3;i++){
    vec3 rp = p;
    rp.yz *= rot(float(i)*1.0472);            // 60deg apart
    float rad = 4.6 + float(i)*0.5;
    vec2 q = vec2(length(rp.xz)-rad, rp.y);
    ring = min(ring, length(q)-0.12);
  }
  float moons = 1e9;
  for(int i=0;i<4;i++){
    float a = uTime*0.5 + float(i)*1.5708;
    vec3 m = vec3(cos(a)*6.0, sin(a*1.3)*1.5, sin(a)*6.0);
    moons = min(moons, length(p-m)-0.5);
  }
  return min(min(core, ring), moons);
}
vec3 megaNormal(vec3 p){
  vec2 e = vec2(0.004, 0.0);
  return normalize(vec3(
    megaField(p+e.xyy) - megaField(p-e.xyy),
    megaField(p+e.yxy) - megaField(p-e.yxy),
    megaField(p+e.yyx) - megaField(p-e.yyx)));
}
// recompute the rotated object-space point + which primitive is nearest
void megaParts(vec3 wp, out vec3 op, out float matId){
  vec3 p = wp - vec3(0.0, 0.0, 9.0);
  p.xz *= rot(uTime*0.14); p.xy *= rot(uTime*0.06);
  op = p;
  float core = length(p) - 3.0;
  float ring = 1e9;
  for(int i=0;i<3;i++){ vec3 rp=p; rp.yz*=rot(float(i)*1.0472);
    vec2 q=vec2(length(rp.xz)-(4.6+float(i)*0.5), rp.y); ring=min(ring,length(q)-0.12); }
  float moons=1e9;
  for(int i=0;i<4;i++){ float a=uTime*0.5+float(i)*1.5708;
    vec3 m=vec3(cos(a)*6.0,sin(a*1.3)*1.5,sin(a)*6.0); moons=min(moons,length(p-m)-0.5); }
  matId = core<ring ? (core<moons?1.0:3.0) : (ring<moons?2.0:3.0);
}

vec3 megaColor(vec3 ro, vec3 rd, out float alpha){
  alpha = 0.0;
  float t = 4.0;
  bool hit = false;
  for(int i=0;i<90;i++){
    vec3 p = ro + rd*t;
    float d = megaField(p);
    if(d < 0.002){ hit = true; break; }
    t += d*0.7;
    if(t > 22.0) break;
  }
  if(!hit) return vec3(0.0);
  vec3 wp = ro + rd*t;
  vec3 n = megaNormal(wp);
  vec3 op; float matId; megaParts(wp, op, matId);
  float fres = pow(clamp(1.0 - dot(n, -rd), 0.0, 1.0), 3.0);
  vec3 col;
  if(matId < 1.5){
    vec3 ln = normalize(op);
    float lat = asin(clamp(ln.y,-1.0,1.0)), lon = atan(ln.z, ln.x);
    float grid = pow(1.0 - min(abs(sin(lat*12.0)), abs(sin(lon*12.0))), 22.0);
    float panel = pow(1.0 - min(abs(sin(lat*40.0)), abs(sin(lon*40.0))), 40.0)*0.4;
    vec3 tint = mix(vec3(0.1,0.9,1.0), vec3(1.0,0.1,0.8), 0.5+0.5*sin(lon*2.0+uTime*0.4));
    float corePulse = (0.4 + 0.6*uBeat) * pow(fres, 1.5);
    col = tint*(grid*2.2 + panel) + tint*fres*1.6 + tint*corePulse + vec3(0.03,0.0,0.07);
  } else if(matId < 2.5){
    col = mix(vec3(1.0,0.2,0.9), vec3(0.2,1.0,1.0), 0.5+0.5*sin(uTime))*(2.6+uBeat*1.5);
  } else {
    col = vec3(0.6,0.95,1.0)*3.0;   // moons: bright emissive
  }
  alpha = 1.0;
  return col;
}

// --- figure flight : fly forward through an endless lattice of neon shapes -
float sdBox(vec3 p, vec3 b){ vec3 d = abs(p)-b; return length(max(d,0.0)) + min(max(d.x,max(d.y,d.z)),0.0); }

// one varied, slowly rotating figure per 3D cell
float figureField(vec3 wp){
  float cell = 4.0;
  vec3 id = floor(wp/cell);
  vec3 q = mod(wp, cell) - cell*0.5;
  q -= (hash33(id) - 0.5) * 1.3;            // jitter inside the cell
  float h = hash13(id);
  q.xy *= rot(uTime*0.3 + h*6.2831);
  q.yz *= rot(uTime*0.2 + h*3.1416);
  float size = 0.55 + h*0.55;
  float ft = floor(h*5.0);
  float d;
  if(ft < 1.0)      d = length(q) - size*0.65;                                  // sphere
  else if(ft < 2.0) d = sdBox(q, vec3(size*0.5));                               // box
  else if(ft < 3.0){ vec2 cc = vec2(length(q.xz)-size*0.6, q.y); d = length(cc)-size*0.2; } // torus
  else if(ft < 4.0) d = (abs(q.x)+abs(q.y)+abs(q.z) - size*0.95)*0.57;          // octahedron
  else              d = (abs(q.x)+abs(q.y)+abs(q.z)*0.5 - size*0.8)*0.5;        // diamond/crystal
  return d;
}
vec3 figureNormal(vec3 p){
  vec2 e = vec2(0.005, 0.0);
  return normalize(vec3(
    figureField(p+e.xyy) - figureField(p-e.xyy),
    figureField(p+e.yxy) - figureField(p-e.yxy),
    figureField(p+e.yyx) - figureField(p-e.yyx)));
}
// banking forward-flight ray for a scene; sd seeds a different path per scene, cp returns the camera position
vec3 flightRay(vec2 uv, float spd, float sd, out vec3 cp){
  cp = vec3(sin((uTime+sd)*0.25)*3.0, sin((uTime+sd)*0.19)*2.2, uTime*spd);
  vec3 ct = vec3(sin((uTime+sd+0.6)*0.25)*3.0, sin((uTime+sd+0.6)*0.19)*2.2, uTime*spd+5.0);
  vec3 fwd = normalize(ct-cp);
  vec3 rt = normalize(cross(vec3(0,1,0), fwd));
  vec3 up = cross(fwd, rt);
  return normalize(fwd*1.4 + rt*(uv.x+uMouse.x*0.3) + up*(uv.y+uMouse.y*0.3));
}
vec3 figureFlight(vec2 uv){
  // banking camera weaving forward through the lattice
  vec3 cp; vec3 rd = flightRay(uv, 4.5, 0.0, cp);

  float t = 0.0; bool hit = false;
  for(int i=0;i<90;i++){
    float d = figureField(cp + rd*t);
    if(d < 0.002){ hit = true; break; }
    t += d*0.8;
    if(t > 42.0) break;
  }
  // distant nebular glow when nothing is hit
  vec3 ambient = mix(vec3(0.08,0.02,0.12), vec3(0.02,0.06,0.12), 0.5+0.5*sin(uv.x*3.0+uTime));
  if(!hit) return ambient*0.6;

  vec3 p = cp + rd*t;
  vec3 n = figureNormal(p);
  float fres = pow(clamp(1.0 - dot(n, -rd), 0.0, 1.0), 3.0);
  vec3 id = floor(p/4.0);
  float h = hash13(id);
  // neon-cyberpunk palette: magenta <-> cyan, occasional violet accent
  vec3 tint = mix(vec3(1.0,0.12,0.7), vec3(0.15,0.85,1.0), h);
  tint = mix(tint, vec3(0.6,0.2,1.0), smoothstep(0.45,0.55,h)*0.6);
  float diff = max(dot(n, normalize(vec3(0.5,0.7,-0.4))), 0.0);
  float fog = exp(-t*0.045);
  // glowing neon: dark faces, bright fresnel edges, subtle diffuse
  vec3 col = tint*(0.12 + fres*2.8 + uBeat*0.5) + tint*diff*0.25;
  return col*fog + ambient*fog;
}

// --- city flyover : fly low over a neon city of buildings ------------------
// buildings on a grid; streets are at cell boundaries; camera flies along a street
float cityField(vec3 p){
  float cell = 6.0;
  vec2 id = floor(p.xz/cell);
  vec2 q = mod(p.xz, cell) - cell*0.5;
  float h = hash13(vec3(id, 1.0));
  float height = 3.0 + h*9.0;
  // building footprint 2.0x2.0, centered in the 6-unit cell (2-unit street gap)
  vec3 bc = vec3(abs(q.x) - 2.0, abs(p.y - height*0.5) - height*0.5, abs(q.y) - 2.0);
  return length(max(bc,0.0)) + min(max(bc.x,max(bc.y,bc.z)),0.0);
}
vec3 cityNormal(vec3 p){ vec2 e=vec2(0.01,0.0); return normalize(vec3(
  cityField(p+e.xyy)-cityField(p-e.xyy), cityField(p+e.yxy)-cityField(p-e.yxy),
  cityField(p+e.yyx)-cityField(p-e.yyx))); }
vec3 cityFlight(vec2 uv){
  // camera flies straight along the street (x=0, z advances with time)
  // gentle banking based on uMouse for interactivity
  float spd = 5.0;
  vec3 cp = vec3(0.0, 4.0, uTime*spd);
  vec3 fwd = normalize(vec3(uMouse.x*0.2, uMouse.y*0.1 - 0.05, 1.0));
  vec3 rt = normalize(cross(vec3(0,1,0), fwd));
  vec3 up = cross(fwd, rt);
  vec3 rd = normalize(fwd*1.4 + rt*uv.x + up*uv.y);
  float t=0.0; bool hit=false;
  for(int i=0;i<96;i++){ float d=cityField(cp+rd*t); if(d<0.003){hit=true;break;} t+=d*0.8; if(t>80.0)break; }
  // dark purple-to-black sky gradient
  float skyT = clamp(uv.y*0.8+0.5, 0.0, 1.0);
  vec3 sky = mix(vec3(0.12,0.01,0.18), vec3(0.0,0.0,0.02), skyT);
  if(!hit) return sky;
  vec3 p=cp+rd*t; vec3 n=cityNormal(p);
  // windows: lit rectangular patches; use the tangential coord for horizontal tiling
  // for X-facing walls (side walls) horizontal axis is Z; for Z-facing walls it is X
  float horiz = abs(n.x) > 0.5 ? p.z : p.x;
  float win = step(0.55, fract(p.y*1.2)) * step(0.55, fract(horiz*1.0));
  vec3 tint = mix(vec3(1.0,0.2,0.7), vec3(0.2,0.8,1.0), hash13(vec3(floor(p.xz/6.0), 0.0)));
  float fog = exp(-t*0.04);
  // dark building body + emissive windows
  vec3 face = tint * (win * 2.0 + 0.04) + vec3(0.01,0.0,0.03);
  return face * fog;
}

// --- outrun grid floor + neon sun -----------------------------------------
vec3 floorScene(vec2 uv, vec3 ro, vec3 rd){
  vec3 col = vec3(0.0);
  // synthwave sun: disc with horizontal scanline gaps in the lower half
  vec2 sp = uv - vec2(0.0, 0.16);
  float sd = length(vec2(sp.x, sp.y*1.05));
  float disc = smoothstep(0.40, 0.385, sd);
  float bands = step(0.0, sin(uv.y*70.0));
  float bandMask = mix(1.0, bands, smoothstep(0.16, -0.02, uv.y));
  vec3 sunCol = mix(vec3(1.0,0.9,0.25), vec3(1.0,0.12,0.6), smoothstep(-0.2,0.4,uv.y));
  col += disc*bandMask*sunCol*(1.5 + uDrop*1.5);
  col += sunCol*pow(max(0.0,1.0-sd*1.25),3.0)*0.5;          // glow halo
  // receding neon grid floor
  if(rd.y < -0.002){
    float t = (-1.0 - ro.y)/rd.y;
    vec3 p = ro + rd*t;
    float gz = abs(fract(p.z*0.4 + uTime*2.0) - 0.5);
    float gx = abs(fract(p.x*0.4) - 0.5);
    float lz = smoothstep(0.05, 0.0, gz);
    float lx = smoothstep(0.05, 0.0, gx);
    float fog = exp(-t*0.03);
    col += (vec3(0.2,0.9,1.0)*lz + vec3(1.0,0.12,0.8)*lx) * fog * 1.3;
  }
  return col;
}

// --- neon tunnel (analytic) -----------------------------------------------
vec3 tunnel(vec2 uv){
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  float depth = 0.5/(r+0.06) + uTime*0.8;
  float ring = abs(fract(depth*1.5) - 0.5)*2.0;
  float ang  = abs(fract(a/PI*6.0) - 0.5)*2.0;
  float grid = pow(1.0-ring, 14.0) + pow(1.0-ang, 14.0);
  vec3 tint = mix(vec3(1.0,0.1,0.8), vec3(0.1,0.9,1.0), 0.5+0.5*sin(depth*0.6 + a));
  float fade = smoothstep(0.0, 0.45, r);
  vec3 col = tint*grid*fade*(1.7 + uBeat*1.2) + tint*0.05*fade;
  // far light at the vanishing point
  col += vec3(0.4,0.7,1.0) * pow(max(0.0, 1.0 - r*1.6), 4.0) * 0.6;
  return col;
}

// --- wormhole flight (analytic) -------------------------------------------
vec3 wormholeFlight(vec2 uv){
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  float depth = 1.2/(r+0.05) + uTime*1.2;
  a += depth*0.25 + sin(uTime*0.5)*0.6;          // twist
  float rings = pow(1.0-abs(fract(depth*1.2)-0.5)*2.0, 12.0);
  float spokes = pow(1.0-abs(fract(a/3.14159*8.0)-0.5)*2.0, 10.0);
  vec3 tint = mix(vec3(0.7,0.1,1.0), vec3(0.1,0.9,1.0), 0.5+0.5*sin(depth*0.5+a));
  float fade = smoothstep(0.0, 0.5, r);
  vec3 col = tint*(rings+spokes)*fade*1.8;
  col += vec3(0.6,0.4,1.0)*pow(max(0.0,1.0-r*1.5),5.0)*(0.8+uBeat); // blazing center
  return col;
}

// --- lasers ----------------------------------------------------------------
float rayLineDist(vec3 ro, vec3 rd, vec3 a, vec3 u){
  vec3 w0 = ro - a;
  float b = dot(rd, u), d = dot(rd, w0), e = dot(u, w0);
  float den = max(1.0 - b*b, 1e-4);
  float sc = (b*e - d)/den, tc = (e - b*d)/den;
  return length((ro + max(sc,0.0)*rd) - (a + tc*u));
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
    float fire = smoothstep(0.3, 0.9, sin(t*3.0)*0.5+0.5);
    col += tint * glow * fire;
  }
  return col;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;

  // kaleidoscope mirror fold (mirrors the whole scene into a mandala)
  if(uKaleido > 0.001){
    float a = atan(uv.y, uv.x) + uTime*0.05;
    float r = length(uv);
    float seg = 6.2831853/6.0;
    a = mod(a, seg); a = abs(a - seg*0.5);
    vec2 ku = vec2(cos(a), sin(a)) * r;
    uv = mix(uv, ku, uKaleido);
  }

  vec3 ro = vec3(0.0);
  vec3 rd = normalize(vec3(uv, 1.25));
  float sw = uTime*0.2;
  float ca = cos(sw*0.5)*0.05, sa = sin(sw*0.5)*0.05;
  rd.xy = rot(sa) * rd.xy;
  rd.xz = rot(ca) * rd.xz;
  // mouse parallax tilt
  rd.xy += uMouse*0.07;
  rd = normalize(rd);

  vec3 color = background(rd);

  // figure flight: fly forward through a field of neon shapes
  if(uFigures > 0.001){
    vec3 ff = figureFlight(uv) + background(rd)*0.15;
    color = mix(color, ff, uFigures);
  }

  if(uCity > 0.001){ color = mix(color, cityFlight(uv) + background(rd)*0.1, uCity); }

  // outrun grid floor + neon sun
  if(uFloor > 0.001){
    vec3 fc = floorScene(uv, ro, rd) + background(rd)*0.3;
    color = mix(color, fc, uFloor);
  }

  // neon tunnel
  if(uTunnel > 0.001){
    vec3 tc = tunnel(uv) + background(rd)*0.25;
    color = mix(color, tc, uTunnel);
  }

  // wormhole flight
  if(uWorm > 0.001){ color = mix(color, wormholeFlight(uv), uWorm); }

  // gel bubbles
  if(uBubbles > 0.001){
    float t = 0.0; float hit = -1.0;
    for(int i=0;i<80;i++){
      float d = bubbleField(ro + rd*t);
      if(d < 0.001){ hit = t; break; }
      t += d*0.85;
      if(t > 18.0) break;
    }
    if(hit > 0.0){
      vec3 p = ro + rd*hit;
      vec3 n = bubbleNormal(p);
      float fres = pow(clamp(1.0 - dot(n, -rd), 0.0, 1.0), 3.0);
      // clear glass: see straight through to the refracted background
      vec3 refr = refract(rd, n, 0.86);
      vec3 behind = background(normalize(refr + rd*0.2));
      vec3 spec = vec3(1.0) * pow(max(dot(reflect(rd,n), normalize(vec3(0.4,0.6,-1.0))),0.0), 80.0);
      // colourless gel: refraction + faint cool rim (fresnel) + tight white glint
      vec3 rim = vec3(0.85, 0.95, 1.0);
      vec3 glass = behind + fres*rim*0.9 + spec*1.8;
      color = mix(color, glass, uBubbles);
    }
  }

  // giant mega structure
  if(uMega > 0.001){
    float alpha;
    vec3 mc = megaColor(ro, rd, alpha);
    color = mix(color, mc, uMega*alpha);
  }

  // additive lasers
  color += lasers(ro, rd);

  // drop flash
  color += uDrop*0.12;

  color *= uFade;
  color = 1.0 - exp(-color*1.3);
  fragColor = vec4(color, 1.0);
}`;

// ---------------------------------------------------------------------------
// Feedback pass: blend the current frame with the (slightly zoomed) previous
// accumulation buffer for light-trail motion blur.
// ---------------------------------------------------------------------------
export const FEEDBACK_FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform sampler2D uScene;
uniform sampler2D uPrev;
uniform vec2  uRes;
uniform float uTrail;   // 0..1 persistence of previous frame
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 scene = texture(uScene, uv).rgb;
  vec3 prev = texture(uPrev, (uv-0.5)*0.996 + 0.5).rgb;   // subtle pull to centre
  fragColor = vec4(max(scene, prev*uTrail), 1.0);
}`;

// ---------------------------------------------------------------------------
// Post pass: bloom + chromatic aberration + vignette + film grain.
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

  float ca = (0.0025 + uBeat*0.006) * length(center);
  vec3 base;
  base.r = texture(uScene, uv + center*ca).r;
  base.g = texture(uScene, uv).g;
  base.b = texture(uScene, uv - center*ca).b;

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
  col *= smoothstep(1.15, 0.35, length(center));
  float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)) + uTime*60.0) * 43758.5453);
  col += (g-0.5)*0.04;
  fragColor = vec4(col, 1.0);
}`;
