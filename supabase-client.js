/**
 * MICA LASH ART — CLIENTE SUPABASE UNIVERSAL & BACKEND BRIDGE
 * Compatible con modo Supabase en la nube y modo local / offline automático.
 */

(function (window) {
  'use strict';

  // Configuración predeterminada (se puede sobrescribir con /api/config o window.MICA_CONFIG)
  const defaultConfig = {
    supabaseUrl: 'https://jhnlieindtfapddivzvq.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpobmxpZWluZHRmYXBkZGl2enZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNjkwMjYsImV4cCI6MjEwODk0NTAyNn0.Yk6QXGRcgHigLLA4lJMDSzCC55_GLdyJPrEfBnWllas',
    isConfigured: true
  };

  const STORAGE_KEYS = {
    TOKEN: 'vasca_token',
    REFRESH: 'vasca_refresh',
    USER: 'mica_current_user',
    LOCAL_TURNOS: 'mica_lashart_turnos',
    LOCAL_USERS: 'mica_users_db',
    GALLERY: 'mica_gallery_photos',
    PUBLISHED_SCHEDULES: 'mica_published_schedules',
    SITE_CONTENT: 'mica_site_content'
  };

  // Seña obligatoria para reservar (porcentaje del precio del servicio)
  const DEPOSIT_PERCENTAGE = 20;

  // Datos de transferencia por defecto (editables desde el Panel Admin > Turnos > Datos para la seña)
  const DEFAULT_PAYMENT_INFO = {
    alias: '',
    cbu: '',
    holder: 'Micaela',
    bank: '',
    whatsapp: ''
  };

  // Servicios oficiales por defecto (garantiza funcionamiento sin demoras)
  const FALLBACK_SERVICES = [
    {
      id: '22222222-2222-2222-2222-222222222201',
      name: 'Clásicas Pelo a Pelo',
      slug: 'clasicas-pelo-a-pelo',
      badge: 'Efecto Rímel Natural',
      desc: 'Una extensión ultra liviana sobre cada pestaña natural. Ideal para el día a día sin maquillaje.',
      duration: 90,
      price: 28000,
      deposit: 5000,
      icon: '✨',
      category: 'extensiones'
    },
    {
      id: '22222222-2222-2222-2222-222222222202',
      name: 'Volumen Híbrido Glam',
      slug: 'volumen-hibrido-glam',
      badge: '★ Look Más Pedido',
      desc: 'Mezcla armoniosa de técnica clásica y abanicos 2D/3D. Textura esponjosa con máxima definición.',
      duration: 120,
      price: 34000,
      deposit: 5000,
      icon: '👑',
      category: 'extensiones'
    },
    {
      id: '22222222-2222-2222-2222-222222222203',
      name: 'Volumen Ruso 3D-5D',
      slug: 'volumen-ruso-3d-5d',
      badge: 'Densidad & Mirada Intensa',
      desc: 'Abanicos artesanales ultralivianos hechos a mano. Densidad sofisticada y curvatura impecable.',
      duration: 135,
      price: 42000,
      deposit: 8000,
      icon: '💎',
      category: 'extensiones'
    },
    {
      id: '22222222-2222-2222-2222-222222222204',
      name: 'Mega Volumen Velvet',
      slug: 'mega-volumen-velvet',
      badge: 'Impacto Black Intenso',
      desc: 'Máxima cobertura y textura aterciopelada. Fibras extra finas 0.03mm de máxima ligereza.',
      duration: 150,
      price: 48000,
      deposit: 10000,
      icon: '🖤',
      category: 'extensiones'
    },
    {
      id: '22222222-2222-2222-2222-222222222205',
      name: 'Lifting de Pestañas + Botox',
      slug: 'lifting-pestanas-botox',
      badge: 'Nutrición 100% Natural',
      desc: 'Arqueado desde la raíz con nutrición profunda de keratina, botox y tinte negro azabache.',
      duration: 60,
      price: 24000,
      deposit: 4000,
      icon: '🌸',
      category: 'lifting'
    },
    {
      id: '22222222-2222-2222-2222-222222222206',
      name: 'Laminado & Diseño de Cejas',
      slug: 'laminado-diseno-cejas',
      badge: 'Alisado + Henna HD',
      desc: 'Fijación y alineación del vello de cejas, perfilado simétrico y color semipermanente.',
      duration: 45,
      price: 20000,
      deposit: 4000,
      icon: '✨',
      category: 'cejas'
    }
  ];

  class MicaBackendManager {
    constructor() {
      this.config = { ...defaultConfig };
      this.sbClient = null;
      this.apiBase = '';
      this.hasNodeBackend = false;
      this.initialized = false;
      this.initPromise = null;

      // Namespaces para acceso intuitivo (ej: MicaBackend.auth.login, MicaBackend.admin.getAppointments)
      this.auth = {
        login: this.login.bind(this),
        register: this.register.bind(this),
        logout: this.logout.bind(this),
        getUser: this.getCurrentUser.bind(this)
      };
      this.turnos = {
        getServices: this.getServices.bind(this),
        getAvailableSlots: this.getAvailableSlots.bind(this),
        createAppointment: this.createAppointment.bind(this),
        getMyAppointments: this.getMyAppointments.bind(this),
        cancelAppointment: this.cancelAppointment.bind(this)
      };
      this.admin = {
        getAppointments: this.getAdminAppointments.bind(this),
        updateAppointmentStatus: this.updateAppointmentStatus.bind(this)
      };
      this.payments = {
        depositPercentage: DEPOSIT_PERCENTAGE,
        calcDeposit: this.calcDeposit.bind(this),
        getInfo: this.getPaymentInfo.bind(this),
        saveInfo: this.savePaymentInfo.bind(this),
        uploadReceipt: this.uploadDepositReceipt.bind(this),
        getReceiptUrl: this.getDepositReceiptUrl.bind(this)
      };
      this.gallery = {
        getPhotos: this.getGalleryPhotos.bind(this),
        addPhoto: this.addGalleryPhoto.bind(this),
        updatePhoto: this.updateGalleryPhoto.bind(this),
        deletePhoto: this.deleteGalleryPhoto.bind(this),
        uploadImage: this.uploadGalleryImage.bind(this),
        resetToDefaults: this.resetGalleryDefaults.bind(this)
      };
      this.instagram = {
        getDaySlots: this.getInstagramDaySlots.bind(this),
        getSchedule: this.getWeeklySchedule.bind(this),
        saveSchedule: this.saveWeeklySchedule.bind(this),
        getPublishedDays: this.getPublishedDays.bind(this),
        getPublishedDay: this.getPublishedDay.bind(this),
        publishDaySlots: this.publishDaySlots.bind(this),
        toggleSlotCrossedOut: this.toggleSlotCrossedOut.bind(this),
        unpublishDay: this.unpublishDay.bind(this)
      };
      this.schedules = {
        getPublishedDays: this.getPublishedDays.bind(this),
        getPublishedDay: this.getPublishedDay.bind(this),
        publishDaySlots: this.publishDaySlots.bind(this),
        toggleSlotCrossedOut: this.toggleSlotCrossedOut.bind(this),
        unpublishDay: this.unpublishDay.bind(this)
      };
      this.emails = {
        getSettings: this.getEmailSettings.bind(this),
        saveTemplates: this.saveEmailTemplates.bind(this),
        saveProvider: this.saveEmailProvider.bind(this),
        preview: this.previewEmailTemplate.bind(this),
        sendTest: this.sendTestEmail.bind(this),
        resendForAppointment: this.resendAppointmentEmail.bind(this)
      };
      this.content = {
        getDefaults: this.getDefaultSiteContent.bind(this),
        getAll: this.getSiteContent.bind(this),
        saveAll: this.saveSiteContent.bind(this),
        saveSection: this.saveSiteSection.bind(this),
        resetDefaults: this.resetSiteContent.bind(this)
      };
    }

    async init() {
      if (this.initPromise) return this.initPromise;
      this.initPromise = this._loadConfigAndInit();
      return this.initPromise;
    }

    async _loadConfigAndInit() {
      try {
        // 1. Auto-descubrimiento inteligente del servidor Node (evita errores 404 en Live Server / GitHub Pages)
        const host = (window.location && window.location.hostname) ? window.location.hostname.toLowerCase() : '';
        const port = (window.location && window.location.port) ? String(window.location.port) : '';
        const proto = (window.location && window.location.protocol) ? window.location.protocol : '';
        const isStaticCloudHost = (
          host.endsWith('.github.io') ||
          host.endsWith('.netlify.app') ||
          host.endsWith('.vercel.app') ||
          host.endsWith('.pages.dev')
        );

        const candidateBases = [];
        if (window.MICA_API_URL) {
          candidateBases.push(String(window.MICA_API_URL).replace(/\/+$/, ''));
        } else if (host === 'localhost' || host === '127.0.0.1' || proto === 'file:') {
          if (port === '3456') {
            candidateBases.push('');
          } else {
            // Abierto desde Live Server (:5500, etc.) o file:// -> conectar directo al backend en :3456 sin provocar 404 local
            candidateBases.push('http://localhost:3456');
          }
        } else if (!isStaticCloudHost) {
          candidateBases.push('');
        }

        for (const base of candidateBases) {
          const res = await fetch(`${base}/api/config`).catch(() => null);
          if (res && res.ok) {
            const ctype = (res.headers.get('content-type') || '').toLowerCase();
            if (ctype.includes('application/json')) {
              const apiConfig = await res.json().catch(() => null);
              if (apiConfig) {
                this.apiBase = base;
                this.hasNodeBackend = true;
                if (apiConfig.supabaseUrl && apiConfig.supabaseAnonKey) {
                  this.config.supabaseUrl = apiConfig.supabaseUrl;
                  this.config.supabaseAnonKey = apiConfig.supabaseAnonKey;
                  this.config.isConfigured = true;
                }
                break;
              }
            }
          }
        }

        // 2. Fallback a window.MICA_CONFIG si fue definido manualmente
        if (!this.config.isConfigured && window.MICA_CONFIG && window.MICA_CONFIG.supabaseUrl) {
          this.config.supabaseUrl = window.MICA_CONFIG.supabaseUrl;
          this.config.supabaseAnonKey = window.MICA_CONFIG.supabaseAnonKey;
          this.config.isConfigured = true;
        }

        // 3. Fallback a localStorage por si el usuario guardó credenciales desde UI
        if (!this.config.isConfigured) {
          const localUrl = localStorage.getItem('mica_supabase_url');
          const localKey = localStorage.getItem('mica_supabase_key');
          if (localUrl && localKey) {
            this.config.supabaseUrl = localUrl;
            this.config.supabaseAnonKey = localKey;
            this.config.isConfigured = true;
          }
        }

        // 4. Si hay credenciales y está disponible supabase-js, instanciar cliente
        if (this.config.isConfigured && window.supabase && window.supabase.createClient) {
          this.sbClient = window.supabase.createClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
        }

        // 5. Mantener la sesión iniciada entre visitas (renueva el token vencido con el refresh_token)
        await this._refreshSessionIfNeeded();
        this._scheduleSessionRefresh();

        this.initialized = true;
        this._updateUIStatusBadge();
        return this.getStatus();
      } catch (e) {
        console.warn('MicaBackend init warning:', e);
        this.initialized = true;
        return this.getStatus();
      }
    }

    async _apiFetch(path, options = {}) {
      if (!this.hasNodeBackend) return null;
      return fetch(`${this.apiBase}${path}`, options);
    }

    getStatus() {
      return {
        isConfigured: !!(this.config.supabaseUrl && this.config.supabaseAnonKey),
        hasNodeBackend: this.hasNodeBackend,
        apiBase: this.apiBase,
        mode: this.config.isConfigured ? 'supabase' : 'local',
        supabaseUrl: this.config.supabaseUrl || null,
        user: this.getCurrentUser()
      };
    }

    _updateUIStatusBadge() {
      const badge = document.getElementById('supabase-status-badge');
      if (!badge) return;

      const status = this.getStatus();
      if (status.isConfigured) {
        badge.innerHTML = `
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#25D366]/20 border border-[#25D366]/40 text-[#25D366] text-xs font-semibold">
            <span class="w-2 h-2 rounded-full bg-[#25D366] animate-pulse"></span>
            Supabase Conectado
          </span>
        `;
      } else {
        badge.innerHTML = `
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold" title="Los turnos y usuarios se guardan en el navegador. Podés configurar tu URL y clave de Supabase en el archivo .env">
            <span class="w-2 h-2 rounded-full bg-amber-400"></span>
            Modo Local / Demo
          </span>
        `;
      }
    }

    // =========================================================================
    // AUTENTICACIÓN (LOGIN / REGISTRO / PERFIL)
    // =========================================================================
    async register({ name, phone, email, password }) {
      await this.init();

      if (this.config.isConfigured) {
        // Enviar a Supabase Auth
        try {
          const authUrl = `${this.config.supabaseUrl}/auth/v1/signup`;
          const res = await fetch(authUrl, {
            method: 'POST',
            headers: {
              apikey: this.config.supabaseAnonKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email,
              password,
              data: { full_name: name, phone: phone || '' }
            })
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error_description || data.msg || data.message || 'Error al registrar');

          if (data.access_token) {
            localStorage.setItem(STORAGE_KEYS.TOKEN, data.access_token);
            if (data.refresh_token) localStorage.setItem(STORAGE_KEYS.REFRESH, data.refresh_token);
          }

          const userObj = {
            id: data.user ? data.user.id : 'usr_' + Date.now(),
            name: name,
            email: email,
            phone: phone || '',
            role: 'client'
          };
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userObj));
          return { success: true, user: userObj, mode: 'supabase' };
        } catch (err) {
          console.warn('Supabase register error, falling back to local storage:', err);
          // Fallback a almacenamiento local para no bloquear la experiencia de usuario
          return this._localRegister({ name, phone, email, password });
        }
      } else {
        return this._localRegister({ name, phone, email, password });
      }
    }

    _localRegister({ name, phone, email, password }) {
      const usersStr = localStorage.getItem(STORAGE_KEYS.LOCAL_USERS) || '[]';
      const users = JSON.parse(usersStr);

      const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        throw new Error('Ya existe una cuenta con este correo. Podés iniciar sesión.');
      }

      const newUser = {
        id: 'usr_' + Date.now(),
        name,
        phone: phone || '',
        email,
        password,
        role: email.includes('admin') || email.includes('mica') ? 'admin' : 'client',
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      localStorage.setItem(STORAGE_KEYS.LOCAL_USERS, JSON.stringify(users));

      const sessionUser = {
        id: newUser.id,
        name: newUser.name,
        phone: newUser.phone,
        email: newUser.email,
        role: newUser.role
      };

      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(sessionUser));
      localStorage.setItem(STORAGE_KEYS.TOKEN, 'demo_token_' + newUser.id);

      return { success: true, user: sessionUser, mode: 'local' };
    }

    async login(email, password) {
      await this.init();

      if (this.config.isConfigured) {
        let res;
        try {
          const authUrl = `${this.config.supabaseUrl}/auth/v1/token?grant_type=password`;
          res = await fetch(authUrl, {
            method: 'POST',
            headers: {
              apikey: this.config.supabaseAnonKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
          });
        } catch (networkErr) {
          console.warn('Supabase unreachable, trying local storage:', networkErr);
          return this._localLogin(email, password);
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const rawMsg = data.error_description || data.msg || data.message || '';
          if (rawMsg.toLowerCase().includes('invalid login credentials')) {
            throw new Error('Email o contraseña incorrectos.');
          }
          throw new Error(rawMsg || 'Credenciales inválidas');
        }

        localStorage.setItem(STORAGE_KEYS.TOKEN, data.access_token);
        if (data.refresh_token) localStorage.setItem(STORAGE_KEYS.REFRESH, data.refresh_token);

        // Consultar rol desde app_metadata firmado por Supabase Auth (y fallback a profiles)
        let resolvedRole = data.user?.app_metadata?.role || null;
        if (!resolvedRole) {
          try {
            const profRes = await fetch(`${this.config.supabaseUrl}/rest/v1/profiles?id=eq.${data.user.id}&select=role,full_name,phone`, {
              headers: {
                apikey: this.config.supabaseAnonKey,
                Authorization: `Bearer ${data.access_token}`
              }
            });
            if (profRes.ok) {
              const profData = await profRes.json();
              if (Array.isArray(profData) && profData[0]?.role) {
                resolvedRole = profData[0].role;
              }
            }
          } catch (e) {}
        }

        if (!resolvedRole) {
          resolvedRole = (data.user.email.toLowerCase() === 'admin@gmail.com') ? 'admin' : 'client';
        }

        const fullName = data.user?.user_metadata?.full_name || data.user?.user_metadata?.name || email.split('@')[0];
        const phone = data.user?.user_metadata?.phone || '';

        const userObj = {
          id: data.user.id,
          name: fullName,
          email: data.user.email,
          phone: phone,
          role: resolvedRole
        };

        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userObj));
        return { success: true, user: userObj, mode: 'supabase' };
      } else {
        return this._localLogin(email, password);
      }
    }

    _localLogin(email, password) {
      const usersStr = localStorage.getItem(STORAGE_KEYS.LOCAL_USERS) || '[]';
      const users = JSON.parse(usersStr);

      const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (found) {
        if (found.password && found.password !== password) {
          throw new Error('Contraseña incorrecta.');
        }
        const sessionUser = {
          id: found.id,
          name: found.name,
          phone: found.phone,
          email: found.email,
          role: found.role || 'client'
        };
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(sessionUser));
        localStorage.setItem(STORAGE_KEYS.TOKEN, 'demo_token_' + found.id);
        return { success: true, user: sessionUser, mode: 'local' };
      }

      // Si no existe, permitir inicio con credenciales demo
      const demoUser = {
        id: 'usr_guest_' + Date.now(),
        name: email.split('@')[0],
        email: email,
        phone: '',
        role: email.includes('admin') || email.includes('mica') ? 'admin' : 'client'
      };
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(demoUser));
      localStorage.setItem(STORAGE_KEYS.TOKEN, 'demo_token_' + demoUser.id);
      return { success: true, user: demoUser, mode: 'local' };
    }

    logout() {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH);
      localStorage.removeItem(STORAGE_KEYS.USER);
      return true;
    }

    getCurrentUser() {
      try {
        const u = localStorage.getItem(STORAGE_KEYS.USER);
        return u ? JSON.parse(u) : null;
      } catch (e) {
        return null;
      }
    }

    _getValidJwtToken() {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (token && token.split('.').length === 3 && !token.startsWith('demo_token_')) {
        // Un JWT vencido provoca 401 en todas las consultas: mejor usar la anon key hasta renovarlo
        const exp = this._getJwtExp(token);
        if (exp && exp * 1000 <= Date.now()) return null;
        return token;
      }
      return null;
    }

    _getJwtExp(token) {
      try {
        const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const json = JSON.parse(atob(payload.padEnd(payload.length + (4 - payload.length % 4) % 4, '=')));
        return Number(json.exp) || null;
      } catch (e) {
        return null;
      }
    }

    // Renueva el access_token (dura 1 hora) usando el refresh_token guardado,
    // así la sesión queda iniciada aunque la clienta/admin cierre y vuelva a entrar.
    async _refreshSessionIfNeeded(force = false) {
      if (!this.config.isConfigured) return false;
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      const refresh = localStorage.getItem(STORAGE_KEYS.REFRESH);
      if (!refresh || !token || token.startsWith('demo_token_')) return false;

      const exp = this._getJwtExp(token);
      const msLeft = exp ? exp * 1000 - Date.now() : 0;
      if (!force && msLeft > 5 * 60 * 1000) return true; // todavía le quedan más de 5 minutos

      if (this._refreshPromise) return this._refreshPromise;
      this._refreshPromise = (async () => {
        try {
          const res = await fetch(`${this.config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: { apikey: this.config.supabaseAnonKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refresh })
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.access_token) {
            localStorage.setItem(STORAGE_KEYS.TOKEN, data.access_token);
            if (data.refresh_token) localStorage.setItem(STORAGE_KEYS.REFRESH, data.refresh_token);
            return true;
          }
          // Refresh token inválido o revocado: la sesión terminó de verdad
          if (res.status === 400 || res.status === 401) {
            this.logout();
          }
          return false;
        } catch (e) {
          // Sin conexión: conservar la sesión y reintentar más tarde
          return false;
        } finally {
          this._refreshPromise = null;
        }
      })();
      return this._refreshPromise;
    }

    _scheduleSessionRefresh() {
      if (this._sessionTimerStarted || typeof window === 'undefined') return;
      this._sessionTimerStarted = true;
      // Revisar cada 4 minutos y al volver a la pestaña
      setInterval(() => { this._refreshSessionIfNeeded(); }, 4 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this._refreshSessionIfNeeded();
      });
    }

    _getAuthBearer() {
      return this._getValidJwtToken() || this.config.supabaseAnonKey;
    }

    // =========================================================================
    // SERVICIOS & DISPONIBILIDAD
    // =========================================================================
    async getServices() {
      await this.init();

      // 1. Consultar primero el contenido editable del sitio (garantiza que los cambios del Admin se reflejen al instante)
      try {
        const siteContent = await this.getSiteContent();
        if (siteContent && Array.isArray(siteContent.services) && siteContent.services.length > 0) {
          return siteContent.services
            .filter(s => s.isActive !== false)
            .map(s => ({
              id: s.id,
              name: s.name,
              slug: s.slug || '',
              badge: s.badge || '',
              desc: s.desc || s.description || '',
              duration: Number(s.duration || s.duration_minutes) || 90,
              durationLabel: s.durationLabel || `${Number(s.duration || s.duration_minutes) || 90} min`,
              price: Number(s.price !== undefined ? s.price : s.price_ars) || 0,
              deposit: Number(s.deposit !== undefined ? s.deposit : s.deposit_ars) || this.calcDeposit(s.price || s.price_ars || 0),
              icon: s.icon || '✨',
              category: s.category || 'extensiones'
            }));
        }
      } catch (e) {}

      // 2. Consultar /api/services en el servidor backend
      try {
        const apiRes = await this._apiFetch('/api/services');
        if (apiRes && apiRes.ok) {
          const apiData = await apiRes.json();
          if (apiData && Array.isArray(apiData.services) && apiData.services.length > 0) {
            return apiData.services.map(s => ({
              id: s.id,
              name: s.name,
              slug: s.slug,
              badge: s.badge || '',
              desc: s.description || s.desc || '',
              duration: s.duration_minutes || s.duration || 90,
              durationLabel: s.durationLabel || `${s.duration_minutes || s.duration || 90} min`,
              price: Number(s.price_ars || s.price) || 0,
              deposit: Number(s.deposit_ars || s.deposit) || 0,
              icon: s.icon || '✨',
              category: s.category || 'extensiones'
            }));
          }
        }
      } catch (e) {}

      if (this.config.isConfigured) {
        try {
          const res = await fetch(`${this.config.supabaseUrl}/rest/v1/services?is_active=eq.true&order=sort_order.asc`, {
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this.config.supabaseAnonKey}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              return data.map(s => ({
                id: s.id,
                name: s.name,
                slug: s.slug,
                badge: s.badge || '',
                desc: s.description || '',
                duration: s.duration_minutes || 90,
                durationLabel: `${s.duration_minutes || 90} min`,
                price: Number(s.price_ars) || 0,
                deposit: Number(s.deposit_ars) || 0,
                icon: s.icon || '✨',
                category: s.category || 'extensiones'
              }));
            }
          }
        } catch (e) {
          console.warn('Error fetching services from Supabase, using fallback:', e);
        }
      }

      return FALLBACK_SERVICES;
    }

    async getAvailableSlots(dateStr, serviceId) {
      await this.init();

      // 1. Consultar primero al backend /api/turnos/availability (incluye horarios subidos y tachados por el Admin)
      try {
        const apiRes = await this._apiFetch(`/api/turnos/availability?date=${encodeURIComponent(dateStr)}`);
        if (apiRes && apiRes.ok) {
          const apiData = await apiRes.json();
          if (apiData && Array.isArray(apiData.slots)) {
            return apiData.slots;
          }
        }
      } catch (e) {}

      // 2. Verificar si existen horarios publicados en Supabase settings o localStorage (para modo estático/nube)
      const pubDay = await this._getStaticPublishedDay(dateStr);
      const baseTimes = (pubDay && Array.isArray(pubDay.slots) && pubDay.slots.length > 0)
        ? pubDay.slots.map(s => String(s.time || '').slice(0, 5))
        : ['10:00', '11:30', '14:00', '15:30', '17:00', '18:30'];

      const crossedSet = new Set(
        (pubDay && Array.isArray(pubDay.slots) ? pubDay.slots : [])
          .filter(s => s && s.crossedOut)
          .map(s => String(s.time || '').slice(0, 5))
      );

      if (this.config.isConfigured) {
        try {
          // Consultar horarios ocupados mediante función RPC segura (sin exponer datos personales)
          const rpcRes = await fetch(`${this.config.supabaseUrl}/rest/v1/rpc/get_booked_slots`, {
            method: 'POST',
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this.config.supabaseAnonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ p_date: dateStr })
          });
          if (rpcRes.ok) {
            const booked = await rpcRes.json();
            if (Array.isArray(booked)) {
              const bookedTimes = booked.map(b => (b.start_time || '').slice(0, 5));
              return baseTimes.map(time => ({
                time,
                crossedOut: crossedSet.has(time),
                autoBooked: bookedTimes.includes(time),
                available: !crossedSet.has(time) && !bookedTimes.includes(time)
              }));
            }
          }

          // Fallback directo si la tabla tiene política de lectura activa
          const res = await fetch(`${this.config.supabaseUrl}/rest/v1/appointments?appointment_date=eq.${dateStr}&status=neq.cancelled&select=start_time`, {
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this.config.supabaseAnonKey}`
            }
          });
          if (res.ok) {
            const booked = await res.json();
            const bookedTimes = booked.map(b => b.start_time.slice(0, 5));
            return baseTimes.map(time => ({
              time,
              crossedOut: crossedSet.has(time),
              autoBooked: bookedTimes.includes(time),
              available: !crossedSet.has(time) && !bookedTimes.includes(time)
            }));
          }
        } catch (e) {
          console.warn('Error fetching slots from Supabase, using local calculation:', e);
        }
      }

      // En modo local, verificar citas guardadas en localStorage
      const localTurnos = this.getStoredTurnos();
      const bookedLocal = localTurnos
        .filter(t => t.date === dateStr && t.status !== 'cancelled')
        .map(t => t.time);

      return baseTimes.map(time => ({
        time,
        crossedOut: crossedSet.has(time),
        autoBooked: bookedLocal.includes(time),
        available: !crossedSet.has(time) && !bookedLocal.includes(time)
      }));
    }

    // =========================================================================
    // CREAR TURNO / RESERVA
    // =========================================================================
    async createAppointment(bookingData) {
      await this.init();

      const newId = 'turn_' + Date.now();
      const currentUser = this.getCurrentUser();

      const normalizedBooking = {
        id: newId,
        service: bookingData.service,
        serviceId: bookingData.serviceId || (bookingData.service ? bookingData.service.id : null),
        date: bookingData.date,
        time: bookingData.time,
        endTime: bookingData.endTime || '',
        price: bookingData.price || (bookingData.service ? bookingData.service.price : 0),
        professional: 'Micaela',
        clientName: bookingData.name,
        clientPhone: bookingData.phone,
        clientEmail: bookingData.email || (currentUser ? currentUser.email : ''),
        clientNotes: bookingData.notes || '',
        depositArs: Number(bookingData.depositArs) || 0,
        depositReceipt: bookingData.depositReceipt || null,
        paymentMethod: bookingData.depositReceipt ? 'transferencia' : 'efectivo',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // Guardar siempre en local storage para disponibilidad offline inmediata
      this._saveLocalTurno(normalizedBooking);

      // 1. Enviar al servidor backend /api/turnos (persiste directo en Supabase con service_role)
      let backendReached = false;
      try {
        const apiRes = await this._apiFetch('/api/turnos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceId: normalizedBooking.serviceId,
            serviceName: normalizedBooking.service ? normalizedBooking.service.name : '',
            date: normalizedBooking.date,
            time: normalizedBooking.time,
            endTime: normalizedBooking.endTime,
            price: normalizedBooking.price,
            name: normalizedBooking.clientName,
            phone: normalizedBooking.clientPhone,
            email: normalizedBooking.clientEmail,
            notes: normalizedBooking.clientNotes,
            depositArs: normalizedBooking.depositArs,
            depositReceipt: normalizedBooking.depositReceipt
          })
        });
        if (apiRes) {
          backendReached = true;
          const apiData = await apiRes.json().catch(() => ({}));
          if (apiRes.ok && apiData && apiData.appointment && apiData.appointment.id) {
            normalizedBooking.supabaseId = apiData.appointment.id;
            this._updateLocalTurno(normalizedBooking);
            return {
              success: true,
              appointment: normalizedBooking,
              emailNotification: apiData.emailNotification || null
            };
          }
          if (apiRes.status === 409 || apiRes.status === 400) {
            const turnos = this.getStoredTurnos().filter(t => t.id !== normalizedBooking.id);
            localStorage.setItem(STORAGE_KEYS.LOCAL_TURNOS, JSON.stringify(turnos));
            throw new Error(apiData.error || 'Ese horario ya no está disponible.');
          }
        }
      } catch (e) {
        if (backendReached) throw e;
      }

      // 2. Fallback directo a Supabase si no hay backend Node corriendo
      if (this.config.isConfigured) {
        try {
          const generatedUuid = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : undefined;
          const hasValidJwt = !!this._getValidJwtToken();
          const svcName = normalizedBooking.service ? normalizedBooking.service.name : '';
          const fullNotes = svcName
            ? (normalizedBooking.clientNotes ? `Tratamiento: ${svcName}\n${normalizedBooking.clientNotes}` : `Tratamiento: ${svcName}`)
            : normalizedBooking.clientNotes;
          const payload = {
            ...(generatedUuid ? { id: generatedUuid } : {}),
            professional_id: '11111111-1111-1111-1111-111111111111',
            service_id: normalizedBooking.serviceId || '22222222-2222-2222-2222-222222222202',
            appointment_date: normalizedBooking.date,
            start_time: normalizedBooking.time.length === 5 ? normalizedBooking.time + ':00' : normalizedBooking.time,
            end_time: (normalizedBooking.endTime || '16:00').slice(0, 5) + ':00',
            price_ars: normalizedBooking.price,
            client_name: normalizedBooking.clientName,
            client_phone: normalizedBooking.clientPhone,
            client_email: normalizedBooking.clientEmail,
            client_notes: fullNotes,
            deposit_ars: normalizedBooking.depositArs,
            deposit_receipt_url: normalizedBooking.depositReceipt,
            payment_method: normalizedBooking.paymentMethod,
            payment_status: 'pending',
            status: 'pending'
          };

          const postAppointment = (body) => fetch(`${this.config.supabaseUrl}/rest/v1/appointments`, {
            method: 'POST',
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this.config.supabaseAnonKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal'
            },
            body: JSON.stringify(body)
          });

          let res = await postAppointment(payload);

          // Si todavía no se ejecutó add-deposit-sena.sql (falta la columna del comprobante),
          // guardar igual el turno dejando los datos de la seña en las notas
          if (!res.ok && normalizedBooking.depositReceipt) {
            const errData = await res.clone().json().catch(() => ({}));
            if (errData.code === 'PGRST204' || /deposit_receipt_url/.test(errData.message || '')) {
              const { deposit_receipt_url, ...legacyPayload } = payload;
              legacyPayload.client_notes = `${fullNotes || ''}\n[Seña $${normalizedBooking.depositArs} - comprobante: ${normalizedBooking.depositReceipt}]`.trim();
              res = await postAppointment(legacyPayload);
            }
          }

          if (res.ok) {
            if (generatedUuid) {
              normalizedBooking.supabaseId = generatedUuid;
            }
            this._updateLocalTurno(normalizedBooking);
          }
        } catch (e) {
          console.warn('Could not save appointment to Supabase, persisted locally:', e);
        }
      }

      return {
        success: true,
        appointment: normalizedBooking
      };
    }

    // =========================================================================
    // CONSULTAR Y CANCELAR TURNOS
    // =========================================================================
    async getMyAppointments() {
      await this.init();
      const currentUser = this.getCurrentUser();
      const localTurnos = this.getStoredTurnos();

      if (currentUser && currentUser.email) {
        try {
          const apiRes = await this._apiFetch(`/api/turnos?email=${encodeURIComponent(currentUser.email)}`);
          if (apiRes && apiRes.ok) {
            const apiData = await apiRes.json();
            if (Array.isArray(apiData.appointments) && apiData.appointments.length > 0) {
              return apiData.appointments.map(row => {
                const rawNotes = row.client_notes || row.notes || '';
                const resolvedSvcName = (row.services && row.services.name)
                  || row.service_name
                  || (rawNotes.includes('Tratamiento:') ? rawNotes.split('Tratamiento:')[1].split('\n')[0].trim() : 'Tratamiento de Pestañas');
                return {
                  id: row.id,
                  date: row.appointment_date || row.date,
                  time: ((row.start_time || row.time) + '').slice(0, 5),
                  endTime: ((row.end_time || row.endTime || '16:00') + '').slice(0, 5),
                  price: Number(row.price_ars || row.price) || 0,
                  status: row.status,
                  clientName: row.client_name || row.name,
                  clientPhone: row.client_phone || row.phone,
                  clientNotes: rawNotes,
                  professional: 'Micaela',
                  service: {
                    name: resolvedSvcName,
                    price: Number(row.price_ars || row.price) || 0
                  }
                };
              });
            }
          }
        } catch (e) {}
      }

      if (this.config.isConfigured && currentUser && currentUser.email) {
        try {
          const res = await fetch(`${this.config.supabaseUrl}/rest/v1/appointments?client_email=eq.${encodeURIComponent(currentUser.email)}&order=appointment_date.desc,start_time.asc`, {
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this._getAuthBearer()}`
            }
          });

          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              return data.map(row => {
                const rawNotes = row.client_notes || '';
                const resolvedSvcName = rawNotes.includes('Tratamiento:')
                  ? rawNotes.split('Tratamiento:')[1].split('\n')[0].trim()
                  : 'Tratamiento de Pestañas';
                return {
                  id: row.id,
                  date: row.appointment_date,
                  time: row.start_time.slice(0, 5),
                  endTime: row.end_time.slice(0, 5),
                  price: Number(row.price_ars),
                  status: row.status,
                  clientName: row.client_name,
                  clientPhone: row.client_phone,
                  clientNotes: rawNotes,
                  professional: 'Micaela',
                  service: {
                    name: resolvedSvcName,
                    price: Number(row.price_ars)
                  }
                };
              });
            }
          }
        } catch (e) {
          console.warn('Error fetching appointments from Supabase:', e);
        }
      }

      return localTurnos;
    }

    async cancelAppointment(appointmentId) {
      await this.init();

      // Actualizar en localStorage y resolver el ID real en Supabase si se pasó el ID local
      const turnos = this.getStoredTurnos();
      const found = turnos.find(t => t.id === appointmentId || t.supabaseId === appointmentId);
      const targetId = (found && found.supabaseId) ? found.supabaseId : appointmentId;
      if (found) {
        found.status = 'cancelled';
        localStorage.setItem(STORAGE_KEYS.LOCAL_TURNOS, JSON.stringify(turnos));
      }

      // 1. Cancelar mediante servidor backend /api/turnos/:id (dispara email personalizado de cancelación)
      try {
        const apiRes = await this._apiFetch(`/api/turnos/${encodeURIComponent(targetId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled', cancelledBy: 'client' })
        });
        if (apiRes && apiRes.ok) {
          const data = await apiRes.json().catch(() => ({}));
          return { success: true, emailNotification: data.emailNotification || null };
        }
      } catch (e) {}

      // 2. Fallback directo si está en Supabase
      if (this.config.isConfigured) {
        try {
          await fetch(`${this.config.supabaseUrl}/rest/v1/appointments?id=eq.${encodeURIComponent(targetId)}`, {
            method: 'PATCH',
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this._getAuthBearer()}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'cancelled' })
          });
        } catch (e) {
          console.warn('Error cancelling on Supabase:', e);
        }
      }

      return true;
    }

    // =========================================================================
    // ADMINISTRACIÓN (PANEL DE CONTROL)
    // =========================================================================
    async getAdminAppointments(filter = 'all') {
      await this.init();

      // 1. Consultar servidor backend /api/turnos (usa SUPABASE_SERVICE_ROLE_KEY)
      try {
        const apiRes = await this._apiFetch(`/api/turnos?status=${filter}`);
        if (apiRes && apiRes.ok) {
          const apiData = await apiRes.json();
          if (Array.isArray(apiData.appointments)) {
            return apiData.appointments.map(r => {
              const rawNotes = r.client_notes || r.notes || '';
              const svcName = (r.services && r.services.name)
                || r.service_name
                || (rawNotes.includes('Tratamiento:') ? rawNotes.split('Tratamiento:')[1].split('\n')[0].trim() : 'Tratamiento de Pestañas');
              return {
                id: r.id,
                date: r.appointment_date || r.date,
                time: ((r.start_time || r.time) + '').slice(0, 5),
                clientName: r.client_name || r.name || 'Clienta',
                clientPhone: r.client_phone || r.phone || '',
                clientEmail: r.client_email || r.email || '',
                price: Number(r.price_ars || r.price) || 0,
                status: r.status || 'pending',
                service: { name: svcName },
                clientNotes: rawNotes,
                notes: rawNotes,
                depositArs: Number(r.deposit_ars) || 0,
                depositReceipt: r.deposit_receipt_url || null,
                paymentStatus: r.payment_status || 'pending',
                createdAt: r.created_at
              };
            });
          }
        }
      } catch (e) {}

      // 2. Fallback directo a Supabase REST
      if (this.config.isConfigured) {
        try {
          let url = `${this.config.supabaseUrl}/rest/v1/appointments?order=appointment_date.desc,start_time.asc`;
          if (filter !== 'all') {
            url += `&status=eq.${filter}`;
          }

          const res = await fetch(url, {
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this._getAuthBearer()}`
            }
          });

          if (res.ok) {
            const data = await res.json();
            return data.map(r => ({
              id: r.id,
              date: r.appointment_date,
              time: r.start_time.slice(0, 5),
              clientName: r.client_name,
              clientPhone: r.client_phone,
              clientEmail: r.client_email,
              price: Number(r.price_ars),
              status: r.status,
              clientNotes: r.client_notes,
              notes: r.client_notes,
              depositArs: Number(r.deposit_ars) || 0,
              depositReceipt: r.deposit_receipt_url || null,
              paymentStatus: r.payment_status || 'pending',
              createdAt: r.created_at
            }));
          }
        } catch (e) {
          console.warn('Admin fetch error:', e);
        }
      }

      // 3. Fallback a localStorage
      let turnos = this.getStoredTurnos();
      if (filter !== 'all') {
        turnos = turnos.filter(t => t.status === filter);
      }
      return turnos;
    }

    async updateAppointmentStatus(appointmentId, newStatus, options = {}) {
      await this.init();

      const turnos = this.getStoredTurnos();
      const t = turnos.find(x => x.id === appointmentId || x.supabaseId === appointmentId);
      if (t) {
        t.status = newStatus;
        localStorage.setItem(STORAGE_KEYS.LOCAL_TURNOS, JSON.stringify(turnos));
      }

      // 1. Actualizar mediante backend /api/turnos/:id (dispara email personalizado si se cancela)
      try {
        const apiRes = await this._apiFetch(`/api/turnos/${encodeURIComponent(appointmentId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus,
            cancelledBy: options.cancelledBy || 'admin',
            cancelReason: options.cancelReason || ''
          })
        });
        if (apiRes && apiRes.ok) {
          const data = await apiRes.json().catch(() => ({}));
          return { success: true, emailNotification: data.emailNotification || null };
        }
      } catch (e) {}

      // 2. Fallback directo a Supabase REST
      if (this.config.isConfigured) {
        try {
          await fetch(`${this.config.supabaseUrl}/rest/v1/appointments?id=eq.${appointmentId}`, {
            method: 'PATCH',
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this._getAuthBearer()}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(newStatus === 'confirmed'
              ? { status: newStatus, payment_status: 'partial' } // Confirmar = seña recibida
              : { status: newStatus })
          });
        } catch (e) {
          console.warn('Status update error in Supabase:', e);
        }
      }

      return true;
    }

    // Helpers locales
    getStoredTurnos() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_TURNOS);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }

    _saveLocalTurno(turno) {
      const turnos = this.getStoredTurnos();
      turnos.unshift(turno);
      localStorage.setItem(STORAGE_KEYS.LOCAL_TURNOS, JSON.stringify(turnos));
    }

    _updateLocalTurno(turno) {
      const turnos = this.getStoredTurnos();
      const idx = turnos.findIndex(t => t.id === turno.id);
      if (idx !== -1) {
        turnos[idx] = turno;
        localStorage.setItem(STORAGE_KEYS.LOCAL_TURNOS, JSON.stringify(turnos));
      }
    }

    // =========================================================================
    // MÉTODOS DE GESTIÓN DE FOTOS DE EJEMPLO & GALERÍA (ADMIN & FRONTEND)
    // =========================================================================

    _getDefaultGalleryPhotos() {
      return [
        {
          id: "photo_1",
          title: "Volumen Híbrido Glam",
          badge: "★ Look Más Pedido",
          category: "volumen",
          description: "Densidad suave, textura esponjosa y abanicos ultralivianos realizados a medida de la mirada.",
          imageUrl: "images/ej-volumen-hibrido.jpg",
          isFeatured: true,
          isHero: true,
          sortOrder: 1
        },
        {
          id: "photo_2",
          title: "Lifting de Pestañas & Nutrición Botox",
          badge: "🌿 100% Pestaña Natural",
          category: "lifting",
          description: "Elevación desde la raíz de la pestaña natural, nutrición profunda con botox y tinte negro azabache.",
          imageUrl: "images/ej-lifting-botox.jpg",
          isFeatured: true,
          isHero: true,
          sortOrder: 2
        },
        {
          id: "photo_3",
          title: "Laminado & Perfilado de Cejas HD",
          badge: "✨ Antes & Después HD",
          category: "cejas",
          description: "Antes y después real. Direccionamiento folicular orgánico, perfilado con pinza y nutrición.",
          imageUrl: "images/ej-laminado-cejas.jpg",
          isFeatured: false,
          isHero: false,
          sortOrder: 3
        },
        {
          id: "photo_4",
          title: "Comparativa Real en Camilla",
          badge: "👁️ Comparativa en Directo",
          category: "comparativa",
          description: "Impacto visual directo: ojo con pestaña aplicada vs ojo natural sin intervenir. Resalta la luminosidad y apertura de la mirada.",
          imageUrl: "images/ej-comparativa-real.jpg",
          isFeatured: true,
          isHero: true,
          sortOrder: 4
        },
        {
          id: "photo_5",
          title: "Mega Volumen Ruso 3D-5D",
          badge: "🔥 Máxima Densidad",
          category: "volumen",
          description: "Máxima densidad aterciopelada con abanicos hechos a mano. Cero peso sobre la raíz.",
          imageUrl: "images/ej-volumen-ruso.jpg",
          isFeatured: true,
          isHero: true,
          sortOrder: 5
        },
        {
          id: "photo_6",
          title: "Aislación Milimétrica & Curvatura",
          badge: "🔬 Técnica de Precisión",
          category: "clasicas",
          description: "Vista de perfil de alta definición. Curvatura uniforme, raíz limpia sin exceso de adhesivo y separación perfecta.",
          imageUrl: "images/ej-perfil-curvatura.jpg",
          isFeatured: false,
          isHero: false,
          sortOrder: 6
        }
      ];
    }

    _safeSetLocalGallery(list) {
      if (!Array.isArray(list)) return;
      try {
        localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify(list));
      } catch (quotaErr) {
        try {
          // Si alguna imagen antigua en Base64 superó la cuota del navegador, conservar URLs livianas y la última foto subida
          const slim = list.filter((p, idx) => {
            const u = String(p && p.imageUrl ? p.imageUrl : '');
            return !u.startsWith('data:image/') || u.length < 350000 || idx === list.length - 1;
          });
          localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify(slim));
        } catch (_) {
          // No bloquear el guardado principal si el caché de localStorage está lleno
        }
      }
    }

    async _compressImageFile(file, maxDim = 1400, quality = 0.84) {
      return new Promise((resolve, reject) => {
        const fallbackReader = () => {
          const reader = new FileReader();
          reader.onload = () => resolve({ dataUrl: reader.result, blob: file });
          reader.onerror = err => reject(err);
          reader.readAsDataURL(file);
        };

        if (typeof document === 'undefined' || typeof Image === 'undefined') {
          return fallbackReader();
        }

        const objUrl = (window.URL && window.URL.createObjectURL) ? window.URL.createObjectURL(file) : null;
        if (!objUrl) return fallbackReader();

        const img = new Image();
        img.onload = () => {
          try {
            window.URL.revokeObjectURL(objUrl);
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;

            if (!width || !height) return fallbackReader();

            if (width > maxDim || height > maxDim) {
              const ratio = Math.min(maxDim / width, maxDim / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return fallbackReader();

            ctx.fillStyle = '#0d0a0f';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            if (canvas.toBlob) {
              canvas.toBlob((blob) => {
                resolve({ dataUrl, blob: blob || file });
              }, 'image/jpeg', quality);
            } else {
              resolve({ dataUrl, blob: file });
            }
          } catch (e) {
            fallbackReader();
          }
        };
        img.onerror = () => {
          try { window.URL.revokeObjectURL(objUrl); } catch (_) {}
          fallbackReader();
        };
        img.src = objUrl;
      });
    }

    async getGalleryPhotos() {
      await this.init();

      // 1. Intentar desde backend server /api/gallery
      try {
        const res = await this._apiFetch('/api/gallery');
        if (res && res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.photos) && data.photos.length > 0) {
            this._safeSetLocalGallery(data.photos);
            return data.photos;
          }
        }
      } catch (e) {
        // Fallback a Supabase o localStorage
      }

      // 2. Intentar Supabase directamente si configurado
      if (this.config.isConfigured) {
        try {
          const res = await fetch(`${this.config.supabaseUrl}/rest/v1/gallery_photos?select=*&order=sort_order.asc`, {
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this.config.supabaseAnonKey}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              const mapped = data.map(r => ({
                id: r.id,
                title: r.title,
                badge: r.badge,
                category: r.category,
                description: r.description,
                imageUrl: r.image_url,
                isFeatured: r.is_featured,
                isHero: r.is_hero,
                sortOrder: r.sort_order
              }));
              this._safeSetLocalGallery(mapped);
              return mapped;
            }
          }
        } catch (e) {
          console.warn('Error fetching gallery from Supabase:', e);
        }
      }

      // 3. Fallback a LocalStorage
      try {
        const local = localStorage.getItem(STORAGE_KEYS.GALLERY);
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}

      // 4. Default 6 fotos
      const def = this._getDefaultGalleryPhotos();
      this._safeSetLocalGallery(def);
      return def;
    }

    async addGalleryPhoto(photoData) {
      await this.init();

      // 1. Intentar backend /api/gallery
      try {
        const res = await this._apiFetch('/api/gallery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(photoData)
        });
        if (res && res.ok) {
          const data = await res.json();
          if (data && data.photo) {
            const current = await this.getGalleryPhotos();
            if (!current.some(p => String(p.id) === String(data.photo.id))) {
              current.push(data.photo);
              this._safeSetLocalGallery(current);
            }
            return data.photo;
          }
        }
      } catch (e) {
        console.warn('Backend addGalleryPhoto error, falling back:', e);
      }

      // 2. Fallback Supabase
      if (this.config.isConfigured) {
        try {
          const res = await fetch(`${this.config.supabaseUrl}/rest/v1/gallery_photos`, {
            method: 'POST',
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this._getAuthBearer()}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation'
            },
            body: JSON.stringify({
              title: photoData.title,
              badge: photoData.badge || 'Look Más Pedido',
              category: photoData.category || 'volumen',
              description: photoData.description || '',
              image_url: photoData.imageUrl,
              is_featured: !!photoData.isFeatured,
              is_hero: !!photoData.isHero,
              sort_order: photoData.sortOrder || 99
            })
          });
          if (res.ok) {
            const createdArr = await res.json();
            if (Array.isArray(createdArr) && createdArr.length > 0) {
              const r = createdArr[0];
              const mapped = {
                id: r.id,
                title: r.title,
                badge: r.badge,
                category: r.category,
                description: r.description,
                imageUrl: r.image_url,
                isFeatured: r.is_featured,
                isHero: r.is_hero,
                sortOrder: r.sort_order
              };
              const current = await this.getGalleryPhotos();
              current.push(mapped);
              this._safeSetLocalGallery(current);
              return mapped;
            }
          }
        } catch (e) {
          console.warn('Supabase addGalleryPhoto error:', e);
        }
      }

      // 3. Fallback Local seguro (sin error de cuota)
      const localPhoto = {
        id: 'photo_' + Date.now(),
        ...photoData
      };
      const current = await this.getGalleryPhotos();
      current.push(localPhoto);
      this._safeSetLocalGallery(current);
      return localPhoto;
    }

    async updateGalleryPhoto(id, photoData) {
      await this.init();

      // 1. Backend /api/gallery/:id
      try {
        const res = await this._apiFetch(`/api/gallery/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(photoData)
        });
        if (res && res.ok) {
          const data = await res.json();
          if (data && data.photo) {
            this._updateLocalGalleryItem(data.photo);
            return data.photo;
          }
        }
      } catch (e) {
        console.warn('Backend updateGalleryPhoto error:', e);
      }

      // 2. Supabase
      if (this.config.isConfigured) {
        try {
          const updateObj = {};
          if (photoData.title !== undefined) updateObj.title = photoData.title;
          if (photoData.badge !== undefined) updateObj.badge = photoData.badge;
          if (photoData.category !== undefined) updateObj.category = photoData.category;
          if (photoData.description !== undefined) updateObj.description = photoData.description;
          if (photoData.imageUrl !== undefined) updateObj.image_url = photoData.imageUrl;
          if (photoData.isFeatured !== undefined) updateObj.is_featured = photoData.isFeatured;
          if (photoData.isHero !== undefined) updateObj.is_hero = photoData.isHero;
          if (photoData.sortOrder !== undefined) updateObj.sort_order = photoData.sortOrder;

          await fetch(`${this.config.supabaseUrl}/rest/v1/gallery_photos?id=eq.${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this._getAuthBearer()}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateObj)
          });
        } catch (e) {
          console.warn('Supabase updateGalleryPhoto error:', e);
        }
      }

      // 3. Local update
      const updated = { ...photoData, id };
      this._updateLocalGalleryItem(updated);
      return updated;
    }

    async deleteGalleryPhoto(id) {
      await this.init();

      // 1. Backend /api/gallery/:id
      try {
        await this._apiFetch(`/api/gallery/${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch (e) {
        console.warn('Backend deleteGalleryPhoto error:', e);
      }

      // 2. Supabase
      if (this.config.isConfigured) {
        try {
          await fetch(`${this.config.supabaseUrl}/rest/v1/gallery_photos?id=eq.${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this._getAuthBearer()}`
            }
          });
        } catch (e) {
          console.warn('Supabase deleteGalleryPhoto error:', e);
        }
      }

      // 3. Local delete
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.GALLERY);
        if (raw) {
          const list = JSON.parse(raw).filter(p => String(p.id) !== String(id));
          this._safeSetLocalGallery(list);
        }
      } catch (e) {}

      return true;
    }

    async resetGalleryDefaults() {
      await this.init();
      try {
        await this._apiFetch('/api/gallery/reset', { method: 'POST' });
      } catch (e) {}

      const def = this._getDefaultGalleryPhotos();
      this._safeSetLocalGallery(def);
      return def;
    }

    async uploadGalleryImage(file) {
      if (!file) throw new Error('No se seleccionó ningún archivo de imagen.');
      await this.init();

      // Optimizar tamaño y resolución en el cliente (evita demoras y errores de cuota)
      const { dataUrl, blob } = await this._compressImageFile(file, 1400, 0.84);
      const cleanName = (file.name || 'foto.jpg')
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .slice(0, 40) || 'foto';
      const uploadFilename = `${cleanName}.jpg`;

      // 1. Subir a través del backend Node (guarda en Supabase Storage + respaldo local)
      try {
        const res = await this._apiFetch('/api/gallery/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: uploadFilename,
            data: dataUrl
          })
        });

        if (res && res.ok) {
          const data = await res.json();
          if (data && data.url) {
            // Si devolvió ruta relativa desde otro puerto local (ej: Live Server :5500), anteponer apiBase
            if (this.apiBase && !data.url.startsWith('http') && !data.url.startsWith('data:')) {
              return `${this.apiBase}/${data.url.replace(/^\/+/, '')}`;
            }
            return data.url;
          }
        }
      } catch (e) {
        console.warn('Upload endpoint warning, trying cloud/compressed fallback:', e);
      }

      // 2. Intento directo a Supabase Storage si no hay servidor Node activo
      if (!this.hasNodeBackend && this.config.isConfigured && blob) {
        try {
          const storageFile = `ej-${Date.now()}-${uploadFilename}`;
          const upRes = await fetch(`${this.config.supabaseUrl}/storage/v1/object/gallery/${storageFile}`, {
            method: 'POST',
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this._getAuthBearer()}`,
              'Content-Type': 'image/jpeg',
              'x-upsert': 'true'
            },
            body: blob
          });
          if (upRes.ok) {
            return `${this.config.supabaseUrl}/storage/v1/object/public/gallery/${storageFile}`;
          }
        } catch (_) {}
      }

      // 3. Fallback a Data URL JPEG optimizado (~120 KB)
      return dataUrl;
    }

    // =========================================================================
    // SEÑA DEL 20% (TRANSFERENCIA + COMPROBANTE)
    // =========================================================================
    calcDeposit(price) {
      const pct = DEPOSIT_PERCENTAGE / 100;
      // Redondeo a múltiplos de $100 para que sea cómodo transferir
      return Math.ceil(((Number(price) || 0) * pct) / 100) * 100;
    }

    async getPaymentInfo() {
      await this.init();
      if (this.config.isConfigured) {
        try {
          const res = await fetch(`${this.config.supabaseUrl}/rest/v1/settings?key=eq.payment_info&select=value`, {
            headers: { apikey: this.config.supabaseAnonKey, Authorization: `Bearer ${this.config.supabaseAnonKey}` }
          });
          if (res.ok) {
            const rows = await res.json();
            if (Array.isArray(rows) && rows[0] && rows[0].value) {
              return { ...DEFAULT_PAYMENT_INFO, ...rows[0].value };
            }
          }
        } catch (e) {}
      }
      return { ...DEFAULT_PAYMENT_INFO };
    }

    async savePaymentInfo(info) {
      await this.init();
      await this._refreshSessionIfNeeded();
      const clean = {
        alias: String(info.alias || '').trim(),
        cbu: String(info.cbu || '').trim(),
        holder: String(info.holder || '').trim(),
        bank: String(info.bank || '').trim(),
        whatsapp: String(info.whatsapp || '').trim()
      };
      if (!this.config.isConfigured) throw new Error('Supabase no está configurado.');
      const res = await fetch(`${this.config.supabaseUrl}/rest/v1/settings?on_conflict=key`, {
        method: 'POST',
        headers: {
          apikey: this.config.supabaseAnonKey,
          Authorization: `Bearer ${this._getAuthBearer()}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify({ key: 'payment_info', value: clean, description: 'Datos de transferencia para la seña' })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudieron guardar los datos de pago. Cerrá sesión y volvé a ingresar como admin.');
      }
      return clean;
    }

    // Sube el comprobante de la seña al bucket privado 'receipts' y devuelve su ruta
    async uploadDepositReceipt(file, dateStr) {
      if (!file) throw new Error('Adjuntá el comprobante de la transferencia de la seña.');
      await this.init();

      const isPdf = (file.type || '').includes('pdf') || /\.pdf$/i.test(file.name || '');
      let blob = file;
      let dataUrl = null;
      let contentType = file.type || (isPdf ? 'application/pdf' : 'image/jpeg');
      let ext = isPdf ? 'pdf' : ((file.name || '').split('.').pop() || 'jpg').toLowerCase();

      if (!isPdf) {
        try {
          const compressed = await this._compressImageFile(file, 1600, 0.85);
          if (compressed && compressed.dataUrl && compressed.dataUrl.startsWith('data:image/jpeg')) {
            blob = compressed.blob;
            dataUrl = compressed.dataUrl;
            contentType = 'image/jpeg';
            ext = 'jpg';
          }
        } catch (e) {}
      }

      if (blob.size > 8 * 1024 * 1024) {
        throw new Error('El comprobante es muy pesado (máximo 8 MB). Probá con una captura de pantalla.');
      }

      const uid = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
      const folder = /^\d{4}-\d{2}-\d{2}$/.test(dateStr || '') ? dateStr : 'sin-fecha';
      const path = `${folder}/${uid}.${ext}`;

      // 1. Subida directa a Supabase Storage
      if (this.config.isConfigured) {
        try {
          const res = await fetch(`${this.config.supabaseUrl}/storage/v1/object/receipts/${path}`, {
            method: 'POST',
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this._getAuthBearer()}`,
              'Content-Type': contentType
            },
            body: blob
          });
          if (res.ok) return path;
          const errData = await res.json().catch(() => ({}));
          console.warn('Receipt direct upload warning:', errData);
        } catch (e) {
          console.warn('Receipt direct upload error:', e);
        }
      }

      // 2. A través del servidor Node (service_role) si está disponible
      try {
        if (!dataUrl) {
          dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
        const res = await this._apiFetch('/api/receipts/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, data: dataUrl, contentType })
        });
        if (res && res.ok) {
          const data = await res.json();
          if (data && data.path) return data.path;
        }
      } catch (e) {
        console.warn('Receipt backend upload error:', e);
      }

      throw new Error('No se pudo subir el comprobante. Revisá tu conexión e intentá de nuevo.');
    }

    // URL temporal (1 hora) para que la admin vea el comprobante privado
    async getDepositReceiptUrl(path) {
      if (!path) return null;
      if (/^https?:|^data:/.test(path)) return path;
      await this.init();
      await this._refreshSessionIfNeeded();

      try {
        const res = await this._apiFetch(`/api/receipts/signed?path=${encodeURIComponent(path)}`);
        if (res && res.ok) {
          const data = await res.json();
          if (data && data.url) return data.url;
        }
      } catch (e) {}

      if (this.config.isConfigured) {
        const res = await fetch(`${this.config.supabaseUrl}/storage/v1/object/sign/receipts/${path}`, {
          method: 'POST',
          headers: {
            apikey: this.config.supabaseAnonKey,
            Authorization: `Bearer ${this._getAuthBearer()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ expiresIn: 3600 })
        });
        if (res.ok) {
          const data = await res.json();
          const signed = data.signedURL || data.signedUrl;
          if (signed) return `${this.config.supabaseUrl}/storage/v1${signed.startsWith('/') ? '' : '/'}${signed}`;
        }
      }
      throw new Error('No se pudo abrir el comprobante. Cerrá sesión y volvé a ingresar como admin.');
    }

    _updateLocalGalleryItem(item) {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.GALLERY);
        if (raw) {
          const list = JSON.parse(raw);
          const idx = list.findIndex(p => String(p.id) === String(item.id));
          if (idx !== -1) {
            list[idx] = { ...list[idx], ...item };
            this._safeSetLocalGallery(list);
          }
        }
      } catch (e) {}
    }

    // =========================================================================
    // GENERADOR DE HISTORIAS INSTAGRAM & HORARIOS (ESTILO PROYECTO VASCA)
    // =========================================================================
    async getWeeklySchedule() {
      await this.init();
      try {
        const res = await this._apiFetch('/api/schedule');
        if (res && res.ok) {
          const data = await res.json();
          if (Array.isArray(data.schedule)) return data.schedule;
        }
      } catch (e) {}

      if (this.config.isConfigured) {
        try {
          const res = await fetch(`${this.config.supabaseUrl}/rest/v1/weekly_schedule?professional_id=eq.11111111-1111-1111-1111-111111111111&order=day_of_week.asc`, {
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this.config.supabaseAnonKey}`
            }
          });
          if (res.ok) return await res.json();
        } catch (e) {}
      }

      try {
        const saved = localStorage.getItem('mica_weekly_schedule');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
      return [];
    }

    async saveWeeklySchedule(days) {
      await this.init();
      const res = await this._apiFetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days })
      });
      if (res) {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'No se pudieron guardar los horarios.');
        }
        return await res.json();
      }
      localStorage.setItem('mica_weekly_schedule', JSON.stringify(days));
      return { success: true, schedule: days };
    }

    async getInstagramDaySlots(dateStr, interval = '60', forceGenerate = false) {
      await this.init();
      if (!dateStr) return { slots: [], isPublished: false, isBlocked: false, noSchedule: false };

      try {
        const fg = forceGenerate ? '&forceGenerate=1' : '';
        const res = await this._apiFetch(`/api/instagram/slots?date=${encodeURIComponent(dateStr)}&interval=${encodeURIComponent(interval)}${fg}`);
        if (res && res.ok) {
          return await res.json();
        }
      } catch (e) {}

      // Fallback si se ejecuta sin servidor Node
      const slotsResp = await this.getAvailableSlots(dateStr);
      const pubDay = await this._getStaticPublishedDay(dateStr);
      return {
        slots: slotsResp.map(s => ({
          time: s.time,
          crossedOut: !!s.crossedOut,
          autoBooked: !!s.autoBooked,
          isBooked: !s.available
        })),
        isPublished: !!(pubDay && pubDay.published !== false),
        isBlocked: false,
        noSchedule: new Date(`${dateStr}T12:00:00`).getDay() === 0
      };
    }

    // =========================================================================
    // SUBIR HORARIOS Y TACHAR TURNOS EN VIVO (ADMIN + CARTELERA WEB)
    // =========================================================================
    _getLocalPublishedMap() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.PUBLISHED_SCHEDULES);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.days) return parsed;
        }
      } catch (e) {}
      return { days: {} };
    }

    _saveLocalPublishedMap(mapObj) {
      try {
        localStorage.setItem(STORAGE_KEYS.PUBLISHED_SCHEDULES, JSON.stringify(mapObj));
      } catch (e) {}
    }

    async _getStaticPublishedMap() {
      if (this.config.isConfigured) {
        try {
          const res = await fetch(`${this.config.supabaseUrl}/rest/v1/settings?key=eq.published_schedules&select=value`, {
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this.config.supabaseAnonKey}`
            }
          });
          if (res.ok) {
            const rows = await res.json();
            if (Array.isArray(rows) && rows[0] && rows[0].value && rows[0].value.days) {
              this._saveLocalPublishedMap(rows[0].value);
              return rows[0].value;
            }
          }
        } catch (e) {}
      }
      return this._getLocalPublishedMap();
    }

    async _getStaticPublishedDay(dateStr) {
      const mapObj = await this._getStaticPublishedMap();
      const d = mapObj && mapObj.days && mapObj.days[dateStr];
      if (d && d.published !== false) return d;
      return null;
    }

    async _upsertSupabasePublishedMap(mapObj) {
      this._saveLocalPublishedMap(mapObj);
      if (!this.config.isConfigured) return;
      try {
        await fetch(`${this.config.supabaseUrl}/rest/v1/settings?on_conflict=key`, {
          method: 'POST',
          headers: {
            apikey: this.config.supabaseAnonKey,
            Authorization: `Bearer ${this._getAuthBearer()}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            key: 'published_schedules',
            value: mapObj,
            description: 'Horarios publicados por el admin con control de tachado en tiempo real'
          })
        });
      } catch (e) {
        console.warn('Supabase settings upsert fallback warning:', e);
      }
    }

    async getPublishedDays(upcomingOnly = true) {
      await this.init();
      try {
        const res = await this._apiFetch(`/api/published-schedules?upcoming=${upcomingOnly ? 'true' : 'false'}`);
        if (res && res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.days)) return data.days;
        }
      } catch (e) {}

      // Fallback estático / Supabase REST
      const mapObj = await this._getStaticPublishedMap();
      const allDays = (mapObj && mapObj.days) || {};
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const dates = Object.keys(allDays)
        .filter(d => allDays[d] && allDays[d].published !== false && Array.isArray(allDays[d].slots) && allDays[d].slots.length > 0)
        .filter(d => !upcomingOnly || d >= todayStr)
        .sort();

      const results = [];
      for (const d of dates) {
        const avail = await this.getAvailableSlots(d);
        results.push({
          date: d,
          isPublished: true,
          updatedAt: allDays[d].updatedAt || null,
          slots: avail.map(s => ({
            time: s.time,
            crossedOut: !!s.crossedOut,
            autoBooked: !!s.autoBooked,
            isBooked: !s.available
          }))
        });
      }
      return results;
    }

    async getPublishedDay(dateStr) {
      await this.init();
      try {
        const res = await this._apiFetch(`/api/published-schedules?date=${encodeURIComponent(dateStr)}`);
        if (res && res.ok) return await res.json();
      } catch (e) {}

      const d = await this._getStaticPublishedDay(dateStr);
      if (!d) return { date: dateStr, isPublished: false, slots: [] };
      const avail = await this.getAvailableSlots(dateStr);
      return {
        date: dateStr,
        isPublished: true,
        updatedAt: d.updatedAt || null,
        slots: avail.map(s => ({
          time: s.time,
          crossedOut: !!s.crossedOut,
          autoBooked: !!s.autoBooked,
          isBooked: !s.available
        }))
      };
    }

    async publishDaySlots(dateStr, slots) {
      await this.init();
      try {
        const res = await this._apiFetch('/api/published-schedules', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: dateStr, slots })
        });
        if (res && res.ok) {
          const data = await res.json();
          // Sincronizar copia local también
          const localMap = this._getLocalPublishedMap();
          localMap.days[dateStr] = {
            date: dateStr,
            published: true,
            updatedAt: data.updatedAt || new Date().toISOString(),
            slots: (data.slots || slots).map(s => ({ time: s.time, crossedOut: !!s.crossedOut }))
          };
          this._saveLocalPublishedMap(localMap);
          return data;
        }
      } catch (e) {}

      // Fallback estático / Supabase directo
      const mapObj = await this._getStaticPublishedMap();
      if (!mapObj.days) mapObj.days = {};
      const cleanSlots = (slots || []).map(s => ({
        time: String(s.time || s).slice(0, 5),
        crossedOut: Boolean(s && s.crossedOut)
      })).sort((a, b) => a.time.localeCompare(b.time));

      mapObj.days[dateStr] = {
        date: dateStr,
        published: true,
        updatedAt: new Date().toISOString(),
        slots: cleanSlots
      };
      await this._upsertSupabasePublishedMap(mapObj);
      return await this.getPublishedDay(dateStr);
    }

    async toggleSlotCrossedOut(dateStr, timeStr, crossedOut, fallbackSlots = []) {
      await this.init();
      try {
        const res = await this._apiFetch('/api/published-schedules/toggle', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: dateStr, time: timeStr, crossedOut, fallbackSlots })
        });
        if (res && res.ok) {
          const data = await res.json();
          const localMap = this._getLocalPublishedMap();
          localMap.days[dateStr] = {
            date: dateStr,
            published: true,
            updatedAt: data.updatedAt || new Date().toISOString(),
            slots: (data.slots || []).map(s => ({ time: s.time, crossedOut: !!s.crossedOut }))
          };
          this._saveLocalPublishedMap(localMap);
          return data;
        }
      } catch (e) {}

      // Fallback estático / Supabase directo
      const mapObj = await this._getStaticPublishedMap();
      if (!mapObj.days) mapObj.days = {};
      if (!mapObj.days[dateStr] || !Array.isArray(mapObj.days[dateStr].slots)) {
        mapObj.days[dateStr] = {
          date: dateStr,
          published: true,
          updatedAt: new Date().toISOString(),
          slots: fallbackSlots.map(s => ({ time: String(s.time || s).slice(0, 5), crossedOut: !!s.crossedOut }))
        };
      }
      const found = mapObj.days[dateStr].slots.find(s => s.time === timeStr);
      if (found) {
        found.crossedOut = typeof crossedOut === 'boolean' ? crossedOut : !found.crossedOut;
      } else {
        mapObj.days[dateStr].slots.push({ time: timeStr, crossedOut: typeof crossedOut === 'boolean' ? crossedOut : true });
        mapObj.days[dateStr].slots.sort((a, b) => a.time.localeCompare(b.time));
      }
      mapObj.days[dateStr].updatedAt = new Date().toISOString();
      await this._upsertSupabasePublishedMap(mapObj);
      return await this.getPublishedDay(dateStr);
    }

    async unpublishDay(dateStr) {
      await this.init();
      try {
        const res = await this._apiFetch(`/api/published-schedules?date=${encodeURIComponent(dateStr)}`, {
          method: 'DELETE'
        });
        if (res && res.ok) {
          const localMap = this._getLocalPublishedMap();
          if (localMap.days) delete localMap.days[dateStr];
          this._saveLocalPublishedMap(localMap);
          return true;
        }
      } catch (e) {}

      const mapObj = await this._getStaticPublishedMap();
      if (mapObj.days && mapObj.days[dateStr]) {
        delete mapObj.days[dateStr];
        await this._upsertSupabasePublishedMap(mapObj);
      }
      return true;
    }

    // =========================================================================
    // EMAILS PERSONALIZADOS DE RESERVA Y CANCELACIÓN
    // =========================================================================
    _getDefaultEmailTemplates() {
      try {
        const raw = localStorage.getItem('mica_email_templates');
        if (raw) return JSON.parse(raw);
      } catch (_) {}
      return {
        studioLocation: 'Zona Hospital Penna - Villa Cerrito, Bahía Blanca',
        notifyAdmin: true,
        booking: {
          enabled: true,
          subject: '✨ ¡Tu turno está confirmado, {{primer_nombre}}! — Mica Lash Art',
          heading: '¡Te esperamos, {{primer_nombre}}! ♡',
          intro: 'Tu reserva para {{servicio}} quedó agendada con éxito. Acá tenés todos los detalles de tu cita:',
          tips: '• Asistí con los ojos limpios y sin máscara de pestañas ni delineador.\n• Tolerancia máxima de espera: 15 minutos.\n• Si necesitás reprogramar o cancelar, avisame con al menos 24 hs de anticipación.',
          footerNote: '¡Gracias por confiar tu mirada a Mica Lash Art!'
        },
        cancellation: {
          enabled: true,
          subject: '🌸 Tu turno fue cancelado, {{primer_nombre}} — Mica Lash Art',
          heading: 'Turno cancelado, {{primer_nombre}}',
          intro: 'Te confirmamos que tu turno para {{servicio}} del día {{fecha}} a las {{hora}} hs fue cancelado.',
          rebookMessage: '¡Cuando quieras volver a agendar tu mirada, vas a poder elegir un nuevo horario disponible desde nuestra web! ♡',
          footerNote: 'Mica Lash Art • Estudio de Miradas en Bahía Blanca'
        }
      };
    }

    async getEmailSettings() {
      await this.init();
      const res = await this._apiFetch('/api/email/settings');
      if (res && res.ok) {
        return await res.json();
      }
      return {
        templates: this._getDefaultEmailTemplates(),
        provider: {
          configured: false,
          mode: 'static',
          label: 'Modo Estático (Iniciá node server.js para envío SMTP)'
        },
        logs: []
      };
    }

    async saveEmailTemplates(templates) {
      await this.init();
      try {
        localStorage.setItem('mica_email_templates', JSON.stringify(templates));
      } catch (_) {}
      const res = await this._apiFetch('/api/email/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates })
      });
      if (!res) return { success: true, templates };
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error guardando plantillas de email');
      return data;
    }

    async saveEmailProvider(providerConfig) {
      await this.init();
      const res = await this._apiFetch('/api/email/provider', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(providerConfig)
      });
      if (!res) throw new Error('Iniciá el servidor local (node server.js) para configurar las credenciales SMTP.');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error guardando credenciales SMTP');
      return data;
    }

    async previewEmailTemplate(type, templates) {
      await this.init();
      const res = await this._apiFetch('/api/email/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, templates })
      });
      if (res && res.ok) {
        return await res.json();
      }
      // Vista previa instantánea en el cliente si server.js no está corriendo
      const t = templates || this._getDefaultEmailTemplates();
      const cfg = (type === 'cancellation' ? t.cancellation : t.booking) || {};
      const vars = {
        nombre: 'Valentina Gómez',
        primer_nombre: 'Valentina',
        servicio: 'Volumen Híbrido Glam',
        fecha: 'Viernes 14 de Noviembre',
        hora: '15:30',
        precio: '$34.000',
        ubicacion: t.studioLocation || 'Bahía Blanca',
        motivo: 'Reprogramación solicitada'
      };
      const rep = (s) => String(s || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => vars[k] || '');
      const subject = rep(cfg.subject);
      const heading = rep(cfg.heading);
      const intro = rep(cfg.intro);
      return {
        subject,
        html: `<div style="background:#0d0a0f;color:#f8eef6;font-family:sans-serif;padding:28px;border-radius:18px;border:1px solid #ff3e9655;"><h2 style="color:#ffaed8;margin-top:0;">${heading}</h2><p style="line-height:1.6;color:#d8c4d6;">${intro}</p><div style="background:#19121d;padding:16px;border-radius:12px;margin:16px 0;font-size:14px;"><p><strong>Tratamiento:</strong> ${vars.servicio}</p><p><strong>Fecha:</strong> ${vars.fecha} — ${vars.hora} hs</p><p><strong>Ubicación:</strong> ${vars.ubicacion}</p></div></div>`
      };
    }

    async sendTestEmail(to, type = 'booking') {
      await this.init();
      const res = await this._apiFetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, type })
      });
      if (!res) throw new Error('Iniciá el servidor (node server.js) para enviar correos de prueba.');
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Error enviando correo de prueba');
      }
      return data;
    }

    async resendAppointmentEmail(appointmentId, type) {
      await this.init();
      const res = await this._apiFetch(`/api/turnos/${encodeURIComponent(appointmentId)}/resend-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      if (!res) throw new Error('Iniciá el servidor (node server.js) para reenviar correos.');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo reenviar el correo');
      return data;
    }

    // =========================================================================
    // CONTENIDO EDITABLE DEL SITIO WEB (PRECIOS, SERVICIOS, PROMOS, CURSOS, SECCIONES)
    // =========================================================================
    getDefaultSiteContent() {
      return {
        services: [
          {
            id: '22222222-2222-2222-2222-222222222205',
            name: 'Lifting de Pestañas + Nutrición Keratina',
            slug: 'lifting-pestanas-botox',
            badge: 'Lifting & Nutrición',
            desc: 'Eleva tus pestañas naturales desde la raíz con curvatura armónica. Baño botox y keratina para engrosar y dar brillo sin rímel.',
            duration: 60,
            durationLabel: '60 min',
            price: 24000,
            deposit: 4800,
            icon: '🌸',
            category: 'lifting',
            isActive: true,
            sortOrder: 1
          },
          {
            id: '22222222-2222-2222-2222-222222222201',
            name: 'Extensiones Pelo a Pelo Clásicas',
            slug: 'clasicas-pelo-a-pelo',
            badge: 'Pelo a Pelo',
            desc: 'Una extensión suave adherida por cada pestaña sana. Logra el aspecto de máscara perfecta, mirada abierta y ordenada sin recargar.',
            duration: 90,
            durationLabel: '90-120 min',
            price: 28000,
            deposit: 5600,
            icon: '✨',
            category: 'clasicas',
            isActive: true,
            sortOrder: 2
          },
          {
            id: '22222222-2222-2222-2222-222222222202',
            name: 'Volumen Híbrido / Light Russian',
            slug: 'volumen-hibrido-glam',
            badge: '★ Look Más Pedido',
            desc: 'Abanicos ultralivianos armados en el momento combinados con técnica individual. Densidad esponjosa, dimensión glam y acabado aterciopelado.',
            duration: 120,
            durationLabel: '120 min',
            price: 34000,
            deposit: 6800,
            icon: '👑',
            category: 'volumen',
            isActive: true,
            sortOrder: 3
          },
          {
            id: '22222222-2222-2222-2222-222222222203',
            name: 'Volumen Ruso 3D-5D',
            slug: 'volumen-ruso-3d-5d',
            badge: 'Densidad & Mirada Intensa',
            desc: 'Abanicos artesanales ultralivianos hechos a mano. Densidad sofisticada y curvatura impecable.',
            duration: 135,
            durationLabel: '135 min',
            price: 42000,
            deposit: 8400,
            icon: '💎',
            category: 'volumen',
            isActive: true,
            sortOrder: 4
          },
          {
            id: '22222222-2222-2222-2222-222222222204',
            name: 'Mega Volumen Velvet',
            slug: 'mega-volumen-velvet',
            badge: 'Impacto Black Intenso',
            desc: 'Máxima cobertura y textura aterciopelada. Fibras extra finas 0.03mm de máxima ligereza.',
            duration: 150,
            durationLabel: '150 min',
            price: 48000,
            deposit: 9600,
            icon: '🖤',
            category: 'volumen',
            isActive: true,
            sortOrder: 5
          },
          {
            id: '22222222-2222-2222-2222-222222222206',
            name: 'Laminado & Perfilado de Cejas',
            slug: 'laminado-diseno-cejas',
            badge: 'Cejas VIP',
            desc: 'Direcciona y fija cada vello para enmarcar el rostro con simetría orgánica. Incluye diseño personalizado con pinza e hidratación.',
            duration: 45,
            durationLabel: '45 min',
            price: 20000,
            deposit: 4000,
            icon: '🦋',
            category: 'volumen',
            isActive: true,
            sortOrder: 6
          },
          {
            id: '22222222-2222-2222-2222-222222222207',
            name: 'Mantenimiento de Extensiones (Service)',
            slug: 'mantenimiento-extensiones',
            badge: 'Service Mensual',
            desc: 'Reemplazo de pestañas regeneradas para mantener el diseño simétrico, fresco y limpio de forma continua cada 2 a 3 semanas.',
            duration: 60,
            durationLabel: '60 min',
            price: 18000,
            deposit: 3600,
            icon: '💫',
            category: 'clasicas',
            isActive: true,
            sortOrder: 7
          }
        ],
        promosSection: {
          pill: 'Promociones de Temporada',
          title: 'Elegí la opción para potenciar tus resultados',
          subtitle: 'Paquetes y combos pensados para maximizar la belleza de tu mirada y mantenerla impecable por semanas.',
          bannerTag: 'Agenda Online 24/7',
          bannerTitle: 'Reservá tu Horario en Tiempo Real',
          bannerSubtitle: 'Zona Htal. Penna - Villa Cerrito - Bahía Blanca',
          bannerBtnText: 'Abrir Agenda Online',
          items: [
            {
              id: 'promo_1',
              badge: 'Combo Look Natural',
              duration: '75 min',
              title: 'Lifting + Botox + Perfilado',
              desc: 'Pestañas curvadas con nutrición profunda y cejas perfectamente definidas y ordenadas. Cero uso de rímel diario.',
              priceLabel: 'Precio Promoción',
              price: 22000,
              ribbonText: 'La opción para potenciar tus resultados ♡',
              btnText: 'Pedir Turno Promo',
              serviceLink: 'lifting',
              isVip: false,
              vipBadge: ''
            },
            {
              id: 'promo_2',
              badge: 'Pack Glow Total',
              duration: '120 min',
              title: 'Extensiones Híbridas / Rusas + Cejas',
              desc: 'Densidad suave, textura aterciopelada y abanicos ultralivianos hechos a mano más laminado de cejas completo.',
              priceLabel: 'Inversión Especial',
              price: 34000,
              ribbonText: 'La opción para potenciar tus resultados ♡',
              btnText: 'Reservar Turno VIP',
              serviceLink: 'hibrido',
              isVip: true,
              vipBadge: '★ Más Elegido VIP ★'
            },
            {
              id: 'promo_3',
              badge: 'Mantenimiento Mensual',
              duration: '60 min',
              title: 'Service Frecuente (Cada 2 a 3 sem)',
              desc: 'Retiro de piezas crecidas y relleno prolijo para lucir tu set completo, limpio y simétrico todo el mes.',
              priceLabel: 'Precio Clientas Frecuentes',
              price: 18000,
              ribbonText: 'Cuidado continuo de tu mirada ♡',
              btnText: 'Agendar Service',
              serviceLink: 'mantenimiento',
              isVip: false,
              vipBadge: ''
            }
          ]
        },
        coursesSection: {
          pill: '🎓 ACADEMIA MICA LASH ART ♡ CAPACITACIONES 🎓',
          title: 'Cursos Profesionales & Masterclasses',
          subtitle: 'Aprendé las técnicas más solicitadas del mercado de la mano de Micaela (lashista y educadora desde 2016). Formación personalizada con práctica en modelo real, kit profesional completo y doble certificación.',
          trustBadges: [
            { icon: '🎓', title: 'Certificado Oficial', subtitle: 'Válido para inserción profesional' },
            { icon: '📦', title: 'Kit Completo Incluido', subtitle: 'Materiales profesionales importados' },
            { icon: '👁️', title: 'Práctica Real Supervisada', subtitle: 'Atención paso a paso con modelo' },
            { icon: '💬', title: 'Mentoría Permanente', subtitle: 'Canal directo de consultas con Mica' }
          ],
          courses: [
            {
              id: '33333333-3333-3333-3333-333333333301',
              slug: 'curso-inicial-clasicas',
              badge: '★ El Más Elegido',
              duration: '2 Jornadas',
              title: 'Curso Inicial: Clásicas 1 a 1',
              subtitle: 'Extensiones Pelo a Pelo • Nivel Inicial sin experiencia previa',
              desc: 'El curso base fundamental para insertarte en el mundo lash. Aprendé desde cero anatomía ocular, bioseguridad, dirección de postura, aislación milimétrica y mapping adaptado a cada ojo.',
              syllabus: [
                'Práctica real en cabeza técnica y modelo viva',
                'Kit profesional completo (pinzas, adhesivo, blíster)',
                'Manual teórico encuadernado y certificado oficial',
                'Seguimiento y asesoría post-curso de por vida'
              ],
              priceLabel: 'Inversión',
              price: 75000,
              priceNote: 'Opciones en cuotas • Seña previa',
              modalityFilter: 'presencial',
              btnText: 'Consultar por WhatsApp',
              whatsappText: 'Hola Mica! Quiero info y temario del Curso Inicial de Clásicas Pelo a Pelo',
              isActive: true,
              sortOrder: 1
            },
            {
              id: '33333333-3333-3333-3333-333333333302',
              slug: 'masterclass-volumen-ruso',
              badge: '👑 Especialización Avanzada',
              duration: '1 Jornada VIP',
              title: 'Masterclass: Volumen Ruso & Mega',
              subtitle: 'Técnicas Rusas • Armado manual de abanicos 2D a 6D',
              desc: 'Llevá tu técnica al máximo nivel. Dominá el armado de abanicos en tira y pinza, retención blindada (hasta 6 semanas), mapping avanzado (Fox, Wet, Kim) y química del adhesivo.',
              syllabus: [
                'Técnica artesanal sin abanicos prearmados',
                'Secretos de retención extrema y control de humedad',
                'Módulo de fotografía y edición para Instagram',
                'Certificado de Master Lashista en Volumen'
              ],
              priceLabel: 'Inversión',
              price: 88000,
              priceNote: 'Cupos ultra limitados (1 a 1)',
              modalityFilter: 'ambos',
              btnText: 'Consultar por WhatsApp',
              whatsappText: 'Hola Mica! Quiero info y fechas de la Masterclass de Volumen Ruso',
              isActive: true,
              sortOrder: 2
            },
            {
              id: '33333333-3333-3333-3333-333333333303',
              slug: 'taller-lifting-laminado',
              badge: '🌿 Rápida Salida Laboral',
              duration: '1 Día Intensivo',
              title: 'Taller Dual: Lifting & Laminado',
              subtitle: 'Lifting con Keratina + Laminado & Perfilado de Cejas',
              desc: 'Combiná los dos tratamientos naturales más pedidos en una sola capacitación. Aprendé tiempos exactos de exposición, elección de moldes según el párpado, tinte y nutrición botox.',
              syllabus: [
                'Modalidad Presencial VIP u Online en Video HD',
                'Visagismo y perfilado de cejas con hilo y pinza',
                'Dossier descargable y lista de proveedores directos',
                'Doble Certificación Oficial incluida'
              ],
              priceLabel: 'Inversión',
              price: 48000,
              priceNote: 'Online: $28.000 • Material incluido',
              modalityFilter: 'ambos',
              btnText: 'Consultar por WhatsApp',
              whatsappText: 'Hola Mica! Quiero info del Taller Dual de Lifting y Laminado de Cejas',
              isActive: true,
              sortOrder: 3
            }
          ]
        },
        hero: {
          statusPill: 'Turnos Disponibles Esta Semana • Bahía Blanca',
          scriptTitle: '¿Lista para sentir la diferencia?',
          mainTitleLine1: 'Miradas con arte,',
          mainTitleHighlight: 'precisión & elegancia.',
          ribbonTop: 'RESERVÁ TU TURNO CON',
          ribbonBrand: 'Mica Lash Art',
          description: 'Diseño exclusivo de pestañas, visagismo y cuidado integral. Un espacio privado en Bahía Blanca para relajarte mientras transformamos tu mirada sin dañar tu pestaña natural.',
          primaryBtnText: 'Pedir Turno Online',
          secondaryBtnText: 'Ver Precios & Promos',
          guarantees: [
            '100% Sin dolor',
            'Nutrición folicular',
            '+150 clientas felices'
          ],
          styles: [
            {
              id: 'hibrido',
              name: 'Volumen Híbrido',
              badge: '★ Look Más Pedido',
              title: 'Volumen Híbrido Glam',
              detail: 'Densidad suave, textura aterciopelada y abanicos ultralivianos en camilla',
              price: '$34.000',
              time: '120 min',
              img: 'images/ej-volumen-hibrido.jpg'
            },
            {
              id: 'lifting',
              name: 'Lifting & Botox',
              badge: '🌿 100% Pestaña Natural',
              title: 'Lifting con Keratina Botox',
              detail: 'Eleva tus pestañas naturales desde la raíz con nutrición botox y tinte negro',
              price: '$24.000',
              time: '75 min',
              img: 'images/ej-lifting-botox.jpg'
            },
            {
              id: 'comparativa',
              name: 'Comparativa Real',
              badge: '✨ Ojo Real vs Natural',
              title: 'Antes vs Después en Directo',
              detail: 'Apertura total de mirada comprobada en sesión real con máxima fijación',
              price: '$34.000',
              time: '120 min',
              img: 'images/ej-comparativa-real.jpg'
            },
            {
              id: 'ruso',
              name: 'Volumen Ruso',
              badge: '🔥 Máxima Densidad 3D-5D',
              title: 'Mega Volumen Ruso',
              detail: 'Abanicos artesanales abiertos a mano, negro carbón y acabado aterciopelado',
              price: '$42.000',
              time: '150 min',
              img: 'images/ej-volumen-ruso.jpg'
            }
          ]
        },
        servicesSection: {
          pill: 'Catálogo del Estudio',
          title: 'Técnicas & Tratamientos VIP',
          subtitle: 'Aislación prolija 1 a 1 sin excesos ni peso. Seleccioná el servicio para agendar tu horario exclusivo.',
          ctaCardTitle: '¿Querés ver todos los horarios libres?',
          ctaCardDesc: 'Consultá el calendario interactivo en tiempo real, elegí el día y horario que más te convenga y dejá tu nota de preferencia.',
          ctaCardBtn: 'Ver Calendario de Turnos'
        },
        gallerySection: {
          pill: 'Trabajos Reales',
          title: 'Galería de Miradas',
          subtitle: 'Aislación milimétrica, cero grumos y terminación de alta gama en cada sesión. Tocá para ver en detalle.',
          instagramBtnText: 'Ver más de 150 trabajos en Instagram @mica.lashart'
        },
        about: {
          photoUrl: 'images/mica-bio-1.jpg',
          photoTopBadge: 'Lashista & Maquilladora desde 2016',
          photoCardName: 'Micaela',
          photoCardRole: 'Creadora de Mica Lash Art • Bahía Blanca',
          photoCardSub: 'Atención VIP & Capacitaciones',
          stat1Value: '9+ Años',
          stat1Label: 'De Experiencia (2016)',
          stat2Value: '+150',
          stat2Label: 'Clientas & Alumnas',
          headerPill: '🎀✨ ¡HOLA, SOY MICA! BIENVENIDAS A MI MUNDO ✨🎀',
          headline: '"Hacer de mi pasión mi profesión." 👑',
          subheadline: 'Si todavía no me conocés, ¡me presento! 💗',
          introParagraph1: 'Soy Micaela, creadora de Mica Lash Art, lashista desde 2016, maquilladora y apasionada por el mundo de la belleza. 🦋💄',
          introParagraph2: 'A lo largo de los años fui aprendiendo, capacitándome y sumando nuevos servicios para ofrecerles una experiencia cada vez más completa, siempre con amor, dedicación y atención a cada detalle. 🩷',
          boxTitle: '¿Qué podés encontrar en Mica Lash Art?',
          specialties: [
            { icon: '🎀', text: 'Extensiones de pestañas y diseños personalizados' },
            { icon: '🤍', text: 'Lifting de pestañas' },
            { icon: '🦋', text: 'Diseño y perfilado de cejas' },
            { icon: '🌸', text: 'Depilación' },
            { icon: '💄', text: 'Maquillaje profesional' },
            { icon: '✨', text: 'Electroestimulación corporal' }
          ],
          quote: '"Cada servicio tiene su magia, pero todos comparten lo mismo: las ganas de ayudarte a resaltar tu belleza y que te sientas hermosa, cómoda y segura de vos misma. 🫶🏻"',
          closingParagraph1: 'Detrás de esta marca hay años de trabajo, esfuerzo, aprendizaje y muchísimos sueños por cumplir. Y esto es solo el comienzo… 💫',
          closingParagraph2: 'Gracias a cada clienta y alumna que confía en mí, recomienda mi trabajo y me acompaña en este camino. Ustedes son una parte muy importante de todo lo que estoy construyendo. 🥹💕',
          closingSignature: 'Bienvenidas a mi espacio, a mi trabajo y a este sueño llamado MICA LASH ART. 🎀🩷'
        },
        bookingSection: {
          pill: '✨ AGENDA ONLINE EN TIEMPO REAL ✨',
          title: 'Reservá Tu Turno en Pocos Clics',
          subtitle: 'Accedé a nuestra aplicación exclusiva de turnos. Seleccioná tu tratamiento favorito, elegí el día en el calendario interactivo y asegurá tu horario sin esperas.',
          primaryBtnText: 'Abrir Agenda de Turnos',
          secondaryBtnText: 'Iniciar Sesión Clientas',
          features: [
            { icon: '🗓️', title: 'Calendario Interactivo', desc: 'Elegí tu fecha y hora exacta disponible en vivo.' },
            { icon: '⚡', title: 'Reserva Directa Online', desc: 'Tu cita queda registrada al instante en nuestra agenda.' },
            { icon: '📅', title: 'Google Calendar', desc: 'Sincronizá tu cita directo en tu celular.' }
          ],
          turnosPageRibbon: 'AGENDA ONLINE • MICA LASH ART ♡',
          turnosPageTitle: 'Pedir Turno',
          turnosPageSubtitle: 'Elegí tu tratamiento, seleccioná fecha en el calendario y asegurá tu horario en tiempo real.',
          turnosHoursNote: 'Atención: Mar a Sáb 10:00 a 19:30 hs'
        },
        location: {
          pill: 'Estudio Privado',
          title: 'Visitanos en Bahía Blanca',
          subtitle: 'Atención en estudio privado climatizado, sin esperas ni ruido exterior. Tu sesión es 100% personalizada.',
          addressTitle: 'Ubicación',
          addressText: 'Zona Htal. Penna - Villa Cerrito - Bahía Blanca',
          addressNote: 'Dirección exacta enviada por WhatsApp al confirmar seña',
          hoursTitle: 'Días & Horarios',
          hoursLine1: 'Lunes a Viernes: 10:00 a 19:30 hs',
          hoursLine2: 'Sábados: 10:00 a 16:00 hs (Cupos limitados)',
          studioPhotoUrl: 'images/studio-ambiance-vip.jpg',
          whatsappNumber: '5492914491141',
          instagramHandle: '@mica.lashart',
          instagramUrl: 'https://instagram.com/mica.lashart',
          brandName: 'MICA LASH ART',
          footerSubtitle: 'Zona Htal. Penna - Villa Cerrito - Bahía Blanca • Agenda de Turnos Online',
          footerCopyright: '© 2025 Mica Lash Art. Todos los derechos reservados.'
        },
        faqs: {
          pill: 'Información Útil',
          title: 'Preguntas Frecuentes',
          subtitle: 'Todo lo que tenés que saber antes de tu cita en el estudio.',
          items: [
            {
              id: 'faq_1',
              question: '¿Duelen las extensiones o el lifting?',
              answer: 'Para nada. Es un proceso 100% indoloro, no invasivo y muy relajante. La mayoría de las clientas se duerme plácidamente durante la sesión sobre nuestra camilla ergonómica.'
            },
            {
              id: 'faq_2',
              question: '¿Cuánto duran las extensiones de pestañas?',
              answer: 'Acompañan el ciclo biológico natural de tu pestaña (4 a 6 semanas). Para mantenerlas siempre tupidas y prolijas, se sugiere realizar el service de mantenimiento cada 2 a 3 semanas.'
            },
            {
              id: 'faq_3',
              question: '¿Cómo llego a mi turno y cómo preparo mis pestañas?',
              answer: 'Es fundamental asistir con los ojos completamente libres de maquillaje, rímel y sombras, y sin cremas en el contorno de ojos para garantizar la máxima adherencia y duración.'
            },
            {
              id: 'faq_4',
              question: '¿Cómo se confirma el turno en el estudio?',
              answer: 'El turno se reserva formalmente mediante transferencia bancaria de una seña. Una vez recibida, te enviamos la confirmación del horario y la dirección exacta en Zona Htal. Penna - Villa Cerrito.'
            }
          ]
        }
      };
    }

    _mergeSiteContent(baseObj, overrideObj) {
      const defaults = baseObj || this.getDefaultSiteContent();
      if (!overrideObj || typeof overrideObj !== 'object') return defaults;
      return {
        ...defaults,
        ...overrideObj,
        services: Array.isArray(overrideObj.services) && overrideObj.services.length > 0 ? overrideObj.services : defaults.services,
        promosSection: {
          ...defaults.promosSection,
          ...(overrideObj.promosSection || {}),
          items: Array.isArray(overrideObj.promosSection?.items) ? overrideObj.promosSection.items : defaults.promosSection.items
        },
        coursesSection: {
          ...defaults.coursesSection,
          ...(overrideObj.coursesSection || {}),
          trustBadges: Array.isArray(overrideObj.coursesSection?.trustBadges) ? overrideObj.coursesSection.trustBadges : defaults.coursesSection.trustBadges,
          courses: Array.isArray(overrideObj.coursesSection?.courses) ? overrideObj.coursesSection.courses : defaults.coursesSection.courses
        },
        hero: {
          ...defaults.hero,
          ...(overrideObj.hero || {}),
          guarantees: Array.isArray(overrideObj.hero?.guarantees) ? overrideObj.hero.guarantees : defaults.hero.guarantees,
          styles: Array.isArray(overrideObj.hero?.styles) && overrideObj.hero.styles.length > 0 ? overrideObj.hero.styles : defaults.hero.styles
        },
        servicesSection: { ...defaults.servicesSection, ...(overrideObj.servicesSection || {}) },
        gallerySection: { ...defaults.gallerySection, ...(overrideObj.gallerySection || {}) },
        about: {
          ...defaults.about,
          ...(overrideObj.about || {}),
          specialties: Array.isArray(overrideObj.about?.specialties) ? overrideObj.about.specialties : defaults.about.specialties
        },
        bookingSection: {
          ...defaults.bookingSection,
          ...(overrideObj.bookingSection || {}),
          features: Array.isArray(overrideObj.bookingSection?.features) ? overrideObj.bookingSection.features : defaults.bookingSection.features
        },
        location: { ...defaults.location, ...(overrideObj.location || {}) },
        faqs: {
          ...defaults.faqs,
          ...(overrideObj.faqs || {}),
          items: Array.isArray(overrideObj.faqs?.items) ? overrideObj.faqs.items : defaults.faqs.items
        }
      };
    }

    _loadLocalSiteContent() {
      const defaults = this.getDefaultSiteContent();
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.SITE_CONTENT);
        if (raw) {
          const parsed = JSON.parse(raw);
          return this._mergeSiteContent(defaults, parsed);
        }
      } catch (e) {}
      return defaults;
    }

    _saveLocalSiteContent(contentObj) {
      try {
        localStorage.setItem(STORAGE_KEYS.SITE_CONTENT, JSON.stringify(contentObj));
      } catch (e) {}
    }

    async getSiteContent(forceRefresh = false) {
      await this.init();
      if (!forceRefresh && this._cachedSiteContent) {
        return this._cachedSiteContent;
      }

      const defaults = this.getDefaultSiteContent();

      // 1. Intentar desde el servidor Node (/api/site-content)
      try {
        const res = await this._apiFetch('/api/site-content');
        if (res && res.ok) {
          const data = await res.json();
          if (data && data.content) {
            const merged = this._mergeSiteContent(defaults, data.content);
            this._cachedSiteContent = merged;
            this._saveLocalSiteContent(merged);
            return merged;
          }
        }
      } catch (e) {}

      // 2. Intentar directamente en Supabase (tabla settings, key='site_content')
      if (this.config.isConfigured) {
        try {
          const res = await fetch(`${this.config.supabaseUrl}/rest/v1/settings?key=eq.site_content&select=value`, {
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this.config.supabaseAnonKey}`
            }
          });
          if (res.ok) {
            const rows = await res.json();
            if (Array.isArray(rows) && rows[0] && rows[0].value && typeof rows[0].value === 'object') {
              const merged = this._mergeSiteContent(defaults, rows[0].value);
              this._cachedSiteContent = merged;
              this._saveLocalSiteContent(merged);
              return merged;
            }
          }
        } catch (e) {
          console.warn('Error leyendo site_content en Supabase:', e);
        }
      }

      // 3. Intentar leer site-content.json estático si no hay localStorage previo
      try {
        const hasLocal = localStorage.getItem(STORAGE_KEYS.SITE_CONTENT);
        if (hasLocal) {
          const localMerged = this._loadLocalSiteContent();
          this._cachedSiteContent = localMerged;
          return localMerged;
        }
        const staticRes = await fetch('site-content.json').catch(() => null);
        if (staticRes && staticRes.ok) {
          const staticJson = await staticRes.json().catch(() => null);
          if (staticJson) {
            const merged = this._mergeSiteContent(defaults, staticJson);
            this._cachedSiteContent = merged;
            this._saveLocalSiteContent(merged);
            return merged;
          }
        }
      } catch (e) {}

      const fallback = this._loadLocalSiteContent();
      this._cachedSiteContent = fallback;
      return fallback;
    }

    async saveSiteContent(partialOrFullContent) {
      await this.init();
      const current = await this.getSiteContent(false);
      const merged = this._mergeSiteContent(current, partialOrFullContent);
      merged.updatedAt = new Date().toISOString();

      this._cachedSiteContent = merged;
      this._saveLocalSiteContent(merged);

      // 1. Guardar en el servidor Node si está activo
      try {
        const res = await this._apiFetch('/api/site-content', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: merged })
        });
        if (res && res.ok) {
          const data = await res.json();
          if (data && data.content) {
            this._cachedSiteContent = data.content;
            this._saveLocalSiteContent(data.content);
            return { success: true, content: data.content, mode: 'backend' };
          }
        }
      } catch (e) {
        console.warn('Aviso guardando site-content en servidor local:', e);
      }

      // 2. Guardar directamente en Supabase REST (para GitHub Pages / modo cloud directo)
      if (this.config.isConfigured) {
        await this._refreshSessionIfNeeded();
        const bearer = this._getAuthBearer();
        try {
          const res = await fetch(`${this.config.supabaseUrl}/rest/v1/settings?on_conflict=key`, {
            method: 'POST',
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${bearer}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=representation'
            },
            body: JSON.stringify({
              key: 'site_content',
              value: merged,
              description: 'Contenido editable completo del sitio web, precios, cursos, promos y secciones'
            })
          });
          if (!res.ok) {
            const errTxt = await res.text().catch(() => '');
            console.warn('Aviso guardando settings.site_content en Supabase:', errTxt);
          }

          // Sincronizar también la tabla services si se actualizaron servicios (para integridad de foreign keys en appointments)
          if (Array.isArray(partialOrFullContent.services) && merged.services.length > 0) {
            const mapCat = (c) => {
              const lc = String(c || '').toLowerCase();
              if (lc === 'lifting') return 'lifting';
              if (lc === 'cejas') return 'cejas';
              if (lc === 'combo') return 'combo';
              return 'extensiones';
            };
            const serviceRows = merged.services.map((s, idx) => {
              const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s.id || ''))
                ? s.id
                : (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `22222222-2222-2222-2222-${String(Date.now() + idx).slice(-12).padStart(12, '0')}`);
              s.id = validUuid;
              const slugBase = String(s.slug || s.name || `servicio-${idx + 1}`)
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '') || `servicio-${idx + 1}`;
              return {
                id: validUuid,
                name: s.name || 'Servicio',
                slug: `${slugBase}-${validUuid.slice(-4)}`,
                badge: s.badge || '',
                description: s.desc || s.description || '',
                duration_minutes: Number(s.duration || s.duration_minutes) || 90,
                price_ars: Number(s.price) || 0,
                deposit_ars: Number(s.deposit) || this.calcDeposit(s.price || 0),
                icon: s.icon || '✨',
                category: mapCat(s.category),
                is_active: s.isActive !== false,
                sort_order: Number(s.sortOrder) || (idx + 1)
              };
            });
            await fetch(`${this.config.supabaseUrl}/rest/v1/services?on_conflict=id`, {
              method: 'POST',
              headers: {
                apikey: this.config.supabaseAnonKey,
                Authorization: `Bearer ${bearer}`,
                'Content-Type': 'application/json',
                Prefer: 'resolution=merge-duplicates'
              },
              body: JSON.stringify(serviceRows)
            }).catch(() => {});
          }
        } catch (e) {
          console.warn('Error sincronizando site_content en Supabase:', e);
        }
      }

      return { success: true, content: merged, mode: this.config.isConfigured ? 'supabase' : 'local' };
    }

    async saveSiteSection(sectionKey, sectionValue) {
      if (!sectionKey) throw new Error('Se requiere sectionKey');
      return this.saveSiteContent({ [sectionKey]: sectionValue });
    }

    async resetSiteContent(sectionKey = null) {
      await this.init();
      const defaults = this.getDefaultSiteContent();

      try {
        const res = await this._apiFetch('/api/site-content/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: sectionKey })
        });
        if (res && res.ok) {
          const data = await res.json();
          if (data && data.content) {
            this._cachedSiteContent = data.content;
            this._saveLocalSiteContent(data.content);
            return { success: true, content: data.content };
          }
        }
      } catch (e) {}

      if (sectionKey && defaults[sectionKey] !== undefined) {
        return this.saveSiteContent({ [sectionKey]: defaults[sectionKey] });
      }
      this._cachedSiteContent = defaults;
      this._saveLocalSiteContent(defaults);
      return this.saveSiteContent(defaults);
    }
  }

  // Exportar instancia global única
  window.MicaBackend = new MicaBackendManager();

  // Auto-inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.MicaBackend.init());
  } else {
    window.MicaBackend.init();
  }

})(window);
