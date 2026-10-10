// Extra room dressing separated from the map geometry for easier future expansion.
export function decorateExpansionRooms(THREE, scene, addBox, mat) {
  const iron = mat(0x262b28, .72, .52);
  const rust = mat(0x60402e, .93, .16);
  const darkWood = mat(0x28221d, .98, 0);
  const tornFabric = mat(0x34352f, 1, 0);
  const black = mat(0x080a09, 1, 0);
  const roomZ = [5, -5, -15, -25];

  // West-side mansion: additional bedside tables, cracked mirrors and overturned chairs.
  for (let i = 0; i < roomZ.length; i++) {
    const z = roomZ[i];
    addBox(`mansion bedside table ${i}`, -13.4, .55, z - 2.2, .8, 1.05, .72, darkWood, true);
    addBox(`mansion cracked mirror ${i}`, -21.1, 2.05, z - 3.5, .08, 1.6, 1.0, mat(0x4a5551, .22, .7));
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(.75,.12,.75), darkWood); seat.position.y=.62; chair.add(seat);
    for (const x of [-.29,.29]) for (const zz of [-.29,.29]) { const leg=new THREE.Mesh(new THREE.BoxGeometry(.09,.62,.09),darkWood);leg.position.set(x,.31,zz);chair.add(leg); }
    const back = new THREE.Mesh(new THREE.BoxGeometry(.72,.9,.1), darkWood); back.position.set(0,1.08,.32); chair.add(back);
    chair.position.set(-23.5,.03,z+1.9); chair.rotation.y = i%2 ? .45 : -.35; chair.rotation.z = i%2 ? .12 : -.08; scene.add(chair);
    // Locker-like wardrobe silhouettes provide future hiding-spot landmarks.
    addBox(`tall storage locker ${i}`, -28.2, 1.25, z + 1.6, 1.15, 2.5, .8, iron, true);
    addBox(`locker seam ${i}`, -28.2, 1.25, z + 1.18, .025, 2.3, .03, rust);
    addBox(`locker handle ${i}`, -27.9, 1.3, z + 1.14, .06, .18, .04, rust);

    // East-side laboratory: broken gurneys, wheeled carts and cable bundles.
    addBox(`lab gurney frame ${i}`, 13.7, .6, z - 2.4, 2.6, .12, .85, iron, true);
    addBox(`lab gurney mattress ${i}`, 13.7, .72, z - 2.4, 2.45, .16, .75, tornFabric, true);
    for (const x of [12.6,14.8]) for (const zz of [z-2.7,z-2.1]) {
      const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.07,10),black);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.2,zz);scene.add(wheel);
    }
    addBox(`lab rolling cart ${i}`, 20.6, .7, z - 2.6, 1.25, .12, .8, iron, true);
    for(let k=0;k<4;k++){
      const cable=new THREE.Mesh(new THREE.TorusGeometry(.17+k*.035,.025,5,16),rust);
      cable.rotation.x=Math.PI/2;cable.position.set(19.2+k*.16,.12,z+.6);scene.add(cable);
    }
    // Damaged ceiling lights: visible silhouettes, with lighting itself handled by rooms.js.
    addBox(`broken light housing west ${i}`, -17.5, 4.02, z, 1.25, .12, .38, iron);
    addBox(`broken light housing east ${i}`, 17.5, 4.02, z, 1.25, .12, .38, iron);
  }

  // A few wall-mounted pipes, warning signs and scattered file boxes in deep chambers.
  for (const side of [-1,1]) {
    for (const z of [5,-5,-15,-25]) {
      const panel=addBox(`sector warning panel ${side} ${z}`,side*29.2,2.1,z-3.35,.08,.72,1.35,iron);
      addBox(`panel warning stripe ${side} ${z}`,side*29.14,2.28,z-3.35,.035,.09,1.15,mat(side>0?0x7b211b:0x8c7b43));
      for(let n=0;n<3;n++) addBox(`evidence storage box ${side} ${z} ${n}`,side*(24.2+n*.45),.3,z+2.65,.38,.5,.4,mat(n%2?0x383a33:0x272a26),true);
    }
  }
}
