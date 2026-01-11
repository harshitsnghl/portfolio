import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#bg'),
  alpha: true,
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.setZ(30);
camera.position.setX(-3);
// Enable Layer 1 for Moon visualization
camera.layers.enable(1);

renderer.render(scene, camera);

// Resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Objects

// Torus
const geometry = new THREE.TorusGeometry(10, 3, 16, 100);
const material = new THREE.MeshStandardMaterial({
  color: 0xFFC640, // Interstellar Gold
  wireframe: true
});
const torus = new THREE.Mesh(geometry, material);

// Group for user interaction vs auto-rotation
const torusGroup = new THREE.Group();
torusGroup.add(torus);
scene.add(torusGroup);

// Lights (Layer 0 - Default Golden Scene)
const pointLight = new THREE.PointLight(0xFFD700, 2); // Golden Light
pointLight.position.set(5, 5, 5);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Soft ambient
scene.add(pointLight, ambientLight);

// Moon Lighting (Layer 1 - Isolated Silver Light)
const moonLight = new THREE.DirectionalLight(0xCCDDEE, 2.0); // Cool Silver-Blue, brighter
moonLight.position.set(10, 10, 10);
moonLight.layers.set(1);
scene.add(moonLight);

// Stars
function addStar() {
  const geometry = new THREE.SphereGeometry(0.2, 24, 24);
  const material = new THREE.MeshStandardMaterial({ color: 0xFFF8E7 }); // Warm star white
  const star = new THREE.Mesh(geometry, material);

  const [x, y, z] = Array(3)
    .fill()
    .map(() => THREE.MathUtils.randFloatSpread(100));

  star.position.set(x, y, z);
  scene.add(star);
}

Array(200).fill().forEach(addStar);

// Background
scene.background = new THREE.Color(0x020205); // Void Black


// Icosahedrons (Floating bits)
const icosahedrons = [];
function addIcosahedron() {
  const geometry = new THREE.IcosahedronGeometry(1, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0x6e6e6e, // Metallic grey debris
    wireframe: true
  });
  const mesh = new THREE.Mesh(geometry, material);

  const [x, y, z] = Array(3).fill().map(() => THREE.MathUtils.randFloatSpread(100));
  mesh.position.set(x, y, z);
  scene.add(mesh);
  icosahedrons.push(mesh);
}
Array(50).fill().forEach(addIcosahedron);


// Avatar (Cube)
const harshitTexture = new THREE.TextureLoader().load('/images/pad.jpg');
const harshit = new THREE.Mesh(
  new THREE.BoxGeometry(3, 3, 3),
  new THREE.MeshBasicMaterial({ map: harshitTexture })
);
scene.add(harshit);
harshit.position.z = -5;
harshit.position.x = 2;


// Moon
const moonTexture = new THREE.TextureLoader().load('/images/moon.jpg');
const normalTexture = new THREE.TextureLoader().load('/images/normal.jpg');
const moon = new THREE.Mesh(
  new THREE.SphereGeometry(3, 32, 32),
  new THREE.MeshStandardMaterial({
    map: moonTexture,
    normalMap: normalTexture,
    color: 0xEEEEFF, // Cool White tint
  })
);
scene.add(moon);
moon.layers.set(1); // Assign to Layer 1 (White Light Only)
moon.position.z = 30;
moon.position.setX(-10);


// Scroll Animation
function moveCamera() {
  const t = document.body.getBoundingClientRect().top;

  // Slower Moon Rotation
  moon.rotation.x += 0.005;
  moon.rotation.y += 0.0075;
  moon.rotation.z += 0.005;

  // Reduced scroll-based rotation for avatar, relying more on loop for constant motion
  harshit.rotation.y += 0.01;
  harshit.rotation.z += 0.01;

  camera.position.z = t * -0.01;
  camera.position.x = t * -0.0002;
  camera.rotation.y = t * -0.0002;
}
document.body.onscroll = moveCamera;
moveCamera();


// Interaction (Mouse Parallax)
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;
const windowHalfX = window.innerWidth / 2;
const windowHalfY = window.innerHeight / 2;

document.addEventListener('mousemove', (event) => {
  mouseX = (event.clientX - windowHalfX);
  mouseY = (event.clientY - windowHalfY);
});


// Animation Loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsedTime = clock.getElapsedTime();

  // Torus rotation (Constant Auto-Rotation)
  torus.rotation.x += 0.01;
  torus.rotation.y += 0.005;
  torus.rotation.z += 0.01;

  // Harshit (Cube) Rotation - RESTORED
  harshit.rotation.x -= 0.005;
  harshit.rotation.y -= 0.0025;
  harshit.rotation.z -= 0.005;

  // Floating Icosahedrons
  icosahedrons.forEach((el, i) => {
    el.rotation.x += 0.01;
    el.rotation.y += 0.01;
    el.position.y += Math.sin(elapsedTime + i) * 0.01;
  });

  // Parallax Smoothing (Applied to Group)
  targetX = mouseX * 0.001;
  targetY = mouseY * 0.001;

  // Mouse interaction affects the group orientation, not the spinning object itself
  torusGroup.rotation.y += 0.05 * (targetX - torusGroup.rotation.y);
  torusGroup.rotation.x += 0.05 * (targetY - torusGroup.rotation.x);

  renderer.render(scene, camera);
}

animate();