import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Object3D, Vector3 } from "three";

export interface SceneProps {}

const COUNT = 500;

export const Scene = ({}: SceneProps) => {
  const ref = useRef<THREE.InstancedMesh>();

  const positions = useMemo(() => {
    const p = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT * 3; i += 3) {
      p[i] = generatePos();
      p[i + 1] = generatePos();
      p[i + 2] = (Math.random() - 0.5) * 10;
    }

    return p;
  }, []);

  useEffect(() => {
    if (!ref.current) return;

    const t = new Object3D();
    let j = 0;
    for (let i = 0; i < COUNT * 3; i += 3) {
      t.position.x = positions[i];
      t.position.y = positions[i + 1];
      t.position.z = positions[i + 2];
      t.updateMatrix();
      ref.current.setMatrixAt(j++, t.matrix);
    }
  }, []);

  const temp = new THREE.Matrix4();
  const tempPos = new Vector3();
  useFrame((state, delta) => {
    if (!ref.current) return;

    for (let i = 0; i < COUNT; i++) {
      ref.current.getMatrixAt(i, temp);

      tempPos.setFromMatrixPosition(temp);
      if (tempPos.z < -5) {
        tempPos.z = 0;
      } else {
        tempPos.z -= delta;
      }
      temp.setPosition(tempPos);

      ref.current.setMatrixAt(i, temp);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref as any}
      args={[undefined, undefined, COUNT]}
      matrixAutoUpdate
    >
      {/* <sphereGeometry args={[0.1]} /> */}
      <boxGeometry args={[0.1, 0.1, 0.1]} />
      <meshNormalMaterial />
    </instancedMesh>
  );
};

function generatePos() {
  return (Math.random() - 0.5) * 10;
}
