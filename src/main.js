import './style.css'
import * as THREE from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'

// --- GLOBAL VARIABLES & STATE ---
let isMobilePortrait = false;
let isStageTransitioned = false;

// Custom Snapping Grid Configuration (Strict 10x7 Grid)
const numCols = 10;
const numRows = 7;
let colWidth = window.innerWidth / 10;
let rowHeight = window.innerHeight / 7;
let mouseX = 0;
let mouseY = 0;

// Keyboard Cursor Navigation State
let useKeyboardCursor = false;
let kbdCol = 0;
let kbdRow = 0;

// Elements
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');
const terminalCursor = document.getElementById('terminal-cursor');
const scrollWrapper = document.getElementById('scroll-wrapper');
const portraitOverlay = document.getElementById('portrait-overlay');
const typewriterContainer = document.getElementById('typewriter-text');
const stage1 = document.getElementById('stage-1');
const threeContainer = document.getElementById('three-canvas-container');

// Hover Tracking
let hoveredHtmlElement = null;

// Three.js State
let renderer, scene, camera;
let letterGroups = []; // Parent group containers for each 3D letter
let pressedMesh = null;
let hovered3DLetterGroup = null;

// ASCII Noise Buffer for CRT Grain
let noiseCanvas, noiseCtx;

// --- INITIALIZATION ---
function init() {
  setupOrientationCheck();
  setupBgCanvas();
  setupCursorSnapping();
  setupKeyboardNavigation();
  
  if (!isMobilePortrait) {
    startStage1();
  }
}

// --- MOBILE PORTRAIT DETECTION ---
function setupOrientationCheck() {
  const checkOrientation = () => {
    const portrait = window.innerHeight > window.innerWidth;
    if (portrait !== isMobilePortrait) {
      isMobilePortrait = portrait;
      if (isMobilePortrait) {
        portraitOverlay.style.display = 'flex';
      } else {
        portraitOverlay.style.display = 'none';
        if (!typewriterContainer.dataset.started) {
          startStage1();
        }
      }
    }
    
    // Resize dimensions
    resizeBgCanvas();
    if (renderer) {
      resizeThreeJS();
    }
    resizeStage1Text();
  };

  window.addEventListener('resize', checkOrientation);
  checkOrientation();
}

// --- BACKGROUND CANVAS (CRT GRAIN STATIC) ---
function setupBgCanvas() {
  noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = 256;
  noiseCanvas.height = 256;
  noiseCtx = noiseCanvas.getContext('2d');
  const noiseImgData = noiseCtx.createImageData(256, 256);
  const noiseData = noiseImgData.data;
  for (let i = 0; i < noiseData.length; i += 4) {
    const val = Math.floor(Math.random() * 255);
    noiseData[i] = val;
    noiseData[i + 1] = val;
    noiseData[i + 2] = val;
    noiseData[i + 3] = 255;
  }
  noiseCtx.putImageData(noiseImgData, 0, 0);

  resizeBgCanvas();
  requestAnimationFrame(bgRenderLoop);
}

function resizeBgCanvas() {
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}

function bgRenderLoop() {
  bgCtx.fillStyle = '#000000';
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

  bgCtx.save();
  bgCtx.globalAlpha = 0.02;
  const pattern = bgCtx.createPattern(noiseCanvas, 'repeat');
  bgCtx.fillStyle = pattern;
  bgCtx.translate(Math.random() * 256, Math.random() * 256);
  bgCtx.fillRect(-256, -256, bgCanvas.width + 512, bgCanvas.height + 512);
  bgCtx.restore();

  requestAnimationFrame(bgRenderLoop);
}

// --- CUSTOM CURSOR & MOUSE SNAPPING ---
function setupCursorSnapping() {
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    // Switch back to mouse cursor mode on mouse movement
    useKeyboardCursor = false;
    updateCursorPosition();
  });

  document.addEventListener('mouseover', (e) => {
    const target = e.target;
    // Stage 1 interactive targets & Stage 2 link span character targets
    if (target.classList.contains('char-span') || target.classList.contains('prompt-char') || target.classList.contains('space-char') || target.classList.contains('terminal-link')) {
      hoveredHtmlElement = target;
      updateCursorPosition();
    }
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target;
    if (target === hoveredHtmlElement) {
      hoveredHtmlElement = null;
      updateCursorPosition();
    }
  });

  document.addEventListener('mouseenter', () => {
    terminalCursor.style.display = 'block';
  });

  document.addEventListener('mouseleave', () => {
    terminalCursor.style.display = 'none';
  });

}

