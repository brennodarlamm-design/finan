// frontend/modules/index.js — Ponto de Entrada Unificado do Frontend Modular
export { Fiscal } from './fiscal.js';
export { Financeiro } from './financeiro.js';
export { Obras } from './obras.js';
export { Suprimentos } from './suprimentos.js';
export { Contratos } from './contratos.js';
export { Atendimento } from './atendimento.js';
export { Gestao } from './gestao.js';
export { Configuracoes } from './configuracoes.js';
export { Core } from './core.js';

import Fiscal from './fiscal.js';
import Financeiro from './financeiro.js';
import Obras from './obras.js';
import Suprimentos from './suprimentos.js';
import Contratos from './contratos.js';
import Atendimento from './atendimento.js';
import Gestao from './gestao.js';
import Configuracoes from './configuracoes.js';
import Core from './core.js';

export const FinGoModules = {
  Fiscal,
  Financeiro,
  Obras,
  Suprimentos,
  Contratos,
  Atendimento,
  Gestao,
  Configuracoes,
  Core
};

export default FinGoModules;
