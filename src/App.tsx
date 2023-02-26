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