// --- KEYBOARD ARROW & SPACE/ENTER NAVIGATION ---
function setupKeyboardNavigation() {
  window.addEventListener('keydown', (e) => {
    if (!isStageTransitioned) return;

    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'];
    if (keys.includes(e.key)) {
      e.preventDefault(); // Prevent standard page arrow scrolls

      if (!useKeyboardCursor) {
        // Init kbd grid coordinate from mouse position
        kbdCol = Math.floor(mouseX / colWidth);
        kbdRow = Math.floor(mouseY / rowHeight);
        useKeyboardCursor = true;
      } else {
        if (e.key === 'ArrowUp') {
          kbdRow = Math.max(0, kbdRow - 1);
        } else if (e.key === 'ArrowDown') {
          kbdRow = Math.min(numRows - 1, kbdRow + 1);
        } else if (e.key === 'ArrowLeft') {
          kbdCol = Math.max(0, kbdCol - 1);
        } else if (e.key === 'ArrowRight') {
          kbdCol = Math.min(numCols - 1, kbdCol + 1);
        }
      }

      // Space / Enter click down actions
      if (e.key === ' ' || e.key === 'Enter') {
        if (kbdRow === 2) { // Middle text row
          let letterIndex = -1;
          if (kbdCol >= 0 && kbdCol < 5) letterIndex = kbdCol;
          else if (kbdCol > 5 && kbdCol < 10) letterIndex = kbdCol - 1;

          if (letterIndex >= 0 && letterIndex < letterGroups.length) {
            pressedMesh = letterGroups[letterIndex];
            pressedMesh.depressZ = -1.5;
          }
        }
      }

      updateCursorPosition();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (!isStageTransitioned) return;

    if (e.key === ' ' || e.key === 'Enter') {
      if (pressedMesh) {
        pressedMesh.depressZ = 0;
        // Cycle active mesh through the 8 states
        pressedMesh.state = (pressedMesh.state + 1) % 8;
        updateLetterRepresentations(pressedMesh);
        pressedMesh = null;
        updateCursorPosition();
      } else if (kbdRow === 5 || kbdRow === 6) { // Links row
        if (kbdCol >= 1 && kbdCol <= 3) {
          window.open('https://github.com/Mason363', '_blank');
        } else if (kbdCol >= 6 && kbdCol <= 8) {
          window.open('https://makerworld.com/en/@roboting', '_blank');
        }
      }
    }
  });
}

function updateCursorPosition() {
  colWidth = window.innerWidth / 10;
  rowHeight = window.innerHeight / 7;

  // --- STAGE 1 SNAPPING ---
  if (!isStageTransitioned) {
    if (hoveredHtmlElement) {
      const rect = hoveredHtmlElement.getBoundingClientRect();
      terminalCursor.style.left = `${rect.left}px`;
      terminalCursor.style.top = `${rect.top}px`;
      terminalCursor.style.width = `${rect.width}px`;
      terminalCursor.style.height = `${rect.height}px`;
      return;
    }
    
    // Stage 1 Grid Snap
    const fs = parseFloat(document.querySelector('.command-line').style.fontSize || "80");
    const cellH = fs * 0.95;
    const cellW = fs * 0.53;
    const cmdLine = document.querySelector('.command-line');
    const rect = cmdLine ? cmdLine.getBoundingClientRect() : { left: 0, top: 0 };
    const gridX = rect.left % cellW;
    const gridY = rect.top % cellH;

    const cellX = Math.floor((mouseX - gridX) / cellW);
    const cellY = Math.floor((mouseY - gridY) / cellH);
    
    terminalCursor.style.left = `${cellX * cellW + gridX}px`;
    terminalCursor.style.top = `${cellY * cellH + gridY}px`;
    terminalCursor.style.width = `${cellW}px`;
    terminalCursor.style.height = `${cellH}px`;
    return;
  }

  // --- STAGE 2 SNAP SYSTEM ---
  const githubLink = document.querySelector('.terminal-link[data-link="github"]');
  const makerworldLink = document.querySelector('.terminal-link[data-link="makerworld"]');

  // Helper to clear link blinks
  const clearLinkBlinks = () => {
    if (githubLink) githubLink.classList.remove('blink-active');
    if (makerworldLink) makerworldLink.classList.remove('blink-active');
  };

  // Keyboard navigation snap path
  if (useKeyboardCursor) {
    if (kbdRow === 5 || kbdRow === 6) { // Links line Row
      if (kbdCol >= 1 && kbdCol <= 3) { // github spans columns 1-3
        const rect = githubLink.getBoundingClientRect();
        terminalCursor.style.left = `${rect.left}px`;
        terminalCursor.style.top = `${rect.top}px`;
        terminalCursor.style.width = `${rect.width}px`;
        terminalCursor.style.height = `${rect.height}px`;
        
        githubLink.classList.add('blink-active');
        if (makerworldLink) makerworldLink.classList.remove('blink-active');
        return;
      } else if (kbdCol >= 6 && kbdCol <= 8) { // makerworld spans columns 6-8
        const rect = makerworldLink.getBoundingClientRect();
        terminalCursor.style.left = `${rect.left}px`;
        terminalCursor.style.top = `${rect.top}px`;
        terminalCursor.style.width = `${rect.width}px`;
        terminalCursor.style.height = `${rect.height}px`;
        
        makerworldLink.classList.add('blink-active');
        if (githubLink) githubLink.classList.remove('blink-active');
        return;
      }
    }
    
    if (kbdRow === 2) { // Character Row
      let letterIndex = -1;
      if (kbdCol >= 0 && kbdCol < 5) letterIndex = kbdCol;
      else if (kbdCol > 5 && kbdCol < 10) letterIndex = kbdCol - 1;
      
      if (letterIndex >= 0 && letterIndex < letterGroups.length) {
        hovered3DLetterGroup = letterGroups[letterIndex];
        const rect = getProjectedRect(hovered3DLetterGroup, camera, window.innerWidth, window.innerHeight);
        
        terminalCursor.style.left = `${rect.left}px`;
        terminalCursor.style.top = `${rect.top}px`;
        terminalCursor.style.width = `${rect.width}px`;
        terminalCursor.style.height = `${rect.height}px`;
        return;
      }
    }

    // Default keyboard empty cell snap
    clearLinkBlinks();
    hovered3DLetterGroup = null;
    terminalCursor.style.left = `${kbdCol * colWidth}px`;
    terminalCursor.style.top = `${kbdRow * rowHeight}px`;
    terminalCursor.style.width = `${colWidth}px`;
    terminalCursor.style.height = `${rowHeight}px`;
    return;
  }

  // Mouse navigation snap path
  const githubRect = githubLink ? githubLink.getBoundingClientRect() : null;
  const makerworldRect = makerworldLink ? makerworldLink.getBoundingClientRect() : null;

  const col = Math.floor(mouseX / colWidth);
  const row = Math.floor(mouseY / rowHeight);

  // 1. Check GITHUB Bounding Box Snap or Grid Segment Snap (Row 5 or 6, Columns 1-3)
  const isOverGithubGrid = ((row === 5 || row === 6) && col >= 1 && col <= 3);
  const isOverGithubRect = (githubRect && mouseX >= githubRect.left && mouseX <= githubRect.right &&
                            mouseY >= githubRect.top && mouseY <= githubRect.bottom);
  if (githubRect && (isOverGithubGrid || isOverGithubRect)) {
    terminalCursor.style.left = `${githubRect.left}px`;
    terminalCursor.style.top = `${githubRect.top}px`;
    terminalCursor.style.width = `${githubRect.width}px`;
    terminalCursor.style.height = `${githubRect.height}px`;
    if (githubLink) githubLink.classList.add('blink-active');
    if (makerworldLink) makerworldLink.classList.remove('blink-active');
    return;
  }

  // 2. Check MAKERWORLD Bounding Box Snap or Grid Segment Snap (Row 5 or 6, Columns 6-8)
  const isOverMakerworldGrid = ((row === 5 || row === 6) && col >= 6 && col <= 8);
  const isOverMakerworldRect = (makerworldRect && mouseX >= makerworldRect.left && mouseX <= makerworldRect.right &&
                                mouseY >= makerworldRect.top && mouseY <= makerworldRect.bottom);
  if (makerworldRect && (isOverMakerworldGrid || isOverMakerworldRect)) {
    terminalCursor.style.left = `${makerworldRect.left}px`;
    terminalCursor.style.top = `${makerworldRect.top}px`;
    terminalCursor.style.width = `${makerworldRect.width}px`;
    terminalCursor.style.height = `${makerworldRect.height}px`;
    if (makerworldLink) makerworldLink.classList.add('blink-active');
    if (githubLink) githubLink.classList.remove('blink-active');
    return;
  }

  // 3. Check Letter Hit — test the projected bounding rect for each letter so that
  //    states > 0 (tilted / extruded) that extend outside row 2 still register correctly.
  let hitLetterGroup = null;
  for (let li = 0; li < letterGroups.length; li++) {
    const lg = letterGroups[li];
    const rect = getProjectedRect(lg, camera, window.innerWidth, window.innerHeight);
    if (mouseX >= rect.left && mouseX <= rect.left + rect.width &&
        mouseY >= rect.top  && mouseY <= rect.top  + rect.height) {
      hitLetterGroup = lg;
      hovered3DLetterGroup = lg;
      terminalCursor.style.left   = `${rect.left}px`;
      terminalCursor.style.top    = `${rect.top}px`;
      terminalCursor.style.width  = `${rect.width}px`;
      terminalCursor.style.height = `${rect.height}px`;
      clearLinkBlinks();
      break;
    }
  }
  if (!hitLetterGroup) hovered3DLetterGroup = null;
  if (hitLetterGroup) return;

  // 4. Fallback: Snap cursor to strict rectangular grid cell
  clearLinkBlinks();
  terminalCursor.style.left = `${col * colWidth}px`;
  terminalCursor.style.top = `${row * rowHeight}px`;
  terminalCursor.style.width = `${colWidth}px`;
  terminalCursor.style.height = `${rowHeight}px`;
}

// Project a 3D Group bounding box onto 2D screen coordinates
function getProjectedRect(group, camera, width, height) {
  // Find the currently active mesh to measure
  let activeMesh = group.getObjectByName('meshText');
  if (group.state === 1) activeMesh = group.getObjectByName('meshText3D');
  else if (group.state === 2) activeMesh = group.getObjectByName('groupCAD');
  else if (group.state === 3) activeMesh = group.getObjectByName('groupClaude');
  else if (group.state === 4) activeMesh = group.getObjectByName('groupAntigravity');
  else if (group.state === 5) activeMesh = group.getObjectByName('groupDesign');
  else if (group.state === 6) activeMesh = group.getObjectByName('groupSignature');
  else if (group.state === 7) activeMesh = group.getObjectByName('groupGlitch');

  if (!activeMesh) activeMesh = group;

  // Collect all world-space points of the geometries to project
  const worldPoints = [];
  activeMesh.updateMatrixWorld(true);

  activeMesh.traverse(child => {
    if ((child.isMesh || child.isLine || child.isLineSegments) && child.geometry) {
      const geom = child.geometry;
      if (!geom.boundingBox) geom.computeBoundingBox();
      const min = geom.boundingBox.min;
      const max = geom.boundingBox.max;
      
      const localCorners = [
        new THREE.Vector3(min.x, min.y, min.z),
        new THREE.Vector3(min.x, min.y, max.z),
        new THREE.Vector3(min.x, max.y, min.z),
        new THREE.Vector3(min.x, max.y, max.z),
        new THREE.Vector3(max.x, min.y, min.z),
        new THREE.Vector3(max.x, min.y, max.z),
        new THREE.Vector3(max.x, max.y, min.z),
        new THREE.Vector3(max.x, max.y, max.z)
      ];

      localCorners.forEach(pt => {
        pt.applyMatrix4(child.matrixWorld);
        worldPoints.push(pt);
      });
    }
  });

  // Fallback if no children with geometry found
  if (worldPoints.length === 0) {
    const box = new THREE.Box3().setFromObject(activeMesh);
    const min = box.min;
    const max = box.max;
    worldPoints.push(
      new THREE.Vector3(min.x, min.y, min.z),
      new THREE.Vector3(min.x, min.y, max.z),
      new THREE.Vector3(min.x, max.y, min.z),
      new THREE.Vector3(min.x, max.y, max.z),
      new THREE.Vector3(max.x, min.y, min.z),
      new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(max.x, max.y, min.z),
      new THREE.Vector3(max.x, max.y, max.z)
    );
  }

  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  worldPoints.forEach(pt => {
    pt.project(camera);
    const x = ((pt.x + 1) * width) / 2;
    const y = ((1 - pt.y) * height) / 2;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });

  const padding = 6;
  const rectL = Math.max(0, minX - padding);
  const rectT = Math.max(0, minY - padding);
  const rectW = Math.max(0, maxX - minX + padding * 2);
  const rectH = Math.max(0, maxY - minY + padding * 2);

  // We do NOT clamp maximum width/height so that the cursor scales in size to fit the animations
  // (taking area from neighboring grid cells as it gets bigger).
  return {
    left: rectL,
    top: rectT,
    width: rectW,
    height: rectH
  };
}

// --- STAGE 1: THE COMMAND SEQUENCE ---
function startStage1() {
  typewriterContainer.dataset.started = "true";
  resizeStage1Text();
  terminalCursor.style.display = 'block';

  const word = "whoami";
  let charIndex = 0;
  const typingInterval = 1000 / word.length;

  function typeNextChar() {
    if (charIndex < word.length) {
      const char = word[charIndex];
      const span = document.createElement('span');
      span.classList.add('char-span');
      span.innerHTML = char === ' ' ? '&nbsp;' : char;
      typewriterContainer.appendChild(span);

      charIndex++;
      updateCursorPosition();
      setTimeout(typeNextChar, typingInterval);
    } else {
      setTimeout(simulatedEnterKeypress, 500);
    }
  }

  setTimeout(typeNextChar, 500);
}

// Left-align Stage 1 Text
function resizeStage1Text() {
  const cmdLine = document.querySelector('.command-line');
  if (!cmdLine) return;

  const tempMeasure = document.createElement('div');
  tempMeasure.style.position = 'absolute';
  tempMeasure.style.visibility = 'hidden';
  tempMeasure.style.whiteSpace = 'nowrap';
  tempMeasure.style.fontFamily = getComputedStyle(cmdLine).fontFamily;
  tempMeasure.style.fontWeight = getComputedStyle(cmdLine).fontWeight;
  tempMeasure.style.fontSize = '100px';
  tempMeasure.innerHTML = '%&nbsp;whoami';
  document.body.appendChild(tempMeasure);
  const mWidth = tempMeasure.getBoundingClientRect().width;
  document.body.removeChild(tempMeasure);

  const targetW = window.innerWidth * 0.88;
  let dynamicFontSize = (targetW / mWidth) * 100;

  const maxFontSize = window.innerHeight * 0.3;
  if (dynamicFontSize > maxFontSize) {
    dynamicFontSize = maxFontSize;
  }

  cmdLine.style.fontSize = `${dynamicFontSize}px`;
}

function simulatedEnterKeypress() {
  startChoppyTransition();
}


// --- Snappy transition in bigger, even increments ---
function startChoppyTransition() {
  const viewportHeight = window.innerHeight;
  let currentY = 0;
  const targetY = -viewportHeight;
  
  // Snap in 20% viewport increments (exactly 5 snaps)
  const stepPct = 20;
  const stepPx = (viewportHeight * stepPct) / 100;
  const stepInterval = 80;

  function performScrollStep() {
    if (currentY > targetY) {
      currentY = Math.max(targetY, currentY - stepPx);
      scrollWrapper.style.transform = `translateY(${currentY}px)`;
      
      updateCursorPosition();
      setTimeout(performScrollStep, stepInterval);
    } else {
      isStageTransitioned = true;
      stage1.style.display = 'none';
      scrollWrapper.style.transform = `translateY(0)`; // Reset translation
      scrollWrapper.style.height = `100vh`;
      
      initThreeJSScene();
    }
  }

  setTimeout(performScrollStep, 100);
}

// --- STAGE 2: THREE.JS MULTI-STATE INTERACTIVE CORE ---
function initThreeJSScene() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 0, 45);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  threeContainer.appendChild(renderer.domElement);

  // Ambient & directional lighting for flat faces + clean side wireframes
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const mainDirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  mainDirLight.position.set(5, 10, 20);
  scene.add(mainDirLight);

  const loader = new FontLoader();
  loader.load(
    '/fonts/helvetiker_bold.typeface.json',
    (font) => {
      console.log('Font loaded successfully in Stage 2');
      buildThreeLetters(font);
      animateThree();
      setupThreeEvents();
    },
    undefined,
    (err) => {
      console.error('Error loading font in Stage 2:', err);
    }
  );
}

