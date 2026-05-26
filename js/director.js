// Timeline director: maps elapsed time -> per-scene shader weights + overlay state.
// Loops every LOOP seconds and is endlessly runnable.
//
// Parts:
//   1 Intro          0 - 12   stars + title
//   2 Nebula Flight 12 - 30   nebula, first gel bubbles forming
//   3 Gel Bubbles   30 - 52   glassy metaballs
//   4 Neon Tunnel   52 - 74   grid tunnel flight
//   5 Mega Structure74 -100   giant rotating grid-sphere + ring
//   6 Kaleidoscope 100 -124   mirrored psychedelia (bubbles + nebula folded)
//   7 Laser Finale 124 -150   lasers + greetings scroller

const LOOP = 150.0;

function clamp01(x) { return Math.min(1, Math.max(0, x)); }
function smoothstep(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

// 0 before `start`, ramps up over `fade`, holds at 1, ramps down before `end`.
function seg(t, start, end, fade) {
  return smoothstep(start, start + fade, t) * (1 - smoothstep(end - fade, end, t));
}

export class Director {
  update(time) {
    const t = time % LOOP;

    // global fade (intro from black + outro to black for the loop seam)
    const fade = smoothstep(0, 2.5, t) * (1 - smoothstep(LOOP - 2.5, LOOP, t));

    // --- scene weights (capped at 1) ---
    const stars = 0.4 + 0.6 * (1 - smoothstep(12, 20, t));
    const nebula = clamp01(seg(t, 10, 52, 5) + seg(t, 98, LOOP, 5));
    const bubbles = clamp01(seg(t, 24, 52, 6) + seg(t, 98, 148, 6));
    const tunnel = seg(t, 52, 74, 4);
    const mega = seg(t, 74, 100, 5);
    const kaleido = seg(t, 100, 124, 5);
    const lasers = seg(t, 120, 148, 4);

    // camera flow: gentle, accelerating into the laser finale
    const finale = smoothstep(120, 144, t);
    const camSpeed = 1.1 + smoothstep(24, 40, t) * 0.5 + finale * 3.0;

    // overlays (DOM)
    const title = seg(t, 2.0, 11.0, 2.0);
    const subtitle = seg(t, 4.0, 11.0, 2.0);
    const scroller = seg(t, 124.0, LOOP - 2.0, 3.0);

    return {
      uniforms: {
        uStars: stars,
        uNebula: nebula,
        uBubbles: bubbles,
        uTunnel: tunnel,
        uMega: mega,
        uKaleido: kaleido,
        uLasers: lasers,
        uCamSpeed: camSpeed,
        uFade: fade,
      },
      overlay: { title, subtitle, scroller },
    };
  }
}
