import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Scene } from "./Scene";

function App() {
  return (
    <Canvas
      camera={{
        fov: 100,
        near: 0.1,
        far: 200,
      }}
    >
      <OrbitControls />
      <Scene />
    </Canvas>
  );
}

export default App;
