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
      p[i + 2] = (Math.random() - 0.5) * 20;
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
  const tempScale = new Vector3();
  const tempObject = new Object3D();
  useFrame((state, delta) => {
    if (!ref.current) return;

    for (let i = 0; i < COUNT; i++) {
      ref.current.getMatrixAt(i, temp);

      // update scale
      tempObject.scale.set(
        1,
        1,
        clamp(1, Math.pow(0.5, state.clock.elapsedTime) * 10, 10)
      );

      // update position
      tempPos.setFromMatrixPosition(temp);
      if (tempPos.z < -10) {
        tempPos.z = 10;
      } else {
        tempPos.z -= clamp(
          delta,
          Math.pow(0.5, state.clock.elapsedTime),
          delta * 20
        );
      }
      tempObject.position.set(tempPos.x, tempPos.y, tempPos.z);

      tempObject.updateMatrix();
      ref.current.setMatrixAt(i, tempObject.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref as any}
      args={[undefined, undefined, COUNT]}
      matrixAutoUpdate
    >
      <sphereGeometry args={[0.05]} />
      <meshNormalMaterial />
    </instancedMesh>
  );
};

function generatePos() {
  return (Math.random() - 0.5) * 20;
}

function clamp(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
