import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- YAPILANDIRMA ---
const CONFIG = {
    speed: 0.4, // Biraz yavaşlattık, daha sinematik
    rotationSmoothness: 0.1,
    auroraDist: 300,
    colors: {
        fogStart: new THREE.Color(0xaaccff),
        fogNight: new THREE.Color(0x051025),
        auroraGreen: new THREE.Color(0x00ffcc),
        auroraPurple: new THREE.Color(0x9933ff),
        auroraBlue: new THREE.Color(0x0077ff), // Deep Blue color for variety
        groundStart: new THREE.Color(0xffffff),
        groundNight: new THREE.Color(0x445577),
        iglooLight: new THREE.Color(0xff6600),
        auroraPink: new THREE.Color(0xFF69B4), // Hot Pink
        auroraDark: new THREE.Color(0x2E004F), // Deep Purple
        valentineNight: new THREE.Color(0x1a0a2e), // Deep purple night for Valentine's
        valentineSnow: new THREE.Color(0xffeef8), // Slightly pink-tinted snow
        snow: new THREE.Color(0xffffff)
    }
};

let scene, camera, renderer, controls, composer;
let heroPenguin, herdGroup, loveInterest, guideArrow;
let auroraRibbons = [];
let starSystem, snowSystem, heartSystem, pinkGuidance;
let iglooGroup = new THREE.Group();
const arrowDir = new THREE.Vector3();

// Çarpışma Sistemi
let collidables = [];

// State Machine
let gamePhase = 'WALKING'; // WALKING, FOUND_VILLAGE, HUGGING, LETTER_GIVEN, PARTNER_CONTROL, TOBOGGAN, ENDING
let hugTimer = 0;
const LOVE_DIST = 8.0;

const keys = {
    w: false, a: false, s: false, d: false,
    arrowup: false, arrowdown: false, arrowleft: false, arrowright: false
};
let clock = new THREE.Clock();

// New Gameplay Variables
let activePenguin;
let tobogganSpeed = 0;

// ===== COMPETITIVE SCORES =====
let blueScore = 0;   // Blue Penguin (Hero) - Player 1
let pinkScore = 0;   // Pink Penguin (Love Interest) - Player 2

let tobogganDistance = 0;
let obstacles = [];
let collectibles = [];
let trailParticles = [];
const TOBOGGAN_MAX_SPEED = 1.2;
const WIN_SCORE = 10;  // First to 10 wins!

let iceBrickTexture;

function getGroundHeight(x, z) {
    // Village area (Flat-ish)
    if (z > -500) {
        return Math.sin(x * 0.02) * 2.5 + Math.cos(z * 0.03) * 2.5 + Math.sin(x * 0.1) * 0.5;
    }
    // Downhill Slope (Mountain)
    else {
        // Smooth transition at -500
        const villageHeight = Math.sin(x * 0.02) * 2.5 + Math.cos(-500 * 0.03) * 2.5 + Math.sin(x * 0.1) * 0.5;
        const slopeDist = -(z + 500); // Positive value increasing as we go deeper
        // steep drop: 0.5 height per 1 unit length
        return villageHeight - (slopeDist * 0.5) + (Math.sin(x * 0.1) * 0.5);
    }
}

// --- DOKU OLUŞTURUCU ---
function createIceTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ccddff';
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = '#ffffff';
    const brickH = 64;
    const brickW = 128;

    for (let y = 0; y < 512; y += brickH) {
        const offset = (y / brickH) % 2 === 0 ? 0 : brickW / 2;
        for (let x = -brickW; x < 512; x += brickW) {
            const shade = 240 + Math.random() * 15;
            ctx.fillStyle = `rgb(${shade}, ${shade}, ${255})`;
            ctx.fillRect(x + offset + 2, y + 2, brickW - 4, brickH - 4);
        }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 2);
    return tex;
}


function init() {
    scene = new THREE.Scene();
    scene.background = CONFIG.colors.fogStart.clone();
    scene.fog = new THREE.FogExp2(CONFIG.colors.fogStart, 0.015);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);
    camera.position.set(0, 5, -20); // Standard start position

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.7; // Parlaklığı düşürdük
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    const renderScene = new RenderPass(scene, camera);
    // Modified Bloom for Dreamy Look
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.6; // Lower threshold to make snow/hearts glow
    bloomPass.strength = 0.4;
    bloomPass.radius = 0.5;

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1; // Daha hızlı takip etsin (lag olmasın)
    controls.enablePan = false;
    controls.minDistance = 5;
    controls.maxDistance = 60; // Increased to allow seeing more sky from further away
    controls.maxPolarAngle = Math.PI; // Allow full freedom to look up/down (clamped by collision)
    controls.minPolarAngle = 0;

    iceBrickTexture = createIceTexture();

    setupLights();
    createGround();
    createEnvironment();
    createStars();
    createSnow(); // Hareketli kar
    createAuroraCurtains();
    createIglooVillage();
    createHeartParticles(); // Kalp sistemi
    createTobogganFireworks(); // Havai Fişek Sistemi Başlatıcı
    createPinkGuidance();   // Pembe rehber ışık

    // Kahraman (Mavi Atkı)
    heroPenguin = createPenguin(true, 0xffffff, 0x0077ff);
    scene.add(heroPenguin);

    // Dişi Penguen (Pembe Atkı)
    loveInterest = createPenguin(false, 0xffcccc, 0xff69b4);
    // Köyün ortasına yerleştir
    const loveX = 0;
    const loveZ = -350;
    loveInterest.position.set(loveX, getGroundHeight(loveX, loveZ), loveZ);
    loveInterest.rotation.y = Math.PI;
    scene.add(loveInterest);

    // Initial Active Penguin
    activePenguin = heroPenguin;

    // Create Path for next phase
    createDecoratedPath();

    // COLLISION REMOVED: Prevent getting stuck after hug
    // collidables.push({ x: loveX, z: loveZ, radius: 2 });



    createHerd();

    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', (e) => handleKey(e, true));
    document.addEventListener('keyup', (e) => handleKey(e, false));

    animate();
}

function setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.4); // Ortam ışığını azalttık
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 0.8); // Güneş şiddetini azalttık 
    sun.position.set(100, 200, 100);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    const d = 200;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    scene.add(sun);

    const auroraLight = new THREE.PointLight(CONFIG.colors.auroraGreen, 0, 300);
    auroraLight.name = "auroraLight";
    auroraLight.position.set(0, 100, 0);
    scene.add(auroraLight);
}

function createGround() {
    // Huge ground for infinite slide feeling
    // 2000 width, 60000 depth
    // Centered at Z = -25000 (Covers +5000 to -55000)
    const geo = new THREE.PlaneGeometry(2000, 60000, 64, 1500);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i); // This is Z in plane space before rotation
        // But our getGroundHeight takes World X, Z.
        // When we rotate -PI/2, Plane Y becomes World Z?
        // Let's verify: Plane lays on XY. We rotate X -90. Plane Y becomes -Z.
        // Actually, Plane Y+ is top. Rotate X -90 -> Top points -Z.
        // So Plane Y corresponds to -World Z (roughly, depending on frame).

        // However, we just want to set Z (height) based on X,Y.
        // Let's assume we map Plane coordinate to World Coordinate.
        // When mesh is at 0,0,-25000.
        // Vertex (x, y, 0) -> World (x, height, y - 25000).
        // Wait, 'pos' is local.
        // We will apply rotation later.
        // Plane Y is along the length.
        // Correct approach:
        // 1. Get World X, Z for this vertex.
        // 2. Calc Height.
        // 3. Set Z (local z, which becomes World Y).

        // Mesh starts at Z=-25000.
        // Plane Y ranges from +30000 to -30000 (Length 60000).
        // World Z = Plane Y + MeshPosition.z (which is -25000) ? 
        // When Rotated X -90:
        // Local X -> World X.
        // Local Y -> World -Z.
        // Local Z -> World Y.

        // Let's stick to the previous pattern which presumably worked:
        // const x = pos.getX(i); const y = pos.getY(i); pos.setZ(i, getGroundHeight(x, y));
        // And then: ground.rotation.x = -Math.PI / 2;
        // This means `y` (local) was treated as `z` (world) in the frequency function `getGroundHeight(x, z)`.
        // Since `cos(z)` doesn't care if z is inverted, `cos(-z) = cos(z)`, it matched.
        // But if we offset the mesh, we need to match the phase.
        // Let's just create it at 0,0 and move it? No, vertices are local.

        // IF we position the mesh at Z = -25000.
        // We want the height at vertex V to match `getGroundHeight(V.worldX, V.worldZ)`.
        // V.worldZ = -V.localY + MeshZ (-25000). (Due to rot -90).
        // Actually, standard Plane:
        // Y+ is Up on screen. Rot -90 -> Y+ is Back (-Z).
        // So LocalY = -WorldZ relative to center.

        // Simplest: Generate geometry IN PLACE (Apply transforms to vertices).
        // Or just don't offset the mesh, but offset vertices?
        // Let's use `offset` variable.

        // Actually, `getGroundHeight` is periodic and broad.
        // We can just generate `getGroundHeight(x, -y - 25000)`?
        // The original code was: `pos.setZ(i, getGroundHeight(x, y));` 
        // effectively `x` vs `z` (where y=z).

        // Let's just create the geometry covering the range we need.
        // Range: Z +500 to -infinity.
        // PlaneGeometry (2000, 60000).
        // We want this to stretch from +5000 down to -55000.
        // So Center should be at Z = -25000.
        // Vertices Local Y: +30000 to -30000.
        // World Z = -LocalY - 25000.
        // getGroundHeight(x, worldZ).

        // Note: Plane Y increases UP. Rotate -90 -> Y increases BACK (towards +Z)? 
        // Let's check Right Hand Rule.
        // X Right. Y Up. Z Out.
        // Rotate X -90.
        // Y axis points into screen (-Z).
        // So Local +Y = World -Z.
        // Correct.

        // Let's blindly apply the offset logic.
        // Mesh Position Z = -25000.
        const meshZ = -25000;
        const worldZ = -y + meshZ;

        // Use worldZ for noise
        pos.setZ(i, getGroundHeight(x, worldZ));
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
        color: CONFIG.colors.groundStart,
        roughness: 0.6,
        metalness: 0.1,
        flatShading: false
    });
    mat.name = "groundMat";
    const ground = new THREE.Mesh(geo, mat);
    ground.name = "Ground"; // İsim verdik ki bulabilelim
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -25000); // Center it deep
    ground.receiveShadow = true;
    scene.add(ground);
}

