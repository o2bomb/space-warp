/**
 * This file contains part of my implementation of the space warp effect. It exists in this codebase for historical purposes only.
 */

import { Box } from "@mui/material";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { KernelSize, Resolution } from "postprocessing";
import React, { useState } from "react";
import { colors } from "../../constants/theme";
import { ColourShiftEffect } from "./ColourShiftEffect";
import { Stars2, StarsProps } from "./Stars";

interface BackdropProps extends StarsProps {
  style?: React.CSSProperties;
}

const Backdrop: React.FC<BackdropProps> = ({
  style,
  children,
  velocity,
  ...starProps
}) => {
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const [showBloom, setShowBloom] = useState(false);

  return !!window.WebGLRenderingContext &&
    !!window.document
      .createElement("canvas")
      .getContext("experimental-webgl") ? (
    <Canvas
      style={{
        position: "fixed",
        height: "100vh",
        width: "100vw",
        backgroundColor: colors.darkNavy,
        ...style,
      }}
      camera={{
        position: [0, 0, 800],
        far: 5000,
      }}
      mode="concurrent"
    >
      <Stars2
        {...starProps}
        shouldAnimate={shouldAnimate}
        setShouldAnimate={setShouldAnimate}
        showBloom={showBloom}
        setShowBloom={setShowBloom}
      />
      <EffectComposer>
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
        <Bloom
          intensity={0.2} // bloom intensity
          width={Resolution.AUTO_SIZE} // render width
          height={Resolution.AUTO_SIZE} // render height
          kernelSize={KernelSize.LARGE} // blur kernel size
          luminanceThreshold={0.01} // luminance threshold
          luminanceSmoothing={0.025} // smoothness of the luminance threshold. Range is [0, 1]
        />
      </EffectComposer>
      {!showBloom && <ColourShiftEffect />}
    </Canvas>
  ) : (
    <Box
      sx={{
        position: "fixed",
        width: "100%",
        height: "100%",
        top: 0,
        left: 0,
        background: "center/cover no-repeat url(/images/stars.webp)",
      }}
    />
  );
};

export default Backdrop;
