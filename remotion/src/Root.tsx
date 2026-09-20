import { Composition } from 'remotion';
import { LogoReveal } from './LogoReveal';
import { HeroVideo } from './HeroVideo';
import { OGVideo } from './OGVideo';
import { FeatureDemo } from './FeatureDemo';
import { CanalIntro } from './CanalIntro';
import { CanalOutro } from './CanalOutro';
import { CanalLowerThird } from './CanalLowerThird';
import { CanalThumbnail } from './CanalThumbnail';
import { TutorialVideo } from './TutorialVideo';

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

      {/* ── KIT DO CANAL OFICIAL FINGO ──────────────────────────────── */}
      <Composition
        id="CanalIntro"
        component={CanalIntro}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="CanalOutro"
        component={CanalOutro}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="CanalLowerThird"
        component={CanalLowerThird}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          nome: 'Eng. Marcos Silva',
          cargo: 'Especialista em Gestão de Obras & SINAPI',
          tema: 'FinGo — Obras em Fluxo',
        }}
      />
      <Composition
        id="CanalThumbnail"
        component={CanalThumbnail}
        durationInFrames={1}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          tituloLinha1: 'ORÇAMENTO SINAPI',
          tituloLinha2: 'BDI CAIXA EM 5 MIN',
          destaqueNeon: 'PASSO A PASSO',
          tagSuperior: 'ENGENHARIA DE CUSTOS & CAIXA',
          badgeTempo: '4 MIN',
          moduloNome: 'Orçamentos & SINAPI',
          iconeModulo: '📐',
        }}
      />
      <Composition
        id="TutorialVideo"
        component={TutorialVideo}
        durationInFrames={1530}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          numero: 1,
          titulo: 'Como Iniciar uma Obra, Cadastrar Clientes e Etapas',
          modulo: 'Obras & Clientes',
          nivel: 'Iniciante',
          duracao: '4 min',
          passos: [
            'Acesse o menu lateral e clique em Obras & Clientes.',
            'Clique no botão + Nova Obra no canto superior direito.',
            'Preencha Razão Social, CPF/CNPJ e Engenheiro Responsável.',
            'Defina as datas previstas de início/término e valor total.',
            'Clique em Salvar Obra para gerar o cronograma.',
          ],
          dica: 'Definir o número do contrato de financiamento (Caixa) agiliza a aprovação das medições.',
        }}
      />
    </>
  );
};