function createPenguin(isHero = false, bellyColor = 0xffffff, scarfColor = null) {
    const group = new THREE.Group();
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: bellyColor, roughness: 0.9 });
    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.6 });

    // Vücut
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16).scale(1, 2, 0.9), blackMat);
    body.position.y = 2; body.castShadow = true; group.add(body);

    // Göbek
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 16).scale(1, 1.6, 0.5), whiteMat);
    belly.position.set(0, 1.8, 0.6); group.add(belly);

    // Gözler - Daha düz ve sevimli (Anime/Cartoon tarzı - Pörtlek değil)
    // Beyaz zemin (Yassı disk gibi - Z ekseninde scale edildi)
    const eyeWhiteGeo = new THREE.SphereGeometry(0.15, 16, 16).scale(1, 1.1, 0.25); // İyice yassılatıldı
    const eyeWhiteL = new THREE.Mesh(eyeWhiteGeo, whiteMat);
    eyeWhiteL.position.set(-0.32, 3.15, 0.62); // Hafif içeri gömük
    eyeWhiteL.rotation.y = -0.2; // Hafif yanlara baksın
    group.add(eyeWhiteL);

    const eyeWhiteR = new THREE.Mesh(eyeWhiteGeo, whiteMat);
    eyeWhiteR.position.set(0.32, 3.15, 0.62);
    eyeWhiteR.rotation.y = 0.2;
    group.add(eyeWhiteR);

    // Göz Bebeği - Siyah (Yassı)
    const eyePupilGeo = new THREE.SphereGeometry(0.08, 16, 16).scale(1, 1, 0.5);
    const eyePupilL = new THREE.Mesh(eyePupilGeo, blackMat);
    eyePupilL.position.set(-0.32, 3.15, 0.68); // Beyazın hemen önünde, çok çıkıntısız
    group.add(eyePupilL);

    const eyePupilR = new THREE.Mesh(eyePupilGeo, blackMat);
    eyePupilR.position.set(0.32, 3.15, 0.68);
    group.add(eyePupilR);

    // Parıltı (Şirinlik için Highlight)
    const shineGeo = new THREE.SphereGeometry(0.025, 8, 8);
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const shineL = new THREE.Mesh(shineGeo, shineMat);
    shineL.position.set(-0.29, 3.20, 0.72);
    group.add(shineL);

    const shineR = new THREE.Mesh(shineGeo, shineMat);
    shineR.position.set(0.35, 3.20, 0.72);
    group.add(shineR);

    // Gaga
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 8), orangeMat);
    beak.rotation.x = Math.PI / 2; beak.position.set(0, 3.0, 0.95); group.add(beak);

    // Kanatlar
    const wingGeo = new THREE.SphereGeometry(0.4, 16, 16).scale(0.3, 1.5, 0.8);
    const wingL = new THREE.Mesh(wingGeo, blackMat); wingL.position.set(-1.1, 2.2, 0); wingL.rotation.z = 0.3; group.add(wingL);
    const wingR = new THREE.Mesh(wingGeo, blackMat); wingR.position.set(1.1, 2.2, 0); wingR.rotation.z = -0.3; group.add(wingR);

    // Ayaklar
    const footGeo = new THREE.BoxGeometry(0.4, 0.1, 0.6);
    const footL = new THREE.Mesh(footGeo, orangeMat); footL.position.set(-0.4, 0.1, 0.2); group.add(footL);
    const footR = new THREE.Mesh(footGeo, orangeMat); footR.position.set(0.4, 0.1, 0.2); group.add(footR);

    // Atkı
    if (scarfColor !== null) {
        const scarfMat = new THREE.MeshStandardMaterial({
            color: scarfColor, roughness: 0.8, emissive: scarfColor, emissiveIntensity: 0.2
        });
        const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.15, 8, 20), scarfMat);
        scarf.rotation.x = Math.PI / 2; scarf.position.set(0, 2.8, 0);

        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 1.2), scarfMat);
        tail.position.set(0, 0, -0.8); tail.rotation.set(-0.2, -0.2, 0); scarf.add(tail);
        group.add(scarf);
        if (isHero) group.userData.scarfTail = tail;
    } else {
        group.scale.setScalar(0.85); // Sürü biraz daha küçük
    }

    // Hero için Mektup ve Çiçek (Kanatlara takılı)
    if (isHero) {
        // Sol Kanat: Mektup
        const envelope = createEnvelope();
        envelope.scale.set(0.6, 0.6, 0.6);
        // Kanadın ucuna yerleştir (Local coordinates of wing)
        envelope.position.set(0, -1.2, 0.5);
        envelope.rotation.set(Math.PI / 2, 0, 0); // Ele uygun açı
        envelope.visible = false;
        wingL.add(envelope); // Kanata ekle

        // Sağ Kanat: Çiçek Buketi
        const bouquet = createBouquet();
        bouquet.scale.set(0.8, 0.8, 0.8);
        bouquet.position.set(0, -1.2, 0.5);
        bouquet.rotation.set(Math.PI / 4, 0, 0);
        bouquet.visible = false;
        wingR.add(bouquet); // Kanata ekle

        group.userData.envelope = envelope;
        group.userData.bouquet = bouquet;
    }

    // Kanat referanslarını sakla
    group.userData.wingL = wingL;
    group.userData.wingR = wingR;

    return group;
}

function createBouquet() {
    const group = new THREE.Group();

    // Saplar (Birkaç tane)
    const stemsMat = new THREE.MeshStandardMaterial({ color: 0x228B22 }); // Forest Green
    for (let i = 0; i < 5; i++) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5), stemsMat);
        stem.rotation.z = (Math.random() - 0.5) * 0.5;
        stem.rotation.x = (Math.random() - 0.5) * 0.5;
        stem.position.y = 0.5;
        group.add(stem);

        // Çiçek Başı
        const color = new THREE.Color().setHSL(Math.random(), 0.8, 0.6); // Rastgele canlı renkler
        const flowerGeo = new THREE.ConeGeometry(0.15, 0.3, 5);
        const flowerMat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.3 });
        const flower = new THREE.Mesh(flowerGeo, flowerMat);
        flower.position.copy(stem.position).add(new THREE.Vector3(0, 0.8, 0).applyEuler(stem.rotation));
        flower.rotation.copy(stem.rotation);
        group.add(flower);
    }

    // Kağıt sargısı
    const wrap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    wrap.position.y = 0.4;
    wrap.rotation.x = Math.PI;
    group.add(wrap);

    return group;
}

function createEnvelope() {
    const group = new THREE.Group();
    // Kağıt
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.05), new THREE.MeshStandardMaterial({ color: 0xf0f8ff, roughness: 0.6 }));
    group.add(paper);

    // Kapak - İsimlendirelim ki animasyonda bulabilelim -> userData.flap
    const flapGeo = new THREE.ConeGeometry(0.3, 0.2, 3);
    const flap = new THREE.Mesh(flapGeo, new THREE.MeshStandardMaterial({ color: 0xb0e0e6, roughness: 0.5 }));
    flap.rotation.z = Math.PI;
    flap.position.set(0, 0.1, 0.03); // Menteşe noktası gibi düşün
    flap.scale.set(1, 0.5, 1);
    group.add(flap);

    // Gruba flap referansını ekle
    group.userData.flap = flap;

    // Mühür
    const seal = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshStandardMaterial({ color: 0x0077be, emissive: 0x003366 }));
    seal.position.set(0, 0, 0.04);
    group.add(seal);

    return group;
}




function createHerd() {
    herdGroup = new THREE.Group();
    for (let i = 0; i < 40; i++) {
        const npc = createPenguin(false); // Atkısız
        const theta = Math.random() * Math.PI * 2;
        const r = Math.random() * 20 + 5;
        const x = Math.cos(theta) * r - 10;
        const z = Math.sin(theta) * r + 15;
        npc.position.set(x, getGroundHeight(x, z), z);
        npc.rotation.y = Math.random() * Math.PI * 2;
        npc.userData.idleOffset = Math.random() * 100;
        herdGroup.add(npc);
    }
    scene.add(herdGroup);
}

function createIgloo(x, z) {
    const group = new THREE.Group();
    const snowMat = new THREE.MeshStandardMaterial({
        color: 0xffffff, map: iceBrickTexture, bumpMap: iceBrickTexture, bumpScale: 0.2, roughness: 0.4
    });
    const rotY = Math.random() * Math.PI * 2;

    const dome = new THREE.Mesh(new THREE.SphereGeometry(14, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2), snowMat);
    dome.castShadow = true; group.add(dome);

    // Tünel - Daha pürüzsüz ve doğru yönelim
    const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 10, 32, 1), snowMat);
    tunnel.rotation.x = Math.PI / 2; // Sadece Z eksenine yatır
    tunnel.position.set(0, 0, 14);
    group.add(tunnel);

    // Kapı - Derinlik hissi için hafif içeri
    const door = new THREE.Mesh(new THREE.CircleGeometry(5, 32), new THREE.MeshBasicMaterial({ color: 0x0 }));
    door.position.set(0, 0, 18.9); // Tünel ucundan hafif içeride
    group.add(door);

    const light = new THREE.PointLight(CONFIG.colors.iglooLight, 0, 50);
    light.position.set(0, 5, 0); group.add(light);
    group.userData.light = light;

    // Yerleşim
    const h = getGroundHeight(x, z);
    group.position.set(x, h, z); // Offsetsiz tam zemin
    group.rotation.y = rotY;

    // Çarpışma
    collidables.push({ x: x, z: z, radius: 13 });
    collidables.push({ x: x + Math.sin(rotY) * 14, z: z + Math.cos(rotY) * 14, radius: 6 });

    return group;
}

function createIglooVillage() {
    scene.add(iglooGroup);
    // Köyü aşkın etrafına kur
    const positions = [
        { x: -40, z: -370 }, { x: 40, z: -370 },
        { x: -70, z: -330 }, { x: 60, z: -330 },
        { x: -90, z: -430 }
    ];
    positions.forEach(pos => iglooGroup.add(createIgloo(pos.x, pos.z)));
}

// --- EFEKTLER ---

function createSnow() {
    const count = 5000;
    const pos = new Float32Array(count * 3);
    const vels = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 400;
        pos[i * 3 + 1] = Math.random() * 200;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 400;
        vels[i] = 0.2 + Math.random() * 0.3;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, transparent: true, opacity: 0.8 });

    snowSystem = new THREE.Points(geo, mat);
    snowSystem.userData = { vels: vels };
    scene.add(snowSystem);
}

function updateSnow() {
    if (!snowSystem) return;
    const pos = snowSystem.geometry.attributes.position;
    const vels = snowSystem.userData.vels;
    for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i);
        y -= vels[i];
        if (y < -10) y = 200; // Reset to top
        pos.setY(i, y);
    }
    pos.needsUpdate = true;
    snowSystem.position.x = camera.position.x;
    snowSystem.position.z = camera.position.z;
}

function createStars() {
    const count = 3000;
    const pos = [];
    for (let i = 0; i < count; i++) {
        pos.push((Math.random() - 0.5) * 2000, Math.random() * 1000, (Math.random() - 0.5) * 2000);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.0, transparent: true, opacity: 0.8 });
    starSystem = new THREE.Points(geo, mat);
    // Disable depth write so stars are always "behind" everything
    starSystem.material.depthWrite = false;
    scene.add(starSystem);
}

function updateStars() {
    if (!starSystem) return;
    starSystem.position.copy(camera.position);
}

function createHeartParticles() {
    const cvs = document.createElement('canvas');
    cvs.width = 128; cvs.height = 128;
    const ctx = cvs.getContext('2d');

    // Toz Pembe Kalp (Dusty Pink) - Sadece kalp şekli, arka plan yok
    ctx.font = "100px Arial";
    ctx.fillStyle = "#FFB7C5"; // Cherry Blossom Pink / Dusty Pink
    // Hafif gölge ekleyelim ki karda belli olsun
    ctx.shadowColor = "#FF69B4";
    ctx.shadowBlur = 5;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("\u2665", 64, 68);

    const tex = new THREE.CanvasTexture(cvs);

    // Sprite Group
    heartSystem = new THREE.Group();
    const count = 60; // Increased count

    for (let i = 0; i < count; i++) {
        const mat = new THREE.SpriteMaterial({
            map: tex,
            color: 0xffffff,
            depthTest: false, // Her zaman görünür
            depthWrite: false,
            transparent: true
        });
        const sprite = new THREE.Sprite(mat);
        sprite.visible = false;
        sprite.scale.set(1.2, 1.2, 1); // User request: Smaller hearts
        sprite.renderOrder = 9999;

        sprite.userData = { velocity: 0, active: false };
        heartSystem.add(sprite);
    }
    scene.add(heartSystem);
}

function updateHeartParticles() {
    if (!heartSystem) return;

    if (gamePhase !== 'HUGGING' && gamePhase !== 'LETTER_GIVEN') {
        heartSystem.children.forEach(s => s.visible = false);
        return;
    }

    heartSystem.children.forEach((sprite, i) => {
        sprite.visible = true;

        // Reset logic
        if (!sprite.userData.active || sprite.position.y > heroPenguin.position.y + 5) {
            const target = (i % 2 === 0) ? heroPenguin : loveInterest;

            // User request: "Yanlarından çıksın" (Spawn from sides)
            const angle = Math.random() * Math.PI * 2;
            // Radius increased to 2.5 - 4.0 to ensure they don't cover the face
            const r = 2.5 + Math.random() * 1.5;

            sprite.position.x = target.position.x + Math.cos(angle) * r;
            sprite.position.y = target.position.y + 0.5 + Math.random();
            sprite.position.z = target.position.z + Math.sin(angle) * r;

            sprite.userData.velocity = 0.02 + Math.random() * 0.03;
            sprite.userData.active = true;
        }

        sprite.position.y += sprite.userData.velocity;
        // Gentle sway
        sprite.position.x += Math.sin(Date.now() * 0.005 + i) * 0.01;
    });
}

