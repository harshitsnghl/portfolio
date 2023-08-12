import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Setup

// Scene == container
const scene = new THREE.Scene();
// Perpective Camera mimics what human eyes would see
let camera;
let renderer;
function setup() {
  let innerWidth = window.innerWidth;
  let innerHeight = window.innerHeight + 100;

  camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#bg'),
  });
  
  renderer.setPixelRatio(window.devicePixelRatio);
  // To make it fullscreen
  renderer.setSize(innerWidth, innerHeight);
  // To give better perpective
  camera.position.setZ(30);
  camera.position.setX(-3);
  
  renderer.render(scene, camera);
}
setup();

let orientation;
let portrait = window.matchMedia("(orientation: portrait)");

portrait.addEventListener("change", function(e) {
    if(e.matches) {
      orientation = 'p'
    } else {
      orientation = 'l'
    }
    setup();
})

// Torus

const geometry = new THREE.TorusGeometry(10, 3, 16, 100);
const material = new THREE.MeshStandardMaterial({ wireframe: true, color: 0xffffff, roughness:1, fog: true, flatShading: true });
const torus = new THREE.Mesh(geometry, material);
scene.add(torus);
scene.add(torus);

// Lights

const pointLight = new THREE.PointLight(0xffffff);
pointLight.position.set(5, 5, 5);

const ambientLight = new THREE.AmbientLight(0xffffff);
scene.add(pointLight, ambientLight);

// Helpers

// const lightHelper = new THREE.PointLightHelper(pointLight)
// const gridHelper = new THREE.GridHelper(200, 50);
// scene.add(lightHelper, gridHelper)

const controls = new OrbitControls(camera, renderer.domElement);

function addStar() {
  const geometry = new THREE.SphereGeometry(0.1, 10, 10);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness:1 });
  const star = new THREE.Mesh(geometry, material);

  const [x, y, z] = Array(3)
    .fill()
    .map(() => THREE.MathUtils.randFloatSpread(100));

  star.position.set(x, y, z);
  scene.add(star);
}

Array(1000).fill().forEach(addStar);

// Background

const spaceTexture = new THREE.TextureLoader().load(orientation === 'l' ? '/images/spacel.jpg' : '/images/spacep.jpg');
scene.background = spaceTexture;

// Avatar

const harshitTexture = new THREE.TextureLoader().load('/images/pad.jpg');

const harshit = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshBasicMaterial({ map: harshitTexture, flatShading: true, fog: true, opacity: 0.5 }));

scene.add(harshit);

// Moon

const moonTexture = new THREE.TextureLoader().load('/images/moon1.jpg');
const normalTexture = new THREE.TextureLoader().load('/images/normal.jpg');

const moon = new THREE.Mesh(
  new THREE.SphereGeometry(3, 32, 32),
  new THREE.MeshStandardMaterial({
    map: moonTexture,
    normalMap: normalTexture,
  })
);

scene.add(moon);

moon.position.z = 30;
moon.position.setX(-10);

harshit.position.z = -5;
harshit.position.x = 2;

// Scroll Animation

function moveCamera() {
  const t = document.body.getBoundingClientRect().top;
  moon.rotation.x += 0.05;
  moon.rotation.y += 0.075;
  moon.rotation.z += 0.05;

  harshit.rotation.y += 0.01;
  harshit.rotation.z += 0.01;

  camera.position.z = t * -0.01;
  camera.position.x = t * -0.0002;
  camera.rotation.y = t * -0.0002;
}

document.body.onscroll = moveCamera;
moveCamera();

// Animation Loop

function animate() {
  requestAnimationFrame(animate);

  torus.rotation.x += 0.01;
  torus.rotation.y += 0.005;
  torus.rotation.z += 0.01;

  harshit.rotation.x -= 0.01;
  harshit.rotation.y -= 0.005;
  harshit.rotation.z -= 0.01;

  moon.rotation.x += 0.005;

  // controls.update();

  renderer.render(scene, camera);
}

animate();


window.onresize = function(){ setup(); }