# NEON DRIFT — Welle 2, Mega-Struktur & Durchflug Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Erweitere die NEON-DRIFT-Demo um echte Durchflug-Bewegung (Nebula-Flight, dynamischere Kamera), eine grandiosere Mega-Struktur, fünf neue Fantasiewelten, vier Polish-Effekte und eine an den Track gekoppelte Szenen-Choreografie.

**Architecture:** Reine WebGL2-Demo ohne Build-Step. Ein Fullscreen-Raymarching-Shader (`js/shaders.js`) rendert alle Szenen, gewichtet über Uniforms; `js/director.js` steuert die Timeline; `js/audio.js` liefert Audio-Analyse; `js/gl.js` fährt die Pipeline (Scene → Feedback → Post). Neue Szenen sind weitere `if(uWeight>0)`-Blöcke im Shader; neue Post-Effekte erweitern `POST_FRAG`; Choreo erweitert `audio.js` + `director.js`.

**Tech Stack:** HTML/CSS/Vanilla-JS (ES-Module), GLSL ES 3.00, Web Audio API. Keine Libraries, kein Build.

---

## Verifikations-Harness (statt Unit-Tests)

Visuals werden nicht mit pytest getestet, sondern per Headless-Chrome-Screenshot + Konsolen-Fehlercheck. Server muss laufen (`python3 -m http.server 8080`).

**Screenshot-Helfer** (in der Shell definieren):

```bash
CHROME=google-chrome-stable
shoot() {  # $1 = name, $2 = timeline-sekunde
  $CHROME --headless=new --use-gl=angle --use-angle=swiftshader \
    --enable-unsafe-swiftshader --ignore-gpu-blocklist --window-size=1280,720 \
    --hide-scrollbars --virtual-time-budget=5000 --no-sandbox \
    --enable-logging=stderr --v=0 \
    --screenshot="/tmp/nd-$1.png" \
    "http://127.0.0.1:8080/?autostart=1&t=$2" 2>/tmp/nd-$1.log
  echo "$1 (t=$2): $(ls -la /tmp/nd-$1.png | awk '{print $5}')b"
}
errcheck() {  # $1 = name -> prüft Shader-/JS-Fehler (Autoplay-Warnung ist ok)
  grep -iE "shader|compile|link failed|Uncaught" /tmp/nd-$1.log \
    | grep -viE "GL Driver|ReadPixels|swiftshader|stall" || echo "(keine Fehler)"
}
```

