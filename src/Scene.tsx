import { useEffect, useRef } from "react";
import * as THREE from "three";

export interface SceneProps {}

const COUNT = 100;

export const Scene = ({}: SceneProps) => {
  const ref = useRef<THREE.InstancedMesh>();
  useEffect(() => {
    if (!ref.current) return;

    // Set positions
    const temp = new THREE.Object3D();
    for (let i = 0; i < COUNT; i++) {
      temp.position.set(generatePos(), generatePos(), 0);
      temp.updateMatrix();
      ref.current.setMatrixAt(i, temp.matrix);
    }
    // Update the instance
    ref.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref as any} args={[undefined, undefined, COUNT]}>
      <boxGeometry args={[0.2, 0.2, 0.2]} />
      <meshNormalMaterial />
    </instancedMesh>
  );
};

function generatePos() {
  return (Math.random() - 0.5) * 10;
}