// State 3: Claude Code Terracotta Orange Block Builder
function createClaudeGroup(char) {
  const group = new THREE.Group();
  const addBox = (px, py, pz, sx, sy, sz) => {
    const boxGeom = new THREE.BoxGeometry(sx, sy, sz);
    const orangeMat = new THREE.MeshStandardMaterial({
      color: 0xdf6b53,
      roughness: 0.18,
      metalness: 0.1
    });
    const orangeMesh = new THREE.Mesh(boxGeom, orangeMat);
    orangeMesh.position.set(px, py, pz);
    
    // Initial flat state targets (custom morph animation)
    orangeMesh.name = 'block';
    orangeMesh.targetScaleZ = 0.05;
    orangeMesh.scale.set(1, 1, 0.05);

    group.add(orangeMesh);

    // Dark outline track
    const edges = new THREE.EdgesGeometry(boxGeom);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x1a0803, linewidth: 2 });
    const outline = new THREE.LineSegments(edges, lineMat);
    outline.name = 'outline';
    outline.position.copy(orangeMesh.position);
    outline.targetScaleZ = 0.05;
    outline.scale.set(1.05, 1.05, 0.05);
    group.add(outline);
  };

  switch (char) {
    case 'M':
      addBox(-1.3, 0, 0, 0.65, 4.0, 2.5);
      addBox(1.3, 0, 0, 0.65, 4.0, 2.5);
      addBox(-0.6, 1.0, 0, 0.65, 1.2, 2.5);
      addBox(0.6, 1.0, 0, 0.65, 1.2, 2.5);
      addBox(0, 0.1, 0, 0.65, 0.8, 2.5);
      break;
    case 'A':
      addBox(-1.3, -0.4, 0, 0.65, 3.2, 2.5);
      addBox(1.3, -0.4, 0, 0.65, 3.2, 2.5);
      addBox(0, 1.5, 0, 1.95, 0.65, 2.5);
      addBox(0, 0, 0, 1.95, 0.65, 2.5);
      break;
    case 'S':
      addBox(0, 1.7, 0, 3.25, 0.65, 2.5);
      addBox(-1.3, 0.85, 0, 0.65, 1.1, 2.5);
      addBox(0, 0, 0, 3.25, 0.65, 2.5);
      addBox(1.3, -0.85, 0, 0.65, 1.1, 2.5);
      addBox(0, -1.7, 0, 3.25, 0.65, 2.5);
      break;
    case 'O':
      addBox(-1.3, 0, 0, 0.65, 4.0, 2.5);
      addBox(1.3, 0, 0, 0.65, 4.0, 2.5);
      addBox(0, 1.7, 0, 1.95, 0.65, 2.5);
      addBox(0, -1.7, 0, 1.95, 0.65, 2.5);
      break;
    case 'N':
      addBox(-1.3, 0, 0, 0.65, 4.0, 2.5);
      addBox(1.3, 0, 0, 0.65, 4.0, 2.5);
      const diagGeom = new THREE.BoxGeometry(0.65, 3.4, 2.5);
      const orangeMat = new THREE.MeshStandardMaterial({ color: 0xdf6b53, roughness: 0.18 });
      const diagMesh = new THREE.Mesh(diagGeom, orangeMat);
      diagMesh.name = 'block';
      diagMesh.targetScaleZ = 0.05;
      diagMesh.scale.set(1, 1, 0.05);
      diagMesh.rotation.z = -0.55;
      group.add(diagMesh);
      
      const edges = new THREE.EdgesGeometry(diagGeom);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x1a0803, linewidth: 2 });
      const outline = new THREE.LineSegments(edges, lineMat);
      outline.name = 'outline';
      outline.rotation.z = diagMesh.rotation.z;
      outline.targetScaleZ = 0.05;
      outline.scale.set(1.05, 1.05, 0.05);
      group.add(outline);
      break;
    case 'C':
      addBox(-1.3, 0, 0, 0.65, 4.0, 2.5);
      addBox(0.2, 1.7, 0, 2.35, 0.65, 2.5);
      addBox(0.2, -1.7, 0, 2.35, 0.65, 2.5);
      break;
    case 'H':
      addBox(-1.3, 0, 0, 0.65, 4.0, 2.5);
      addBox(1.3, 0, 0, 0.65, 4.0, 2.5);
      addBox(0, 0, 0, 1.95, 0.65, 2.5);
      break;
    case 'E':
      addBox(-1.3, 0, 0, 0.65, 4.0, 2.5);
      addBox(0.2, 1.7, 0, 2.35, 0.65, 2.5);
      addBox(-0.1, 0, 0, 1.75, 0.65, 2.5);
      addBox(0.2, -1.7, 0, 2.35, 0.65, 2.5);
      break;
  }
  return group;
}

