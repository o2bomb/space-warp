# Recreating and refactoring weareninja.com's "space warp" effect
In 2021, I created this space warp effect in 3D using [react-three-fiber](https://github.com/pmndrs/react-three-fiber), a React-based renderer for three.js. The effect looked like this:

![space_warp_checkpoint8](https://user-images.githubusercontent.com/41817193/221518712-d3f59051-779c-4ccb-8750-a6ebececcf4f.gif)

The result looks cool and all, but there were a number of problems with my implementation of this effect:
- It was not performant on certain platforms, mobile devices espcecially. If I recall correctly, Google's Lighthouse reported a disappointing score of ~65% for performance. Not good.
- Some of the postprocessing effects (bloom, chromatic abberation) were poorly chained together, resulting in a noticeable pop-in when the space warp ended
- It uses React's setState() in the animation loop, which is a big no-no

Overall, my implementation was poor. A partial snippet of my old implementation of this effect can be found here: https://github.com/o2bomb/reworked-stars/commit/3ae2021c503b1429c266b8a3bd5d9263f6aa8aa5

My goal in this project is to recreate the "space warp" effect, fix my previous errors and improve both performance and code-readability in my implementation. I will also outline all of the main steps in creating this effect, with diagrams that illustrate these steps. Some basic knowledge of high-scool level mathematics is not required but recommended.

## Initialising the scene
Constructing a basic scene in r3f is simple enough. We can use a `<Canvas />` element to initialise the canvas and construct the scene. Then, we can put whatever we want in the `<Canvas />` to render 3D objects in the scene.

```tsx
// App.tsx
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Scene } from "./Scene";

function App() {
  return (
    <Canvas
      camera={{
        fov: 45,
        near: 0.1,
        far: 200,
        position: [-4, 3, 6],
      }}
    >
      <OrbitControls />
      <Scene />
    </Canvas>
  );
}

export default App;
```

Then we want to create a bunch of boxes randomly scattered on the x and y axis within this scene, as a starting point for the space warp effect. There are several ways of doing this in three.js:
- Creating a mesh for each object, and rendering them all ⇒ Not performant, a draw call occurs for each and every object ❌
- Initialising a buffer geometry, and assigning it a [PointsMaterial](https://threejs.org/docs/#api/en/materials/PointsMaterial), making each vertex of the geometry a particle ⇒ Very performant, but we cannot apply scale transformations on each particle. This is because each particle is essentially a 2D sprite ❌
- Using a single [InstancedMesh](https://threejs.org/docs/#api/en/objects/InstancedMesh) works best, since we can render a large number of objects using one draw call. It also supports positional, rotational and scaling transformations on each object ✅

> Being able to transform each object individually is important for the warp effect, explained later on.

```tsx
// Scene.tsx
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
```

After doing all this, we get something like this showing up on the screen. These colourful looking boxes will become spherical stars very soon.

![image](https://user-images.githubusercontent.com/41817193/221528743-a360e7ba-fdee-47c2-a524-348730cad606.png)

## Animating each object

In order to animate our instanced objects, we need to modify their positions individually, which is stored within the instanced mesh's matrix data. First, lets change how each object's position is initialised.

```diff
// Scene.tsx
export const Scene = ({}: SceneProps) => {
...
-  useEffect(() => {
-    if (!ref.current) return;
-  
-    // Set positions
-    const temp = new THREE.Object3D();
-    for (let i = 0; i < COUNT; i++) {
-      temp.position.set(generatePos(), generatePos(), 0);
-      temp.updateMatrix();
-      ref.current.setMatrixAt(i, temp.matrix);
-    }
-    
-    // Update the instance
-    ref.current.instanceMatrix.needsUpdate = true;
-  }, []);

+  useEffect(() => {
+    if (!ref.current) return;
+
+    const t = new Object3D();
+    let j = 0;
+    for (let i = 0; i < COUNT * 3; i += 3) {
+      t.position.x = generatePos();
+      t.position.y = generatePos();
+      t.position.z = (Math.random() - 0.5) * 10;
+      t.updateMatrix();
+      ref.current.setMatrixAt(j++, t.matrix);
+    }
+  }, []);
...
```

The objects are now ready to be animated using r3f's [useFrame()](https://docs.pmnd.rs/react-three-fiber/api/hooks#useframe) hook. It is important to use either the current elapsed time or delta value to animate objects, in order to decouple the animation from the framerate.

```tsx
// Scene.tsx
export const Scene = ({}: SceneProps) => {
...
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
...
```

Now we get this:

https://user-images.githubusercontent.com/41817193/221534451-b7ccd3a5-60f1-4cae-8e39-395cd53e14d4.mp4

## Deccelerating objects

Before we continue, lets change our boxes to spheres and increase the z-plane bounds to better represent a field of stars.

```diff
// Scene.tsx
export const Scene = ({}: SceneProps) => {
...
  const temp = new THREE.Matrix4();
  const tempPos = new Vector3();
  useFrame((state, delta) => {
    if (!ref.current) return;

    for (let i = 0; i < COUNT; i++) {
      ref.current.getMatrixAt(i, temp);

      tempPos.setFromMatrixPosition(temp);
-      if (tempPos.z < -5) {
+      if (tempPos.z < -10) {
-        tempPos.z = 0;
+        tempPos.z = 10;
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
-      <boxGeometry args={[0.1, 0.1, 0.1]} />
+      <sphereGeometry args={[0.05]} />
      <meshNormalMaterial />
    </instancedMesh>
  );
}
```

The space warp animation can be broken down into 2 distinct phases:
1. The stars move at maximum warp speed, resulting in them being stretched out due to time dilation and other physics-based phenomena
2. Then, they slow down and return to their original spherical shape

When an object "slows down", we call this deceleration. We can mimic this deceleration mathematically by using a decreasing exponential function, otherwise known as exponential decay.

![image](https://user-images.githubusercontent.com/41817193/221538227-ec2720b9-6090-4cd6-9bd2-1f02b280bc69.png)

The graph above is defined by the function:

```math
 f(x) = (0.5)^x
```

As $\ x$ grows bigger, the output tends towards 0. When $\ x$ decreases, the output tends to infinity. This function works great for animating the velocity of the stars.

```tsx
// Scene.tsx
  const temp = new THREE.Matrix4();
  const tempPos = new Vector3();
  useFrame((state, delta) => {
    if (!ref.current) return;

    for (let i = 0; i < COUNT; i++) {
      ref.current.getMatrixAt(i, temp);

      tempPos.setFromMatrixPosition(temp);
      if (tempPos.z < -10) {
        tempPos.z = 10;
      } else {
        tempPos.z -= Math.max(delta, Math.pow(0.5, state.clock.elapsedTime));
      }
      temp.setPosition(tempPos);

      ref.current.setMatrixAt(i, temp);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
```

An important thing to consider when using exponential decay is that the output will never be 0, even if x is infinitesimally small. So we wrap the function call in a `Math.max()` in order to define a minimum value above 0.

And here is the result. Note how the stars decelerate to a minimum velocity, and stays at that velocity.

https://user-images.githubusercontent.com/41817193/221540975-0cb008e5-5a08-4af4-bfcb-3e451b257402.mp4

## Warping the stars

Lets warp the stars. This can be achieved easily by animated each object's scale on the z-axis. We want the stars to be incredibly stretched out when it is at peak velocity, and return back to normal once they slow down to the minimum velocity. We can reuse the function for exponential decay to animate this effect.

```diff
// Scene.tsx
  const temp = new THREE.Matrix4();
  const tempPos = new Vector3();
+  const tempScale = new Vector3();
+  const tempObject = new Object3D();
  useFrame((state, delta) => {
    if (!ref.current) return;

    for (let i = 0; i < COUNT; i++) {
      ref.current.getMatrixAt(i, temp);

+      // update scale
+      tempObject.scale.set(
+        1,
+        1,
+        Math.max(1, Math.pow(0.5, state.clock.elapsedTime) * 10)
+      );

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
-      temp.setPosition(tempPos);
+      tempObject.position.set(tempPos.x, tempPos.y, tempPos.z);

+      tempObject.updateMatrix();
-      ref.current.setMatrixAt(i, temp);
+      ref.current.setMatrixAt(i, tempObject.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
```

By stretching the stars out to a comical degree, we can create the illusion that they are travelling incredibly fast.

https://user-images.githubusercontent.com/41817193/221559835-b7a56574-12fd-41a6-b92b-f5405b65a6c0.mp4


## Fading stars out

Right now our stars are popping out of view when it reaches the end of the z bound. This can be fixed by "fading" each star out as they travel further away from the camera. I can think of 2 ways of achieving this effect:
- By enabling [Fog](https://threejs.org/docs/#api/en/scenes/Fog) on a three.js scene
- By altering the colour of the stars as they move away from the camera, from white to black

I chose the second method to achieve this effect.

First, lets replace the `<meshNormalMaterial />` with a `<meshBasicMaterial />` and initialise its colour to white.

```diff
// Scene.tsx
  return (
    <instancedMesh
      ref={ref as any}
      args={[undefined, undefined, COUNT]}
      matrixAutoUpdate
    >
-      <meshNormalMaterial />
+      <sphereGeometry args={[0.05]} />
      <meshBasicMaterial color="white" />
    </instancedMesh>
  );
```

Then, we can modify each star's RGB values based on their z position. As their z position approaches the end of the z bound, we reduce the RGB values to 0.

```diff
// Scene.tsx
+  const tempColor = new THREE.Color();
  useFrame((state, delta) => {
      ...
+      // update and apply color
+      if (tempPos.z > 0) {
+        tempColor.r = tempColor.g = tempColor.b = 1;
+      } else {
+        tempColor.r = tempColor.g = tempColor.b = 1 - tempPos.z / -10;
+      }
+      ref.current.setColorAt(i, tempColor);
    }
    ref.current.instanceMatrix.needsUpdate = true;
+    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  });
```

Now the stars fade to black as they move away from the camera.

https://user-images.githubusercontent.com/41817193/221557346-226bc1f6-1be8-45af-a73d-83cf1203c9a1.mp4

Sideview:

https://user-images.githubusercontent.com/41817193/221557393-0636273b-859e-4dbf-90f5-57a6a159c975.mp4


# Postprocessing