function createAuroraCurtains() {
    const vertexShader = `
        varying vec2 vUv;
        varying float vHeight;
        uniform float time;
        uniform float speed;
        
        void main() {
            vUv = uv;
            vec3 pos = position;
            
            // Daha karmaşık, yavaş dalgalanma
            float wave = sin(pos.x * 0.005 + time * speed) * 60.0;
            wave += cos(pos.x * 0.015 + time * speed * 0.8) * 30.0;
            
            pos.z += wave;
            pos.y += sin(pos.x * 0.01 + time * 0.3) * 20.0;

            vHeight = uv.y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `;

    const fragmentShader = `
        varying vec2 vUv;
        varying float vHeight;
        uniform vec3 color1;
        uniform vec3 color2;
        uniform float opacity;
        
        void main() {
            vec3 finalColor = mix(color1, color2, vHeight * vHeight); // Üstel renk geçişi daha doğal durur
            
            float alpha = opacity;
            alpha *= smoothstep(0.0, 0.3, vHeight);
            alpha *= smoothstep(1.0, 0.5, vHeight);
            
            // İnce ışık perdeleri
            float beam = sin(vUv.x * 30.0 + vUv.y * 10.0) * 0.1 + 0.9;
            
            gl_FragColor = vec4(finalColor * beam, alpha);
        }
    `;

    // Katmanlar (Devasa boyutta)
    const layers = [
        { z: -1000, color1: new THREE.Color(0x00ff99), color2: new THREE.Color(0x9900ff), speed: 0.5, opacity: 0.6, y: 600 },
        { z: -1500, color1: new THREE.Color(0x00ffcc), color2: new THREE.Color(0xaa00ff), speed: 0.3, opacity: 0.5, y: 700 },
        { z: -800, color1: new THREE.Color(0x33ff99), color2: new THREE.Color(0x8a2be2), speed: 0.7, opacity: 0.4, y: 500 },
        // Başımızın üstünden geçen katman
        { z: 0, color1: new THREE.Color(0x00ff66), color2: new THREE.Color(0x5500ff), speed: 0.2, opacity: 0.3, y: 800 }
    ];

    layers.forEach((layerData) => {
        // Çok geniş ve kavisli geometri
        const geometry = new THREE.PlaneGeometry(6000, 1200, 300, 1);

        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                speed: { value: layerData.speed },
                color1: { value: layerData.color1 },
                color2: { value: layerData.color2 },
                opacity: { value: layerData.opacity }
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.set(0, layerData.y, layerData.z);

        // Gökyüzüne doğru büküm (hafif silindir etkisi için vertex modifikasyonu yerine basit rotasyon)
        // Daha gerçekçi olması için "yay" şeklinde durması gerekir ama düzlem yeterince iyi.
        // Kafayı kaldırınca görebilmek için biraz daha yatay yapalım:
        mesh.rotation.x = -Math.PI / 4;

        mesh.userData = {
            baseOpacity: layerData.opacity, // Target opacity from layer data
            speed: layerData.speed
        };

        scene.add(mesh);
        auroraRibbons.push(mesh);
    });
}

function createEnvironment() {
    for (let i = 0; i < 40; i++) {
        const h = 80 + Math.random() * 150;
        const geo = new THREE.ConeGeometry(30 + Math.random() * 30, h, 4);
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true });
        const mesh = new THREE.Mesh(geo, mat);

        // Calculate position first
        const a = Math.random() * Math.PI * 2;
        const d = 300 + Math.random() * 600;
        const x = Math.cos(a) * d;
        const z = Math.sin(a) * d - 200;

        // Fix Floating Mountains: Get ground height at this X, Z
        let y = getGroundHeight(x, z);

        // Prevent mountains from blocking the toboggan path (Central corridor)
        if (Math.abs(x) < 150 && z < -200) continue;

        // Offset Y slightly down so it looks buried/natural
        mesh.position.set(x, y - 5, z);

        scene.add(mesh);
    }
}

function createHeartAurora() {
    // Large Heart Aurora in the sky (Watercolor style)
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Soft Glow Background (Greenish Aurora)
    const grad = ctx.createRadialGradient(512, 512, 100, 512, 512, 500);
    grad.addColorStop(0, 'rgba(0, 255, 128, 0)');
    grad.addColorStop(0.2, 'rgba(0, 255, 128, 0.1)');
    grad.addColorStop(0.6, 'rgba(100, 0, 255, 0.2)'); // Purple tint
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    // Heart Shape
    ctx.save();
    ctx.translate(512, 450);
    ctx.scale(15, -15); // Flip Y to draw heart correctly up
    ctx.beginPath();
    // Heart formula equivalent drawing
    // Or just bezier curves for a nice shape
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-10, -10, -20, 5, 0, 25);
    ctx.bezierCurveTo(20, 5, 10, -10, 0, 0);
    ctx.closePath();

    // Fill with Aurora Colors (Pink/Purple)
    // We can use a gradient for the fill too
    ctx.shadowBlur = 50;
    ctx.shadowColor = '#ff69b4';
    ctx.fillStyle = 'rgba(255, 105, 180, 0.3)'; // Soft Pink
    ctx.fill();

    // Stroking multiple times for "Curtain" effect look
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = 'rgba(0, 255, 200, 0.4)'; // Green edges
    ctx.stroke();

    ctx.restore();

    // More defined Heart Texture for the main shape
    const hCanvas = document.createElement('canvas');
    hCanvas.width = 512; hCanvas.height = 512;
    const hCtx = hCanvas.getContext('2d');

    // Draw Heart
    hCtx.beginPath();
    const topCurveHeight = 150;
    hCtx.moveTo(256, 512 - 120);
    hCtx.bezierCurveTo(0, 512 - 250, 0, 0 + 50, 256, 0 + 150);
    hCtx.bezierCurveTo(512, 0 + 50, 512, 512 - 250, 256, 512 - 120);
    hCtx.closePath();

    // Gradient Fill for Heart
    const hGrad = hCtx.createLinearGradient(0, 0, 0, 512);
    hGrad.addColorStop(0, 'rgba(0, 255, 150, 0.8)'); // Green Top
    hGrad.addColorStop(0.5, 'rgba(0, 100, 255, 0.6)'); // Blue/Purple Middle
    hGrad.addColorStop(1, 'rgba(255, 105, 180, 0.8)'); // Pink Bottom
    hCtx.fillStyle = hGrad;
    hCtx.filter = 'blur(20px)'; // Soften edges
    hCtx.fill();

    const tex = new THREE.CanvasTexture(hCanvas);

    // Create the mesh in the sky
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(3000, 3000),
        new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );

    // Position deep in the sky looking down towards the track
    plane.position.set(0, 1200, -2500);
    plane.lookAt(0, 0, -500); // Look somewhat towards the start

    scene.add(plane);
}

function handleKey(e, state) {
    const k = e.key.toLowerCase();

    // Player 1 (WASD)
    if (['w', 'a', 's', 'd'].includes(k)) keys[k] = state;

    // Player 2 (Arrows)
    if (k === "arrowup") keys.arrowup = state;
    if (k === "arrowdown") keys.arrowdown = state;
    if (k === "arrowleft") keys.arrowleft = state;
    if (k === "arrowright") keys.arrowright = state;
}

function checkCollision(x, z) {
    for (let obj of collidables) {
        if (Math.sqrt((x - obj.x) ** 2 + (z - obj.z) ** 2) < obj.radius + 1.5) return true;
    }
    return false;
}

// UI Event Listener
document.getElementById('close-letter').addEventListener('click', () => {
    const letter = document.getElementById('letter-overlay');
    letter.classList.add('hidden');

    // Reset animations
    const flap = letter.querySelector('.envelope-flap');
    const container = letter.querySelector('.letter-container');
    const wrapper = letter.querySelector('.envelope-wrapper');
    if (flap) flap.classList.remove('open');
    if (container) container.classList.remove('slide-up');
    if (wrapper) wrapper.classList.remove('vanish');

    // Oyun durumunu güncelle: Artık partner kontrolü
    gamePhase = 'PARTNER_CONTROL';
    activePenguin = loveInterest; // Switch control to Pink Penguin

    // Camera reset offset for smooth transition
    const offset = new THREE.Vector3(0, 5, 20);
    controls.target.copy(activePenguin.position);
    camera.position.copy(activePenguin.position).add(offset);

    // Show NEW guidance overlay
    const overlay = document.getElementById('guidance-overlay');
    if (overlay) overlay.classList.remove('hidden');

    // Clear old status just in case
    const stat = document.getElementById('status');
    if (stat) stat.innerText = '';
});

// Interactive Valentine Buttons
const handleValentineResponse = () => {
    // 1. Yazıyı Güncelle
    const section = document.querySelector('.interactive-section');
    section.innerHTML = '<h3>Yay! I Love You! ??</h3>';

    // 2. Kapat Butonunu Göster
    const closeBtn = document.getElementById('close-letter');
    closeBtn.classList.remove('hidden');

    // 3. Kalp Patlaması (Mevcut kalp sistemini coştur)
    if (heartSystem) {
        heartSystem.children.forEach(sprite => {
            sprite.scale.set(2.0, 2.0, 1); // Kalpleri büyüt
            sprite.userData.velocity *= 2; // Hızlandır
        });
    }

    // 4. Havai Fişekler
    launchFireworks();
};

function launchFireworks() {
    const container = document.getElementById('letter-overlay');
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];

    // Creates 5 explosions
    for (let j = 0; j < 8; j++) {
        setTimeout(() => {
            const cx = 30 + Math.random() * 40; // Center X %
            const cy = 30 + Math.random() * 40; // Center Y %

            for (let i = 0; i < 30; i++) {
                const p = document.createElement('div');
                p.className = 'firework-particle';
                p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                p.style.left = cx + '%';
                p.style.top = cy + '%';

                const angle = Math.random() * Math.PI * 2;
                const dist = 50 + Math.random() * 150;
                const tx = Math.cos(angle) * dist;
                const ty = Math.sin(angle) * dist;

                p.style.setProperty('--tx', `${tx}px`);
                p.style.setProperty('--ty', `${ty}px`);

                // Initial offset 0
                p.style.setProperty('--dtx', '0px');
                p.style.setProperty('--dty', '0px');

                container.appendChild(p);
                setTimeout(() => p.remove(), 1000);
            }
        }, j * 300);
    }
}

document.getElementById('btn-yes').addEventListener('click', handleValentineResponse);
document.getElementById('btn-course').addEventListener('click', handleValentineResponse);
document.getElementById('btn-restart').addEventListener('click', () => {
    document.getElementById('ending-screen').classList.add('hidden');
    document.getElementById('ending-screen').style.opacity = 0;
    startTobogganMode();
});