// State 4: Antigravity Neon Green ASCII cylinders
function createAntigravityGroup(char) {
  const group = new THREE.Group();
  const addStroke = (px, py, pz, rx, ry, rz, length) => {
    const cylGeom = new THREE.CylinderGeometry(0.12, 0.12, length, 8);
    const greenMat = new THREE.MeshStandardMaterial({
      color: 0x39ff14,
      emissive: 0x39ff14,
      emissiveIntensity: 0.7,
      roughness: 0.5
    });
    const mesh = new THREE.Mesh(cylGeom, greenMat);
    mesh.rotation.set(rx, ry, rz);
    mesh.position.set(px, py, pz);
    
    // Custom stroke drawing Y scale targets
    mesh.targetScaleY = 0;
    mesh.scale.set(1, 0, 1);

    group.add(mesh);
  };

  switch (char) {
    case 'M':
      addStroke(-1.3, 0, 0, 0, 0, 0, 4.0);
      addStroke(1.3, 0, 0, 0, 0, 0, 4.0);
      addStroke(-0.65, 1.0, 0, 0, 0, -1.0, 2.4);
      addStroke(0.65, 1.0, 0, 0, 0, 1.0, 2.4);
      break;
    case 'A':
      addStroke(-0.6, 0, 0, 0, 0, -0.25, 4.2);
      addStroke(0.6, 0, 0, 0, 0, 0.25, 4.2);
      addStroke(0, -0.5, 0, 0, 0, Math.PI / 2, 1.2);
      break;
    case 'S':
      addStroke(0, 1.7, 0, 0, 0, Math.PI / 2, 1.8);
      addStroke(-0.9, 0.85, 0, 0, 0, 0, 1.7);
      addStroke(0, 0, 0, 0, 0, Math.PI / 2, 1.8);
      addStroke(0.9, -0.85, 0, 0, 0, 0, 1.7);
      addStroke(0, -1.7, 0, 0, 0, Math.PI / 2, 1.8);
      break;
    case 'O':
      addStroke(-0.9, 0, 0, 0, 0, 0, 3.4);
      addStroke(0.9, 0, 0, 0, 0, 0, 3.4);
      addStroke(0, 1.7, 0, 0, 0, Math.PI / 2, 1.8);
      addStroke(0, -1.7, 0, 0, 0, Math.PI / 2, 1.8);
      break;
    case 'N':
      addStroke(-1.2, 0, 0, 0, 0, 0, 4.0);
      addStroke(1.2, 0, 0, 0, 0, 0, 4.0);
      addStroke(0, 0, 0, 0, 0, 1.03, 4.7);
      break;
    case 'C':
      addStroke(-0.9, 0, 0, 0, 0, 0, 3.4);
      addStroke(0, 1.7, 0, 0, 0, Math.PI / 2, 1.8);
      addStroke(0, -1.7, 0, 0, 0, Math.PI / 2, 1.8);
      break;
    case 'H':
      addStroke(-1.2, 0, 0, 0, 0, 0, 4.0);
      addStroke(1.2, 0, 0, 0, 0, 0, 4.0);
      addStroke(0, 0, 0, 0, 0, Math.PI / 2, 2.4);
      break;
    case 'E':
      addStroke(-0.9, 0, 0, 0, 0, 0, 3.4);
      addStroke(0, 1.7, 0, 0, 0, Math.PI / 2, 1.8);
      addStroke(0, 0, 0, 0, 0, Math.PI / 2, 1.2);
      addStroke(0, -1.7, 0, 0, 0, Math.PI / 2, 1.8);
      break;
  }
  return group;
}

// State 2: CAD Blueprint Cyan Wireframe Builder
function createCADGroup(char, font) {
  const group = new THREE.Group();
  const geom = new TextGeometry(char, {
    font: font,
    size: 4.5,
    depth: 2.2,
    curveSegments: 8,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.03,
    bevelSegments: 2
  });
  geom.center();

  // Blueprint blue backing body mesh (opacity fades in)
  const bodyMat = new THREE.MeshBasicMaterial({
    color: 0x003b6f,
    transparent: true,
    opacity: 0.0,
    depthWrite: false
  });
  const bodyMesh = new THREE.Mesh(geom, bodyMat);
  bodyMesh.name = 'bodyMesh';
  group.add(bodyMesh);

  // Cyan wireframe lines overlay (scale slides in)
  const edges = new THREE.EdgesGeometry(geom);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x00d2ff, linewidth: 1 });
  const outline = new THREE.LineSegments(edges, lineMat);
  outline.name = 'outline';
  outline.scale.set(0.01, 0.01, 0.01);
  group.add(outline);

  return group;
}

