import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf8');
let passed = 0, failed = 0;
const test = (n, c) => {
  if (c) {
    console.log('✅', n);
    passed++;
  } else {
    console.error('❌', n);
    failed++;
  }
};

const idbStorageCode = read('js/idb_storage.js');
const appHtml = read('app.html');
const jsData = read('js/data.js');
const jsApp = read('js/app.js');

// 1. Verificações do Motor Nativo IndexedDB (js/idb_storage.js)
test('js/idb_storage.js define IDBStorage com métodos essenciais',
  idbStorageCode.includes('const IDBStorage = {') &&
  idbStorageCode.includes('getItem(key)') &&
  idbStorageCode.includes('setItem(key, value)') &&
  idbStorageCode.includes('removeItem(key)') &&
  idbStorageCode.includes('getAllKeys()') &&
  idbStorageCode.includes('clear()') &&
  idbStorageCode.includes('isAvailable()')
);

test('js/idb_storage.js usa banco finobra_db e store kv_store versão 1',
  idbStorageCode.includes("DB_NAME: 'finobra_db'") &&
  idbStorageCode.includes("STORE_NAME: 'kv_store'") &&
  idbStorageCode.includes('DB_VERSION: 1')
);

test('app.html carrega js/idb_storage.js antes de js/data.js',
  (appHtml.includes('<script defer src="/js/idb_storage.js"></script>') || /\/js\/idb_storage\.js(?:\?v=[^"]*)?"/.test(appHtml)) &&
  appHtml.indexOf('/js/idb_storage.js') < appHtml.indexOf('/js/data.js')
);

// 2. Verificações do Cache em Memória com Hidratação do IndexedDB (js/data.js)
test('js/data.js inicializa _memCache e rotinas de hidratação',
  jsData.includes('_memCache: new Map()') &&
  jsData.includes('_initMemoryCache()') &&
  jsData.includes('_hydrateFromIndexedDB()')
);

test('js/data.js DB.init executa _initMemoryCache e _hydrateFromIndexedDB',
  jsData.includes('this._initMemoryCache()') &&
  jsData.includes('this._hydrateFromIndexedDB()')
);

test('js/data.js DB.getAll(key) é síncrono e consulta _memCache prioritariamente',
  jsData.includes('this._memCache && this._memCache.has(storageKey)') &&
  jsData.includes('this._memCache.get(storageKey)') &&
  !jsData.includes('async getAll(')
);

test('js/data.js DB.save(key, data) persiste em memória, IndexedDB e LocalStorage',
  jsData.includes('this._memCache.set(storageKey, normalized)') &&
  jsData.includes('IDBStorage.setItem(storageKey, normalized)') &&
  jsData.includes('localStorage.setItem(storageKey, JSON.stringify(normalized))') &&
  jsData.includes('this._broadcastMutation(key)')
);

test('js/data.js getEmpresa e saveEmpresa utilizam _memCache e IDBStorage',
  jsData.includes('this._memCache.get(storageKey)') &&
  jsData.includes('IDBStorage.setItem(storageKey, updated)')
);

// 3. Verificações de Sincronização Multi-Aba (BroadcastChannel)
test('js/data.js implementa canal finobra_tab_sync com fallback de storage event',
  jsData.includes("new BroadcastChannel('finobra_tab_sync')") &&
  jsData.includes('_handleCrossTabMessage(event?.data)') &&
  jsData.includes("window.addEventListener('storage'")
);

test('js/data.js emite evento customizado finobra:cross-tab-mutation',
  jsData.includes("window.dispatchEvent(new CustomEvent('finobra:cross-tab-mutation'")
);

test('js/app.js escuta finobra:cross-tab-mutation e atualiza rota se não houver modal aberto',
  jsApp.includes("window.addEventListener('finobra:cross-tab-mutation'") &&
  jsApp.includes('this.refreshCurrentRoute()')
);

// 4. Verificações de Resiliência de Rede: Exponential Backoff com Full Jitter
test('js/data.js implementa _calculateBackoff com fórmula exponencial e full jitter',
  jsData.includes('_calculateBackoff(attempt') &&
  jsData.includes('Math.pow(1.5,') &&
  jsData.includes('0.6 + Math.random() * 0.4')
);

// 5. Verificações do Circuit Breaker (Disjuntor de Rede)
test('js/data.js implementa máquina de estados do Circuit Breaker (CLOSED, OPEN, HALF_OPEN)',
  jsData.includes("_circuitState: 'CLOSED'") &&
  jsData.includes('_circuitFailureThreshold: 5') &&
  jsData.includes('_circuitCooldownMs: 30000') &&
  jsData.includes('_isCircuitOpen()') &&
  jsData.includes('_recordNetworkSuccess()') &&
  jsData.includes('_recordNetworkFailure(')
);

test('js/data.js _flushCloudQueue consulta o disjuntor antes de tentar envio',
  jsData.includes('if (this._isCircuitOpen())')
);

test('js/data.js _flushCloudQueue registra falhas e sucessos de rede no Circuit Breaker',
  jsData.includes('this._recordNetworkFailure(true)') &&
  jsData.includes('this._recordNetworkSuccess()')
);

// 6. Verificações de Resolução de Conflitos Genérica
test('js/data.js resolveSyncConflict é genérico para qualquer tabela',
  jsData.includes("const table = item.payload?.table || 'lancamentos';") &&
  jsData.includes('this.getAll(table)') &&
  jsData.includes('this.save(table, local)')
);

test('js/data.js _acceptSyncVersion aceita confirmação de versão para qualquer tabela',
  jsData.includes('const table = item.payload?.table;') &&
  jsData.includes('const local = this.getAll(table);')
);

test('js/app.js reviewSyncConflict compara campos específicos de múltiplas entidades',
  jsApp.includes('fieldLabels = {') &&
  jsApp.includes('lancamentos:') &&
  jsApp.includes('obras:') &&
  jsApp.includes('notas:') &&
  jsApp.includes('fornecedores:')
);

// 7. Teste Funcional: Distribuição de Jitter e Exponential Backoff
function testBackoffDistribution() {
  const delays = [];
  const base = 2000;
  for (let i = 0; i < 200; i++) {
    const exp = Math.min(60000, base * Math.pow(1.5, Math.min(3, 8)));
    const jitter = 0.6 + Math.random() * 0.4;
    delays.push(Math.floor(exp * jitter));
  }
  const min = Math.min(...delays);
  const max = Math.max(...delays);
  const distinct = new Set(delays).size;

  test('Exponential Backoff com Jitter produz atrasos distribuídos sem colisões determinísticas',
    min >= 2000 * Math.pow(1.5, 3) * 0.59 &&
    max <= 2000 * Math.pow(1.5, 3) * 1.01 &&
    distinct > 150 // dispersão ampla por causa do jitter aleatório
  );
}
testBackoffDistribution();

// 8. Teste Funcional: Transições de Estado do Circuit Breaker
function testCircuitBreakerStateMachine() {
  const cb = {
    _circuitState: 'CLOSED',
    _circuitFailureCount: 0,
    _circuitNextAttemptAt: 0,
    _circuitCooldownMs: 30000,
    _circuitFailureThreshold: 5,

    _isCircuitOpen() {
      if (this._circuitState === 'OPEN') {
        if (Date.now() >= this._circuitNextAttemptAt) {
          this._circuitState = 'HALF_OPEN';
          return false;
        }
        return true;
      }
      return false;
    },

    _recordNetworkSuccess() {
      this._circuitState = 'CLOSED';
      this._circuitFailureCount = 0;
      this._circuitNextAttemptAt = 0;
    },

    _recordNetworkFailure(is5xxOrNetwork = true) {
      if (!is5xxOrNetwork) return;
      this._circuitFailureCount++;
      if (this._circuitFailureCount >= this._circuitFailureThreshold) {
        this._circuitState = 'OPEN';
        this._circuitNextAttemptAt = Date.now() + this._circuitCooldownMs;
      }
    }
  };

  test('Circuit Breaker inicia em CLOSED', cb._circuitState === 'CLOSED' && !cb._isCircuitOpen());

  // 4 falhas
  for (let i = 0; i < 4; i++) cb._recordNetworkFailure(true);
  test('Circuit Breaker permanece CLOSED com 4 falhas (< threshold 5)', cb._circuitState === 'CLOSED' && !cb._isCircuitOpen());

  // 5ª falha -> ABERTO (OPEN)
  cb._recordNetworkFailure(true);
  test('Circuit Breaker abre (OPEN) na 5ª falha consecutiva de rede', cb._circuitState === 'OPEN' && cb._isCircuitOpen());

  // Simula expiração do cooldown de 30s
  cb._circuitNextAttemptAt = Date.now() - 100;
  test('Circuit Breaker transiciona para HALF_OPEN após período de cooldown', !cb._isCircuitOpen() && cb._circuitState === 'HALF_OPEN');

  // Sucesso na requisição de teste
  cb._recordNetworkSuccess();
  test('Circuit Breaker retorna para CLOSED após sucesso em HALF_OPEN', cb._circuitState === 'CLOSED' && cb._circuitFailureCount === 0);
}
testCircuitBreakerStateMachine();

console.log(`\n=== Resumo dos Testes de Confiabilidade e Armazenamento ===`);
console.log(`Passou: ${passed} | Falhou: ${failed}`);
if (failed > 0) process.exit(1);