function updateGameLogic(time) {
    if (!heroPenguin || !loveInterest) return;
    const dist = heroPenguin.position.distanceTo(loveInterest.position);

    if (dist < 100 && gamePhase === 'WALKING') {
        gamePhase = 'FOUND_VILLAGE';
        document.getElementById('status').innerText = "Civilization found...";
    }

    // Sarılma Başlangıcı
    if (dist < LOVE_DIST && (gamePhase === 'WALKING' || gamePhase === 'FOUND_VILLAGE')) {
        gamePhase = 'HUGGING';
        document.getElementById('status').innerText = "Reunited <3";
        hugTimer = time; // Başlangıç zamanı

        // Yüzlerini birbirine döndür
        const tHero = loveInterest.position.clone(); tHero.y = heroPenguin.position.y;
        heroPenguin.lookAt(tHero);

        const tLove = heroPenguin.position.clone(); tLove.y = loveInterest.position.y;
        loveInterest.lookAt(tLove);

        // Mektubu ve Çiçeği görünür yap
        if (heroPenguin.userData.envelope) {
            heroPenguin.userData.envelope.visible = true;
        }
        if (heroPenguin.userData.bouquet) {
            heroPenguin.userData.bouquet.visible = true;
        }
    }

    if (gamePhase === 'HUGGING') {
        // Kamera Zoom Efekti (Yakınlaş) - YANDAN GÖRÜNÜM
        const centerPos = new THREE.Vector3().addVectors(heroPenguin.position, loveInterest.position).multiplyScalar(0.5);

        // Yan vektörü hesapla (İkisi arasındaki çizgiye dik)
        const diff = new THREE.Vector3().subVectors(loveInterest.position, heroPenguin.position);
        const sideDir = new THREE.Vector3(-diff.z, 0, diff.x).normalize(); // 90 derece dönüş (Y ekseni etrafında)

        // Kamerayı ikilinin yanına yerleştir (Biraz yukarıdan ve hafif geriden değil, tam profile yakın)
        // 22 birim mesafe (Daha uzak), 6 birim yükseklik
        const camTargetPos = centerPos.clone().add(sideDir.multiplyScalar(22)).add(new THREE.Vector3(0, 6, 0));

        camera.position.lerp(camTargetPos, 0.03);
        controls.target.lerp(centerPos, 0.05);
        controls.update();

        // Yüzlerini birbirine döndür
        const tHero = loveInterest.position.clone(); tHero.y = heroPenguin.position.y;
        heroPenguin.lookAt(tHero);
        const tLove = heroPenguin.position.clone(); tLove.y = loveInterest.position.y;
        loveInterest.lookAt(tLove);

        const dir = new THREE.Vector3().subVectors(loveInterest.position, heroPenguin.position);
        dir.y = 0; dir.normalize();

        if (dist > 2.5) {
            heroPenguin.position.add(dir.multiplyScalar(0.02));
            heroPenguin.position.y = getGroundHeight(heroPenguin.position.x, heroPenguin.position.z);
        }

        // Mektup ve Çiçek Verme Animasyonu (Kanatları Kaldır)
        if (heroPenguin.userData.wingL && heroPenguin.userData.wingR) {
            // Hedef Kanat Açısı (Öne ve yukarı)
            // Normalde: Z 0.3. Hedef: Z 1.5 (yana aç) veya X ile öne kaldır. 
            // Penguen kanadı yana yapışık. Öne uzatmak için X ekseninde döndürelim ve biraz Z ile açalım.

            const liftProgress = Math.min(1, Math.max(0, (time - hugTimer - 0.5) / 1.5)); // 0.5s bekle, 1.5s sürsün

            // Sol Kanat (Mektup): Öne ve ortaya
            // Başlangıç rotasyonlarını koruyarak üzerine ekleyelim, ama burada set etmek daha temiz.
            // Başlangıç: rot.z = 0.3, rot.x = 0
            const targetRotXL = -Math.PI / 3; // Öne kaldır
            const targetRotZL = 0.5; // Hafif yana

            heroPenguin.userData.wingL.rotation.x = THREE.MathUtils.lerp(0, targetRotXL, liftProgress);
            heroPenguin.userData.wingL.rotation.z = THREE.MathUtils.lerp(0.3, targetRotZL, liftProgress);

            // Sağ Kanat (Çiçek): Öne ve ortaya
            const targetRotXR = -Math.PI / 3;
            const targetRotZR = -0.5;

            heroPenguin.userData.wingR.rotation.x = THREE.MathUtils.lerp(0, targetRotXR, liftProgress);
            heroPenguin.userData.wingR.rotation.z = THREE.MathUtils.lerp(-0.3, targetRotZR, liftProgress);

            // Mektubu hafif salla (Heyecan)
            if (heroPenguin.userData.envelope) {
                heroPenguin.userData.envelope.rotation.y = Math.sin(time * 10) * 0.1;
            }
        }

        // Zarf Kapağı Animasyonu (Kanat kalktıktan sonra)
        if (time - hugTimer > 3.5 && heroPenguin.userData.envelope && heroPenguin.userData.envelope.userData.flap) {
            const flap = heroPenguin.userData.envelope.userData.flap;
            const openProg = Math.min(1, (time - hugTimer - 3.5) / 0.5);
            flap.rotation.x = -openProg * 2.5;
        }

        // 4 saniye sonra mektup UI açılır
        if (time - hugTimer > 4.0) {
            gamePhase = 'LETTER_GIVEN';
            document.getElementById('status').innerText = "";

            // --- Çiçek Buketi Transferi ---
            // Zarf açıldıktan sonra çiçeği sevgiliye ver
            if (heroPenguin.userData.bouquet && loveInterest.userData.wingL) {
                const bq = heroPenguin.userData.bouquet;

                // Hero'dan çıkar
                if (heroPenguin.userData.wingR) heroPenguin.userData.wingR.remove(bq);

                // Sevgiliye ekle (Sol kanadına)
                loveInterest.userData.wingL.add(bq);

                // Pozisyonu ayarla (Sevgilinin eline göre)
                bq.position.set(0, -1.2, 0.5);
                bq.rotation.set(Math.PI / 4, 0, 0); // Eline oturt

                // Referansları güncelle
                heroPenguin.userData.bouquet = null; // Artık onda değil
                loveInterest.userData.bouquet = bq;
            }

            // UI Göster
            const letter = document.getElementById('letter-overlay');
            if (letter.classList.contains('hidden')) {
                letter.classList.remove('hidden');

                // Animation Sequence
                const flap = letter.querySelector('.envelope-flap');
                const container = letter.querySelector('.letter-container');
                const wrapper = letter.querySelector('.envelope-wrapper');

                if (flap) {
                    setTimeout(() => flap.classList.add('open'), 100);
                }
                if (container) {
                    setTimeout(() => container.classList.add('slide-up'), 700); // Wait for flap
                }
                if (wrapper) {
                    setTimeout(() => wrapper.classList.add('vanish'), 1800); // 700 + 1000s slide + buffer
                }
            }
        }
    }

    if (gamePhase === 'LETTER_GIVEN') {
        const t = performance.now() * 0.001; // Smooth movement

        // --- Poz Koruma ---
        // Hero: Sol eli (Mektup) havada kalsın, Sağ eli (Boş) insin
        if (heroPenguin.userData.wingL) {
            heroPenguin.userData.wingL.rotation.x = THREE.MathUtils.lerp(heroPenguin.userData.wingL.rotation.x, -Math.PI / 3, 0.1);
            heroPenguin.userData.wingL.rotation.z = THREE.MathUtils.lerp(heroPenguin.userData.wingL.rotation.z, 0.5, 0.1);
            // Mektup sallanmaya devam etsin
            if (heroPenguin.userData.envelope) heroPenguin.userData.envelope.rotation.y = Math.sin(t * 10) * 0.1;
        }
        if (heroPenguin.userData.wingR) {
            // Sağ el iniyor
            heroPenguin.userData.wingR.rotation.x = THREE.MathUtils.lerp(heroPenguin.userData.wingR.rotation.x, 0, 0.1);
            heroPenguin.userData.wingR.rotation.z = THREE.MathUtils.lerp(heroPenguin.userData.wingR.rotation.z, -0.3, 0.1);
        }

        // Sevgili: Sol eli (Çiçek) kalksın
        if (loveInterest.userData.wingL) {
            // Çiçeği tutmak için kaldırıyor
            loveInterest.userData.wingL.rotation.x = THREE.MathUtils.lerp(loveInterest.userData.wingL.rotation.x, -Math.PI / 3, 0.1);
            loveInterest.userData.wingL.rotation.z = THREE.MathUtils.lerp(loveInterest.userData.wingL.rotation.z, 0.5, 0.1);
        }

        // Karşılıklı hafif salınım
        loveInterest.rotation.z = Math.sin(t) * 0.02;
    }

    if (gamePhase === 'PARTNER_CONTROL') {
        // ===== BOTH PENGUINS ARE INDEPENDENTLY CONTROLLED =====
        // Player 1 (Blue) uses WASD - already handled in updateCharacter()
        // Player 2 (Pink) uses Arrow Keys - already handled in updateCharacter()
        // NO automatic following! Both move independently.

        // Check for Toboggan Start Trigger
        // Path ends around Z = -600
        // Either penguin can trigger it
        if (loveInterest.position.z < -580 || heroPenguin.position.z < -580) {
            startTobogganMode();
        }
    } else if (gamePhase === 'POST_HUG') {
        // Legacy state, might happen if letter closed without acceptance (not possible in current UI flow but safe to keep)
    }
    else if (gamePhase !== 'HUGGING' && gamePhase !== 'LETTER_GIVEN' && gamePhase !== 'TOBOGGAN') {
        loveInterest.rotation.z = Math.sin(time) * 0.05;
    }

    if (gamePhase !== 'TOBOGGAN') {
        // Fix ground clipping for loveInterest with proper offset
        loveInterest.position.y = getGroundHeight(loveInterest.position.x, loveInterest.position.z) + 0.1;
    }
}

function updateCharacter() {
    if (gamePhase === 'HUGGING' || gamePhase === 'LETTER_GIVEN') return;

    // Toboggan controls are handled separately
    if (gamePhase === 'TOBOGGAN') {
        updateTobogganPhysics();
        return;
    }

    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    camDir.y = 0;
    camDir.normalize();
    const camRight = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0));

    // ===== PLAYER 1 (BLUE SCARF) - WASD CONTROLS =====
    if (heroPenguin && (gamePhase === 'WALKING' || gamePhase === 'FOUND_VILLAGE' || gamePhase === 'PARTNER_CONTROL')) {
        const moveHero = new THREE.Vector3();

        // Only respond to WASD
        if (keys.w) moveHero.add(camDir);
        if (keys.s) moveHero.sub(camDir);
        if (keys.d) moveHero.add(camRight);
        if (keys.a) moveHero.sub(camRight);

        if (moveHero.length() > 0) {
            moveHero.normalize();
            const nx = heroPenguin.position.x + moveHero.x * CONFIG.speed;
            const nz = heroPenguin.position.z + moveHero.z * CONFIG.speed;

            if (!checkCollision(nx, nz)) {
                heroPenguin.position.x = nx;
                heroPenguin.position.z = nz;
            }

            const angle = Math.atan2(moveHero.x, moveHero.z);
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            heroPenguin.quaternion.slerp(q, CONFIG.rotationSmoothness);

            // Waddle animation
            const t = Date.now() * 0.015;
            if (heroPenguin.children[0]) heroPenguin.children[0].rotation.z = Math.sin(t) * 0.1;
        }

        // Fix ground clipping - add offset for penguin height
        heroPenguin.position.y = getGroundHeight(heroPenguin.position.x, heroPenguin.position.z) + 0.1;
    }

    // ===== PLAYER 2 (PINK SCARF) - ARROW KEY CONTROLS =====
    if (loveInterest && gamePhase === 'PARTNER_CONTROL') {
        const moveLove = new THREE.Vector3();

        // Only respond to Arrow Keys
        if (keys.arrowup) moveLove.add(camDir);
        if (keys.arrowdown) moveLove.sub(camDir);
        if (keys.arrowright) moveLove.add(camRight);
        if (keys.arrowleft) moveLove.sub(camRight);

        if (moveLove.length() > 0) {
            moveLove.normalize();
            const nx = loveInterest.position.x + moveLove.x * CONFIG.speed;
            const nz = loveInterest.position.z + moveLove.z * CONFIG.speed;

            if (!checkCollision(nx, nz)) {
                loveInterest.position.x = nx;
                loveInterest.position.z = nz;
            }

            const angle = Math.atan2(moveLove.x, moveLove.z);
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            loveInterest.quaternion.slerp(q, CONFIG.rotationSmoothness);

            // Waddle animation
            const t = Date.now() * 0.015;
            if (loveInterest.children[0]) loveInterest.children[0].rotation.z = Math.sin(t) * 0.1;
        }

        // Fix ground clipping
        loveInterest.position.y = getGroundHeight(loveInterest.position.x, loveInterest.position.z) + 0.1;
    }

    // Update active penguin for camera following (backward compatibility)
    if (gamePhase === 'WALKING' || gamePhase === 'FOUND_VILLAGE') {
        activePenguin = heroPenguin;
    } else if (gamePhase === 'PARTNER_CONTROL') {
        // Follow the center point between both penguins
        activePenguin = loveInterest; // Keep for camera target
    }
}