// State 5: 2D Design Chromatic Offset Builder (CMY offsets slide out on transition)
function createDesignGroup(char, font) {
  const group = new THREE.Group();
  const createLayer = (colorCode, ox, oy, oz, name) => {
    const geom = new TextGeometry(char, {
      font: font,
      size: 4.5,
      depth: 0.1,
      curveSegments: 8,
      bevelEnabled: false
    });
    geom.center();
    const mat = new THREE.MeshBasicMaterial({
      color: colorCode,
      transparent: true,
      opacity: 0.0, // starts hidden
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = name;
    mesh.position.set(0, 0, oz); // starts overlapped at center
    
    mesh.targetOpacity = 0.0;
    mesh.targetX = 0;
    mesh.targetY = 0;

    group.add(mesh);
  };

  createLayer(0x00ffff, -0.22, 0, 0, 'cyanLayer');      // Cyan
  createLayer(0xff00ff, 0.22, 0, 0.02, 'magentaLayer'); // Magenta
  createLayer(0xffff00, 0, -0.12, 0.04, 'yellowLayer'); // Yellow
  return group;
}

// State 6: Signature Cursive Golden Glowing Tube Builder (Curves are highly visible)
function createSignatureGroup(char) {
  const group = new THREE.Group();
  
  let points = [];
  switch (char) {
    case 'M':
      points = [
        new THREE.Vector3(-1.4, -1.8, 0),
        new THREE.Vector3(-0.8, 1.4, 0.2),
        new THREE.Vector3(0, -0.6, 0),
        new THREE.Vector3(0.8, 1.4, 0.2),
        new THREE.Vector3(1.4, -1.8, 0)
      ];
      break;
    case 'A':
      points = [
        new THREE.Vector3(0.6, 0.8, 0),
        new THREE.Vector3(0, 1.4, 0.2),
        new THREE.Vector3(-0.8, 0, 0),
        new THREE.Vector3(0, -1.2, 0.2),
        new THREE.Vector3(0.8, 0, 0),
        new THREE.Vector3(0.6, 1.0, 0.2),
        new THREE.Vector3(1.0, -1.6, 0)
      ];
      break;
    case 'S':
      points = [
        new THREE.Vector3(-0.8, -1.6, 0),
        new THREE.Vector3(0.2, 1.6, 0.2),
        new THREE.Vector3(-0.2, 1.4, 0),
        new THREE.Vector3(0.8, -0.6, 0.2),
        new THREE.Vector3(-0.6, -1.2, 0),
        new THREE.Vector3(0.8, -1.0, 0.2)
      ];
      break;
    case 'O':
      points = [
        new THREE.Vector3(0, 1.4, 0),
        new THREE.Vector3(-0.8, 0, 0.2),
        new THREE.Vector3(0, -1.4, 0),
        new THREE.Vector3(0.8, 0, 0.2),
        new THREE.Vector3(0, 1.2, 0),
        new THREE.Vector3(0.8, 1.5, 0.2)
      ];
      break;
    case 'N':
      points = [
        new THREE.Vector3(-1.2, -1.4, 0),
        new THREE.Vector3(-0.6, 1.4, 0.2),
        new THREE.Vector3(0.4, -1.6, 0),
        new THREE.Vector3(1.2, 1.4, 0.2)
      ];
      break;
    case 'C':
      points = [
        new THREE.Vector3(1.0, 1.4, 0),
        new THREE.Vector3(0, 1.6, 0.2),
        new THREE.Vector3(-1.0, 0, 0),
        new THREE.Vector3(0, -1.6, 0.2),
        new THREE.Vector3(1.0, -1.4, 0)
      ];
      break;
    case 'H':
      points = [
        new THREE.Vector3(-1.2, 1.6, 0.2),
        new THREE.Vector3(-1.2, -1.8, 0),
        new THREE.Vector3(-1.2, 0, 0.1),
        new THREE.Vector3(1.2, 0, 0.1),
        new THREE.Vector3(1.2, 1.6, 0.2),
        new THREE.Vector3(1.2, -1.8, 0)
      ];
      break;
    case 'E':
      points = [
        new THREE.Vector3(0.8, 1.4, 0),
        new THREE.Vector3(-0.6, 1.6, 0.2),
        new THREE.Vector3(-0.8, 0.6, 0),
        new THREE.Vector3(0.2, 0, 0.2),
        new THREE.Vector3(-0.8, -0.6, 0),
        new THREE.Vector3(-0.6, -1.6, 0.2),
        new THREE.Vector3(0.8, -1.4, 0)
      ];
      break;
  }

  if (points.length > 0) {
    const curve = new THREE.CatmullRomCurve3(points);
    // Draw thick continuous 3D tube for peak readability and high visibility
    const tubeGeom = new THREE.TubeGeometry(curve, 40, 0.26, 8, false);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffd700,
      emissiveIntensity: 0.7,
      roughness: 0.3
    });
    const tubeMesh = new THREE.Mesh(tubeGeom, goldMat);
    tubeMesh.name = 'tube';
    
    // Scale starts normal, animated writing effect via setDrawRange
    tubeMesh.writeProgress = 0;
    tubeMesh.scale.set(1, 1, 1);
    group.add(tubeMesh);
  }
  return group;
}

// State 7: Glitch horizontal slices (slide out on transition)
function createGlitchGroup(char) {
  const group = new THREE.Group();

  const topGroup = new THREE.Group(); topGroup.name = 'top';
  const midGroup = new THREE.Group(); midGroup.name = 'mid';
  const botGroup = new THREE.Group(); botGroup.name = 'bot';
  const topOutline = new THREE.Group(); topOutline.name = 'topOutline';
  const midOutline = new THREE.Group(); midOutline.name = 'midOutline';
  const botOutline = new THREE.Group(); botOutline.name = 'botOutline';

  [topGroup, midGroup, botGroup, topOutline, midOutline, botOutline].forEach(g => {
    g.targetX = 0;
    g.targetScaleX = 0.01;
    g.scale.set(0.01, 1, 1);
  });
  topOutline.scale.z = 0.01;
  midOutline.scale.z = 0.01;
  botOutline.scale.z = 0.01;

  group.add(topGroup);
  group.add(midGroup);
  group.add(botGroup);
  group.add(topOutline);
  group.add(midOutline);
  group.add(botOutline);

  const addSegment = (band, px, sx) => {
    let py = 0;
    let parentGroup, parentOutline;
    if (band === 'top') {
      py = 1.35;
      parentGroup = topGroup;
      parentOutline = topOutline;
    } else if (band === 'mid') {
      py = 0;
      parentGroup = midGroup;
      parentOutline = midOutline;
    } else {
      py = -1.35;
      parentGroup = botGroup;
      parentOutline = botOutline;
    }

    const boxGeom = new THREE.BoxGeometry(sx, 1.2, 2.0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(boxGeom, mat);
    mesh.position.set(px, py, 0);
    parentGroup.add(mesh);

    const edges = new THREE.EdgesGeometry(boxGeom);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x000000 });
    const outline = new THREE.LineSegments(edges, lineMat);
    outline.position.copy(mesh.position);
    outline.scale.set(1.05, 1.05, 1.0);
    parentOutline.add(outline);
  };

  switch (char) {
    case 'M':
      // Width 3.6
      addSegment('top', -1.35, 0.9);
      addSegment('top', 0, 0.8);
      addSegment('top', 1.35, 0.9);
      addSegment('mid', -1.35, 0.9);
      addSegment('mid', 1.35, 0.9);
      addSegment('bot', -1.35, 0.9);
      addSegment('bot', 1.35, 0.9);
      break;
    case 'A':
      // Width 3.2
      addSegment('top', 0, 2.2);
      addSegment('mid', 0, 3.2);
      addSegment('bot', -1.15, 0.9);
      addSegment('bot', 1.15, 0.9);
      break;
    case 'S':
      // Width 3.2
      addSegment('top', -1.15, 0.9);
      addSegment('top', 0.2, 2.8);
      addSegment('mid', 0, 3.2);
      addSegment('bot', -0.2, 2.8);
      addSegment('bot', 1.15, 0.9);
      break;
    case 'O':
      // Width 3.2
      addSegment('top', 0, 3.2);
      addSegment('mid', -1.15, 0.9);
      addSegment('mid', 1.15, 0.9);
      addSegment('bot', 0, 3.2);
      break;
    case 'N':
      // Width 3.2
      addSegment('top', -1.15, 0.9);
      addSegment('top', -0.5, 0.8);
      addSegment('top', 1.15, 0.9);
      addSegment('mid', -1.15, 0.9);
      addSegment('mid', 0, 0.8);
      addSegment('mid', 1.15, 0.9);
      addSegment('bot', -1.15, 0.9);
      addSegment('bot', 0.5, 0.8);
      addSegment('bot', 1.15, 0.9);
      break;
    case 'C':
      // Width 2.8
      addSegment('top', 0, 2.8);
      addSegment('mid', -0.95, 0.9);
      addSegment('bot', 0, 2.8);
      break;
    case 'H':
      // Width 3.2
      addSegment('top', -1.15, 0.9);
      addSegment('top', 1.15, 0.9);
      addSegment('mid', 0, 3.2);
      addSegment('bot', -1.15, 0.9);
      addSegment('bot', 1.15, 0.9);
      break;
    case 'E':
      // Width 2.8
      addSegment('top', 0, 2.8);
      addSegment('mid', -0.2, 2.4);
      addSegment('bot', 0, 2.8);
      break;
  }

  return group;
}

