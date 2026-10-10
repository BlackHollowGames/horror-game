// THE SEEKER — additional explorable rooms and sector-specific set dressing.
// Kept in a separate file so the map can grow without bloating game.js.
import { decorateExpansionRooms } from "./room-details.js";
export function buildExpansion(THREE, scene, state, addBox, mat) {
  const concrete = mat(0x565850, 1, 0);
  const stained = mat(0x343832, 1, 0);
  const metal = mat(0x252b29, .62, .55);
  const rust = mat(0x67412e, .94, .18);
  const wood = mat(0x29221d, .96, 0);
  const glass = new THREE.MeshStandardMaterial({ color: 0x263b3c, roughness: .2, metalness: .35, transparent: true, opacity: .38 });
  const glowRed = new THREE.MeshStandardMaterial({ color: 0x8d1712, emissive: 0x4c0503, emissiveIntensity: 1.2 });
  const glowGreen = new THREE.MeshStandardMaterial({ color: 0x6a9b76, emissive: 0x16351b, emissiveIntensity: .8 });

  const centers = [5, -5, -15, -25];
  for (const side of [-1, 1]) {
    for (let i = 0; i < centers.length; i++) {
      const z = centers[i];
      const x1 = side * 17, x2 = side * 26.5;
      // The middle wing is a large room, not a narrow passage.
      addBox(`deep wing floor ${side} ${i}`, x1, -.19, z, 10.1, .32, 8.8, concrete);
      addBox(`deep wing ceiling ${side} ${i}`, x1, 4.25, z, 10.1, .28, 8.8, stained);
      // Outer wall of the first wing is split to create a real walk-through doorway.
      addBox(`wing divider upper ${side} ${i}`, side * 22.05, 2, z + 2.45, .3, 4.25, 2.35, concrete, true);
      addBox(`wing divider lower ${side} ${i}`, side * 22.05, 2, z - 2.45, .3, 4.25, 2.35, concrete, true);
      addBox(`wing doorway lintel ${side} ${i}`, side * 22.05, 3.05, z, .42, .2, 2.65, metal);
      addBox(`wing doorway jamb left ${side} ${i}`, side * 22.05, 1.45, z + 1.35, .24, 2.9, .22, rust);
      addBox(`wing doorway jamb right ${side} ${i}`, side * 22.05, 1.45, z - 1.35, .24, 2.9, .22, rust);

      // Deep chambers: larger side rooms with their own doorways, floor clutter and landmarks.
      addBox(`deep chamber floor ${side} ${i}`, x2, -.19, z, 8.8, .32, 8.8, concrete);
      addBox(`deep chamber ceiling ${side} ${i}`, x2, 4.25, z, 8.8, .28, 8.8, stained);
      addBox(`deep chamber outer wall ${side} ${i}`, side * 31.1, 2, z, .32, 4.25, 8.8, concrete, true);
      addBox(`deep chamber end wall A ${side} ${i}`, side * 26.5, 2, z + 4.4, 8.8, 4.25, .32, concrete, true);
      addBox(`deep chamber end wall B ${side} ${i}`, side * 26.5, 2, z - 4.4, 8.8, 4.25, .32, concrete, true);

      // The east wing reads as industrial / laboratory; the west wing as decayed mansion rooms.
      if (side > 0) {
        addBox(`lab workbench ${i}`, side * 15.1, .92, z + 2.2, 2.8, .18, 1.05, metal, true);
        for (let k = 0; k < 3; k++) {
          const jar = new THREE.Mesh(new THREE.CylinderGeometry(.22, .25, .9, 12), glass);
          jar.position.set(side * (14.3 + k * .72), 1.48, z + 2.2); jar.castShadow = true; scene.add(jar);
        }
        // Containment pod with warning light.
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(.7, .82, 2.8, 16, 1, true), glass);
        pod.position.set(side * 18.8, 1.45, z - 1.35); pod.castShadow = true; scene.add(pod);
        addBox(`containment base ${i}`, side * 18.8, .18, z - 1.35, 1.85, .32, 1.85, metal, true);
        const warning = new THREE.PointLight(0x9c1711, .85, 5); warning.position.set(side * 18.8, 2.9, z - 1.35); scene.add(warning);
        addBox(`lab monitor ${i}`, side * 21.0, 1.7, z + .4, .08, .75, .95, glowGreen);
      } else {
        // Furniture gives the west side a different silhouette and places to duck behind.
        addBox(`mansion bed frame ${i}`, side * 15.1, .28, z + 2.0, 2.8, .25, 1.5, wood, true);
        addBox(`mansion mattress ${i}`, side * 15.1, .48, z + 2.0, 2.65, .22, 1.38, mat(0x55504a), true);
        addBox(`wardrobe ${i}`, side * 18.8, 1.35, z - 1.45, 1.25, 2.7, .9, wood, true);
        addBox(`wardrobe door ${i}`, side * 18.15, 1.35, z - 1.45, .08, 2.45, .8, rust);
        addBox(`library shelf ${i}`, side * 21.0, 1.6, z + 2.55, .55, 3.2, 2.8, wood, true);
        for (let k = 0; k < 9; k++) addBox(`old book ${i} ${k}`, side * (20.72 + (k % 3) * .18), .55 + Math.floor(k / 3) * .72, z + 1.65 + (k % 2) * .28, .18, .42, .22, mat([0x4a2722,0x343d32,0x5b4b32][k%3]));
      }

      // A few chunky rubble pieces and overhead pipes add scale and stop rooms feeling empty.
      for (let n = 0; n < 10; n++) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(.12 + Math.random() * .25, 0), mat(Math.random() > .5 ? 0x353630 : 0x171a18));
        rock.position.set(side * (13 + Math.random() * 16), .05, z + (Math.random() - .5) * 7.2);
        rock.scale.y = .3 + Math.random() * .4; rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); scene.add(rock);
      }
      for (const pipeX of [side * 14, side * 16, side * 19, side * 21, side * 24, side * 28]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 8.1, 8), rust);
        pipe.rotation.x = Math.PI / 2; pipe.position.set(pipeX, 3.82, z); scene.add(pipe);
      }
      const lamp = new THREE.PointLight(side > 0 ? 0x718477 : 0x9a7651, i % 2 ? .36 : .22, 10);
      lamp.position.set(side * 17, 3.55, z); scene.add(lamp);
    }
  }

  // The original central exit remains reachable; the added wings do not wall it off.

  // Add simple map markers above room entrances to encourage exploration.
  for (const side of [-1, 1]) {
    for (let i = 0; i < centers.length; i++) {
      const z = centers[i];
      const markerMat = side > 0 ? glowGreen : glowRed;
      const marker = new THREE.Mesh(new THREE.BoxGeometry(.7, .1, .08), markerMat);
      marker.position.set(side * 12.15, 3.25, z); scene.add(marker);
    }
  }
  decorateExpansionRooms(THREE, scene, addBox, mat);
  state.worldExpanded = true;
}
