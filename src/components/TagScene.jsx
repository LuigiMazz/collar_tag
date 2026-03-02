
import { useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

function TagMeshObject({ mesh }) {
  const groupRef = useRef();

  useEffect(() => {
    if (!groupRef.current || !mesh) return;
    while (groupRef.current.children.length) {
      groupRef.current.remove(groupRef.current.children[0]);
    }
    groupRef.current.add(mesh);
    return () => {
      if (groupRef.current) groupRef.current.remove(mesh);
    };
  }, [mesh]);

  return <group ref={groupRef} />;
}

// ---------------------------------------------------------------------------
// Luci
// ---------------------------------------------------------------------------
function Lights() {
  return (
    <>
      {/* Ambient soffusa — volutamente bassa per massimizzare il contrasto incisioni */}
      <ambientLight intensity={0.25} />

      {/* Luce principale: laterale dall'alto-sinistra → crea ombre nelle cavità */}
      <directionalLight
        position={[-30, 25, 20]}
        intensity={2.0}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />

      {/* Fill light opposta, debole → evita zone completamente nere */}
      <directionalLight position={[30, -15, -20]} intensity={0.5} />

      {/* Point light frontale — riflesso metallico caldo sulla superficie */}
      <pointLight position={[0, 5, 40]} intensity={1.2} color="#ffe8b0" decay={2} />

      {/* Rim light dal basso-retro — separa il bordo dal fondo */}
      <pointLight position={[0, -20, -30]} intensity={0.4} color="#a0c0ff" decay={2} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Canvas principale
// ---------------------------------------------------------------------------
/**
 * @param {object}     props
 * @param {THREE.Mesh} props.mesh        - mesh della medaglietta
 * @param {boolean}    props.autoRotate  - rotazione automatica
 */
export default function TagScene({ mesh, autoRotate = false }) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 0, 55], fov: 42, near: 0.1, far: 500 }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <Lights />

      {/* Ombra proiettata sotto la medaglietta */}
      <ContactShadows
        position={[0, -18, 0]}
        opacity={0.4}
        scale={50}
        blur={2}
        far={20}
      />

      {mesh && <TagMeshObject mesh={mesh} />}

      <OrbitControls
        enableDamping
        dampingFactor={0.07}
        autoRotate={autoRotate}
        autoRotateSpeed={1.0}
        minDistance={22}
        maxDistance={110}
        makeDefault
      />
    </Canvas>
  );
}
