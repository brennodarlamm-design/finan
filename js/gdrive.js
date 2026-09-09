/**
 * FinObra — Módulo de Integração com Google Drive (Google Picker API)
 */
const GDrive = {
  API_KEY: 'AIzaSyAulsSIHM0kPq28qJwQtj1taNMG-0jZqGE',
  CLIENT_ID: '260462714670-568cfk38egdla84caeklv3bg2hi2fs0u.apps.googleusercontent.com',
  APP_ID: '260462714670',
  SCOPE: 'https://www.googleapis.com/auth/drive.readonly',

  _tokenClient: null,
  _accessToken: null,
  _pickerApiLoaded: false,
  _gisLoaded: false,

  // Carrega scripts oficiais do Google sob demanda
  async init() {
    if (this._pickerApiLoaded && this._gisLoaded) return true;

    // 1. Carregar gapi (Google API Client)
    if (!window.gapi) {
      await this._loadScript('https://apis.google.com/js/api.js');
    }
    await new Promise((resolve) => {
      window.gapi.load('picker', () => {
        this._pickerApiLoaded = true;
        resolve();
      });
    });

    // 2. Carregar google.accounts.oauth2 (Google Identity Services)
    if (!window.google || !window.google.accounts) {
      await this._loadScript('https://accounts.google.com/gsi/client');
    }
    this._gisLoaded = true;
    return true;
  },

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });
  },

  // Solicita autorização e abre a janela oficial do Google Picker
  async abrirSeletor(callback) {
    try {
      Utils.toast('Conectando ao Google Drive...', 'info');
      await this.init();

      const onTokenReady = () => {
        this._createPicker(callback);
      };

      if (!this._accessToken) {
        this._tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: this.CLIENT_ID,
          scope: this.SCOPE,
          callback: async (response) => {
            if (response.error !== undefined) {
              console.error('[GDrive] Erro OAuth:', response);
              if (response.error === 'access_denied') {
                Utils.toast('Permissão cancelada pelo usuário.', 'warning');
              } else {
                Utils.toast(`Erro Google OAuth: ${response.error}. Verifique as origens autorizadas no Console.`, 'error');
              }
              return;
            }
            this._accessToken = response.access_token;
            onTokenReady();
          },
        });
        this._tokenClient.requestAccessToken();
      } else {
        onTokenReady();
      }
    } catch (e) {
      console.error('[GDrive] Falha ao inicializar Google Picker:', e);
      Utils.toast('Para usar o seletor direto, ative "Google Picker API" no Google Cloud Console.', 'warning');
    }
  },

  _createPicker(callback) {
    if (!window.google || !google.picker) {
      return Utils.toast('Biblioteca do Google Picker indisponível no navegador.', 'error');
    }

    try {
      const docsView = new google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true);

      const picker = new google.picker.PickerBuilder()
        .enableFeature(google.picker.Feature.NAV_HIDDEN)
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setAppId(this.APP_ID)
        .setOAuthToken(this._accessToken)
        .addView(docsView)
        .addView(new google.picker.DocsUploadView())
        .setDeveloperKey(this.API_KEY)
        .setCallback((data) => {
          if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
            const docs = data[google.picker.Response.DOCUMENTS] || [];
            if (callback && docs.length) {
              callback(docs);
            }
          }
        })
        .build();

      picker.setVisible(true);
    } catch (e) {
      console.error('[GDrive] Erro ao abrir janela do Picker:', e);
      Utils.toast('Erro ao abrir seletor do Drive. Verifique se a Google Picker API está ativada.', 'error');
    }
  }
};