function buildThreeLetters(font) {
  const text = "MASON CHEN";
  letterGroups = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === ' ') continue;

    const charGroup = new THREE.Group();
    charGroup.charIndex = i;
    charGroup.charText = char;
    charGroup.state = 0; 
    
    charGroup.targetRotX = 0;
    charGroup.targetRotY = 0;
    charGroup.targetPosZ = 0;
    charGroup.depressZ = 0;

    // --- State 0: Flat 2D unshaded white text (MeshBasicMaterial) ---
    const geom2D = new TextGeometry(char, {
      font: font,
      size: 4.5,
      depth: 0.05, // very flat
      curveSegments: 12,
      bevelEnabled: false
    });
    geom2D.center();
    
    const mat2D = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0
    });
    const meshText = new THREE.Mesh(geom2D, mat2D);
    meshText.name = 'meshText';
    meshText.scale.set(1, 1, 1);
    charGroup.add(meshText);

    // --- State 1: Shaded 3D extruded white text (MeshStandardMaterial) ---
    const geom3D = new TextGeometry(char, {
      font: font,
      size: 4.5,
      depth: 2.2, // extruded deep Z-dimension
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: 0.15,
      bevelSize: 0.05,
      bevelOffset: 0,
      bevelSegments: 4
    });
    geom3D.center();
    
    const mat3D = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.1
    });
    const meshText3D = new THREE.Mesh(geom3D, mat3D);
    meshText3D.name = 'meshText3D';
    meshText3D.scale.set(0.01, 0.01, 0.01); // start collapsed
    meshText3D.visible = false;
    charGroup.add(meshText3D);

    // Outline details for State 1 3D (left here for compatibility and hidden)
    const edges = new THREE.EdgesGeometry(geom3D);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
    const textOutline = new THREE.LineSegments(edges, lineMat);
    textOutline.name = 'textOutline';
    textOutline.scale.set(1.002, 1.002, 1.002);
    textOutline.visible = false;
    charGroup.add(textOutline);

    // --- State 2: CAD blueprint cyan wireframe ---
    const groupCAD = createCADGroup(char, font);
    groupCAD.name = 'groupCAD';
    groupCAD.visible = false;
    charGroup.add(groupCAD);

    // --- State 3: Claude Code orange voxel blocks ---
    const groupClaude = createClaudeGroup(char);
    groupClaude.name = 'groupClaude';
    groupClaude.visible = false;
    charGroup.add(groupClaude);

    // --- State 4: Antigravity green ASCII neon cylinders ---
    const groupAntigravity = createAntigravityGroup(char);
    groupAntigravity.name = 'groupAntigravity';
    groupAntigravity.visible = false;
    charGroup.add(groupAntigravity);

    // --- State 5: 2D Design chromatic offsets ---
    const groupDesign = createDesignGroup(char, font);
    groupDesign.name = 'groupDesign';
    groupDesign.visible = false;
    charGroup.add(groupDesign);

    // --- State 6: Signature cursive golden curves ---
    const groupSignature = createSignatureGroup(char);
    groupSignature.name = 'groupSignature';
    groupSignature.visible = false;
    charGroup.add(groupSignature);

    // --- State 7: Glitch horizontal slices ---
    const groupGlitch = createGlitchGroup(char);
    groupGlitch.name = 'groupGlitch';
    groupGlitch.visible = false;
    charGroup.add(groupGlitch);

    scene.add(charGroup);
    letterGroups.push(charGroup);
  }

  resizeThreeJS();
}

function updateLetterRepresentations(group) {
  const state = group.state;
  const meshText = group.getObjectByName('meshText');
  const meshText3D = group.getObjectByName('meshText3D');
  const textOutline = group.getObjectByName('textOutline');
  const groupCAD = group.getObjectByName('groupCAD');
  const groupClaude = group.getObjectByName('groupClaude');
  const groupAntigravity = group.getObjectByName('groupAntigravity');
  const groupDesign = group.getObjectByName('groupDesign');
  const groupSignature = group.getObjectByName('groupSignature');
  const groupGlitch = group.getObjectByName('groupGlitch');

  // Reset targets
  meshText.visible = false;
  if (meshText3D) meshText3D.visible = false;
  if (textOutline) textOutline.visible = false;

  groupCAD.visible = false;
  groupClaude.visible = false;
  groupAntigravity.visible = false;
  groupDesign.visible = false;
  groupSignature.visible = false;
  groupGlitch.visible = false;

  // State target scale maps
  if (state === 0) {
    // Flat 2D White
    group.targetRotX = 0;
    group.targetRotY = 0;
    group.targetPosZ = 0;

    meshText.visible = true;
    meshText.scale.set(1, 1, 1);
  } else if (state === 1) {
    // Original 3D Extruded White, tilted (roughness and metalness standard material)
    group.targetRotX = -0.28;
    group.targetRotY = 0.38;
    group.targetPosZ = 1.2;

    if (meshText3D) {
      meshText3D.visible = true;
    }
  } else if (state === 2) {
    // CAD blueprint cyan wireframe
    group.targetRotX = -0.28;
    group.targetRotY = 0.38;
    group.targetPosZ = 1.2;
    groupCAD.visible = true;
    
    // Scale body & outline
    const body = groupCAD.getObjectByName('bodyMesh');
    const outline = groupCAD.getObjectByName('outline');
    body.material.opacity = 0.0; // will fade in
    outline.scale.set(0.01, 0.01, 0.01);
    outline.drawProgress = 0;
    if (outline.geometry) outline.geometry.setDrawRange(0, 0);
  } else if (state === 3) {
    // Claude Code orange blocks
    group.targetRotX = -0.28;
    group.targetRotY = 0.38;
    group.targetPosZ = 1.2;
    groupClaude.visible = true;
    
    // Extrude blocks start flat
    groupClaude.children.forEach(c => {
      c.scale.z = 0.05;
    });
  } else if (state === 4) {
    // Antigravity Green ASCII (draw strokes)
    group.targetRotX = -0.28;
    group.targetRotY = 0.38;
    group.targetPosZ = 1.2;
    groupAntigravity.visible = true;

    groupAntigravity.children.forEach(child => {
      child.scale.y = 0.0;
    });
  } else if (state === 5) {
    // 2D Design chromatic offsets (slide layers out)
    group.targetRotX = -0.28;
    group.targetRotY = 0.38;
    group.targetPosZ = 1.2;
    groupDesign.visible = true;

    const cyan = groupDesign.getObjectByName('cyanLayer');
    const mag = groupDesign.getObjectByName('magentaLayer');
    const yel = groupDesign.getObjectByName('yellowLayer');

    cyan.position.x = 0;
    mag.position.x = 0;
    yel.position.y = 0;

    cyan.material.opacity = 0;
    mag.material.opacity = 0;
    yel.material.opacity = 0;
  } else if (state === 6) {
    // Signature golden curves (write curves)
    group.targetRotX = -0.28;
    group.targetRotY = 0.38;
    group.targetPosZ = 1.2;
    groupSignature.visible = true;

    const tube = groupSignature.getObjectByName('tube');
    if (tube) {
      tube.scale.set(1, 1, 1);
      tube.writeProgress = 0;
      if (tube.geometry) tube.geometry.setDrawRange(0, 0);
    }
  } else if (state === 7) {
    // CRT Glitch horizontal slices (slide slices out)
    group.targetRotX = -0.28;
    group.targetRotY = 0.38;
    group.targetPosZ = 1.2;
    groupGlitch.visible = true;

    const top = groupGlitch.getObjectByName('top');
    const mid = groupGlitch.getObjectByName('mid');
    const bot = groupGlitch.getObjectByName('bot');
    const topO = groupGlitch.getObjectByName('topOutline');
    const midO = groupGlitch.getObjectByName('midOutline');
    const botO = groupGlitch.getObjectByName('botOutline');

    top.targetX = -0.35; top.scale.x = 0.01;
    topO.targetX = -0.35; topO.scale.x = 0.01;
    mid.targetX = 0.35; mid.scale.x = 0.01;
    midO.targetX = 0.35; midO.scale.x = 0.01;
    bot.targetX = -0.15; bot.scale.x = 0.01;
    botO.targetX = -0.15; botO.scale.x = 0.01;
  }
}

