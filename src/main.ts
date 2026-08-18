import * as THREE from 'three';
import './style.css';
import { BLOCKS, BlockId, generateWorld, keyOf, terrainHeight, WORLD_SIZE } from './world';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <canvas id="game"></canvas>
  <div class="vignette"></div><div class="crosshair">+</div>
  <header class="hud topbar">
    <div class="brand"><span class="brand-cube">◆</span><strong>BLOCKHAVEN</strong></div>
    <div class="world-pill"><span class="pulse"></span> WORLD 01 <b>•</b> DAY <span id="day">1</span></div>
    <button id="pause" aria-label="Pause">Ⅱ</button>
  </header>
  <section class="hud stats">
    <div class="stat"><span class="heart">♥</span><div><small>HEALTH</small><div class="meter"><i></i></div></div><b>10</b></div>
    <div class="stat"><span class="food">●</span><div><small>HUNGER</small><div class="meter hunger"><i></i></div></div><b>10</b></div>
  </section>
  <aside class="hud objective">
    <small>▣ &nbsp; OBJECTIVE</small><strong>Build your first shelter</strong>
    <span>Gather wood and place 10 blocks</span><div class="progress"><i id="progress"></i></div>
    <em><span id="placed">0</span> / 10 BLOCKS</em>
  </aside>
  <div class="hud toast" id="toast"><b>WELCOME, EXPLORER</b><span>Click to enter your world</span></div>
  <footer class="hud bottom">
    <div class="tips"><span><kbd>WASD</kbd> MOVE</span><span><kbd>SPACE</kbd> JUMP</span><span><i>◉</i> MINE</span><span><i>◎</i> PLACE</span></div>
    <div class="hotbar" id="hotbar"></div>
    <div class="coords">POSITION<br><b id="coords">X 0 &nbsp; Y 0 &nbsp; Z 0</b></div>
  </footer>
  <div class="menu" id="menu">
    <div class="menu-card"><div class="logo-cube">◈</div><p>SURVIVAL SANDBOX</p><h1>BLOCK<span>HAVEN</span></h1>
      <div class="rule"></div><p class="tagline">A WORLD SHAPED BY YOU</p>
      <button id="play"><span>▶</span> ENTER WORLD</button>
      <div class="controls"><span><kbd>WASD</kbd> Move</span><span><kbd>SPACE</kbd> Jump</span><span><kbd>1—6</kbd> Select</span><span>Mouse Mine / Place</span></div>
      <small>Your world saves automatically in this browser</small>
    </div>
  </div>`;

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9dd8ff);
scene.fog = new THREE.Fog(0xb9def2, 22, 58);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 100);
camera.rotation.order = 'YXZ';

scene.add(new THREE.HemisphereLight(0xd9efff, 0x5c6c47, 2.1));
const sun = new THREE.DirectionalLight(0xfff1ce, 3.2);
sun.position.set(-18, 28, 12); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = sun.shadow.camera.bottom = -25;
sun.shadow.camera.right = sun.shadow.camera.top = 25; scene.add(sun);

const seed = 47;
const stored = localStorage.getItem('blockhaven-world');
let blocks = stored ? new Map<string, BlockId>(JSON.parse(stored)) : generateWorld(seed);
const blockGroup = new THREE.Group(); scene.add(blockGroup);
const geometry = new THREE.BoxGeometry(1, 1, 1);
const materials = new Map<BlockId, THREE.MeshLambertMaterial>();
BLOCKS.forEach(b => materials.set(b.id, new THREE.MeshLambertMaterial({ color: b.color, flatShading: true })));
const meshes: THREE.Mesh[] = [];

function rebuildWorld() {
  blockGroup.clear(); meshes.length = 0;
  const byType = new Map<BlockId, Array<[number, number, number]>>();
  blocks.forEach((id, key) => {
    const [x, y, z] = key.split(',').map(Number);
    const exposed = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]
      .some(([dx,dy,dz]) => !blocks.has(keyOf(x+dx,y+dy,z+dz)));
    if (exposed) (byType.get(id) ?? (byType.set(id, []), byType.get(id)!)).push([x,y,z]);
  });
  byType.forEach((positions, id) => {
    const mesh = new THREE.InstancedMesh(geometry, materials.get(id)!, positions.length);
    const matrix = new THREE.Matrix4();
    positions.forEach(([x,y,z], i) => mesh.setMatrixAt(i, matrix.makeTranslation(x,y,z)));
    mesh.userData.positions = positions; mesh.userData.blockId = id;
    mesh.castShadow = true; mesh.receiveShadow = true; blockGroup.add(mesh); meshes.push(mesh);
  });
}
rebuildWorld();

const water = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE + 16, WORLD_SIZE + 16), new THREE.MeshPhysicalMaterial({ color: 0x42aee8, transparent: true, opacity: .55, roughness: .18, metalness: .08 }));
water.rotation.x = -Math.PI / 2; water.position.y = 4.42; scene.add(water);

const player = new THREE.Vector3(0, terrainHeight(0, 0, seed) + 2.7, 3);
let velocityY = 0, yaw = 0, pitch = -0.12, selected = 0, placed = 0;
const keys = new Set<string>();
const raycaster = new THREE.Raycaster(); raycaster.far = 6;
const selector = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04,1.04,1.04)), new THREE.LineBasicMaterial({ color: 0xffffff }));
selector.visible = false; scene.add(selector);

const hotbar = document.querySelector('#hotbar')!;
BLOCKS.forEach((block, i) => hotbar.insertAdjacentHTML('beforeend', `<button class="slot ${i === 0 ? 'active' : ''}" data-i="${i}" title="${block.name}"><span>${i+1}</span><i style="--block:${block.css}"></i><small>${block.name}</small><b>∞</b></button>`));
function choose(index: number) {
  selected = (index + BLOCKS.length) % BLOCKS.length;
  document.querySelectorAll('.slot').forEach((el, i) => el.classList.toggle('active', i === selected));
}
document.querySelectorAll<HTMLButtonElement>('.slot').forEach(b => b.onclick = () => choose(Number(b.dataset.i)));

function save() { localStorage.setItem('blockhaven-world', JSON.stringify([...blocks])); }
function targetBlock() {
  raycaster.setFromCamera(new THREE.Vector2(), camera);
  const hit = raycaster.intersectObjects(meshes, false)[0];
  if (!hit || hit.instanceId === undefined) return null;
  return { hit, pos: (hit.object.userData.positions as Array<[number,number,number]>)[hit.instanceId] };
}
canvas.addEventListener('mousedown', e => {
  if (document.pointerLockElement !== canvas) { canvas.requestPointerLock(); return; }
  const target = targetBlock(); if (!target) return;
  const [x,y,z] = target.pos;
  if (e.button === 0 && y > 0) blocks.delete(keyOf(x,y,z));
  if (e.button === 2 && target.hit.face) {
    const n = target.hit.face.normal; const nx=x+n.x, ny=y+n.y, nz=z+n.z;
    if (new THREE.Vector3(nx,ny,nz).distanceTo(player) > 1.4) { blocks.set(keyOf(nx,ny,nz), BLOCKS[selected].id); placed++; }
  }
  rebuildWorld(); save();
  document.querySelector('#placed')!.textContent = String(Math.min(placed, 10));
  (document.querySelector('#progress') as HTMLElement).style.width = `${Math.min(placed * 10, 100)}%`;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) { yaw -= e.movementX * .0022; pitch = THREE.MathUtils.clamp(pitch - e.movementY * .0022, -1.52, 1.52); } });
addEventListener('keydown', e => { keys.add(e.code); if (/^Digit[1-6]$/.test(e.code)) choose(Number(e.code.at(-1))-1); });
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('wheel', e => choose(selected + Math.sign(e.deltaY)));

const menu = document.querySelector('#menu')!;
document.querySelector<HTMLButtonElement>('#play')!.onclick = () => { menu.classList.add('hidden'); canvas.requestPointerLock(); };
document.querySelector<HTMLButtonElement>('#pause')!.onclick = () => { document.exitPointerLock(); menu.classList.remove('hidden'); };
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement === canvas) menu.classList.add('hidden'); });

const clock = new THREE.Clock(); let elapsed = 0;
function solidAt(x: number, y: number, z: number) { return blocks.has(keyOf(Math.round(x), Math.floor(y), Math.round(z))); }
function animate() {
  requestAnimationFrame(animate); const dt = Math.min(clock.getDelta(), .05); elapsed += dt;
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const move = new THREE.Vector3();
  if (keys.has('KeyW')) move.add(forward); if (keys.has('KeyS')) move.sub(forward);
  if (keys.has('KeyD')) move.add(right); if (keys.has('KeyA')) move.sub(right);
  if (move.lengthSq()) move.normalize().multiplyScalar(dt * (keys.has('ShiftLeft') ? 7 : 4.5));
  const next = player.clone().add(move);
  if (!solidAt(next.x, player.y - 1.5, player.z)) player.x = next.x;
  if (!solidAt(player.x, player.y - 1.5, next.z)) player.z = next.z;
  const onGround = solidAt(player.x, player.y - 1.7, player.z);
  if (onGround && velocityY <= 0) { velocityY = 0; player.y = Math.floor(player.y - 1.7) + 2.7; if (keys.has('Space')) velocityY = 7; }
  else velocityY -= 18 * dt;
  player.y += velocityY * dt;
  if (player.y < 1) { player.set(0, terrainHeight(0,0,seed)+3, 3); velocityY = 0; }
  camera.position.copy(player); camera.rotation.set(pitch, yaw, 0);
  const target = targetBlock(); selector.visible = Boolean(target);
  if (target) selector.position.set(...target.pos);
  const daylight = .75 + Math.sin(elapsed * .035) * .25; sun.intensity = 2.5 * daylight;
  water.position.y = 4.43 + Math.sin(elapsed * .7) * .025;
  document.querySelector('#coords')!.textContent = `X ${Math.round(player.x)}   Y ${Math.round(player.y)}   Z ${Math.round(player.z)}`;
  renderer.render(scene, camera);
}
animate();
addEventListener('resize', () => { camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
