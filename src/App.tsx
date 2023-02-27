import { Canvas } from "@react-three/fiber";
import { Perf } from "r3f-perf";
import { Scene } from "./Scene";

function App() {
  return (
    <Canvas
      camera={{
        fov: 100,
        near: 0.1,
        far: 200,
        // position: [15, 5, 5],
      }}
    >
      <Perf />
      <Scene />
    </Canvas>
  );
}

export default App;