**Standard-Verify pro Task:** `shoot <name> <t>` ausführen, das PNG mit dem Read-Tool ansehen und gegen die im Task genannten Erwartungen prüfen, dann `errcheck <name>` (muss „keine Fehler" zeigen). Visuelles Feintuning ist iterativ: Parameter anpassen, neu screenshotten, bis es sitzt — das ist Teil des jeweiligen „Verify"-Schritts, kein separater Task.

---

## Aktueller Stand (Baseline)

9-Part-Timeline (178s) in `js/director.js`. Szenen-Uniforms im Shader: `uStars uNebula uBubbles uFigures uFloor uTunnel uMega uKaleido uLasers`. Audio liefert `bass mid treble beat drop`. Pipeline mit Feedback-Trails + Post (Bloom/CA/Vignette/Grain). Die Mega-Struktur (`megaField`/`megaColor` in `shaders.js`) ist eine rotierende Gitterkugel + ein Ring, Kamera statisch. Nebula (`nebula()`) wird analytisch in Blickrichtung gesampelt, ohne echte Vorwärtsbewegung.

Neue Uniforms, die dieser Plan einführt: `uWorld` (int/float Selektor für neue Welten ODER einzelne Gewichte je Welt), `uDof`, `uCrt`, `uSpectrum[…]` (EQ), `uSection` (Choreo). Konvention: **ein Gewichts-Uniform pro Szene** (wie bisher), gated mit `if(uX>0.001)`.

---

## Phase A — Durchflug & Mega-Grandeur

Liefert sofort spürbar mehr Bewegung + die imposantere Mega-Struktur. Unabhängig lauffähig.

### Task A1: Nebula als echter Vorwärts-Flug

**Files:**
- Modify: `js/shaders.js` (Funktion `nebula()` und der Aufruf in `background()`)

- [ ] **Step 1: `nebula()` auf eine entlang einer Flugachse marschierende Volumen-Akkumulation umstellen**

Ersetze die aktuelle `nebula(vec3 rd)` durch eine Version, die entlang `rd` mehrere Samples nimmt, deren Sample-Punkt aber mit der Zeit in +z verschoben wird, sodass Wolken auf die Kamera zukommen und vorbeiziehen (Parallaxe + Tiefe):

```glsl
vec3 nebula(vec3 rd){
  vec3 acc = vec3(0.0);
  float fly = uTime * (0.9 + uCamSpeed*0.6);   // Vorwärtsbewegung
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
```

- [ ] **Step 2: Verify** — `shoot nebulaflight 18` und `shoot nebulaflight2 22`. Erwartung: Wolken haben Tiefe und ziehen zwischen den beiden Zeitpunkten sichtbar vorbei (nicht statisch). `errcheck nebulaflight`. Falls zu schnell/langsam: `fly`-Faktor anpassen.

- [ ] **Step 3: Commit**

```bash
git add js/shaders.js && git commit -m "Nebula: true forward-flight through the cloud volume"
```

### Task A2: Mega-Struktur — Grandeur (Panels, Energiekern, Monde, mehrere Ringe)

**Files:**
- Modify: `js/shaders.js` (`megaField`, `megaParts`, `megaColor`)

- [ ] **Step 1: `megaField` um zwei zusätzliche Ringe und umlaufende Monde erweitern**

Ersetze den Body von `megaField` (die Distanzfunktion) durch:

```glsl
float megaField(vec3 wp){
  vec3 p = wp - vec3(0.0, 0.0, 9.0);
  p.xz *= rot(uTime*0.14);
  p.xy *= rot(uTime*0.06);
  float core = length(p) - 3.0;
  // drei Ringe in leicht gekippten Ebenen
  float ring = 1e9;
  for(int i=0;i<3;i++){
    vec3 rp = p;
    float a = float(i)*1.0472;            // 60° versetzt
    rp.yz *= rot(a);
    float rad = 4.6 + float(i)*0.5;
    vec2 q = vec2(length(rp.xz)-rad, rp.y);
    ring = min(ring, length(q)-0.12);
  }
  // vier umlaufende Monde
  float moons = 1e9;
  for(int i=0;i<4;i++){
    float a = uTime*0.5 + float(i)*1.5708;
    vec3 m = vec3(cos(a)*6.0, sin(a*1.3)*1.5, sin(a)*6.0);
    moons = min(moons, length(p-m)-0.5);
  }
  return min(min(core, ring), moons);
}
```

- [ ] **Step 2: `megaParts` synchron halten + Energiekern-Puls** — die Funktion `megaParts` muss dieselben Transforms benutzen und `matId` setzen (1=core, 2=ring, 3=moon). Passe sie an:

```glsl
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
```

- [ ] **Step 3: `megaColor` — Panel-Linien auf der Kugel + pulsierender Kern + Mond-Glow**

Im Sphere-Zweig (matId<1.5) zusätzlich feine Panel-Linien (zweite, feinere Gitterfrequenz) und einen zum Beat pulsierenden Kern-Glow nahe der Silhouette; neuer Zweig für matId≈3 (Monde, emissiv weiß-cyan):

```glsl
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
    col = vec3(0.6,0.95,1.0)*3.0;   // Monde: hell emissiv
  }
```

- [ ] **Step 4: Verify** — `shoot mega 122`. Erwartung: Gitterkugel mit feinen Panel-Linien, drei gekippte Ringe, vier helle Monde drumherum, Kern glüht. `errcheck mega`. Tuning: Anzahl/Radien der Ringe, Mond-Bahnen.

- [ ] **Step 5: Commit**

```bash
git add js/shaders.js && git commit -m "Mega structure: panels, pulsing core, triple rings, orbiting moons"
```

---

## Phase B — Neue Welten (Durchflug-Szenen)

Jede Welt ist ein eigener gewichteter Shader-Block mit eigenem Flug-Kamera-Pfad, analog zu `figureFlight`. Muster pro Welt: (1) `xField(vec3)` SDF + `xNormal`, (2) `xFlight(vec2 uv)` mit Banking-Kamera + Raymarch + Neon-Shading, (3) Uniform `uX`, (4) `if(uX>0.001)`-Block in `main()`, (5) Gewicht + Part in `director.js`. **Verallgemeinere die Banking-Kamera** aus `figureFlight` in einen Helfer, um DRY zu bleiben:

### Task B0: Kamera-Helfer extrahieren

**Files:**
- Modify: `js/shaders.js` (vor `figureFlight` einfügen; `figureFlight` darauf umstellen)

- [ ] **Step 1: Helfer hinzufügen**

```glsl
// banking forward-flight ray for scene with index seed `sd`
vec3 flightRay(vec2 uv, float spd, float sd, out vec3 cp){
  cp = vec3(sin((uTime+sd)*0.25)*3.0, sin((uTime+sd)*0.19)*2.2, uTime*spd);
  vec3 ct = vec3(sin((uTime+sd+0.6)*0.25)*3.0, sin((uTime+sd+0.6)*0.19)*2.2, uTime*spd+5.0);
  vec3 fwd = normalize(ct-cp);
  vec3 rt = normalize(cross(vec3(0,1,0), fwd));
  vec3 up = cross(fwd, rt);
  return normalize(fwd*1.4 + rt*(uv.x+uMouse.x*0.3) + up*(uv.y+uMouse.y*0.3));
}
```

- [ ] **Step 2: `figureFlight` darauf umstellen** — ersetze die manuelle Kamera-Berechnung in `figureFlight` durch `vec3 cp; vec3 rd = flightRay(uv, 4.5, 0.0, cp);`.

- [ ] **Step 3: Verify** — `shoot figrefactor 58`. Erwartung: identisch zu vorher (Figuren-Feld, Banking). `errcheck figrefactor`.

- [ ] **Step 4: Commit** — `git commit -am "Extract flightRay() banking-camera helper"`

### Task B1: City Flyover

**Files:** Modify `js/shaders.js`, `js/director.js`

- [ ] **Step 1: `cityField` + `cityFlight` einfügen** (Häuserblocks per 2D-Domain-Repetition, Höhe per Hash, Fensterlichter über Helligkeitsmodulation; tiefer Flug über den Dächern):

```glsl
float cityField(vec3 p){
  p.z += uTime*0.0;                      // city steht, Kamera fliegt
  vec2 cell = vec2(4.0, 4.0);
  vec2 id = floor(p.xz/cell);
  vec2 q = mod(p.xz, cell) - cell*0.5;
  float h = hash13(vec3(id, 1.0));
  float height = 1.0 + h*6.0;
  vec3 b = vec3(abs(q.x), p.y - (height-8.0), abs(q.y)) - vec3(1.4, height, 1.4);
  return length(max(b,0.0)) + min(max(b.x,max(b.y,b.z)),0.0);
}
vec3 cityNormal(vec3 p){ vec2 e=vec2(0.01,0.0); return normalize(vec3(
  cityField(p+e.xyy)-cityField(p-e.xyy), cityField(p+e.yxy)-cityField(p-e.yxy),
  cityField(p+e.yyx)-cityField(p-e.yyx))); }
vec3 cityFlight(vec2 uv){
  vec3 cp; vec3 rd = flightRay(uv, 5.0, 11.0, cp); cp.y += 2.0;
  float t=0.0; bool hit=false;
  for(int i=0;i<96;i++){ float d=cityField(cp+rd*t); if(d<0.003){hit=true;break;} t+=d*0.8; if(t>60.0)break; }
  vec3 sky = mix(vec3(0.15,0.02,0.2), vec3(0.0), uv.y*0.5+0.5);
  if(!hit) return sky;
  vec3 p=cp+rd*t; vec3 n=cityNormal(p);
  // Fensterraster auf vertikalen Wänden
  float win = step(0.5, fract(p.y*1.5))*step(0.5, fract((abs(n.x)>0.5?p.z:p.x)*1.5));
  vec3 tint = mix(vec3(1.0,0.3,0.7), vec3(0.3,0.8,1.0), hash13(floor(p.xz/4.0).xyy));
  float fog = exp(-t*0.03);
  return (tint*win*1.8 + tint*0.05 + vec3(0.02)) * fog;
}
```

- [ ] **Step 2: Uniform `uCity` deklarieren** (bei den anderen Szenen-Uniforms) und Block in `main()` nach `figureFlight` einfügen:

```glsl
  if(uCity > 0.001){ color = mix(color, cityFlight(uv) + background(rd)*0.1, uCity); }
```

- [ ] **Step 3: Timeline** — in `director.js` `const city = seg(t, A, B, 4);` ergänzen, ins `uniforms`-Objekt als `uCity: city` und einen Zeitslot zuweisen (siehe Task B6 Re-Timing). Vorläufig zum Testen: `uCity: seg(t, 44, 74, 5)` temporär (überschneidet Figures — nur fürs Verify, in B6 final einsortiert).

- [ ] **Step 4: Verify** — `shoot city 58`. Erwartung: Flug über eine Neon-Stadt, Gebäude mit Fensterlichtern, Tiefen-Nebel. `errcheck city`. Tuning: Höhenfaktor, Fensterdichte, Flughöhe `cp.y`.

- [ ] **Step 5: Commit** — `git commit -am "Add City Flyover scene"`

### Task B2: Wormhole

**Files:** Modify `js/shaders.js`, `js/director.js`

- [ ] **Step 1: `wormholeFlight` einfügen** (verdrehter Tunnel: polare Koordinaten mit zeit-/tiefenabhängiger Rotation + Lensing-Verzerrung):

```glsl
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
  col += vec3(0.6,0.4,1.0)*pow(max(0.0,1.0-r*1.5),5.0)*(0.8+uBeat); // gleißendes Zentrum
  return col;
}
```

- [ ] **Step 2: Uniform `uWorm` + Block** in `main()`: `if(uWorm>0.001){ color = mix(color, wormholeFlight(uv), uWorm); }`

- [ ] **Step 3: Timeline** — `const worm = seg(...)`, `uWorm: worm` (Slot in B6). Test temporär `seg(t,94,112,4)`.

- [ ] **Step 4: Verify** — `shoot worm 100`. Erwartung: verdrehter, sich drehender Tunnel mit gleißendem Zentrum, stärker verzerrt als der normale Tunnel. `errcheck worm`.

- [ ] **Step 5: Commit** — `git commit -am "Add Wormhole scene"`

### Task B3: Tentacle Field

**Files:** Modify `js/shaders.js`, `js/director.js`

- [ ] **Step 1: `tentacleField` + `tentacleFlight`** (Domain-Repetition vertikaler, per sin-Wellen wabernder „Tentakel" = verschobene Zylinder/Capsules; organischer Durchflug):

```glsl
float tentacleField(vec3 p){
  vec2 cell = vec2(3.5);
  vec2 id = floor(p.xz/cell);
  vec2 q = mod(p.xz, cell) - cell*0.5;
  float h = hash13(vec3(id,2.0));
  // seitliches Wabern entlang y
  q.x += sin(p.y*0.5 + uTime + h*6.28)*0.8;
  q.y += cos(p.y*0.4 + uTime*0.8 + h*6.28)*0.8;
  float rad = 0.25 + 0.15*sin(p.y*0.7 + uTime);
  return length(q) - rad;                 // unendlich lange, wabernde Säulen
}
vec3 tentacleNormal(vec3 p){ vec2 e=vec2(0.008,0.0); return normalize(vec3(
  tentacleField(p+e.xyy)-tentacleField(p-e.xyy), tentacleField(p+e.yxy)-tentacleField(p-e.yxy),
  tentacleField(p+e.yyx)-tentacleField(p-e.yyx))); }
vec3 tentacleFlight(vec2 uv){
  vec3 cp; vec3 rd = flightRay(uv, 3.5, 23.0, cp);
  float t=0.0; bool hit=false;
  for(int i=0;i<90;i++){ float d=tentacleField(cp+rd*t); if(d<0.003){hit=true;break;} t+=d*0.7; if(t>40.0)break; }
  if(!hit) return vec3(0.04,0.0,0.07);
  vec3 p=cp+rd*t; vec3 n=tentacleNormal(p);
  float fres=pow(clamp(1.0-dot(n,-rd),0.0,1.0),3.0);
  vec3 tint=mix(vec3(1.0,0.1,0.6), vec3(0.5,0.2,1.0), 0.5+0.5*sin(p.y*0.3));
  float fog=exp(-t*0.05);
  return (tint*(0.15+fres*2.4) + tint*0.2)*fog;
}
```

- [ ] **Step 2: Uniform `uTentacle` + Block** in `main()`.
- [ ] **Step 3: Timeline** — `const tentacle = seg(...)`, `uTentacle: tentacle`.
- [ ] **Step 4: Verify** — `shoot tentacle 60`. Erwartung: organisch wabernde Neon-Säulen, Durchflug dazwischen. `errcheck tentacle`.
- [ ] **Step 5: Commit** — `git commit -am "Add Tentacle Field scene"`

### Task B4: Mandelbox Temple

**Files:** Modify `js/shaders.js`, `js/director.js`

- [ ] **Step 1: `mandelboxField` + `mandelboxFlight`** (klassische Mandelbox-Distanzschätzer-Iteration; langsamer Zoom statt Vollflug, da fraktal):

```glsl
float mandelboxField(vec3 p){
  vec4 z = vec4(p*0.8, 1.0);
  vec4 o = z;
  float scale = 2.4;
  for(int i=0;i<8;i++){
    z.xyz = clamp(z.xyz, -1.0, 1.0)*2.0 - z.xyz;      // box fold
    float r2 = dot(z.xyz, z.xyz);
    z *= clamp(max(0.25/r2, 0.25), 0.0, 1.0);         // sphere fold
    z = z*scale + o;
  }
  return length(z.xyz)/abs(z.w);
}
vec3 mandelboxNormal(vec3 p){ vec2 e=vec2(0.0015,0.0); return normalize(vec3(
  mandelboxField(p+e.xyy)-mandelboxField(p-e.xyy), mandelboxField(p+e.yxy)-mandelboxField(p-e.yxy),
  mandelboxField(p+e.yyx)-mandelboxField(p-e.yyx))); }
vec3 mandelboxFlight(vec2 uv){
  vec3 cp = vec3(sin(uTime*0.1)*4.0, cos(uTime*0.08)*3.0, -6.0 + uTime*0.4);
  vec3 fwd = normalize(vec3(0.0,0.0,1.0) + vec3(sin(uTime*0.1),cos(uTime*0.08),0.0)*0.1);
  vec3 rt = normalize(cross(vec3(0,1,0),fwd)); vec3 up = cross(fwd,rt);
  vec3 rd = normalize(fwd*1.4 + rt*uv.x + up*uv.y);
  float t=0.0; bool hit=false;
  for(int i=0;i<100;i++){ float d=mandelboxField(cp+rd*t); if(d<0.001){hit=true;break;} t+=d*0.6; if(t>20.0)break; }
  if(!hit) return vec3(0.02,0.0,0.05);
  vec3 p=cp+rd*t; vec3 n=mandelboxNormal(p);
  float ao = 1.0 - float(0)/100.0;                    // (optional: Iterationszahl als AO)
  float fres=pow(clamp(1.0-dot(n,-rd),0.0,1.0),2.0);
  vec3 tint=mix(vec3(0.2,0.9,1.0), vec3(1.0,0.2,0.8), 0.5+0.5*sin(p.x+p.y+uTime));
  return tint*(0.2+fres*2.0)*exp(-t*0.06);
}
```

- [ ] **Step 2: Uniform `uMandel` + Block** in `main()`.
- [ ] **Step 3: Timeline** — `const mandel = seg(...)`, `uMandel: mandel`.
- [ ] **Step 4: Verify** — `shoot mandel 130`. Erwartung: fraktaler Tempel/Gebilde mit Selbstähnlichkeit, langsamer Zoomflug. `errcheck mandel`. Achtung Performance: 8 Iterationen × 100 Steps — falls FPS einbrechen, Iterationen auf 6 senken (Auto-Scaling fängt Rest ab).
- [ ] **Step 5: Commit** — `git commit -am "Add Mandelbox Temple scene"`

### Task B5: Wireframe Vector Objects

**Files:** Modify `js/shaders.js`, `js/director.js`

- [ ] **Step 1: Wireframe via Kanten-Distanz** — rotierender Würfel/Oktaeder, dessen Kanten als leuchtende Linien gezeichnet werden (Kanten-Distanzfunktion über min der Abstände zu den 12 Kanten eines Würfels). Einfacher Ansatz: SDF eines „Rohr-Rahmens" (Box-Frame), wie `sdBoxFrame`:

```glsl
float sdBoxFrame(vec3 p, vec3 b, float e){
  p = abs(p)-b; vec3 q = abs(p+e)-e;
  return min(min(
    length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
    length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
    length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
}
float wireField(vec3 wp){
  vec3 p = wp - vec3(0.0,0.0,7.0);
  p.xy *= rot(uTime*0.4); p.yz *= rot(uTime*0.3);
  float box = sdBoxFrame(p, vec3(1.6), 0.06);
  float oct = (abs(p.x)+abs(p.y)+abs(p.z)-2.6)*0.57;   // umhüllender Oktaeder
  return min(box, max(oct, -(oct+0.08)));               // Oktaeder als dünne Schale
}
vec3 wireNormal(vec3 p){ vec2 e=vec2(0.004,0.0); return normalize(vec3(
  wireField(p+e.xyy)-wireField(p-e.xyy), wireField(p+e.yxy)-wireField(p-e.yxy),
  wireField(p+e.yyx)-wireField(p-e.yyx))); }
vec3 wireScene(vec3 ro, vec3 rd){
  float t=2.0; bool hit=false;
  for(int i=0;i<80;i++){ float d=wireField(ro+rd*t); if(d<0.002){hit=true;break;} t+=d*0.8; if(t>20.0)break; }
  if(!hit) return vec3(0.0);
  vec3 p=ro+rd*t; vec3 n=wireNormal(p);
  float fres=pow(clamp(1.0-dot(n,-rd),0.0,1.0),2.0);
  vec3 tint=mix(vec3(0.1,1.0,0.9), vec3(1.0,0.2,0.9), 0.5+0.5*sin(uTime));
  return tint*(1.2+fres*2.5+uBeat);
}
```

- [ ] **Step 2: Uniform `uWire` + Block** in `main()` (Kamera = die geteilte statische `ro/rd`, da Objekt zentral): `if(uWire>0.001){ color = mix(color, wireScene(ro,rd), uWire); }`
- [ ] **Step 3: Timeline** — `const wire = seg(...)`, `uWire: wire`.
- [ ] **Step 4: Verify** — `shoot wire 40`. Erwartung: leuchtendes Drahtgitter-Objekt (Würfelrahmen + Oktaederschale), rotierend, Oldschool-Vektor-Look. `errcheck wire`.
- [ ] **Step 5: Commit** — `git commit -am "Add Wireframe vector object scene"`

### Task B6: Timeline neu einsortieren (alle neuen Welten in eine Reise)

**Files:** Modify `js/director.js` (Kommentar-Block + alle `seg`-Slots), `README.md`

- [ ] **Step 1: Neue Reihenfolge & LOOP festlegen.** Erweitere die Timeline um die 5 neuen Welten, verteilt als Reise. Vorschlag (LOOP = 250s, falls Track kürzer ist, loopt Audio unabhängig weiter):

```
1 Intro 0-12 · 2 Nebula-Flight 12-30 · 3 Gel Bubbles 30-46 ·
4 Figure Flight 46-72 · 5 City Flyover 72-98 · 6 Wormhole 98-118 ·
7 Tentacle Field 118-142 · 8 Outrun Floor 142-162 · 9 Neon Tunnel 162-180 ·
10 Wireframe 180-198 · 11 Mega Structure 198-222 · 12 Mandelbox 222-244 ·
13 Kaleidoscope (über X) + 14 Laser Finale 244-250
```

Setze jedes `seg(t, start, end, fade)` entsprechend; entferne die temporären Test-Slots aus B1–B5. `stars/nebula/bubbles/kaleido/lasers` an die neuen Grenzen anpassen. Alle Gewichts-Uniforms (`uCity uWorm uTentacle uMandel uWire` zusätzlich zu den bestehenden) ins `uniforms`-Objekt aufnehmen.

- [ ] **Step 2: Verify** — Screenshot-Sweep: `for s in 20 38 58 85 108 130 152 170 188 210 232; do shoot sweep$s $s; done`, dann jedes PNG ansehen — jede Welt erscheint sauber, Übergänge blenden weich, keine zwei schweren Raymarches dauerhaft gleichzeitig (nur ~Übergänge). `errcheck sweep58` etc.
- [ ] **Step 3: README aktualisieren** — Part-Liste auf 14 Parts / neue LOOP-Länge bringen.
- [ ] **Step 4: Commit** — `git commit -am "Re-time timeline into one journey through all worlds"`

---

## Phase C — Polish-Effekte

### Task C1: Depth of Field (Post)

**Files:** Modify `js/shaders.js` (`POST_FRAG`), `js/gl.js` (Uniform `uDof` durchreichen), `js/director.js` (DoF-Stärke pro Part)

- [ ] **Step 1: In `POST_FRAG` einen leichten Defocus für Bildränder/Helligkeit ergänzen** — da kein echter Tiefenpuffer existiert, nähern wir DoF über radialen Blur weg vom Zentrum (Fokus = Bildmitte):

```glsl
// nach dem bloom, vor vignette:
float focus = smoothstep(0.0, 0.6, length(center));      // 0 Mitte scharf
vec3 blur = vec3(0.0);
for(int i=0;i<8;i++){ float a=float(i)/8.0*6.2831;
  blur += texture(uScene, uv + vec2(cos(a),sin(a))*focus*uDof*0.01).rgb; }
col = mix(col, blur/8.0, focus*uDof);
```

- [ ] **Step 2: `uDof` in `gl.js` an `postProg` übergeben** (analog zu `uBeat`), Default 0; in `director.js` z.B. `uDof: 0.6` global oder pro Part variieren.
- [ ] **Step 3: Verify** — `shoot dof 58`. Erwartung: Bildmitte scharf, Ränder weicher. `errcheck dof`.
- [ ] **Step 4: Commit** — `git commit -am "Add radial depth-of-field approximation"`

### Task C2: Lens Flares

**Files:** Modify `js/shaders.js` (`POST_FRAG`)

- [ ] **Step 1: Helles-Pixel-Flares** — finde den hellsten Bereich grob (Zentrumsannäherung oder feste Lichtpunkte je Szene) und zeichne Flare-Ghosts entlang der Achse durch die Bildmitte:

```glsl
// vor vignette: ghosts entlang der Achse Bildpunkt->Mitte
vec3 flare = vec3(0.0);
for(int i=1;i<=4;i++){
  vec2 gp = center * (-0.4*float(i));
  vec3 s = texture(uScene, gp+0.5).rgb;
  float b = max(luma(s)-0.7, 0.0);
  flare += s*b * (0.4/float(i)) * vec3(1.0,0.8,0.9);
}
col += flare;
```

- [ ] **Step 2: Verify** — `shoot flare 122` (Mega-Struktur, viele helle Stellen). Erwartung: Flare-Ghosts bei hellen Quellen. `errcheck flare`. Falls zu dominant: Faktor senken.
- [ ] **Step 3: Commit** — `git commit -am "Add lens-flare ghosts"`

### Task C3: CRT-Modus (Toggle)

**Files:** Modify `js/shaders.js` (`POST_FRAG`), `js/main.js` (Hotkey `c`), `js/gl.js` (`uCrt`), `index.html` (Hotkey-Hinweis)

- [ ] **Step 1: CRT in `POST_FRAG`** — Scanlines + Barrel-Distortion + Maske, gated über `uCrt`:

```glsl
if(uCrt > 0.5){
  vec2 cc = uv-0.5; cc *= 1.0 + dot(cc,cc)*0.15;       // barrel
  uv = cc+0.5;                                          // (vor den Texture-Reads anwenden)
  // … am Ende:
  col *= 0.8 + 0.2*sin(uv.y*uRes.y*3.1416);             // scanlines
}
```
(Hinweis: Die Barrel-Verzerrung muss VOR den `texture()`-Reads stehen; ggf. `uv` früh anpassen. Scanline-Multiplikation ans Ende.)

- [ ] **Step 2: Toggle** — in `main.js` `uCrt` als State (0/1), Hotkey `c` toggelt; an `gl.js`→`postProg` übergeben. `index.html`-Hotkey-Zeile um „C = CRT" ergänzen.
- [ ] **Step 3: Verify** — `shoot crt 58` mit vorher gesetztem CRT-State (zum Testen `uCrt` temporär auf 1). Erwartung: Scanlines + leichte Wölbung. `errcheck crt`.
- [ ] **Step 4: Commit** — `git commit -am "Add toggleable CRT mode"`

### Task C4: EQ / Waveform Visualizer

**Files:** Modify `js/audio.js` (Spektrum/Waveform exportieren), `js/main.js` (als Uniform-Array übergeben), `js/shaders.js` (am unteren Rand zeichnen)

- [ ] **Step 1: `audio.js`** — Methode `getSpectrum(n)` die `n` (z.B. 32) gemittelte Bänder 0..1 liefert, und `getWaveform(n)` via `getByteTimeDomainData`.
- [ ] **Step 2: `main.js`** — pro Frame `uSpectrum` als `float[32]`-Uniform setzen (in `gl.js` via `gl.uniform1fv` unterstützen — `_apply` um Array-Fall erweitern: `if(Array.isArray(v)&&v.length>4) gl.uniform1fv(loc,v)`).
- [ ] **Step 3: `shaders.js`** — am unteren Bildrand 32 Neon-Balken zeichnen (Höhe = `uSpectrum[i]`), gated über `uEq`:

```glsl
if(uEq > 0.001){
  float bars = 32.0; float bi = floor(uv.x*0.5+0.5 ... );   // x->bar index
  // Balkenhöhe aus uSpectrum[index] vergleichen mit (uv.y eines bodennahen Bandes)
}
```
(Konkrete Indexberechnung beim Implementieren über `int idx = int(clamp((gl_FragCoord.x/uRes.x)*32.0,0.0,31.0));` und Vergleich `step(1.0-uSpectrum[idx], normalisierte Bildhöhe)`.)

- [ ] **Step 4: Verify** — `shoot eq 30` (mit `uEq>0`). Erwartung: 32 reagierende Balken unten. Im Headless evtl. flach (kein Audio) — primär im echten Browser prüfen; `errcheck eq` muss sauber sein.
- [ ] **Step 5: Commit** — `git commit -am "Add EQ/waveform visualizer overlay"`

---

## Phase D — Audio-Sync-Choreografie

Koppelt Szenenwechsel & Intensität an die Track-Struktur statt nur an Timer.

### Task D1: Energie-/Sektions-Analyse in `audio.js`

**Files:** Modify `js/audio.js`

- [ ] **Step 1: Gleitende Gesamtenergie + Sektions-Flag** — in `getLevels()` zusätzlich `L.energy` (geglätteter Gesamtpegel 0..1) und `L.section` (zählt hoch bei großen, anhaltenden Energiesprüngen — Drop-getriggert mit Mindestabstand) berechnen:

```js
// nach drop-Detection:
this._energy = this._energy*0.9 + (bass+mid+treble)/3*0.1;
L.energy = this._energy;
if (this._drop > 0.9 && (performance.now()-this._lastSection) > 4000){
  this._section++; this._lastSection = performance.now();
}
L.section = this._section;
```
(Felder `_energy=0,_section=0,_lastSection=0` im Konstruktor ergänzen.)

- [ ] **Step 2: Verify** — im echten Browser mit `console.log(audio.getLevels())` prüfen, dass `energy` mitläuft und `section` bei Drops hochzählt. (Headless ohne Audio: nur `errcheck`.)
- [ ] **Step 3: Commit** — `git commit -am "Audio: rolling energy + section counter"`

### Task D2: Director reagiert auf Audio

**Files:** Modify `js/director.js`, `js/main.js` (levels an `director.update` durchreichen)

- [ ] **Step 1: `update(time, levels)`-Signatur erweitern** (in `main.js` `director.update(time, levels)` aufrufen). Intensitäts-Kopplung: globaler `intensity = 0.7 + levels.energy*0.6` als Multiplikator auf `lasers`, `camSpeed`, `trail`; `uDrop` treibt bereits Flash. Optional: bei `levels.section`-Wechsel einen kurzen Kaleido-/Glitch-freien „Akzent" (z.B. Trail-Boost) setzen.
- [ ] **Step 2: Verify** — echter Browser: an lauten Stellen sichtbar mehr Laser/Speed/Glow; leise Passagen ruhiger. `errcheck` sauber.
- [ ] **Step 3: Commit** — `git commit -am "Director: couple intensity & speed to track energy"`

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** Neue Welten (B1–B5) ✓, Polish (C1–C4) ✓, Audio-Choreo (D1–D2) ✓, Mega-Grandeur (A2) ✓, Nebula-Durchflug (A1) ✓. Video-Export bewusst ausgelassen (Nutzerentscheid).
- **DRY:** Banking-Kamera in `flightRay()` (B0) extrahiert, von Figure/City/Tentacle genutzt.
- **Reihenfolge:** B0 vor B1–B3 (Helfer zuerst). B6 nach B1–B5 (Re-Timing). C1/C3 brauchen `gl.js`-Uniform-Durchreichung; C4 braucht `uniform1fv`-Support — explizit als Schritt benannt.
- **Performance-Risiko:** Mandelbox (B4) ist am teuersten — Iterationszahl-Fallback genannt; Auto-Scaling in `gl.js` fängt FPS-Einbrüche ab.
- **Offene Tuning-Punkte:** Alle Welten brauchen visuelles Feintuning per Screenshot-Loop (in jedem Verify-Schritt eingeplant); exakte Timeline-Slots in B6 final.
