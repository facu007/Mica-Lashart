/**
 * MICA LASH ART — CLIENTE SUPABASE UNIVERSAL & BACKEND BRIDGE
 * Compatible con modo Supabase en la nube y modo local / offline automático.
 */

(function (window) {
  'use strict';

  // Configuración predeterminada (se puede sobrescribir con /api/config o window.MICA_CONFIG)
  const defaultConfig = {
    supabaseUrl: '',
    supabaseAnonKey: '',
    isConfigured: false
  };

  const STORAGE_KEYS = {
    TOKEN: 'vasca_token',
    REFRESH: 'vasca_refresh',
    USER: 'mica_current_user',
    LOCAL_TURNOS: 'mica_lashart_turnos',
    LOCAL_USERS: 'mica_users_db',
    GALLERY: 'mica_gallery_photos'
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
        try {
          const authUrl = `${this.config.supabaseUrl}/auth/v1/token?grant_type=password`;
          const res = await fetch(authUrl, {
            method: 'POST',
            headers: {
              apikey: this.config.supabaseAnonKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error_description || data.msg || data.message || 'Credenciales inválidas');

          localStorage.setItem(STORAGE_KEYS.TOKEN, data.access_token);
          if (data.refresh_token) localStorage.setItem(STORAGE_KEYS.REFRESH, data.refresh_token);

          // Obtener datos del perfil o user metadata
          const fullName = data.user?.user_metadata?.full_name || data.user?.user_metadata?.name || email.split('@')[0];
          const phone = data.user?.user_metadata?.phone || '';

          const userObj = {
            id: data.user.id,
            name: fullName,
            email: data.user.email,
            phone: phone,
            role: data.user.email.includes('admin') || data.user.email.includes('mica') ? 'admin' : 'client'
          };

          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userObj));
          return { success: true, user: userObj, mode: 'supabase' };
        } catch (err) {
          console.warn('Supabase login failed, trying local storage:', err);
          return this._localLogin(email, password);
        }
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

    // =========================================================================
    // SERVICIOS & DISPONIBILIDAD
    // =========================================================================
    async getServices() {
      await this.init();

      if (this.config.isConfigured) {
        try {
          const res = await fetch(`${this.config.supabaseUrl}/rest/v1/services?is_active=eq.true&order=sort_order.asc`, {
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN) || this.config.supabaseAnonKey}`
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
      
      const allSlots = ['10:00', '11:30', '14:00', '15:30', '17:00', '18:30'];

      if (this.config.isConfigured) {
        try {
          // Consultar turnos ya reservados en Supabase para esa fecha
          const res = await fetch(`${this.config.supabaseUrl}/rest/v1/appointments?appointment_date=eq.${dateStr}&status=neq.cancelled&select=start_time`, {
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN) || this.config.supabaseAnonKey}`
            }
          });
          if (res.ok) {
            const booked = await res.json();
            const bookedTimes = booked.map(b => b.start_time.slice(0, 5));
            return allSlots.map(time => ({
              time,
              available: !bookedTimes.includes(time)
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

      return allSlots.map(time => ({
        time,
        available: !bookedLocal.includes(time)
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

      // Si Supabase está conectado, persistir en appointments
      if (this.config.isConfigured) {
        try {
          const payload = {
            professional_id: '11111111-1111-1111-1111-111111111111',
            service_id: normalizedBooking.serviceId || '22222222-2222-2222-2222-222222222202',
            appointment_date: normalizedBooking.date,
            start_time: normalizedBooking.time.length === 5 ? normalizedBooking.time + ':00' : normalizedBooking.time,
            end_time: (normalizedBooking.endTime || '16:00').slice(0, 5) + ':00',
            price_ars: normalizedBooking.price,
            client_name: normalizedBooking.clientName,
            client_phone: normalizedBooking.clientPhone,
            client_email: normalizedBooking.clientEmail,
            client_notes: normalizedBooking.clientNotes,
            status: 'pending'
          };

          const res = await fetch(`${this.config.supabaseUrl}/rest/v1/appointments`, {
            method: 'POST',
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN) || this.config.supabaseAnonKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation'
            },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            const inserted = await res.json();
            if (Array.isArray(inserted) && inserted[0]) {
              normalizedBooking.supabaseId = inserted[0].id;
              this._updateLocalTurno(normalizedBooking);
            }
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

      if (this.config.isConfigured && currentUser && currentUser.email) {
        try {
          const res = await fetch(`${this.config.supabaseUrl}/rest/v1/appointments?client_email=eq.${encodeURIComponent(currentUser.email)}&order=appointment_date.desc,start_time.asc`, {
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN) || this.config.supabaseAnonKey}`
            }
          });

          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              return data.map(row => ({
                id: row.id,
                date: row.appointment_date,
                time: row.start_time.slice(0, 5),
                endTime: row.end_time.slice(0, 5),
                price: Number(row.price_ars),
                status: row.status,
                clientName: row.client_name,
                clientPhone: row.client_phone,
                clientNotes: row.client_notes,
                professional: 'Micaela',
                service: {
                  name: row.client_notes && row.client_notes.includes('Tratamiento:') ? 'Servicio VIP' : 'Tratamiento de Pestañas',
                  price: Number(row.price_ars)
                }
              }));
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

      // Actualizar en localStorage
      const turnos = this.getStoredTurnos();
      const found = turnos.find(t => t.id === appointmentId || t.supabaseId === appointmentId);
      if (found) {
        found.status = 'cancelled';
        localStorage.setItem(STORAGE_KEYS.LOCAL_TURNOS, JSON.stringify(turnos));
      }

      // Si está en Supabase
      if (this.config.isConfigured) {
        try {
          await fetch(`${this.config.supabaseUrl}/rest/v1/appointments?id=eq.${appointmentId}`, {
            method: 'PATCH',
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN) || this.config.supabaseAnonKey}`,
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

      if (this.config.isConfigured) {
        try {
          let url = `${this.config.supabaseUrl}/rest/v1/appointments?order=appointment_date.desc,start_time.asc`;
          if (filter !== 'all') {
            url += `&status=eq.${filter}`;
          }

          const res = await fetch(url, {
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN) || this.config.supabaseAnonKey}`
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
              notes: r.client_notes,
              createdAt: r.created_at
            }));
          }
        } catch (e) {
          console.warn('Admin fetch error:', e);
        }
      }

      // 2. Consultar servidor backend /api/turnos si está disponible
      try {
        const apiRes = await fetch(`/api/turnos?status=${filter}`);
        if (apiRes && apiRes.ok) {
          const apiData = await apiRes.json();
          if (apiData.appointments && apiData.appointments.length > 0) {
            return apiData.appointments.map(r => ({
              id: r.id,
              date: r.appointment_date || r.date,
              time: ((r.start_time || r.time) + '').slice(0, 5),
              clientName: r.client_name || r.name || 'Clienta',
              clientPhone: r.client_phone || r.phone || '',
              clientEmail: r.client_email || r.email || '',
              price: Number(r.price_ars || r.price) || 0,
              status: r.status || 'pending',
              notes: r.client_notes || r.notes || '',
              createdAt: r.created_at
            }));
          }
        }
      } catch (e) {}

      // 3. Fallback a localStorage
      let turnos = this.getStoredTurnos();
      if (filter !== 'all') {
        turnos = turnos.filter(t => t.status === filter);
      }
      return turnos;
    }

    async updateAppointmentStatus(appointmentId, newStatus) {
      await this.init();

      const turnos = this.getStoredTurnos();
      const t = turnos.find(x => x.id === appointmentId || x.supabaseId === appointmentId);
      if (t) {
        t.status = newStatus;
        localStorage.setItem(STORAGE_KEYS.LOCAL_TURNOS, JSON.stringify(turnos));
      }

      if (this.config.isConfigured) {
        try {
          await fetch(`${this.config.supabaseUrl}/rest/v1/appointments?id=eq.${appointmentId}`, {
            method: 'PATCH',
            headers: {
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN) || this.config.supabaseAnonKey}`,
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
              Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN) || this.config.supabaseAnonKey}`,
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
              Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN) || this.config.supabaseAnonKey}`,
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
              Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN) || this.config.supabaseAnonKey}`
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
