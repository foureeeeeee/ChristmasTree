import * as THREE from 'three';
import { CAM } from './config.js';
import { STAR_MESSAGE } from './content.js';
import { clamp, easeInOut } from './utils.js';

/* ------------------------------------------------------------------
   Pointer handling: hover titles, clicking ornaments, presents,
   snowflakes and the star, and a gentle focus move that brings the
   camera in to whatever you just opened.
   ------------------------------------------------------------------ */

export function createInteractions({ dom, camera, controls, ornaments, presents, star, constellation, ui, state, onAlbum, canHold }) {
  const ray = new THREE.Raycaster();
  ray.params.Points.threshold = 0.1;
  const ndc = new THREE.Vector2();
  const pointer = { x: 0, y: 0, down: false, moved: 0, id: null, downAt: 0 };
  let swallow = false;
  const HOLD_DELAY = 200;

  const focus = {
    active: false, t: 0, dur: 1.15,
    fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(),
    fromTgt: new THREE.Vector3(), toTgt: new THREE.Vector3(),
    savedPos: new THREE.Vector3(), savedTgt: new THREE.Vector3(),
    returning: false, engaged: false,
  };

  function targets() {
    if (state.wall) return [];
    const list = [];
    if (state.morph < 0.65) list.push(...ornaments.pickables);
    list.push(...presents.pickables, star.star, ...constellation.pickables);
    return list;
  }

  function pick(cx, cy) {
    const r = dom.getBoundingClientRect();
    ndc.x = ((cx - r.left) / r.width) * 2 - 1;
    ndc.y = -((cy - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(targets(), false);
    return hits.length ? hits[0] : null;
  }

  function describe(hit) {
    if (!hit) return null;
    const o = hit.object;
    const sky = constellation.starFor(o);
    if (sky) {
      const a = sky.album;
      return {
        kind: 'album', star: sky,
        hover: a.year ? `${a.name} · ${a.year}` : a.name,
        content: a.note,
      };
    }
    if (o === star.star) return { kind: 'star', hover: 'The Christmas star', content: STAR_MESSAGE };
    if (o.userData.kind === 'present') {
      const p = presents.findPresent(o);
      return p ? { kind: 'present', hover: p.special ? 'The special gift' : 'A present', content: p.content, obj: p.group, special: p.special } : null;
    }
    const it = ornaments.findItem(o, hit.instanceId);
    if (it) return { kind: it.kind, hover: it.hover, content: it.content, item: it };
    return null;
  }

  function moveTo(point, distance) {
    /* remember where we came from only on the FIRST move in, so that
       hopping from one ornament to the next still returns home */
    if (!focus.engaged) {
      focus.savedPos.copy(camera.position);
      focus.savedTgt.copy(controls.target);
    }
    focus.engaged = true;
    focus.fromPos.copy(camera.position);
    focus.fromTgt.copy(controls.target);
    const dir = new THREE.Vector3().subVectors(camera.position, point);
    dir.y = Math.max(dir.y, 0.25 * dir.length());
    dir.normalize();
    focus.toPos.copy(point).addScaledVector(dir, distance);
    focus.toPos.y = Math.max(focus.toPos.y, 0.9);
    focus.toTgt.copy(point);
    focus.t = 0; focus.active = true; focus.returning = false;
    controls.autoRotate = false;
  }

  function release() {
    if (!focus.engaged) return;
    focus.fromPos.copy(camera.position);
    focus.fromTgt.copy(controls.target);
    focus.toPos.copy(focus.savedPos);
    focus.toTgt.copy(focus.savedTgt);
    focus.t = 0; focus.active = true; focus.returning = true;
  }

  function open(d, hitPoint) {
    if (d.kind === 'album') { onAlbum(d.star); return; }
    ui.showCard(d.content, { media: d.kind === 'present' });
    if (d.kind === 'star') {
      star.trigger();
      moveTo(star.group.position.clone(), 7.0);
    } else if (d.kind === 'present') {
      moveTo(d.obj.position.clone().setY(d.obj.position.y + 0.3), 3.9);
    } else {
      moveTo(hitPoint.clone(), 2.35);
    }
  }

  /* ---------- events ---------- */
  function onMove(e) {
    pointer.x = e.clientX; pointer.y = e.clientY;
    if (pointer.down) { pointer.moved += 1; return; }
    if (e.pointerType === 'touch') return;
    const hit = pick(e.clientX, e.clientY);
    const d = describe(hit);
    constellation.setHovered(d && d.kind === 'album' ? d.star : null);
    if (d) {
      ui.setTooltip(d.hover, e.clientX, e.clientY);
      ui.setCursor('pointer');
    } else {
      ui.setTooltip(null);
      ui.setCursor('');
    }
  }

  function onDown(e) {
    pointer.down = true; pointer.moved = 0; pointer.id = e.pointerId;
    pointer.downAt = performance.now();
    pointer.x = e.clientX; pointer.y = e.clientY;
  }

  function onUp(e) {
    const wasDown = pointer.down;
    pointer.down = false;
    if (swallow) { swallow = false; return; }
    if (!wasDown || pointer.moved > 5) return;
    const hit = pick(e.clientX, e.clientY);
    const d = describe(hit);
    if (d) {
      open(d, hit.point);
    } else if (ui.cardIsOpen()) {
      ui.hideCard();
      release();
    }
  }

  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointerleave', () => { ui.setTooltip(null); ui.setCursor(''); });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { ui.hideCard(); release(); }
  });

  return {
    /** true once the pointer has been held still on the scene for a beat */
    isHolding() {
      return pointer.down && pointer.moved <= 6 && canHold?.()
        && performance.now() - pointer.downAt > HOLD_DELAY;
    },
    pointerAt() { return { x: pointer.x, y: pointer.y }; },
    /** stop the release from also counting as a click */
    swallowClick() { swallow = true; pointer.moved = 999; },
    update(dt) {
      if (!focus.active) return;
      focus.t = Math.min(1, focus.t + dt / focus.dur);
      const e = easeInOut(focus.t);
      camera.position.lerpVectors(focus.fromPos, focus.toPos, e);
      controls.target.lerpVectors(focus.fromTgt, focus.toTgt, e);
      if (focus.t >= 1) {
        focus.active = false;
        if (focus.returning) {
          focus.returning = false;
          focus.engaged = false;
          controls.autoRotate = state.spin;
        }
      }
    },
    release,
    isFocused() { return focus.engaged || focus.active || ui.cardIsOpen(); },
  };
}