function updateEnvironment() {
    if (!heroPenguin) return;
    const dist = heroPenguin.position.distanceTo(new THREE.Vector3(0, 0, 0));
    let prog = THREE.MathUtils.clamp(dist / CONFIG.auroraDist, 0, 1);
    const night = THREE.MathUtils.clamp(prog * 2, 0, 1);

    scene.fog.color.lerpColors(CONFIG.colors.fogStart, CONFIG.colors.fogNight, night);
    scene.background.lerpColors(CONFIG.colors.fogStart, CONFIG.colors.fogNight, night);

    // Aurora Effect Logic
    const aurora = scene.getObjectByName("auroraLight");
    if (gamePhase === 'TOBOGGAN') {
        // ===== VALENTINE'S AURORA THEME =====
        // Force vibrant Valentine's night sky with colorful aurora
        scene.fog.color.lerp(CONFIG.colors.valentineNight, 0.05);
        scene.background.lerp(CONFIG.colors.valentineNight, 0.05);

        // Intense aurora lighting with pink/purple/green hues
        if (aurora) {
            // Pulsating aurora intensity for dynamic effect
            const pulseIntensity = 2.0 + Math.sin(Date.now() * 0.002) * 0.5;
            aurora.intensity = pulseIntensity;

            // Cycle through Valentine colors
            const time = Date.now() * 0.0005;
            const colorCycle = (Math.sin(time) + 1) * 0.5; // 0 to 1
            aurora.color.lerpColors(CONFIG.colors.auroraPink, CONFIG.colors.auroraGreen, colorCycle);

            // Position aurora to follow the camera/penguins
            aurora.position.set(camera.position.x, camera.position.y + 80, camera.position.z - 100);
        }

        // Make aurora ribbons more visible in toboggan mode
        if (auroraRibbons.length > 0) {
            auroraRibbons.forEach(ribbon => {
                if (ribbon.material.uniforms) {
                    ribbon.material.uniforms.opacity.value = THREE.MathUtils.lerp(
                        ribbon.material.uniforms.opacity.value,
                        ribbon.userData.baseOpacity * 1.5, // Boost visibility
                        0.05
                    );
                }
            });
        }

        return; // Skip normal cycle
    }

    if (prog > 0.5) {
        aurora.intensity = (prog - 0.5) * 4;
        aurora.position.set(heroPenguin.position.x, 50, heroPenguin.position.z - 50);
    } else {
        aurora.intensity = 0;
    }

    if (auroraRibbons.length > 0) {
        // Calculate visibility based on distance (Night progression)
        // Hidden at start (dist < 50), gradually fades in as it gets darker (50 -> 150)
        const auroraVisibility = Math.min(1.0, Math.max(0.0, (dist - 50) / 150));

        auroraRibbons.forEach(m => {
            if (m.material.uniforms) {
                // Update time
                m.material.uniforms.time.value = performance.now() * 0.001;

                // Opacity depends on how dark it is
                const targetOp = m.userData.baseOpacity * auroraVisibility;
                const currentOp = m.material.uniforms.opacity.value;

                // Smooth transition
                m.material.uniforms.opacity.value = THREE.MathUtils.lerp(currentOp, targetOp, 0.05);
            }
        });
    }

    if (iglooGroup && prog > 0.5) {
        const iInt = Math.min(2, (prog - 0.5) * 4);
        iglooGroup.children.forEach(ig => {
            if (ig.userData.light) ig.userData.light.intensity = iInt * (0.8 + Math.random() * 0.4);
        });
    }

    // Status Text logic - Only if not met
    const stat = document.getElementById('status');
    if (gamePhase === 'WALKING' && stat) {
        if (prog < 0.3) stat.innerText = "Walk into the darkness...";
        else if (prog < 0.8) stat.innerText = "It's getting colder...";
    }
}

function updateCameraCollision() {
    if (!heroPenguin) return;
    // Keep camera above ground but allow getting closer to maximize look-up angle
    const h = getGroundHeight(camera.position.x, camera.position.z);

    // Smooth clamping with a smaller buffer (0.5)
    if (camera.position.y < h + 0.5) {
        camera.position.y = h + 0.5;
    }
}


// function updateGuideArrow removed


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    const t = Date.now() * 0.001;
    updateCharacter();
    updateEnvironment();
    updateStars(); // Keep stars around
    updateSnow();
    updateHeartParticles();
    updatePinkGuidance(t);
    updateGameLogic(t);

    if (herdGroup) herdGroup.children.forEach(n => n.rotation.z = Math.sin(t * 2 + n.userData.idleOffset) * 0.05);

    // Animate LED path lights (pulsing/twinkling)
    const ledPath = scene.getObjectByName('DecoratedPath');
    if (ledPath && ledPath.userData.animateLights) {
        ledPath.userData.animateLights(t);
    }

    // Only use default controls if NOT hugging (hugging has custom camera logic)
    if (activePenguin && controls && gamePhase !== 'HUGGING' && gamePhase !== 'LETTER_GIVEN' && gamePhase !== 'TOBOGGAN' && gamePhase !== 'ENDING') {
        const tp = activePenguin.position.clone(); tp.y += 7.0;
        controls.target.copy(tp); controls.update();
    }

    if (gamePhase === 'TOBOGGAN') {
        // Camera is handled in updateTobogganPhysics - skip here to avoid conflict
        // This prevents camera jitter from duplicate updates
    }

    // Check collision AFTER update to clamp correctly
    updateCameraCollision();

    composer.render();
}

// --- NEW FEATURES ---

function createDecoratedPath() {
    // ===== LAPLAND-STYLE LED LIGHT PATH (VALENTINE'S THEME) =====
    // Beautiful, colorful LED lights guide the path to the sliding area
    // Like fairy lights in Lapland but with pink/purple Valentine colors

    const pathGroup = new THREE.Group();

    // Create stunning LED-style arrow texture (pink sparkle)
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Draw sparkling arrow pointing down (toward sliding area)
    const gradient = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
    gradient.addColorStop(0, '#ff69b4'); // Hot pink center
    gradient.addColorStop(0.5, '#ff1493'); // Deep pink
    gradient.addColorStop(1, 'rgba(255, 20, 147, 0)'); // Fade out

    ctx.fillStyle = gradient;
    ctx.beginPath();
    // Arrow shape pointing down (-Z direction)
    ctx.moveTo(64, 20);   // Top center
    ctx.lineTo(90, 50);   // Right wing
    ctx.lineTo(75, 50);   // Right inner
    ctx.lineTo(75, 100);  // Right shaft
    ctx.lineTo(53, 100);  // Left shaft
    ctx.lineTo(53, 50);   // Left inner
    ctx.lineTo(38, 50);   // Left wing
    ctx.closePath();
    ctx.fill();

    // Add glow
    ctx.shadowColor = '#ff69b4';
    ctx.shadowBlur = 20;
    ctx.fill();

    const arrowMap = new THREE.CanvasTexture(canvas);

    // ===== COLORED LED ORBS (LIKE LAPLAND CHRISTMAS LIGHTS BUT VALENTINE'S) =====
    const ledColors = [
        { color: 0xff69b4, emissive: 0xff69b4, name: 'Hot Pink' },      // Pink
        { color: 0xff1493, emissive: 0xff1493, name: 'Deep Pink' },     // Deep Pink
        { color: 0xda70d6, emissive: 0xda70d6, name: 'Orchid' },        // Orchid (purple-pink)
        { color: 0xff00ff, emissive: 0xff00ff, name: 'Magenta' },       // Magenta
        { color: 0x00ffff, emissive: 0x00ffff, name: 'Cyan' },          // Cyan (contrast)
        { color: 0x9370db, emissive: 0x9370db, name: 'Medium Purple' }, // Medium Purple
    ];

    let colorIndex = 0;

    for (let z = -360; z > -610; z -= 20) {  // Tighter spacing for more lights
        const groundY = getGroundHeight(0, z);

        // ===== LEFT SIDE LED STRING =====
        const ledLeft = ledColors[colorIndex % ledColors.length];
        const orbLeft = new THREE.Mesh(
            new THREE.SphereGeometry(0.8, 16, 16),
            new THREE.MeshStandardMaterial({
                color: ledLeft.color,
                emissive: ledLeft.emissive,
                emissiveIntensity: 3.0,  // Very bright!
                metalness: 0.3,
                roughness: 0.2
            })
        );
        orbLeft.position.set(-4, groundY + 1.5, z);

        // Add point light to each LED for real glow effect
        const lightLeft = new THREE.PointLight(ledLeft.color, 2, 10);
        lightLeft.position.copy(orbLeft.position);
        pathGroup.add(lightLeft);
        orbLeft.userData.light = lightLeft;
        orbLeft.userData.pulseOffset = Math.random() * Math.PI * 2; // Random phase

        pathGroup.add(orbLeft);

        // ===== RIGHT SIDE LED STRING =====
        colorIndex++; // Different color on right side
        const ledRight = ledColors[colorIndex % ledColors.length];
        const orbRight = new THREE.Mesh(
            new THREE.SphereGeometry(0.8, 16, 16),
            new THREE.MeshStandardMaterial({
                color: ledRight.color,
                emissive: ledRight.emissive,
                emissiveIntensity: 3.0,
                metalness: 0.3,
                roughness: 0.2
            })
        );
        orbRight.position.set(4, groundY + 1.5, z);

        const lightRight = new THREE.PointLight(ledRight.color, 2, 10);
        lightRight.position.copy(orbRight.position);
        pathGroup.add(lightRight);
        orbRight.userData.light = lightRight;
        orbRight.userData.pulseOffset = Math.random() * Math.PI * 2;

        pathGroup.add(orbRight);

        colorIndex++;

        // ===== SPARKLING ARROW INDICATORS =====
        // Arrows point TOWARD the sliding area (not at penguin position)
        if (Math.abs(z % 60) < 1) {  // Every 60 units
            const arrowPlane = new THREE.Mesh(
                new THREE.PlaneGeometry(4, 4),
                new THREE.MeshBasicMaterial({
                    map: arrowMap,
                    color: 0xffffff,  // White to show texture colors
                    transparent: true,
                    opacity: 0.95,
                    side: THREE.DoubleSide,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                })
            );

            arrowPlane.rotation.x = -Math.PI / 2;
            arrowPlane.rotation.z = 0; // Corrected direction
            arrowPlane.position.set(0, groundY + 0.2, z);
            arrowPlane.userData.pulseOffset = Math.random() * Math.PI * 2;

            pathGroup.add(arrowPlane);
        }

        // ===== ADDITIONAL SPARKLE PARTICLES =====
        // Small floating sparkles between the LED lights
        if (Math.random() > 0.7) {
            const sparkle = new THREE.Mesh(
                new THREE.SphereGeometry(0.15, 8, 8),
                new THREE.MeshBasicMaterial({
                    color: ledColors[Math.floor(Math.random() * ledColors.length)].color,
                    transparent: true,
                    opacity: 0.8
                })
            );
            sparkle.position.set(
                (Math.random() - 0.5) * 6,
                groundY + 0.5 + Math.random() * 2,
                z
            );
            sparkle.userData.floatOffset = Math.random() * Math.PI * 2;
            pathGroup.add(sparkle);
        }
    }

    pathGroup.name = 'DecoratedPath';
    scene.add(pathGroup);

    // ===== ANIMATE LED LIGHTS (Pulsing/Twinkling) =====
    pathGroup.userData.animateLights = function (time) {
        pathGroup.children.forEach(child => {
            if (child.userData.pulseOffset !== undefined) {
                // Pulsing animation
                const pulse = Math.sin(time * 3 + child.userData.pulseOffset) * 0.5 + 0.5;

                if (child.material && child.material.emissiveIntensity !== undefined) {
                    // LED orbs pulse
                    child.material.emissiveIntensity = 2.0 + pulse * 2.0;
                    if (child.userData.light) {
                        child.userData.light.intensity = 1.5 + pulse * 1.5;
                    }
                } else if (child.material && child.material.opacity !== undefined) {
                    // Arrows pulse
                    child.material.opacity = 0.7 + pulse * 0.3;
                }
            }

            if (child.userData.floatOffset !== undefined) {
                // Sparkles float up and down
                child.position.y += Math.sin(time * 2 + child.userData.floatOffset) * 0.01;
            }
        });
    };
}

