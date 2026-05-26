// Timeline director: maps elapsed time -> per-part shader weights + overlay state.
// The demo loops every LOOP seconds and is endlessly runnable.

const LOOP = 90.0;

function clamp01(x) { return Math.min(1, Math.max(0, x)); }
function smoothstep(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

// envelope: 0 before `start`, ramps up over `fade`, holds at 1, ramps down before `end`.
function seg(t, start, end, fade) {
  return smoothstep(start, start + fade, t) * (1 - smoothstep(end - fade, end, t));
}

export class Director {
  // returns { uniforms, overlay } where overlay has title/subtitle/scroller opacities
  update(time) {
    const t = time % LOOP;

    // --- global fade (intro from black + outro to black for the loop seam) ---
    const fade = smoothstep(0, 2.5, t) * (1 - smoothstep(LOOP - 2.5, LOOP, t));

    // --- per-element weights across the four parts ---
    // Part 1 Intro 0-15 | Part 2 Nebula 15-40 | Part 3 Bubbles 40-65 | Part 4 Laser 65-90
    const stars = 0.45 + 0.55 * (1 - smoothstep(14, 22, t));        // strong at intro, lingers
    const nebula = seg(t, 11, LOOP - 3, 5.0);                        // from ~part 2 onward
    const bubbles = seg(t, 27, LOOP, 7.0);                           // first bubbles already during nebula flight
    const lasers = seg(t, 60, LOOP, 4.0);                            // part 4 finale

    // camera speed ramps up into the finale
    const finale = smoothstep(58, 78, t);
    const camSpeed = 1.1 + smoothstep(14, 40, t) * 0.6 + finale * 3.2;

    // --- overlays (DOM) ---
    const title = seg(t, 2.0, 13.0, 2.0);
    const subtitle = seg(t, 4.0, 13.0, 2.0);
    const scroller = seg(t, 62.0, LOOP - 2.0, 3.0);

    return {
      uniforms: {
        uStars: stars,
        uNebula: nebula,
        uBubbles: bubbles,
        uLasers: lasers,
        uCamSpeed: camSpeed,
        uFade: fade,
      },
      overlay: { title, subtitle, scroller },
    };
  }
}
