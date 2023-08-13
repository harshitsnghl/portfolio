import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Setup

// Scene == container
const scene = new THREE.Scene();
// Perpective Camera mimics what human eyes would see
let camera;
let renderer;
let innerWidth;
let innerHeight;
function setup() {
  innerWidth = window.innerWidth + 200;
  innerHeight = window.innerHeight + 200;

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
const material = new THREE.MeshStandardMaterial({ wireframe: true, color: 0xffffff, emmisive: 0xffffff });
const torus = new THREE.Mesh(geometry, material);
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
  const geometry = new THREE.SphereGeometry(0.2, 10, 10);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness:1 });
  const star = new THREE.Mesh(geometry, material);

  const [x, y, z] = Array(3)
    .fill()
    .map(() => THREE.MathUtils.randFloatSpread(250));

  star.position.set(x, y, z);
  scene.add(star);
}

Array(2000).fill().forEach(addStar);

// Icosahedron
const icosahedronArr = []
function addIcosahedron() {
  const geometry = new THREE.IcosahedronGeometry(2, 0);
  const material = new THREE.MeshStandardMaterial({ wireframe: true, color: 0xffffff, emmisive: 0xffffff });
  const icosahedron = new THREE.Mesh(geometry, material);

  const [x, y, z] = Array(3)
    .fill()
    .map(() => THREE.MathUtils.randFloatSpread(300));

  icosahedron.position.set(x, y, z);
  scene.add(icosahedron);
  icosahedronArr.push(icosahedron);
}

Array(500).fill().forEach(addIcosahedron);

// Background
// const spaceTexture = new THREE.TextureLoader().load(orientation === 'l' ? '/images/spacel.jpg' : '/images/spacep.jpg')
const spaceTexture = new THREE.TextureLoader().load('/images/space.svg')
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
  moon.rotation.x += 0.03;
  moon.rotation.y += 0.05;
  moon.rotation.z += 0.03;

  harshit.rotation.y -= 0.02;
  harshit.rotation.z -= 0.02;

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

  harshit.rotation.x -= 0.005;
  harshit.rotation.y -= 0.0025;
  harshit.rotation.z -= 0.005;

  moon.rotation.x += 0.005;


  icosahedronArr.forEach((el,i) => {
    const x = 0.01 + (0.0001 * i);
    const y = 0.005 + (0.00005 * i);
    const z = 0.01 + (0.0001 * i);
    el.rotation.x += x;
    el.rotation.y += y;
    el.rotation.z += y;
  })

  // controls.update();

  renderer.render(scene, camera);
}

animate();


window.onresize = function(event){
  if(event.target.innerHeight > innerHeight + 200 || event.target.innerWidth > innerWidth) {
    setup();
  } 
}