function startTobogganMode() {
    gamePhase = 'TOBOGGAN';
    tobogganSpeed = 0.5;
    tobogganDistance = 0;

    // Hide guidance overlay
    const guide = document.getElementById('guidance-overlay');
    if (guide) guide.classList.add('hidden');

    // ===== RESET COMPETITIVE SCORES =====
    blueScore = 0;
    pinkScore = 0;
    document.getElementById('blue-score').innerText = "0";
    document.getElementById('pink-score').innerText = "0";
    document.getElementById('score-board').classList.remove('hidden');

    // ===== ATMOSPHERE & VISUALS =====
    // Brighten the scene significantly
    const ambient = scene.getObjectByName('ambient');
    if (ambient) ambient.intensity = 1.2; // Very bright, daytime feel? Or bright night.

    if (scene.fog) scene.fog.density = 0.003; // Very clear view

    // Make ground icy
    const ground = scene.getObjectByName('Ground');
    if (ground && ground.material) {
        ground.material.color.setHex(0xe0ffff); // Icy blue
        ground.material.roughness = 0.1;
        ground.material.metalness = 0.5;
        ground.material.needsUpdate = true;
    }

    // Show toboggan controls UI
    const controlsUI = document.getElementById('toboggan-controls');
    if (controlsUI) controlsUI.classList.remove('hidden');

    // Scenery Cleanup (if restarting)
    const oldScenery = scene.getObjectByName('SlopeScenery');
    if (oldScenery) scene.remove(oldScenery);

    // Create New Environment (Mountain scenery for Valentine's slope)
    createTreesAndRocks();


    function createTreesAndRocks() {
        const slopeGroup = new THREE.Group();
        slopeGroup.name = "SlopeScenery";

        // Add "Glass Trees" (Crystal Pines) along the sides - Festive
        const treeGeo = new THREE.ConeGeometry(5, 18, 8); // Taller trees
        const treeMat = new THREE.MeshStandardMaterial({
            color: 0x88ccff,
            roughness: 0,
            metalness: 0.9,
            emissive: 0x0044aa,
            emissiveIntensity: 0.4,
            transparent: true,
            opacity: 0.8
        });

        const trunkGeo = new THREE.CylinderGeometry(1, 1.5, 4);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x443322 });

        // Populate slope sides
        for (let z = -600; z > -5000; z -= 50) {
            // Left Side
            const xL = -45 - Math.random() * 60;
            const hL = getGroundHeight(xL, z);

            const treeL = new THREE.Group();
            const topL = new THREE.Mesh(treeGeo, treeMat); topL.position.y = 9;
            const baseL = new THREE.Mesh(trunkGeo, trunkMat); baseL.position.y = 2;
            treeL.add(baseL); treeL.add(topL);
            treeL.position.set(xL, hL, z);
            slopeGroup.add(treeL);

            // Right Side
            const xR = 45 + Math.random() * 60;
            const hR = getGroundHeight(xR, z);

            const treeR = new THREE.Group();
            const topR = new THREE.Mesh(treeGeo, treeMat); topR.position.y = 9;
            const baseR = new THREE.Mesh(trunkGeo, trunkMat); baseR.position.y = 2;
            treeR.add(baseR); treeR.add(topR);
            treeR.position.set(xR, hR, z);
            slopeGroup.add(treeR);

            // Add festive lights occasionally
            if (z % 150 === 0) {
                const lightColor = Math.random() > 0.5 ? 0xff69b4 : 0x00ffff;
                const light = new THREE.PointLight(lightColor, 2, 80);
                light.position.set(xL + 10, hL + 15, z);
                slopeGroup.add(light);

                const light2 = new THREE.PointLight(lightColor, 2, 80);
                light2.position.set(xR - 10, hR + 15, z);
                slopeGroup.add(light2);
            }
        }

        scene.add(slopeGroup);
    }

    // Clear previous obstacles and collectibles
    obstacles.forEach(o => scene.remove(o)); obstacles = [];
    collectibles.forEach(c => scene.remove(c)); collectibles = [];

    // Remove Infinity Gate if exists
    const gate = scene.getObjectByName('InfinityGate');
    if (gate) scene.remove(gate);

    // Position penguins Side by Side for tobogganing
    const startZ = -620;
    // Player 1 - Hero (Blue Scarf) on Left - WASD controls
    heroPenguin.position.set(-5, getGroundHeight(-5, startZ) + 0.8, startZ);
    // Player 2 - Love Interest (Pink/Orange Scarf) on Right - Arrow keys
    loveInterest.position.set(5, getGroundHeight(5, startZ) + 0.8, startZ);

    // ===== BELLY-DOWN SLIDING POSE - FACING FORWARD =====
    // Goal: Belly Down (-Y), Head Forward (-Z).

    heroPenguin.rotation.order = 'YXZ';
    loveInterest.rotation.order = 'YXZ';

    const slopeAngle = Math.atan(0.5);
    // Base X rotation is +PI/2 (Face Down).
    const baseRotationX = Math.PI / 2;
    const currentSlopeX = baseRotationX + slopeAngle * 0.5;

    // Y = PI (Turn around to face -Z)
    heroPenguin.rotation.set(currentSlopeX, Math.PI, 0);
    loveInterest.rotation.set(currentSlopeX, Math.PI, 0);

    // Reset internal animations
    if (heroPenguin.children[0]) heroPenguin.children[0].rotation.z = 0;
    if (loveInterest.children[0]) loveInterest.children[0].rotation.z = 0;

    // Hide gifts/flowers from previous scene
    if (heroPenguin.userData.envelope) heroPenguin.userData.envelope.visible = false;
    if (heroPenguin.userData.bouquet) heroPenguin.userData.bouquet.visible = false;
    if (loveInterest.userData.bouquet) loveInterest.userData.bouquet.visible = false;
}

// Toboggan-specific keys to avoid conflicts with global controls
// NEW GLOBALS
let p1Input = { w: false, a: false, s: false, d: false };
let p2Input = { up: false, down: false, left: false, right: false };
let nextSpawnDistance = 0;
let biomeState = 'NIGHT';

let tobogganKeys = {
    w: false, a: false, s: false, d: false,
    arrowup: false, arrowdown: false, arrowleft: false, arrowright: false
};

// ===== DEDICATED TOBOGGAN INPUT HANDLING =====
function handleTobogganInput(e, isDown) {
    if (gamePhase !== 'TOBOGGAN') return;

    // Prevent default scrolling for arrow keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) > -1) {
        if (e.type === 'keydown') e.preventDefault();
    }

    const key = e.key.toLowerCase();
    const code = e.code;

    // Player 1 (Blue) - WASD ONLY
    if (code === 'KeyW' || key === 'w') p1Input.w = isDown;
    if (code === 'KeyA' || key === 'a') p1Input.a = isDown;
    if (code === 'KeyS' || key === 's') p1Input.s = isDown;
    if (code === 'KeyD' || key === 'd') p1Input.d = isDown;

    // Player 2 (Pink) - Arrow Keys ONLY
    if (code === 'ArrowUp') p2Input.up = isDown;
    if (code === 'ArrowDown') p2Input.down = isDown;
    if (code === 'ArrowLeft') p2Input.left = isDown;
    if (code === 'ArrowRight') p2Input.right = isDown;
}

// Attach listener specifically for toboggan keys (Safe to call multiple times as functions match)
document.removeEventListener('keydown', handleTobogganInput); // Clean up old listeners just in case
document.removeEventListener('keyup', handleTobogganInput);
document.addEventListener('keydown', (e) => handleTobogganInput(e, true));
document.addEventListener('keyup', (e) => handleTobogganInput(e, false));


function updateTobogganPhysics() {
    // ===== TWO-PLAYER COMPETITIVE RACING =====
    let steerHero = 0;
    let steerLove = 0;

    // Player 1 Controls (Uses p1Input)
    if (p1Input.a) steerHero -= 1.0;
    if (p1Input.d) steerHero += 1.0;

    // Player 2 Controls (Uses p2Input)
    if (p2Input.left) steerLove -= 1.0;
    if (p2Input.right) steerLove += 1.0;

    // Apply steering independently
    heroPenguin.position.x += steerHero;
    loveInterest.position.x += steerLove;

    // Clamp to track boundaries
    heroPenguin.position.x = THREE.MathUtils.clamp(heroPenguin.position.x, -45, 45); // Widened track slightly
    loveInterest.position.x = THREE.MathUtils.clamp(loveInterest.position.x, -45, 45);

    // ===== SMOOTH SLIDING =====
    tobogganSpeed = Math.min(tobogganSpeed + 0.005, 2.5);

    // Move forward
    heroPenguin.position.z -= tobogganSpeed;
    loveInterest.position.z -= tobogganSpeed;

    tobogganDistance += tobogganSpeed;

    // ===== BIOME TRANSITION LOGIC =====
    // Distance-based transitions: Night -> Dawn (2000) -> Day (4000)

    if (biomeState === 'NIGHT' && tobogganDistance > 2000) {
        biomeState = 'DAWN';
        // Ensure fog exists
        if (!scene.fog) scene.fog = new THREE.FogExp2(0x050510, 0.003);
    } else if (biomeState === 'DAWN' && tobogganDistance > 4000) {
        biomeState = 'DAY';
    }

    // Visual Transitions (Lerp Colors)
    if (biomeState === 'DAWN') {
        const dawnColor = new THREE.Color(0xffaa55); // Orange/Pink
        scene.background.lerp(dawnColor, 0.005);
        if (scene.fog) scene.fog.color.lerp(dawnColor, 0.005);
    } else if (biomeState === 'DAY') {
        const dayColor = new THREE.Color(0x88ccff); // Light Blue
        scene.background.lerp(dayColor, 0.005);
        if (scene.fog) scene.fog.color.lerp(dayColor, 0.005);
    }

    // ===== JUMP PHYSICS (Gravity) =====
    const gravity = 0.05;

    // Hero Jump
    const heroGround = getGroundHeight(heroPenguin.position.x, heroPenguin.position.z);

    if (heroPenguin.userData.isJumping) {
        heroPenguin.position.y += heroPenguin.userData.yVel;
        heroPenguin.userData.yVel -= gravity;

        // Land
        if (heroPenguin.position.y <= heroGround + 0.8) {
            heroPenguin.position.y = heroGround + 0.8;
            heroPenguin.userData.isJumping = false;
        }
    } else {
        heroPenguin.position.y = heroGround + 0.8;
    }

    // Love Jump
    const loveGround = getGroundHeight(loveInterest.position.x, loveInterest.position.z);

    if (loveInterest.userData.isJumping) {
        loveInterest.position.y += loveInterest.userData.yVel;
        loveInterest.userData.yVel -= gravity;

        // Land
        if (loveInterest.position.y <= loveGround + 0.8) {
            loveInterest.position.y = loveGround + 0.8;
            loveInterest.userData.isJumping = false;
        }
    } else {
        loveInterest.position.y = loveGround + 0.8;
    }

    // ===== POSE & ROTATION =====
    heroPenguin.rotation.order = 'YXZ';
    loveInterest.rotation.order = 'YXZ';
    const baseRotX = Math.PI / 2;

    const heroPitch = heroPenguin.userData.isJumping ? (heroPenguin.userData.yVel * 0.5) : 0;
    const lovePitch = loveInterest.userData.isJumping ? (loveInterest.userData.yVel * 0.5) : 0;

    heroPenguin.rotation.set(baseRotX - heroPitch, Math.PI, steerHero * 0.1);
    loveInterest.rotation.set(baseRotX - lovePitch, Math.PI, steerLove * 0.1);

    // ===== IMPROVED CAMERA - FIXED X AXIS =====
    // Camera follows forward progress (Z) and vertical (Y) average, 
    // BUT STAYS CENTERED ON TRACK (X=0) to prevent "opposite movement" illusion.

    const centerZ = (heroPenguin.position.z + loveInterest.position.z) / 2;
    const centerY = (heroPenguin.position.y + loveInterest.position.y) / 2;

    const cameraHeight = 30;
    const cameraBack = 40;
    const cameraLift = 8;

    camera.position.set(
        0, // Fixed X (Track Center)
        centerY + cameraHeight,
        centerZ + cameraBack
    );

    // Look ahead on the track center
    const lookAtPoint = new THREE.Vector3(
        0, // Fixed X
        centerY + cameraLift,
        centerZ - 25
    );
    camera.lookAt(lookAtPoint);

    // ===== SNOW TRAILS =====
    if (Math.random() > 0.6) {
        createTrailParticle(heroPenguin.position, 0x00aaff);
        createTrailParticle(loveInterest.position, 0xff69b4);
    }
    updateTrails();

    // Trigger fireworks randomly
    if (Math.random() < 0.05) { // 5% chance per frame
        spawnFirework();
    }
    updateTobogganFireworks();

    // Trigger fireworks randomly
    if (Math.random() < 0.05) { // 5% chance per frame (approx 3 per sec)
        spawnFirework();
    }
    updateTobogganFireworks();

    // Handle collectibles and obstacles
    handleTobogganObjects();

    // Win condition is checked in handleTobogganObjects when collecting hearts
}



