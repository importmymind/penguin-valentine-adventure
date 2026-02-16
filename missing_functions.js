
// ===== SCENERY FOR TOBOGGAN MODE =====
function createTreesAndRocks() {
    const slopeGroup = new THREE.Group();
    slopeGroup.name = "SlopeScenery";

    // Add "Glass Trees" (Crystal Pines) along the sides
    const treeGeo = new THREE.ConeGeometry(4, 12, 8);
    // emissive material makes them glow slightly
    const treeMat = new THREE.MeshStandardMaterial({
        color: 0x88ccff,
        roughness: 0.1,
        metalness: 0.9,
        emissive: 0x0044aa,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.9
    });

    for (let z = -600; z > -3000; z -= 80) {
        // Left Side
        const treeL = new THREE.Mesh(treeGeo, treeMat);
        const xL = -50 - Math.random() * 50;
        treeL.position.set(xL, getGroundHeight(xL, z) + 6, z);
        slopeGroup.add(treeL);

        // Right Side
        const treeR = new THREE.Mesh(treeGeo, treeMat);
        const xR = 50 + Math.random() * 50;
        treeR.position.set(xR, getGroundHeight(xR, z) + 6, z);
        slopeGroup.add(treeR);

        // Add some colored point lights near trees for "festive" feel?
        if (Math.random() < 0.3) {
            const light = new THREE.PointLight(Math.random() > 0.5 ? 0xff00ff : 0x00ffff, 1, 60);
            light.position.set(xL, getGroundHeight(xL, z) + 10, z);
            slopeGroup.add(light);
        }
    }

    scene.add(slopeGroup);
}
