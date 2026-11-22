import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const SPACING = 4;
const LABELS = 30;

function houseColor(seed) {
  return new THREE.Color().setHSL((seed % 360) / 360, 0.55, 0.62);
}

/** Create the 3D town. Returns {setPlayers, focus, onSelect, dispose}. */
export function createWorld(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9bd1ff);
  scene.fog = new THREE.Fog(0x9bd1ff, 60, 260);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);
  camera.position.set(14, 16, 18);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.maxDistance = 200;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b8f5a, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(30, 50, 20);
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 48), new THREE.MeshLambertMaterial({ color: 0x7ec35a }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const labelEls = Array.from({ length: LABELS }, () => {
    const el = document.createElement('div');
    el.className = 'label';
    el.style.display = 'none';
    container.appendChild(el);
    return el;
  });

  let bodies, roofs, names = [], positions = [];
  const selectHandlers = [];

  function setPlayers(players) {
    for (const m of [bodies, roofs]) if (m) { scene.remove(m); m.dispose(); }
    names = Object.keys(players);
    positions = names.map((u) => new THREE.Vector3(players[u].house.x * SPACING, 0, players[u].house.z * SPACING));
    const count = Math.max(names.length, 1);
    bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 1.6, 2).translate(0, 0.8, 0), new THREE.MeshLambertMaterial(), count);
    roofs = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 1.2, 4).rotateY(Math.PI / 4).translate(0, 2.2, 0), new THREE.MeshLambertMaterial({ color: 0xb5452f }), count);
    bodies.count = roofs.count = names.length;
    const m = new THREE.Matrix4();
    names.forEach((u, i) => {
      m.makeTranslation(positions[i].x, 0, positions[i].z);
      bodies.setMatrixAt(i, m);
      roofs.setMatrixAt(i, m);
      bodies.setColorAt(i, houseColor(players[u].house.seed));
    });
    scene.add(bodies, roofs);
    const extent = Math.max(20, Math.sqrt(names.length) * SPACING * 0.75 + 20);
    ground.scale.setScalar(extent / 80);
    scene.fog.far = Math.max(260, extent * 3);
    camera.far = Math.max(600, extent * 6);
    camera.updateProjectionMatrix();
  }

  function focus(username) {
    const i = names.indexOf(username);
    if (i < 0) return false;
    controls.target.copy(positions[i]);
    camera.position.set(positions[i].x + 8, 9, positions[i].z + 10);
    return true;
  }

  const ray = new THREE.Raycaster();
  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5 || !bodies) return;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObject(bodies)[0];
    if (hit) selectHandlers.forEach((fn) => fn(names[hit.instanceId]));
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
      if (!entry || entry[1] > 900) return void (el.style.display = 'none');
      v.copy(positions[names.indexOf(entry[0])]).setY(3.4).project(camera);
      if (v.z > 1) return void (el.style.display = 'none');
      el.style.display = 'block';
      el.textContent = entry[0];
      el.style.transform = `translate(-50%,-100%) translate(${((v.x + 1) / 2) * container.clientWidth}px,${((1 - v.y) / 2) * container.clientHeight}px)`;
    });
  }

  renderer.setAnimationLoop(() => {
    controls.update();
    updateLabels();
    renderer.render(scene, camera);
  });

  return { setPlayers, focus, onSelect: (fn) => selectHandlers.push(fn), dispose: () => renderer.dispose() };
}