function createTrailParticle(pos, colorHex) {
    const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 4, 4),
        new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.8 })
    );
    p.position.copy(pos);
    p.position.y += 0.2; // Slightly off ground
    scene.add(p);
    trailParticles.push({ mesh: p, life: 1.0 });
}

function updateTrails() {
    for (let i = trailParticles.length - 1; i >= 0; i--) {
        const tp = trailParticles[i];
        tp.life -= 0.05;
        tp.mesh.material.opacity = tp.life;
        tp.mesh.scale.setScalar(tp.life);

        if (tp.life <= 0) {
            scene.remove(tp.mesh);
            trailParticles.splice(i, 1);
        }
    }
}


function handleTobogganObjects() {
    // ===== SPAWNING LOGIC (Distance Based) =====
    // Ensure generation never stops
    if (tobogganDistance > nextSpawnDistance) {
        nextSpawnDistance = tobogganDistance + 35; // Spawn much more frequently (was 60)

        const spawnZ = heroPenguin.position.z - 150; // Spawn ahead
        const spawnX = (Math.random() * 80) - 40;    // Random X width

        // BIOME SPECIFIC SPAWNING
        let spawnType = Math.random();

        // SCENERY: Spawn Mountains/Trees on far sides occasionally
        if (Math.random() > 0.7) {
            const side = Math.random() > 0.5 ? 1 : -1;
            const sceneryX = side * (50 + Math.random() * 50);

            if (biomeState === 'DAY' || biomeState === 'DAWN') {
                const tree = new THREE.Mesh(
                    new THREE.ConeGeometry(8, 25, 8),
                    new THREE.MeshStandardMaterial({ color: 0x2d4c1e, roughness: 0.8 })
                );
                tree.position.set(sceneryX, getGroundHeight(sceneryX, spawnZ), spawnZ);
                scene.add(tree);
                obstacles.push(tree);
                tree.userData.isScenery = true;
            } else {
                const mtn = new THREE.Mesh(
                    new THREE.ConeGeometry(15, 40, 4),
                    new THREE.MeshStandardMaterial({ color: 0xaaccff, roughness: 0.1 })
                );
                mtn.position.set(sceneryX, getGroundHeight(sceneryX, spawnZ) - 5, spawnZ);
                scene.add(mtn);
                obstacles.push(mtn);
                mtn.userData.isScenery = true;
            }
        }

        // GAMEPLAY OBJECTS (Center track)
        if (spawnType < 0.45) {
            // ===== COLLECTIBLE HEARTS (45% chance - INCREASED) =====

            // Heart 1
            const heart1 = createCollectibleHeart();
            heart1.position.set(spawnX, getGroundHeight(spawnX, spawnZ) + 2, spawnZ);
            scene.add(heart1);
            collectibles.push(heart1);

            // TWIN HEART CHANCE (Allow both players to get one)
            if (Math.random() < 0.6) {
                const heart2 = createCollectibleHeart();
                // Spawn slightly offset to the other side
                const offset = (spawnX > 0) ? -15 : 15;
                const h2X = spawnX + offset;
                heart2.position.set(h2X, getGroundHeight(h2X, spawnZ) + 2, spawnZ);
                scene.add(heart2);
                collectibles.push(heart2);
            }

        } else if (spawnType < 0.65) {
            // ===== SPEED BOOST (20% chance) =====
            const boost = createSpeedBoost();
            boost.position.set(spawnX, getGroundHeight(spawnX, spawnZ) + 0.1, spawnZ);
            boost.rotation.x = -Math.PI / 2;
            scene.add(boost);
            boost.userData.isBoost = true;
            obstacles.push(boost);

        } else {
            // ===== OBSTACLES (35% chance) =====
            // Biome variation
            if (biomeState === 'DAY') {
                // Day: logs or rocks
                if (Math.random() > 0.5) {
                    const log = createLogObstacle();
                    log.position.set(spawnX, getGroundHeight(spawnX, spawnZ), spawnZ);
                    scene.add(log);
                    obstacles.push(log);
                } else {
                    // Rock
                    const rock = new THREE.Mesh(
                        new THREE.DodecahedronGeometry(2),
                        new THREE.MeshStandardMaterial({ color: 0x555555 })
                    );
                    rock.position.set(spawnX, getGroundHeight(spawnX, spawnZ) + 1, spawnZ);
                    scene.add(rock);
                    obstacles.push(rock);
                }

            } else {
                // Night: Snowmen & Logs
                if (Math.random() > 0.5) {
                    const snowman = createSnowmanObstacle();
                    snowman.position.set(spawnX, getGroundHeight(spawnX, spawnZ), spawnZ);
                    scene.add(snowman);
                    obstacles.push(snowman);
                } else {
                    const log = createLogObstacle();
                    log.position.set(spawnX, getGroundHeight(spawnX, spawnZ), spawnZ);
                    scene.add(log);
                    obstacles.push(log);
                }
            }
        }
    }

    // WIN SCORE CHECK (TESTING MODE = 5)
    // WIN SCORE CHECK (Global WIN_SCORE used)

    // Update & Collect - Hearts
    for (let i = collectibles.length - 1; i >= 0; i--) {
        const c = collectibles[i];
        c.rotation.y += 0.05;

        // Remove if behind
        const furthestZ = Math.max(heroPenguin.position.z, loveInterest.position.z);
        if (c.position.z > furthestZ + 10) {
            scene.remove(c);
            collectibles.splice(i, 1);
            continue;
        }

        // Check Collisions
        if (heroPenguin.position.distanceTo(c.position) < 3.5) {
            blueScore++;
            document.getElementById('blue-score').innerText = blueScore;
            scene.remove(c);
            collectibles.splice(i, 1);
        }
        else if (loveInterest.position.distanceTo(c.position) < 3.5) {
            pinkScore++;
            document.getElementById('pink-score').innerText = pinkScore;
            scene.remove(c);
            collectibles.splice(i, 1);
        }

        if (blueScore >= WIN_SCORE || pinkScore >= WIN_SCORE) endGameLoveWins();
    }

    // Update & Collide - Obstacles & Boosts
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];

        // Remove if behind
        const furthestZ = Math.max(heroPenguin.position.z, loveInterest.position.z);
        if (o.position.z > furthestZ + 10) {
            scene.remove(o);
            obstacles.splice(i, 1);
            continue;
        }

        // Ignore collision for scenery (far objects)
        if (o.userData.isScenery) continue;

        // Collision Logic
        // Blue Penguin
        if (heroPenguin.position.distanceTo(o.position) < 3.5) {
            if (o.userData.isBoost) {
                // SPEED UP & JUMP
                tobogganSpeed += 0.05;
                heroPenguin.userData.isJumping = true;
                heroPenguin.userData.yVel = 0.4;

                scene.remove(o);
                obstacles.splice(i, 1);
                continue;
            } else {
                // HIT OBSTACLE
                tobogganSpeed *= 0.8;
                heroPenguin.position.z += 5;
                scene.remove(o);
                obstacles.splice(i, 1);
                continue;
            }
        }

        // Pink Penguin
        if (loveInterest.position.distanceTo(o.position) < 3.5) {
            if (o.userData.isBoost) {
                // SPEED UP & JUMP
                tobogganSpeed += 0.05;
                loveInterest.userData.isJumping = true;
                loveInterest.userData.yVel = 0.4;

                scene.remove(o);
                obstacles.splice(i, 1);
                continue;
            } else {
                // HIT OBSTACLE
                tobogganSpeed *= 0.8;
                loveInterest.position.z += 5;
                scene.remove(o);
                obstacles.splice(i, 1);
                continue;
            }
        }
    }
}

function createSpeedBoost() {
    // Glowing Blue Ice Patch
    const geometry = new THREE.CircleGeometry(4, 32);
    const material = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });
    const patch = new THREE.Mesh(geometry, material);

    // Add inner glow ring
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(2, 2.5, 32),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    ring.position.z = 0.01;
    patch.add(ring);

    return patch;
}


function createCollectibleHeart() {
    const shape = new THREE.Shape();
    const x = -2.5;
    const y = -5;
    shape.moveTo(x + 2.5, y + 2.5);
    shape.bezierCurveTo(x + 2.5, y + 2.5, x + 2.0, y, x, y);
    shape.bezierCurveTo(x - 3.0, y, x - 3.0, y + 3.5, x - 3.0, y + 3.5);
    shape.bezierCurveTo(x - 3.0, y + 5.5, x - 1.0, y + 7.7, x + 2.5, y + 9.5);
    shape.bezierCurveTo(x + 6.0, y + 7.7, x + 8.0, y + 5.5, x + 8.0, y + 3.5);
    shape.bezierCurveTo(x + 8.0, y + 3.5, x + 8.0, y, x + 5.0, y);
    shape.bezierCurveTo(x + 3.5, y, x + 2.5, y + 2.5, x + 2.5, y + 2.5);

    const extrudeSettings = { depth: 2, bevelEnabled: true, bevelSegments: 2, steps: 2, bevelSize: 0.5, bevelThickness: 0.5 };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();

    // Rotate 180 Z to make it point up (Shape is drawn upside down often? or just X flip)
    // Actually shape points down. Let's adjust rotation in usage.
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xff1493, metalness: 0.3, roughness: 0.2, emissive: 0xff1493, emissiveIntensity: 0.6 }));
    mesh.scale.set(0.15, 0.15, 0.15);
    mesh.rotation.z = Math.PI; // Flip upright
    return mesh;
}

// ===== CREATE LOG OBSTACLE =====
function createLogObstacle() {
    const log = new THREE.Group();

    // Horizontal log lying across the path
    const logBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 8, 8),
        new THREE.MeshStandardMaterial({
            color: 0x8B4513, // Brown
            roughness: 0.9
        })
    );
    logBody.rotation.z = Math.PI / 2; // Lay horizontal
    log.add(logBody);

    // End caps (darker)
    const endMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
    const end1 = new THREE.Mesh(new THREE.CircleGeometry(0.8, 8), endMat);
    end1.position.set(-4, 0, 0);
    end1.rotation.y = Math.PI / 2;
    const end2 = new THREE.Mesh(new THREE.CircleGeometry(0.8, 8), endMat);
    end2.position.set(4, 0, 0);
    end2.rotation.y = -Math.PI / 2;
    log.add(end1, end2);

    log.position.y = 0.8; // Slightly above ground
    return log;
}

// ===== CREATE ROCK OBSTACLE =====
function createRockObstacle() {
    const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(2, 0),
        new THREE.MeshStandardMaterial({
            color: 0x808080, // Gray
            roughness: 1.0,
            flatShading: true
        })
    );
    rock.position.y = 1;
    rock.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
    );
    return rock;
}

// ===== CREATE SNOWMAN OBSTACLE =====
function createSnowmanObstacle() {
    const snowman = new THREE.Group();

    // Bottom sphere
    const bottom = new THREE.Mesh(
        new THREE.SphereGeometry(2, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    bottom.position.y = 2;
    snowman.add(bottom);

    // Middle sphere
    const middle = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    middle.position.y = 4.5;
    snowman.add(middle);

    // Head sphere
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(1, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    head.position.y = 6.5;
    snowman.add(head);

    // Carrot nose
    const nose = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 0.8, 6),
        new THREE.MeshStandardMaterial({ color: 0xff6600 })
    );
    nose.position.set(0, 6.5, 1);
    nose.rotation.x = Math.PI / 2;
    snowman.add(nose);

    return snowman;
}

function createTreesAndRocks() {
    const group = new THREE.Group();
    group.name = 'SlopeScenery';

    // Create trees along the path (START FURTHER AHEAD so no trees at beginning!)
    // Penguins start at -620, so trees should start at -700 or further
    const treeGeo = new THREE.ConeGeometry(4, 12, 8);
    const treeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true });

    for (let z = -700; z > -5000; z -= 40) {
        // Left side
        if (Math.random() > 0.3) {
            const tree = new THREE.Mesh(treeGeo, treeMat);
            const x = -30 - Math.random() * 50;
            tree.position.set(x, getGroundHeight(x, z), z);
            tree.scale.setScalar(0.8 + Math.random() * 0.5);
            group.add(tree);
        }

        // Right side
        if (Math.random() > 0.3) {
            const tree = new THREE.Mesh(treeGeo, treeMat);
            const x = 30 + Math.random() * 50;
            tree.position.set(x, getGroundHeight(x, z), z);
            tree.scale.setScalar(0.8 + Math.random() * 0.5);
            group.add(tree);
        }
    }
    scene.add(group);
}

