import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { hashSeed } from '../src/core/rng.mjs';

const SPACING = 5;
const LABELS = 24;
const ROOF = ['#d4543a', '#3a7bd5', '#7a4bd1', '#e5a31c', '#2f9e72', '#d94c8c'];
const WALL = ['#fff1d6', '#ffd9c7', '#d7ecff', '#e6ffd9', '#f3e0ff'];
const LEAF = ['#4caf50', '#2e9e5b', '#7cb342', '#3f9d6a'];

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#5fb8ff');
  grad.addColorStop(0.55, '#bfe3ff');
  grad.addColorStop(1, '#ffe7c2');
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function instanced(geometry, count, color) {
  const m = new THREE.InstancedMesh(geometry, new THREE.MeshLambertMaterial(color ? { color } : {}), Math.max(count, 1));
  m.count = count;
  return m;
}

/** Create the 3D town. Returns {setPlayers, focus, select, setMine, onSelect, dispose}. */
export function createWorld(container) {
  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xffe7c2, 80, 320);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 900);
  camera.position.set(18, 20, 24);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.maxDistance = 220;
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;

  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x7fb069, 1.05));
  const sun = new THREE.DirectionalLight(0xffe0b0, 1.6);
  sun.position.set(40, 60, 25);
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshLambertMaterial({ color: 0x8bd36a }));
  ground.rotation.x = -Math.PI / 2;
  const outer = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshLambertMaterial({ color: 0x5fa84e }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.05;
  scene.add(ground, outer);

  const ring = new THREE.Mesh(new THREE.RingGeometry(2.7, 3.2, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffb938, transparent: true, opacity: 0.95 }));
  ring.position.y = 0.2;
  ring.visible = false;
  const flag = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), new THREE.MeshBasicMaterial({ color: 0xffd34d }));
  flag.visible = false;
  scene.add(ring, flag);

  const labelEls = Array.from({ length: LABELS }, () => {
    const el = document.createElement('div');
    el.className = 'label';
    el.style.display = 'none';
    container.appendChild(el);
    return el;
  });

  let parts = [];
  let pickables = [];
  let names = [];
  let positions = [];
  let mine = null;
  let selected = null;
  const selectHandlers = [];
  let tween = null;

  function clearParts() {
    for (const p of parts) {
      scene.remove(p);
      p.geometry.dispose();
      p.material.dispose();
      p.dispose();
    }
    parts = [];
    pickables = [];
  }

  function setPlayers(players) {
    clearParts();
    names = Object.keys(players);
    positions = names.map((u) => new THREE.Vector3(players[u].house.x * SPACING, 0, players[u].house.z * SPACING));
    const n = names.length;
    const yards = instanced(new THREE.BoxGeometry(4.2, 0.12, 4.2).translate(0, 0.06, 0), n, '#d8c38e');
    const bodies = instanced(new THREE.BoxGeometry(2.2, 1.7, 2.2).translate(0, 0.97, 0), n);
    const roofs = instanced(new THREE.ConeGeometry(1.95, 1.3, 4).rotateY(Math.PI / 4).translate(0, 2.44, 0), n);
    const doors = instanced(new THREE.BoxGeometry(0.55, 0.95, 0.12).translate(0, 0.6, 1.1), n, '#7a4a2b');
    const chimneys = instanced(new THREE.BoxGeometry(0.34, 0.9, 0.34).translate(0.6, 2.7, -0.5), n, '#8d6e63');
    const m = new THREE.Matrix4();
    let maxCell = 3;
    names.forEach((u, i) => {
      const h = players[u].house;
      maxCell = Math.max(maxCell, Math.abs(h.x), Math.abs(h.z));
      m.makeTranslation(positions[i].x, 0, positions[i].z);
      for (const mesh of [yards, bodies, roofs, doors, chimneys]) mesh.setMatrixAt(i, m);
      bodies.setColorAt(i, new THREE.Color(WALL[(h.seed >> 3) % WALL.length]));
      roofs.setColorAt(i, new THREE.Color(ROOF[h.seed % ROOF.length]));
    });
    const extent = maxCell + 4;
    const treeSpots = [];
    for (let x = -extent; x < extent; x++) {
      for (let z = -extent; z < extent; z++) {
        if (hashSeed(`t${x},${z}`) % 100 < 45) treeSpots.push([(x + 0.5) * SPACING, (z + 0.5) * SPACING, hashSeed(`s${x},${z}`)]);
      }
    }
    const trunks = instanced(new THREE.CylinderGeometry(0.13, 0.17, 0.7).translate(0, 0.35, 0), treeSpots.length, '#7a5230');
    const leaves = instanced(new THREE.ConeGeometry(0.75, 1.8, 7).translate(0, 1.5, 0), treeSpots.length);
    treeSpots.forEach(([x, z, s], i) => {
      const sc = 0.8 + (s % 40) / 100;
      m.makeScale(sc, sc, sc).setPosition(x, 0, z);
      trunks.setMatrixAt(i, m);
      leaves.setMatrixAt(i, m);
      leaves.setColorAt(i, new THREE.Color(LEAF[s % LEAF.length]));
    });
    parts = [yards, bodies, roofs, doors, chimneys, trunks, leaves];
    pickables = [yards, bodies, roofs];
    scene.add(...parts);
    const radius = extent * SPACING * 1.15 + 30;
    ground.scale.setScalar(radius);
    outer.scale.setScalar(radius * 4);
    scene.fog.near = radius * 0.6;
    scene.fog.far = radius * 3.2;
    controls.maxDistance = Math.max(220, radius * 2);
    camera.far = radius * 8;
    camera.updateProjectionMatrix();
    placeMarkers();
  }

  function placeMarkers() {
    const si = selected ? names.indexOf(selected) : -1;
    ring.visible = si >= 0;
    if (si >= 0) ring.position.set(positions[si].x, 0.2, positions[si].z);
    const mi = mine ? names.indexOf(mine) : -1;
    flag.visible = mi >= 0;
    if (mi >= 0) flag.position.set(positions[mi].x, 4.4, positions[mi].z);
  }

  function focus(username) {
    const i = names.indexOf(username);
    if (i < 0) return false;
    controls.autoRotate = false;
    const t = positions[i].clone();
    tween = {
      t0: performance.now(),
      fromT: controls.target.clone(),
      toT: t,
      fromP: camera.position.clone(),
      toP: new THREE.Vector3(t.x + 9, 9, t.z + 11),
    };
    return true;
  }

  const select = (u) => {
    selected = u;
    placeMarkers();
  };
  const setMine = (u) => {
    mine = u;
    placeMarkers();
  };

  const ray = new THREE.Raycaster();
  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    downAt = [e.clientX, e.clientY];
    controls.autoRotate = false;
    tween = null;
  });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6 || !pickables.length) return;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(pickables)[0];
    if (hit) {
      select(names[hit.instanceId]);
      selectHandlers.forEach((fn) => fn(names[hit.instanceId]));
    }
  });

  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  const v = new THREE.Vector3();
  function updateLabels() {
    const near = names
      .map((u, i) => [u, positions[i].distanceToSquared(controls.target)])
      .sort((a, b) => a[1] - b[1])
      .slice(0, LABELS);
    labelEls.forEach((el, k) => {
      const entry = near[k];
      if (!entry || entry[1] > 1600 || controls.getDistance() > 70) return void (el.style.display = 'none');
      v.copy(positions[names.indexOf(entry[0])]).setY(4.1).project(camera);
      if (v.z > 1) return void (el.style.display = 'none');
      el.style.display = 'block';
      el.textContent = entry[0];
      el.classList.toggle('mine', entry[0] === mine);
      el.style.transform = `translate(-50%,-100%) translate(${((v.x + 1) / 2) * container.clientWidth}px,${((1 - v.y) / 2) * container.clientHeight}px)`;
    });
  }

  renderer.setAnimationLoop((time) => {
    if (tween) {
      const k = Math.min((performance.now() - tween.t0) / 700, 1);
      const e = 1 - Math.pow(1 - k, 3);
      controls.target.lerpVectors(tween.fromT, tween.toT, e);
      camera.position.lerpVectors(tween.fromP, tween.toP, e);
      if (k >= 1) tween = null;
    }
    controls.update();
    ring.scale.setScalar(1 + Math.sin(time / 300) * 0.06);
    flag.rotation.y = time / 500;
    if (mine) flag.position.y = 4.4 + Math.sin(time / 350) * 0.2;
    updateLabels();
    renderer.render(scene, camera);
  });

  return { setPlayers, focus, select, setMine, onSelect: (fn) => selectHandlers.push(fn), dispose: () => renderer.dispose() };
}