function resizeThreeJS() {
  if (!camera || !renderer || letterGroups.length === 0) return;

  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  colWidth = window.innerWidth / 10;
  rowHeight = window.innerHeight / 7;

  // Calculate 3D viewport dimensions at Z = 0
  const dist = camera.position.z;
  const fovRad = (camera.fov * Math.PI) / 180;
  const visibleH = 2 * Math.tan(fovRad / 2) * dist;
  const visibleW = visibleH * camera.aspect;

  const colWidth3D = visibleW / 10;
  const rowHeight3D = visibleH / 7;

  // Vertical center of Row 2: (2 + 0.5) * rowHeight = 2.5 * rowHeight
  const screenCenterY = 2.5 * rowHeight;
  const normY = -(screenCenterY / height) * 2 + 1;
  const tempV = new THREE.Vector3(0, normY, 0.5).unproject(camera);
  const dir = tempV.sub(camera.position).normalize();
  const rayDistance = -camera.position.z / dir.z;
  const target3DY = camera.position.y + dir.y * rayDistance;

  letterGroups.forEach((group, index) => {
    let charCol = index;
    if (index >= 5) {
      charCol = index + 1; // skip space column 5
    }
    
    // Center inside the grid column
    const targetX = -visibleW / 2 + (charCol + 0.5) * colWidth3D;
    group.position.set(targetX, target3DY, 0);

    // Scale characters to fit rectangular grid cells perfectly
    const maxColWidth3D = colWidth3D * 0.82;
    const maxRowHeight3D = rowHeight3D * 0.82;
    const charScale = Math.min(maxColWidth3D / 5.0, maxRowHeight3D / 4.5);
    group.scale.set(charScale, charScale, charScale);
  });
}

function animateThree() {
  requestAnimationFrame(animateThree);

  letterGroups.forEach(group => {
    // Lerp parent rotations and Z-positions
    group.rotation.x += (group.targetRotX - group.rotation.x) * 0.15;
    group.rotation.y += (group.targetRotY - group.rotation.y) * 0.15;

    const combinedZ = group.targetPosZ + group.depressZ;
    group.position.z += (combinedZ - group.position.z) * 0.22;

    const meshText = group.getObjectByName('meshText');
    const meshText3D = group.getObjectByName('meshText3D');
    const groupCAD = group.getObjectByName('groupCAD');
    const groupClaude = group.getObjectByName('groupClaude');
    const groupAntigravity = group.getObjectByName('groupAntigravity');
    const groupDesign = group.getObjectByName('groupDesign');
    const groupSignature = group.getObjectByName('groupSignature');
    const groupGlitch = group.getObjectByName('groupGlitch');

    const isHovered = (group === hovered3DLetterGroup);

    // 1. Lerp Solid Text
    // Flat 2D (State 0) scales up/down
    const targetScale2D = (group.state === 0) ? 1.0 : 0.0;
    meshText.scale.x += (targetScale2D - meshText.scale.x) * 0.15;
    meshText.scale.y += (targetScale2D - meshText.scale.y) * 0.15;
    meshText.scale.z += (targetScale2D - meshText.scale.z) * 0.15;
    meshText.visible = (meshText.scale.x > 0.01);

    if (meshText3D) {
      // State 1 (Original 3D) extrudes Z and tilts. Scales slightly larger on hover.
      const targetScale3D = (group.state === 1) ? (isHovered ? 1.15 : 1.0) : 0.0;
      meshText3D.scale.x += (targetScale3D - meshText3D.scale.x) * 0.15;
      meshText3D.scale.y += (targetScale3D - meshText3D.scale.y) * 0.15;
      meshText3D.scale.z += (targetScale3D - meshText3D.scale.z) * 0.15;
      
      meshText3D.visible = (meshText3D.scale.x > 0.01);
      
      // Original 3D shaded standard material color reactions
      meshText3D.material.color.setHex(isHovered ? 0xffffff : 0xdddddd);
    }

    // 2. Animate CAD Blueprint (Fades / wireframe scales and TRACES in)
    const body = groupCAD.getObjectByName('bodyMesh');
    const outline = groupCAD.getObjectByName('outline');
    if (group.state === 2) {
      body.material.opacity += (0.25 - body.material.opacity) * 0.15;
      outline.scale.x += (1.002 - outline.scale.x) * 0.15;
      outline.scale.y += (1.002 - outline.scale.y) * 0.15;
      outline.scale.z += (1.002 - outline.scale.z) * 0.15;

      outline.drawProgress = outline.drawProgress || 0;
      outline.drawProgress += (1.0 - outline.drawProgress) * 0.12;
      
      const geom = outline.geometry;
      if (geom) {
        const totalCount = geom.attributes.position.count;
        geom.setDrawRange(0, Math.floor(outline.drawProgress * totalCount));
      }
    } else {
      body.material.opacity += (0.0 - body.material.opacity) * 0.15;
      outline.scale.x += (0.01 - outline.scale.x) * 0.15;
      outline.scale.y += (0.01 - outline.scale.y) * 0.15;
      outline.scale.z += (0.01 - outline.scale.z) * 0.15;
      
      if (outline.drawProgress) {
        outline.drawProgress += (0.0 - outline.drawProgress) * 0.15;
        const geom = outline.geometry;
        if (geom) {
          geom.setDrawRange(0, Math.floor(outline.drawProgress * geom.attributes.position.count));
        }
      }
    }
    outline.material.color.setHex(isHovered ? 0xffffff : 0x00d2ff);

    // 3. Animate Claude orange blocks (Voxel blocks extrude out in Z with staggered speeds)
    groupClaude.children.forEach((c, idx) => {
      const targetZ = (group.state === 3) ? (isHovered ? 1.25 : 1.0) : 0.05;
      const speed = 0.1 + idx * 0.02; // Stagger voxel construction
      c.scale.z += (targetZ - c.scale.z) * speed;
      if (c.name === 'outline') {
        c.scale.x += ((group.state === 3 ? 1.05 : 0.05) - c.scale.x) * speed;
        c.scale.y += ((group.state === 3 ? 1.05 : 0.05) - c.scale.y) * speed;
      }
      
      // Hover highlight
      if (c.isMesh) {
        if (isHovered) {
          c.material.color.setHex(0xff8c73);
          c.material.emissive.setHex(0xdf6b53);
          c.material.emissiveIntensity = 0.55;
        } else {
          c.material.color.setHex(0xdf6b53);
          c.material.emissive.setHex(0x000000);
          c.material.emissiveIntensity = 0;
        }
      }
    });

    // 4. Animate Antigravity green ASCII (Neon cylinders draw/extrude in Y length with staggered rates)
    groupAntigravity.children.forEach((child, idx) => {
      const targetY = (group.state === 4) ? 1.0 : 0.0;
      const speed = 0.1 + idx * 0.04; // Stagger cylinder drawing
      child.scale.y += (targetY - child.scale.y) * speed;
      child.material.emissiveIntensity = isHovered ? 1.4 : 0.7;
    });

    // 5. Animate 2D Design chromatic offsets (Magenta/Cyan slide out from center)
    const cyan = groupDesign.getObjectByName('cyanLayer');
    const mag = groupDesign.getObjectByName('magentaLayer');
    const yel = groupDesign.getObjectByName('yellowLayer');
    
    if (group.state === 5) {
      const offsetAmt = isHovered ? 0.35 : 0.22;
      cyan.targetX = -offsetAmt;
      mag.targetX = offsetAmt;
      yel.targetY = -offsetAmt * 0.55;

      cyan.material.opacity += (0.8 - cyan.material.opacity) * 0.15;
      mag.material.opacity += (0.8 - mag.material.opacity) * 0.15;
      yel.material.opacity += (0.8 - yel.material.opacity) * 0.15;
    } else {
      cyan.targetX = 0;
      mag.targetX = 0;
      yel.targetY = 0;

      cyan.material.opacity += (0.0 - cyan.material.opacity) * 0.15;
      mag.material.opacity += (0.0 - mag.material.opacity) * 0.15;
      yel.material.opacity += (0.0 - yel.material.opacity) * 0.15;
    }
    cyan.position.x += (cyan.targetX - cyan.position.x) * 0.15;
    mag.position.x += (mag.targetX - mag.position.x) * 0.15;
    yel.position.y += (yel.targetY - yel.position.y) * 0.15;

    // 6. Animate Signature cursive Golden curves (curves write/extrude segment by segment)
    const tube = groupSignature.getObjectByName('tube');
    if (tube) {
      const targetProgress = (group.state === 6) ? 1.0 : 0.0;
      tube.writeProgress = tube.writeProgress || 0;
      tube.writeProgress += (targetProgress - tube.writeProgress) * 0.12;
      
      const geom = tube.geometry;
      if (geom) {
        const totalCount = geom.index ? geom.index.count : geom.attributes.position.count;
        const radialSegments = 8;
        const indicesPerStep = 6 * radialSegments;
        const steps = totalCount / indicesPerStep;
        const currentStep = Math.floor(tube.writeProgress * steps);
        geom.setDrawRange(0, currentStep * indicesPerStep);
      }
      tube.material.emissiveIntensity = isHovered ? 1.4 : 0.65;
    }

    // 7. Animate Glitch horizontal slices (flicker and slide horizontally)
    const gtop = groupGlitch.getObjectByName('top');
    const gmid = groupGlitch.getObjectByName('mid');
    const gbot = groupGlitch.getObjectByName('bot');
    const gtopO = groupGlitch.getObjectByName('topOutline');
    const gmidO = groupGlitch.getObjectByName('midOutline');
    const gbotO = groupGlitch.getObjectByName('botOutline');

    if (group.state === 7) {
      gtop.targetX = -0.35; gtop.targetScaleX = 1.0;
      gtopO.targetX = -0.35; gtopO.targetScaleX = 1.05;
      
      gmid.targetX = 0.35; gmid.targetScaleX = 1.0;
      gmidO.targetX = 0.35; gmidO.targetScaleX = 1.05;
      
      gbot.targetX = -0.15; gbot.targetScaleX = 1.0;
      gbotO.targetX = -0.15; gbotO.targetScaleX = 1.05;
    } else {
      gtop.targetX = 0; gtop.targetScaleX = 0.01;
      gtopO.targetX = 0; gtopO.targetScaleX = 0.01;
      
      gmid.targetX = 0; gmid.targetScaleX = 0.01;
      gmidO.targetX = 0; gmidO.targetScaleX = 0.01;
      
      gbot.targetX = 0; gbot.targetScaleX = 0.01;
      gbotO.targetX = 0; gbotO.targetScaleX = 0.01;
    }

    gtop.position.x += (gtop.targetX - gtop.position.x) * 0.15;
    gtop.scale.x += (gtop.targetScaleX - gtop.scale.x) * 0.15;
    gtopO.position.x += (gtopO.targetX - gtopO.position.x) * 0.15;
    gtopO.scale.x += (gtopO.targetScaleX - gtopO.scale.x) * 0.15;
    gtopO.scale.z += ((group.state === 7 ? 1.05 : 0.01) - gtopO.scale.z) * 0.15;

    gmid.position.x += (gmid.targetX - gmid.position.x) * 0.15;
    gmid.scale.x += (gmid.targetScaleX - gmid.scale.x) * 0.15;
    gmidO.position.x += (gmidO.targetX - gmidO.position.x) * 0.15;
    gmidO.scale.x += (gmidO.targetScaleX - gmidO.scale.x) * 0.15;
    gmidO.scale.z += ((group.state === 7 ? 1.05 : 0.01) - gmidO.scale.z) * 0.15;

    gbot.position.x += (gbot.targetX - gbot.position.x) * 0.15;
    gbot.scale.x += (gbot.targetScaleX - gbot.scale.x) * 0.15;
    gbotO.position.x += (gbotO.targetX - gbotO.position.x) * 0.15;
    gbotO.scale.x += (gbotO.targetScaleX - gbotO.scale.x) * 0.15;
    gbotO.scale.z += ((group.state === 7 ? 1.05 : 0.01) - gbotO.scale.z) * 0.15;

    // Hover wireframe highlight on glitch slices
    if (groupGlitch.visible) {
      const setGroupColor = (g, hex) => {
        if (!g) return;
        if (g.material) {
          g.material.color.setHex(hex);
        } else {
          g.traverse(child => {
            if (child.material) {
              child.material.color.setHex(hex);
            }
          });
        }
      };
      setGroupColor(gtopO, isHovered ? 0xffffff : 0x000000);
      setGroupColor(gmidO, isHovered ? 0xffffff : 0x000000);
      setGroupColor(gbotO, isHovered ? 0xffffff : 0x000000);
    }
  });

  renderer.render(scene, camera);
  updateCursorPosition();
}