function createInfinityGate(zPos) {
    const gateGroup = new THREE.Group();
    gateGroup.name = 'InfinityGate';
    gateGroup.position.set(0, 0, zPos);

    const torus = new THREE.Mesh(
        new THREE.TorusGeometry(30, 2, 16, 100, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.5, metalness: 1, roughness: 0.2 })
    );
    gateGroup.add(torus);

    const glow = new THREE.PointLight(0xffaa00, 2, 100);
    glow.position.y = 15; gateGroup.add(glow);
    scene.add(gateGroup);
}

// ===== REDESIGNED LOVE WINS ENDING =====
function endGameLoveWins() {
    gamePhase = 'ENDING';

    // Stop toboggan speed eventually
    tobogganSpeed = 0;

    // Hide gameplay UI
    const controlsUI = document.getElementById('toboggan-controls');
    if (controlsUI) controlsUI.classList.add('hidden');

    const scoreBoard = document.getElementById('score-board');
    if (scoreBoard) scoreBoard.classList.add('hidden'); // Hide in-game score

    // Create Ending Screen
    let endScreen = document.getElementById('ending-screen');
    if (!endScreen) {
        endScreen = document.createElement('div');
        endScreen.id = 'ending-screen';
        endScreen.className = 'hidden';
        document.body.appendChild(endScreen);
    }

    // Determine Winner initially
    let winnerText = "";
    let winnerColor = "";
    if (blueScore > pinkScore) {
        winnerText = "Blue Penguin Leads!";
        winnerColor = "#00aaff";
    } else if (pinkScore > blueScore) {
        winnerText = "Pink Penguin Leads!";
        winnerColor = "#ff69b4";
    } else {
        winnerText = "It's a Tie!";
        winnerColor = "#ffffff";
    }

    // Set styling and content
    endScreen.style.cssText = `
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: linear-gradient(135deg, rgba(20, 0, 40, 0.95), rgba(60, 20, 80, 0.95));
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        z-index: 200; opacity: 0; transition: opacity 1s;
    `;

    endScreen.innerHTML = `
        <div id="end-content" style="text-align: center; position: relative;">
            
            <!-- STAGE 1: Winner Announcement -->
            <div id="stage-winner" style="transition: opacity 1s;">
                <h1 style="color: ${winnerColor}; font-family: 'Great Vibes', cursive; font-size: 4rem; text-shadow: 0 0 20px ${winnerColor}; margin-bottom: 20px;">
                    ${winnerText}
                </h1>
                <div style="font-size: 2rem; color: #fff; margin-bottom: 40px; font-family: 'Playfair Display';">
                    <span style="color: #00aaff">Blue: ${blueScore}</span> vs <span style="color: #ff69b4">Pink: ${pinkScore}</span>
                </div>
            </div>

            <!-- STAGE 2: Love Wins (Hearts Merging) -->
            <div id="stage-love" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0; transition: opacity 1s; width: 100%;">
                
                <div style="position: relative; height: 150px; margin-bottom: 20px;">
                    <!-- Blue Heart -->
                    <div id="heart-blue" style="position: absolute; left: 40%; font-size: 6rem; filter: drop-shadow(0 0 20px #00aaff); transition: all 2s ease-in-out;">\uD83D\uDC99</div>
                    <!-- Pink Heart -->
                    <div id="heart-pink" style="position: absolute; right: 40%; font-size: 6rem; filter: drop-shadow(0 0 20px #ff69b4); transition: all 2s ease-in-out;">\uD83D\uDC96</div>
                    <!-- Final Purple Heart -->
                    <div id="heart-final" style="position: absolute; left: 50%; transform: translateX(-50%) scale(0); font-size: 8rem; filter: drop-shadow(0 0 40px #8a2be2); transition: all 0.5s;">\uD83D\uDC9C</div>
                </div>

                <h1 style="color: #ffffff; font-family: 'Great Vibes', cursive; font-size: 5rem; text-shadow: 0 0 30px #ffffff;">
                    Love Wins!
                </h1>
                
                <button id="btn-restart-final" class="valentine-btn" 
                    style="margin-top: 30px; font-size: 1.5rem; padding: 15px 40px; cursor: pointer; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 50px; color: white; box-shadow: 0 4px 15px rgba(0,0,0,0.3); opacity: 0; transition: opacity 1s;">
                    Play Again \uD83D\uDC95
                </button>
            </div>
        </div>
    `;

    // Show Screen
    endScreen.classList.remove('hidden');
    setTimeout(() => { endScreen.style.opacity = '1'; }, 100);

    // ANIMATION SEQUENCE
    setTimeout(() => {
        // Fade out winner text
        const stageWinner = document.getElementById('stage-winner');
        if (stageWinner) stageWinner.style.opacity = '0';

        // Fade in hearts container
        const stageLove = document.getElementById('stage-love');
        if (stageLove) stageLove.style.opacity = '1';

        // Animate hearts merging
        setTimeout(() => {
            const hB = document.getElementById('heart-blue');
            const hP = document.getElementById('heart-pink');
            const hF = document.getElementById('heart-final');
            const btn = document.getElementById('btn-restart-final');

            if (hB && hP) {
                hB.style.left = '50%';
                hB.style.transform = 'translateX(-50%) scale(0.5)';
                hB.style.opacity = '0';

                hP.style.right = '50%';
                hP.style.transform = 'translateX(50%) scale(0.5)';
                hP.style.opacity = '0';
            }

            setTimeout(() => {
                if (hF) hF.style.transform = 'translateX(-50%) scale(1.2)';

                // Pulse effect logic inside interval if needed

                if (btn) btn.style.opacity = '1';

            }, 1800); // After move completes

        }, 1000); // Start move after fade in

    }, 3000); // Show winner result for 3 seconds

    // Bind Restart Button
    // Use timeout to ensure element exists in DOM
    setTimeout(() => {
        const btn = document.getElementById('btn-restart-final');
        if (btn) {
            btn.addEventListener('click', () => {
                endScreen.classList.add('hidden');
                setTimeout(() => {
                    endScreen.style.opacity = '0';
                    endScreen.style.display = 'none';
                }, 500);

                // Restart Logic
                if (scene.fog) scene.fog.density = 0.003;
                startTobogganMode();
            });
        }
    }, 100);
}




// Legacy function for compatibility
function endGameHappy() {
    endGameLoveWins();
}


// Start when button clicked
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            setTimeout(() => {
                // Initialize only if not already initialized
                if (!scene) init();
            }, 100);
        });
    }
});
// --- Guidance Overlay Interaction ---
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        const overlay = document.getElementById('guidance-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            overlay.classList.add('hidden');
        }
    }
});


// --- GUIDANCE LIGHT SYSTEM ---

function createPinkGuidance() {
    pinkGuidance = new THREE.Group();

    // Soft glowing cloud (no solid core)
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 105, 180, 0.8)');
    grad.addColorStop(0.5, 'rgba(255, 105, 180, 0.2)');
    grad.addColorStop(1, 'rgba(255, 105, 180, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);

    const cloudParts = [];
    for (let i = 0; i < 6; i++) {
        const mat = new THREE.SpriteMaterial({
            map: tex,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending
        });
        const sprite = new THREE.Sprite(mat);
        sprite.position.set((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5);
        sprite.scale.setScalar(1.5 + Math.random() * 1.5);
        pinkGuidance.add(sprite);
        cloudParts.push({
            sprite: sprite,
            phase: Math.random() * Math.PI * 2,
            speed: 0.4 + Math.random() * 0.6
        });
    }

    const pl = new THREE.PointLight(0xff69b4, 3, 30);
    pinkGuidance.add(pl);

    pinkGuidance.userData = { pl: pl, cloudParts: cloudParts, targetVisibility: 1.0 };

    if (heroPenguin) {
        pinkGuidance.position.copy(heroPenguin.position);
        pinkGuidance.position.y += 10;
    }
    scene.add(pinkGuidance);
}

function updatePinkGuidance(t) {
    if (!pinkGuidance || !heroPenguin || !loveInterest) return;

    const distToTarget = heroPenguin.position.distanceTo(loveInterest.position);

    // Visibility Logic
    if (gamePhase !== 'WALKING' && gamePhase !== 'FOUND_VILLAGE') {
        pinkGuidance.userData.targetVisibility = 0.0;
    } else {
        pinkGuidance.userData.targetVisibility = 1.0;
    }

    const currentInt = pinkGuidance.userData.pl.intensity / 5.0;
    const newVis = THREE.MathUtils.lerp(currentInt, pinkGuidance.userData.targetVisibility, 0.05);
    pinkGuidance.userData.pl.intensity = newVis * 5.0;

    pinkGuidance.userData.cloudParts.forEach(p => {
        p.sprite.material.opacity = newVis * 0.4;
        // Natural drift
        p.sprite.position.y += Math.sin(t * p.speed + p.phase) * 0.015;
        p.sprite.position.x += Math.cos(t * p.speed + p.phase) * 0.015;
    });

    if (newVis < 0.01) {
        pinkGuidance.visible = false;
        return;
    }
    pinkGuidance.visible = true;

    // NO GLOBAL SCALE PULSING
    pinkGuidance.scale.set(1, 1, 1);

    // Movement
    const dir = new THREE.Vector3().subVectors(loveInterest.position, heroPenguin.position).normalize();
    const leadDist = Math.min(15, distToTarget * 0.5);
    const targetPos = heroPenguin.position.clone().add(dir.multiplyScalar(leadDist));
    targetPos.y = getGroundHeight(targetPos.x, targetPos.z) + 6 + Math.sin(t * 1.5) * 1.0;

    pinkGuidance.position.lerp(targetPos, 0.03);
}

// --- FIREWORKS SYSTEM ---
let fireworks = [];

function createTobogganFireworks() {
    // Just initializes the array, actual spawning happens in update
    fireworks = [];
}

function spawnFirework() {
    // Random position ahead of the camera
    const zOffset = camera.position.z - 400 - Math.random() * 200; // Look ahead
    const xOffset = (Math.random() - 0.5) * 300; // Spread wide
    const yHeight = 150 + Math.random() * 150; // High in sky

    const color = new THREE.Color().setHSL(Math.random(), 1.0, 0.6); // Vivid rainbow colors
    const particleCount = 20 + Math.floor(Math.random() * 20);

    // Create explosion particles
    const geo = new THREE.BufferGeometry();
    const pos = [];
    const vels = [];

    for (let i = 0; i < particleCount; i++) {
        pos.push(xOffset, yHeight, zOffset);

        // Explosion velocity sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const speed = 2 + Math.random() * 3;

        vels.push(
            Math.sin(phi) * Math.cos(theta) * speed,
            Math.cos(phi) * speed,
            Math.sin(phi) * Math.sin(theta) * speed
        );
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
        color: color,
        size: 8 + Math.random() * 8,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const system = new THREE.Points(geo, mat);
    system.userData = { vels: vels, life: 1.0, decay: 0.01 + Math.random() * 0.02 };

    scene.add(system);
    fireworks.push(system);
}

function updateTobogganFireworks() {
    for (let i = fireworks.length - 1; i >= 0; i--) {
        const fw = fireworks[i];
        const positions = fw.geometry.attributes.position;
        const vels = fw.userData.vels;

        fw.userData.life -= fw.userData.decay;
        fw.material.opacity = fw.userData.life;

        // Update positions
        for (let j = 0; j < positions.count; j++) {
            let x = positions.getX(j);
            let y = positions.getY(j);
            let z = positions.getZ(j);

            x += vels[j * 3];
            y += vels[j * 3 + 1];
            z += vels[j * 3 + 2];

            // Gravity
            vels[j * 3 + 1] -= 0.05;

            positions.setXYZ(j, x, y, z);
        }
        positions.needsUpdate = true;

        if (fw.userData.life <= 0) {
            scene.remove(fw);
            fireworks.splice(i, 1);
        }
    }
}
