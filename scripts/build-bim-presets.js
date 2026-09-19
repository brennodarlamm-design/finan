import fs from 'fs';

const struct = fs.readFileSync('tests/fixtures/bim-real/ifc4-building-structural.ifc', 'utf8');
const hvac = fs.readFileSync('tests/fixtures/bim-real/ifc4-building-hvac.ifc', 'utf8');
const arch = fs.readFileSync('tests/fixtures/bim-real/ifc4-building-architecture.ifc', 'utf8');
const openWin = fs.readFileSync('tests/fixtures/bim-real/ifc4-wall-opening-window.ifc', 'utf8');

const catalog = {
  ifc4_structural: {
    id: 'ifc4_structural',
    name: 'Estrutura de Concreto Armado (IFC4)',
    format: 'ifc',
    description: '13 elementos estruturais: sapatas, pilares de concreto armado, vigas mestras e lajes.',
    content: struct
  },
  ifc4_hvac: {
    id: 'ifc4_hvac',
    name: 'Instalações MEP & HVAC Climatização (IFC4)',
    format: 'ifc',
    description: 'Rede de dutos de ventilação, curvas e equipamentos de climatização predial.',
    content: hvac
  },
  ifc4_architecture: {
    id: 'ifc4_architecture',
    name: 'Arquitetura Residencial buildingSMART (IFC4)',
    format: 'ifc',
    description: 'Paredes, laje, cobertura, porta e janelas em padrão IFC4.',
    content: arch
  },
  ifc4_opening_window: {
    id: 'ifc4_opening_window',
    name: 'Parede com Abertura e Esquadria Booleana (IFC4)',
    format: 'ifc',
    description: 'Parede com recorte booleano exato de abertura e janela.',
    content: openWin
  }
};

const fileContent = `/**
 * FinGo BIM Presets Catalog
 * Catálogo oficial de modelos BIM e fixtures buildingSMART para testes e demonstrações.
 */
const BIMPresets = ${JSON.stringify(catalog)};

if (typeof window !== 'undefined') window.BIMPresets = BIMPresets;
`;

fs.writeFileSync('js/bim_presets.js', fileContent, 'utf8');
console.log('js/bim_presets.js gerado com sucesso! Tamanho:', Math.round(fileContent.length / 1024), 'KB');
