import React from "react";
import { Composition } from "remotion";
import { VideoComposition } from "./VideoComposition";
import { SampleJourneyComposition, SAMPLE_JOURNEY_FRAMES } from "./SampleJourneyComposition";
import { TOTAL_FRAMES, FPS, WIDTH, HEIGHT } from "./constants";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="ProductTour"
        component={VideoComposition}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="SampleProductJourney"
        component={SampleJourneyComposition}
        durationInFrames={SAMPLE_JOURNEY_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