function setupThreeEvents() {
  const onMouseDown = () => {
    if (!isStageTransitioned) return;
    // hovered3DLetterGroup is the single source of truth — set by updateCursorPosition
    // via projected-rect intersection, consistent with what the cursor visually shows.
    if (hovered3DLetterGroup) {
      pressedMesh = hovered3DLetterGroup;
      pressedMesh.depressZ = -1.5;
    }
  };

  const onMouseUp = () => {
    if (!isStageTransitioned) return;

    if (pressedMesh) {
      pressedMesh.depressZ = 0;
      // Only cycle state if the cursor is still over the same letter on release.
      if (hovered3DLetterGroup === pressedMesh) {
        pressedMesh.state = (pressedMesh.state + 1) % 8;
        updateLetterRepresentations(pressedMesh);
      }
      pressedMesh = null;
    }
  };

  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  // Fire links whenever the stylized cursor is over them (full grid zone, not just the <a> element)
  window.addEventListener('click', () => {
    if (!isStageTransitioned) return;

    const col = Math.floor(mouseX / colWidth);
    const row = Math.floor(mouseY / rowHeight);

    const githubLink = document.querySelector('.terminal-link[data-link="github"]');
    const makerworldLink = document.querySelector('.terminal-link[data-link="makerworld"]');
    const githubRect = githubLink ? githubLink.getBoundingClientRect() : null;
    const makerworldRect = makerworldLink ? makerworldLink.getBoundingClientRect() : null;

    const isOverGithubGrid = ((row === 5 || row === 6) && col >= 1 && col <= 3);
    const isOverGithubRect = githubRect && mouseX >= githubRect.left && mouseX <= githubRect.right &&
                             mouseY >= githubRect.top && mouseY <= githubRect.bottom;

    if (isOverGithubGrid || isOverGithubRect) {
      window.open('https://github.com/Mason363', '_blank');
      return;
    }

    const isOverMakerworldGrid = ((row === 5 || row === 6) && col >= 6 && col <= 8);
    const isOverMakerworldRect = makerworldRect && mouseX >= makerworldRect.left && mouseX <= makerworldRect.right &&
                                 mouseY >= makerworldRect.top && mouseY <= makerworldRect.bottom;

    if (isOverMakerworldGrid || isOverMakerworldRect) {
      window.open('https://makerworld.com/en/@roboting', '_blank');
    }
  });

  window.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      mouseX = e.touches[0].clientX;
      mouseY = e.touches[0].clientY;
      onMouseDown();
    }
  });

  window.addEventListener('touchend', () => {
    onMouseUp();
  });
}

// --- RUN PROGRAM ---
init();
