/**
 * This file contains part of my implementation of the space warp effect. It exists in this codebase for historical purposes only.
 */

import { useFrame } from "@react-three/fiber";
import React, { useMemo, useRef } from "react";
import { Color, Object3D } from "three";
import { getRandomNumber } from "../../utils/getRandomNumber";
import { isIos } from "../../utils/isIos";
import { normaliseToRange } from "../../utils/normaliseToRange";
import { CustomDeviceOrientationControls } from "./CustomDeviceOrientationControls";
import { CustomFlyControls } from "./CustomFlyControls";

export interface StarsProps {
  count?: number; // number of stars
  velocity?: number; // initial velocity of stars. cannot be less than 3
  xBounds?: number;
  yBounds?: number;
  zBounds?: number;
  size?: number; // size of each star
}

interface StarAnimationProps {
  shouldAnimate: boolean;
  setShouldAnimate: React.Dispatch<React.SetStateAction<boolean>>;
  showBloom: boolean;
  setShowBloom: React.Dispatch<React.SetStateAction<boolean>>;
}

export const Stars2: React.FC<StarsProps & StarAnimationProps> = ({
  count = window ? (window.innerWidth * window.innerHeight) / 2050 : 1000,
  xBounds = window ? window.innerWidth / 3.84 : 500,
  yBounds = window ? window.innerHeight / 4.32 : 250,
  zBounds = 1600,
  size = 0.6,
  shouldAnimate,
  setShouldAnimate,
  showBloom,
  setShowBloom,
}) => {
  const isMobileWithAccelerometerAndAlsoNotSafari =
    window.DeviceOrientationEvent && "ontouchstart" in window && !isIos();
  const meshRef = useRef<any>();
  const [coords] = useMemo(() => {
    const initialCoords = [];
    for (let i = 0; i < count; i += 1) {
      initialCoords.push(getRandomNumber(-xBounds, xBounds));
      initialCoords.push(getRandomNumber(-yBounds, yBounds));
      initialCoords.push(getRandomNumber(0, zBounds));
    }

    const coords = new Float32Array(initialCoords);
    return [coords];
  }, [count, xBounds, yBounds, zBounds]);

  // useLayoutEffect(() => {
  // 	console.log(geomRef.current)
  // }, [])

  const geomRef = useRef<any>();
  const tempObject = useMemo(() => new Object3D(), []);
  const tempColour = useMemo(() => new Color(1, 1, 1), []);
  const velocityToAnimateThreshold = 0.1;
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (!meshRef.current || !geomRef.current) return;
    const velocity = shouldAnimate
      ? (Math.cos(time) + 1) * 8.0
      : velocityToAnimateThreshold;
    if (velocity < 3 && !showBloom) {
      setShowBloom(true);
    }
    if (velocity <= velocityToAnimateThreshold && shouldAnimate) {
      setShouldAnimate(false);
    }
    for (let i = 0; i < count; i++) {
      const x = i * 3;
      const y = i * 3 + 1;
      const z = i * 3 + 2;
      const positions = geomRef.current.attributes.position2.array as number[];
      if (shouldAnimate) {
        tempObject.scale.set(1, 1, (Math.cos(time) + 1) * 40);
      }
      tempObject.position.set(coords[x], coords[y], coords[z]);

      positions[z] = tempObject.position.z = velocity + positions[z];
      if (tempObject.position.z > zBounds) {
        positions[z] = tempObject.position.z = 0;
      }
      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObject.matrix);
      tempColour.r =
        tempColour.g =
        tempColour.b =
          normaliseToRange(positions[z], 0, zBounds);
      meshRef.current.setColorAt(i, tempColour);
    }
    geomRef.current.attributes.position2.needsUpdate = true;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor)
      meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <>
      {isMobileWithAccelerometerAndAlsoNotSafari && !shouldAnimate ? (
        <CustomDeviceOrientationControls />
      ) : (
        <CustomFlyControls
          movementSpeed={0}
          rollSpeed={shouldAnimate ? 0 : 0.1}
        />
      )}
      <instancedMesh ref={meshRef} args={[null as any, null as any, count]}>
        <sphereBufferGeometry
          args={[size, 6, 4]}
          ref={geomRef}
          attach="geometry"
        >
          <instancedBufferAttribute
            attachObject={["attributes", "position2"]}
            count={coords.length / 3}
            array={coords}
            itemSize={3}
          />
        </sphereBufferGeometry>
        <meshBasicMaterial attach="material" />
      </instancedMesh>
    </>
  );
};
