import { Composition } from 'remotion';
import { LogoReveal } from './LogoReveal';
import { HeroVideo } from './HeroVideo';
import { OGVideo } from './OGVideo';
import { FeatureDemo } from './FeatureDemo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LogoReveal"
        component={LogoReveal}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1080}
      />
      <Composition
        id="HeroVideo"
        component={HeroVideo}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="OGVideo"
        component={OGVideo}
        durationInFrames={180}
        fps={30}
        width={1200}
        height={630}
      />
      <Composition
        id="FeatureDemo"
        component={FeatureDemo}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
