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
    PUBLISHED_SCHEDULES: 'mica_published_schedules'
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
    }

    async init() {
      if (this.initPromise) return this.initPromise;
      this.initPromise = this._loadConfigAndInit();
      return this.initPromise;
    }

    async _loadConfigAndInit() {
      try {
        // 1. Intentar cargar config desde endpoint de node /api/config
        const res = await fetch('/api/config').catch(() => null);
        if (res && res.ok) {
          const apiConfig = await res.json();
          if (apiConfig.supabaseUrl && apiConfig.supabaseAnonKey) {
            this.config.supabaseUrl = apiConfig.supabaseUrl;
            this.config.supabaseAnonKey = apiConfig.supabaseAnonKey;
            this.config.isConfigured = true;
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

        this.initialized = true;
        this._updateUIStatusBadge();
        return this.getStatus();
      } catch (e) {
        console.warn('MicaBackend init warning:', e);
        this.initialized = true;
        return this.getStatus();
      }
    }

    getStatus() {
      return {
        isConfigured: !!(this.config.supabaseUrl && this.config.supabaseAnonKey),
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
        return token;
      }
      return null;
    }

    _getAuthBearer() {
      return this._getValidJwtToken() || this.config.supabaseAnonKey;
    }

    // =========================================================================
    // SERVICIOS & DISPONIBILIDAD
    // =========================================================================
    async getServices() {
      await this.init();

      // 1. Consultar primero /api/services en el servidor backend
      try {
        const apiRes = await fetch('/api/services');
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
              Authorization: `Bearer ${this._getAuthBearer()}`
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
        const apiRes = await fetch(`/api/turnos/availability?date=${encodeURIComponent(dateStr)}`);
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
              Authorization: `Bearer ${this._getAuthBearer()}`,
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
              Authorization: `Bearer ${this._getAuthBearer()}`
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
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // Guardar siempre en local storage para disponibilidad offline inmediata
      this._saveLocalTurno(normalizedBooking);

      // 1. Enviar al servidor backend /api/turnos (persiste directo en Supabase con service_role)
      let backendReached = false;
      try {
        const apiRes = await fetch('/api/turnos', {
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
            notes: normalizedBooking.clientNotes
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
            status: 'pending'
          };

          const res = await fetch(`${this.config.supabaseUrl}/rest/v1/appointments`, {
            method: 'POST',
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this._getAuthBearer()}`,
              'Content-Type': 'application/json',
              Prefer: hasValidJwt ? 'return=representation' : 'return=minimal'
            },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            if (hasValidJwt) {
              const inserted = await res.json().catch(() => null);
              if (Array.isArray(inserted) && inserted[0]) {
                normalizedBooking.supabaseId = inserted[0].id;
              }
            } else if (generatedUuid) {
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
          const apiRes = await fetch(`/api/turnos?email=${encodeURIComponent(currentUser.email)}`);
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
        const apiRes = await fetch(`/api/turnos/${encodeURIComponent(targetId)}`, {
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
        const apiRes = await fetch(`/api/turnos?status=${filter}`);
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
        const apiRes = await fetch(`/api/turnos/${encodeURIComponent(appointmentId)}`, {
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
            body: JSON.stringify({ status: newStatus })
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

    async getGalleryPhotos() {
      await this.init();

      // 1. Intentar desde backend server /api/gallery
      try {
        const res = await fetch('/api/gallery');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.photos) && data.photos.length > 0) {
            localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify(data.photos));
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
              localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify(mapped));
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
      localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify(def));
      return def;
    }

    async addGalleryPhoto(photoData) {
      await this.init();

      // 1. Intentar backend /api/gallery
      try {
        const res = await fetch('/api/gallery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(photoData)
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.photo) {
            const current = await this.getGalleryPhotos();
            // Evitar duplicados
            if (!current.some(p => p.id === data.photo.id)) {
              current.push(data.photo);
              localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify(current));
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
              localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify(current));
              return mapped;
            }
          }
        } catch (e) {
          console.warn('Supabase addGalleryPhoto error:', e);
        }
      }

      // 3. Fallback Local
      const localPhoto = {
        id: 'photo_' + Date.now(),
        ...photoData
      };
      const current = await this.getGalleryPhotos();
      current.push(localPhoto);
      localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify(current));
      return localPhoto;
    }

    async updateGalleryPhoto(id, photoData) {
      await this.init();

      // 1. Backend /api/gallery/:id
      try {
        const res = await fetch(`/api/gallery/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(photoData)
        });
        if (res.ok) {
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

          await fetch(`${this.config.supabaseUrl}/rest/v1/gallery_photos?id=eq.${id}`, {
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
        await fetch(`/api/gallery/${id}`, { method: 'DELETE' });
      } catch (e) {
        console.warn('Backend deleteGalleryPhoto error:', e);
      }

      // 2. Supabase
      if (this.config.isConfigured) {
        try {
          await fetch(`${this.config.supabaseUrl}/rest/v1/gallery_photos?id=eq.${id}`, {
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
          const list = JSON.parse(raw).filter(p => p.id !== id);
          localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify(list));
        }
      } catch (e) {}

      return true;
    }

    async resetGalleryDefaults() {
      await this.init();
      try {
        await fetch('/api/gallery/reset', { method: 'POST' });
      } catch (e) {}

      const def = this._getDefaultGalleryPhotos();
      localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify(def));
      return def;
    }

    async uploadGalleryImage(file) {
      if (!file) throw new Error('No se seleccionó ningún archivo de imagen.');

      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = err => reject(err);
        reader.readAsDataURL(file);
      });

      try {
        const res = await fetch('/api/gallery/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            data: base64
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.url) return data.url;
        }
      } catch (e) {
        console.warn('Upload endpoint error, using data URL fallback:', e);
      }

      // Fallback a data URL Base64
      return base64;
    }

    _updateLocalGalleryItem(item) {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.GALLERY);
        if (raw) {
          const list = JSON.parse(raw);
          const idx = list.findIndex(p => p.id === item.id);
          if (idx !== -1) {
            list[idx] = { ...list[idx], ...item };
            localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify(list));
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
        const res = await fetch('/api/schedule');
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
              Authorization: `Bearer ${this._getAuthBearer()}`
            }
          });
          if (res.ok) return await res.json();
        } catch (e) {}
      }
      return [];
    }

    async saveWeeklySchedule(days) {
      await this.init();
      const res = await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'No se pudieron guardar los horarios.');
      }
      return await res.json();
    }

    async getInstagramDaySlots(dateStr, interval = '60', forceGenerate = false) {
      await this.init();
      if (!dateStr) return { slots: [], isPublished: false, isBlocked: false, noSchedule: false };

      try {
        const fg = forceGenerate ? '&forceGenerate=1' : '';
        const res = await fetch(`/api/instagram/slots?date=${encodeURIComponent(dateStr)}&interval=${encodeURIComponent(interval)}${fg}`);
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
              Authorization: `Bearer ${this._getAuthBearer()}`
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
        const res = await fetch(`/api/published-schedules?upcoming=${upcomingOnly ? 'true' : 'false'}`);
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
        const res = await fetch(`/api/published-schedules?date=${encodeURIComponent(dateStr)}`);
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
        const res = await fetch('/api/published-schedules', {
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
        const res = await fetch('/api/published-schedules/toggle', {
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
        const res = await fetch(`/api/published-schedules?date=${encodeURIComponent(dateStr)}`, {
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
    async getEmailSettings() {
      await this.init();
      const res = await fetch('/api/email/settings');
      if (!res.ok) throw new Error('No se pudo cargar la configuración de emails');
      return await res.json();
    }

    async saveEmailTemplates(templates) {
      await this.init();
      const res = await fetch('/api/email/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error guardando plantillas de email');
      return data;
    }

    async saveEmailProvider(providerConfig) {
      await this.init();
      const res = await fetch('/api/email/provider', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(providerConfig)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error guardando credenciales SMTP');
      return data;
    }

    async previewEmailTemplate(type, templates) {
      await this.init();
      const res = await fetch('/api/email/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, templates })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error generando vista previa');
      return data;
    }

    async sendTestEmail(to, type = 'booking') {
      await this.init();
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, type })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Error enviando correo de prueba');
      }
      return data;
    }

    async resendAppointmentEmail(appointmentId, type) {
      await this.init();
      const res = await fetch(`/api/turnos/${encodeURIComponent(appointmentId)}/resend-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo reenviar el correo');
      return data;
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
