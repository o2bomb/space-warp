# Recreating and refactoring weareninja.com's "space warp" effect
In 2021, I created this space warp effect in 3D using [react-three-fiber](https://github.com/pmndrs/react-three-fiber), a React-based renderer for three.js. The effect looked like this:

![space_warp_checkpoint8](https://user-images.githubusercontent.com/41817193/221518712-d3f59051-779c-4ccb-8750-a6ebececcf4f.gif)

The result looks cool and all, but there were a number of problems with my implementation of this effect:
- It was not performant on certain platforms, mobile devices espcecially. If I recall correctly, Google's Lighthouse reported a disappointing score of ~65% for performance. Not good.
- Some of the postprocessing effects (bloom, chromatic aberration) were poorly chained together, resulting in a noticeable pop-in when the space warp ended
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


## Post processing effects

It's time to add some flare to the space warp. We'll first have to install the `postprocessing` and `@react-three/postprocessing` npm packages. Then, we can add a `<EffectComposer />` to the scene in order to chain our post processing effects.

### Bloom

Let's start by adding bloom to the scene by adding a `<Bloom />` component within the `<EffectComposer />`. Note how we disable tone mapping on the material of the instanced mesh by passing `false` to the `toneMapped` prop. This allows us to specify an emissive colour value to the material, which is required for the bloom effect to work.

> An emissive colour value in three.js is a colour value that is greater than 1.

To make objects even brighter under the bloom effect, we can set the `mipmapBlur` prop to true on the `<Bloom />` component.


```diff
// Scene.tsx
+ import {
+   Bloom,
+   EffectComposer,
+ } from "@react-three/postprocessing";

export const Scene = ({}: SceneProps) => {
  ...
  return (
    <>
      <color args={["#000000"]} attach="background" />
      <instancedMesh
        ref={meshRef as any}
        args={[undefined, undefined, COUNT]}
        matrixAutoUpdate
      >
        <sphereGeometry args={[0.05]} />
-        <meshBasicMaterial color="white" />
+        <meshBasicMaterial color={[1.5, 1.5, 1.5]} toneMapped={false} />
      </instancedMesh>
+      <EffectComposer>
+        <Bloom luminanceThreshold={0.2} mipmapBlur />
+      </EffectComposer>
    </>
  );
};
```

### Chromatic aberration

Chromatic aberration is an effect that creates a visual distortion in the red, green and blue colour values.

![image](https://upload.wikimedia.org/wikipedia/commons/c/c5/Chromatic_aberration_%28comparison%29_-_enlargement.jpg)

Let's add this effect to the scene, when the stars are being warped in. We can use the `<ChromaticAberration />` component for this. We can specify the strength of this effect by setting the `offset` prop, which takes a `THREE.Vector2` object as a value.

```diff
// Scene.tsx
 import {
   Bloom,
+   ChromaticAberration,
   EffectComposer,
 } from "@react-three/postprocessing";
+ import { BlendFunction, ChromaticAberrationEffect } from "postprocessing";

+ const CHROMATIC_ABBERATION_OFFSET = 0.007;

export const Scene = ({}: SceneProps) => {
  ...
  return (
    <>
      <color args={["#000000"]} attach="background" />
      <instancedMesh
        ref={meshRef as any}
        args={[undefined, undefined, COUNT]}
        matrixAutoUpdate
      >
        <sphereGeometry args={[0.05]} />
        <meshBasicMaterial color={[1.5, 1.5, 1.5]} toneMapped={false} />
      </instancedMesh>
      <EffectComposer>
        <Bloom luminanceThreshold={0.2} mipmapBlur />
+        <ChromaticAberration
+          blendFunction={BlendFunction.NORMAL} // blend mode
+          offset={
+            new THREE.Vector2(
+              CHROMATIC_ABBERATION_OFFSET,
+              CHROMATIC_ABBERATION_OFFSET
+            )
+          }
+        />
      </EffectComposer>
    </>
  );
};
```

https://user-images.githubusercontent.com/41817193/221581926-dca7a2fc-5ff5-4a14-a7a5-bb2492de71f8.mp4

Great, now it looks really cool when stars are warping in. But we should probably tone down the effect as the stars start to slow down. The best way to do this is by modifying the offset value directly in the `useFrame()` hook.

First, we use React's `useRef()` hook to point to our `<ChromaticAberration />` effect.

```diff
// Scene.tsx
...
export const Scene = ({}: SceneProps) => {
+  const effectsRef = useRef<ChromaticAberrationEffect>();
...
  return (
    <>
      <color args={["#000000"]} attach="background" />
      <instancedMesh
        ref={meshRef as any}
        args={[undefined, undefined, COUNT]}
        matrixAutoUpdate
      >
        <sphereGeometry args={[0.05]} />
        <meshBasicMaterial color={[1.5, 1.5, 1.5]} toneMapped={false} />
      </instancedMesh>
      <EffectComposer>
        <Bloom luminanceThreshold={0.2} mipmapBlur />
        <ChromaticAberration
+          ref={effectsRef as any}
          blendFunction={BlendFunction.NORMAL} // blend mode
          offset={
            new THREE.Vector2(
              CHROMATIC_ABBERATION_OFFSET,
              CHROMATIC_ABBERATION_OFFSET
            )
          }
        />
      </EffectComposer>
    </>
  );
```

Then, we can modify the `offset` value, which is a Vector2 type.
> This value is called a uniform value, which can be used as a parameter to tweak the behaviour of the underlying shader. Learn more about it [here](#how-to-access-effect-uniforms).

```diff
// Scene.tsx
  ...
  useFrame((state, delta) => {
    ...
+    // update post processing uniforms
+    if (!effectsRef.current) return;
+    effectsRef.current.offset.x = Math.max(0, Math.pow(0.5, state.clock.elapsedTime) * CHROMATIC_ABBERATION_OFFSET);
+    effectsRef.current.offset.y = Math.max(0, Math.pow(0.5, state.clock.elapsedTime) * CHROMATIC_ABBERATION_OFFSET);
  });

  ...
```

And now, the chromatic aberration effect will slowly fade out as the stars slow down. Perfect.

https://user-images.githubusercontent.com/41817193/221586278-32b4c2bd-a754-4dc1-933a-dca341932c0d.mp4


### How to access effect uniforms

In the previous section, we directly modified the `offset` uniform value in the chromatic aberration effect in order to make it disappear as the stars slowed down.

Underneath the hood, the chromatic aberration effect is actually composed of a [fragment shader](https://thebookofshaders.com/01/) and [vertex shader](https://www.khronos.org/opengl/wiki/Vertex_Shader). Shaders are lightweight programs that are run on the system's GPU. They determine how pixels are displayed on our computer screens.

Uniform values are commonly used in shaders to tweak the shader's behaviour. It is not uncommon to modify uniform values during the runtime of the program in order to change the look of the scene/objects.

Let's log the ref that is pointing to the `<ChromaticAberration />` component to the browser console.

![image](https://user-images.githubusercontent.com/41817193/221589747-35d6abcb-465c-4866-9e34-78aeceee6f75.png)

There are a couple of ways to find out what uniforms exist in this effect. 

The first way is inspecting the `uniforms` property. By expanding this field in our browser devtools, we can tell that `offset` and `modulationOffset` exist as uniforms. If we expand the `offset` property, we can see that it contains an x and y value, indicating that it is of type Vector2

![image](https://user-images.githubusercontent.com/41817193/221591037-84619daf-281b-446d-b002-f97d71d52c32.png)

Another way is by inspecting the fragment shader and vertex shader code.

![image](https://user-images.githubusercontent.com/41817193/221592909-d07eee0c-9fb6-4bdd-9ce7-fe657e524ec3.png)

Here is the fragment shader code, formatted. We can quickly tell from the `uniform float modulationOffset;` statement that `modulationOffset` is a uniform that we can modify.

```glsl
#ifdef RADIAL_MODULATION
uniform float modulationOffset; // <--- This is the important part
#endif
varying float vActive;
varying vec2 vUvR;
varying vec2 vUvB;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 ra = inputColor.ra;
  vec2 ba = inputColor.ba;
  #ifdef RADIAL_MODULATION
  const vec2 center = vec2(0.5);
  float d = distance(uv, center) * 2.0;
  d = max(d - modulationOffset, 0.0);
  if (vActive > 0.0 && d > 0.0) {
    ra = texture2D(inputBuffer, mix(uv, vUvR, d)).ra;
    ba = texture2D(inputBuffer, mix(uv, vUvB, d)).ba;
  }
  #else
  if(vActive > 0.0) {
    ra = texture2D(inputBuffer, vUvR).ra;
    ba = texture2D(inputBuffer, vUvB).ba;
  }
  #endif
  outputColor = vec4(ra.x, inputColor.g, ba.x, max(max(ra.y, ba.y), inputColor.a));
}
```

And with the vertex shader, we can tell that `offset` is also a uniform that we can modify.

```glsl
uniform vec2 offset; // <-- This is the important part
varying float vActive;
varying vec2 vUvR;
varying vec2 vUvB;
void mainSupport(const in vec2 uv) {
  vec2 shift = offset * vec2(1.0, aspect);
  vActive = (shift.x != 0.0 || shift.y != 0.0) ? 1.0 : 0.0;
  vUvR = uv + shift;
  vUvB = uv - shift;
}
```

Now let's inspect the logged object again. Notice how we can actually access and modify these uniform values directly, via the prototype fields. Very useful.

![image](https://user-images.githubusercontent.com/41817193/221594799-05e7cbbb-b166-4ce8-9701-4114c060c3e9.png)


