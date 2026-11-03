const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const TEMPLATES_FILE = path.join(__dirname, 'email-templates.json');
const LOGS_FILE = path.join(__dirname, 'email-logs.json');
const ENV_FILE = path.join(__dirname, '.env');

const DEFAULT_EMAIL_TEMPLATES = {
  studioName: 'Mica Lash Art',
  studioLocation: 'Zona Hospital Penna - Villa Cerrito, Bahía Blanca',
  studioWhatsapp: process.env.STUDIO_WHATSAPP || '5492914491141',
  studioInstagram: '@mica.lashart',
  notifyAdmin: true,
  booking: {
    enabled: true,
    subject: '✨ ¡Hola {{primer_nombre}}! Tu turno en Mica Lash Art quedó agendado ({{fecha}})',
    badge: '✨ RESERVA REGISTRADA',
    heading: '¡Tu lugar exclusivo ya está agendado, {{primer_nombre}}! ♡',
    intro: 'Hola {{nombre}}, ¡qué alegría recibirte en Mica Lash Art! Te enviamos el comprobante personalizado de tu cita de {{servicio}} con {{profesional}}.',
    tipsTitle: 'Indicaciones importantes antes de asistir 🎀',
    tips: '• Asistí con tus pestañas y párpados limpios, sin rímel ni maquillaje ocular.\n• Tolerancia máxima de espera: 15 minutos para respetar el turno de cada clienta.\n• Si necesitás reprogramar o cancelar, podés hacerlo desde la web con al menos 24 hs de anticipación.',
    footerNote: '¡Te esperamos para transformar tu mirada con arte, precisión y elegancia! 🩷'
  },
  cancellation: {
    enabled: true,
    subject: '🌸 Confirmación de cancelación de turno en Mica Lash Art — {{fecha}}',
    badge: '🗓️ TURNO CANCELADO',
    heading: 'Hola {{primer_nombre}}, tu turno fue cancelado',
    intro: 'Hola {{nombre}}, te confirmamos que tu turno de {{servicio}} programado para el {{fecha}} ({{hora}}) quedó cancelado y el horario fue liberado en nuestra agenda.',
    rebookMessage: 'Cuando quieras volver a agendar tu momento de belleza, podés elegir un nuevo día y horario disponible en tiempo real desde nuestra agenda online ♡',
    footerNote: 'Gracias por confiar en Mica Lash Art. ¡Esperamos verte muy pronto! ✨'
  },
  emailjs: {
    publicKey: '',
    serviceId: '',
    templateId: '',
    senderName: 'Mica Lashes',
    replyTo: 'micalashes.estudio@gmail.com',
    adminEmail: 'micalashes.estudio@gmail.com'
  }
};

let cachedTransporter = null;
let cachedTransportKey = '';
let cachedEtherealAccount = null;

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mergeTemplates(saved) {
  const src = (saved && typeof saved === 'object') ? saved : {};
  return {
    studioName: src.studioName || DEFAULT_EMAIL_TEMPLATES.studioName,
    studioLocation: src.studioLocation || DEFAULT_EMAIL_TEMPLATES.studioLocation,
    studioWhatsapp: src.studioWhatsapp || DEFAULT_EMAIL_TEMPLATES.studioWhatsapp,
    studioInstagram: src.studioInstagram || DEFAULT_EMAIL_TEMPLATES.studioInstagram,
    notifyAdmin: typeof src.notifyAdmin === 'boolean' ? src.notifyAdmin : DEFAULT_EMAIL_TEMPLATES.notifyAdmin,
    booking: {
      ...DEFAULT_EMAIL_TEMPLATES.booking,
      ...(src.booking || {})
    },
    cancellation: {
      ...DEFAULT_EMAIL_TEMPLATES.cancellation,
      ...(src.cancellation || {})
    },
    emailjs: {
      ...DEFAULT_EMAIL_TEMPLATES.emailjs,
      ...(src.emailjs || {})
    }
  };
}

function loadLocalTemplates() {
  try {
    if (fs.existsSync(TEMPLATES_FILE)) {
      return mergeTemplates(JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf-8')));
    }
  } catch (e) {
    console.warn('[Mailer] Error leyendo email-templates.json:', e.message);
  }
  return mergeTemplates(null);
}

function saveLocalTemplates(templates) {
  const merged = mergeTemplates(templates);
  try {
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Mailer] Error guardando email-templates.json:', e.message);
  }
  return merged;
}

async function getEmailTemplates(supabase) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'email_templates')
        .maybeSingle();
      if (!error && data && data.value && typeof data.value === 'object') {
        const merged = mergeTemplates(data.value);
        saveLocalTemplates(merged);
        return merged;
      }
    } catch (e) {
      console.warn('[Mailer] Error consultando email_templates en Supabase:', e.message);
    }
  }
  return loadLocalTemplates();
}

async function saveEmailTemplates(supabase, newTemplates) {
  const merged = saveLocalTemplates(newTemplates);
  if (supabase) {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'email_templates',
          value: merged,
          description: 'Plantillas personalizadas de emails de reserva y cancelación de turnos'
        }, { onConflict: 'key' });
      if (error) {
        console.warn('[Mailer] Error guardando email_templates en Supabase:', error.message);
      }
    } catch (e) {
      console.warn('[Mailer] Excepción guardando email_templates:', e.message);
    }
  }
  return merged;
}

function loadEmailLogs() {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function appendEmailLog(entry) {
  try {
    const logs = loadEmailLogs();
    logs.unshift({
      id: 'eml_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      createdAt: new Date().toISOString(),
      ...entry
    });
    const trimmed = logs.slice(0, 40);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
    return trimmed[0];
  } catch (e) {
    console.warn('[Mailer] Error registrando log de email:', e.message);
    return entry;
  }
}

function formatDateSpanishLong(dateStr) {
  if (!dateStr) return 'Fecha a confirmar';
  const parts = String(dateStr).slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return String(dateStr);
  const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  return d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function formatArsPrice(amount) {
  const num = Number(amount) || 0;
  return '$' + num.toLocaleString('es-AR');
}

function renderVarsPlain(templateStr, vars) {
  return String(templateStr || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : '';
  });
}

function renderVarsHtml(templateStr, vars) {
  const escapedTemplate = escapeHtml(templateStr || '');
  return escapedTemplate
    .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      const val = vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : '';
      return `<strong>${escapeHtml(val)}</strong>`;
    })
    .replace(/\n/g, '<br/>');
}

function buildGoogleCalendarUrl({ serviceName, date, startTime, endTime, clientName, location }) {
  if (!date || !startTime) return null;
  const cleanDate = String(date).slice(0, 10).replace(/-/g, '');
  const cleanStart = String(startTime).slice(0, 5).replace(':', '') + '00';
  let cleanEnd = '';
  if (endTime) {
    cleanEnd = String(endTime).slice(0, 5).replace(':', '') + '00';
  } else {
    const [h, m] = String(startTime).slice(0, 5).split(':').map(Number);
    const endTot = (h || 10) * 60 + (m || 0) + 90;
    cleanEnd = `${String(Math.floor(endTot / 60)).padStart(2, '0')}${String(endTot % 60).padStart(2, '0')}00`;
  }
  const text = encodeURIComponent(`Turno: ${serviceName} - Mica Lash Art`);
  const details = encodeURIComponent(`Reserva personalizada para ${clientName} en Mica Lash Art.`);
  const loc = encodeURIComponent(location || 'Zona Hospital Penna, Bahía Blanca');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${cleanDate}T${cleanStart}/${cleanDate}T${cleanEnd}&details=${details}&location=${loc}`;
}

function buildAppointmentVars(appt, templates, extra = {}) {
  const fullName = (appt.clientName || appt.client_name || appt.name || 'Clienta').trim();
  const firstName = fullName.split(/\s+/)[0] || fullName;
  const rawNotes = appt.clientNotes || appt.client_notes || appt.notes || '';
  const serviceName = appt.serviceName
    || appt.service?.name
    || appt.services?.name
    || (rawNotes.includes('Tratamiento:') ? rawNotes.split('Tratamiento:')[1].split('\n')[0].trim() : 'Tratamiento de Pestañas');

  const dateRaw = String(appt.date || appt.appointment_date || '').slice(0, 10);
  const startClean = String(appt.time || appt.start_time || '10:00').slice(0, 5);
  const endClean = appt.endTime || appt.end_time ? String(appt.endTime || appt.end_time).slice(0, 5) : '';
  const timeDisplay = endClean ? `${startClean} a ${endClean} hs` : `${startClean} hs`;
  const priceDisplay = formatArsPrice(appt.price ?? appt.price_ars ?? 0);

  // Extraer nota limpia de la clienta (sin el prefijo interno Tratamiento:)
  let cleanClientNote = rawNotes;
  if (cleanClientNote.startsWith('Tratamiento:')) {
    const lines = cleanClientNote.split('\n');
    cleanClientNote = lines.slice(1).join('\n').trim();
  }

  return {
    nombre: fullName,
    primer_nombre: firstName,
    servicio: serviceName,
    fecha: formatDateSpanishLong(dateRaw),
    fecha_iso: dateRaw,
    hora: timeDisplay,
    hora_inicio: startClean,
    hora_fin: endClean,
    precio: priceDisplay,
    profesional: 'Micaela',
    ubicacion: templates.studioLocation,
    estudio: templates.studioName,
    telefono: appt.clientPhone || appt.client_phone || appt.phone || '',
    email: appt.clientEmail || appt.client_email || appt.email || '',
    nota_clienta: cleanClientNote,
    motivo: extra.cancelReason ? String(extra.cancelReason).trim() : '',
    cancelado_por: extra.cancelledBy === 'admin' ? 'el estudio' : 'tu solicitud online'
  };
}

function buildEmailLayout({ type, templates, vars, baseUrl }) {
  const isBooking = type === 'booking';
  const cfg = isBooking ? templates.booking : templates.cancellation;
  const accentColor = isBooking ? '#ff2d85' : '#fb7185';
  const badgeBg = isBooking ? '#361028' : '#331420';
  const badgeBorder = isBooking ? '#ff3e96' : '#fb7185';

  const subject = renderVarsPlain(cfg.subject, vars);
  const headingHtml = renderVarsPlain(cfg.heading, vars);
  const introHtml = renderVarsHtml(cfg.intro, vars);
  const footerNoteHtml = renderVarsHtml(cfg.footerNote, vars);

  const safeBaseUrl = (baseUrl || process.env.PUBLIC_SITE_URL || `http://localhost:${process.env.PORT || 3456}`).replace(/\/$/, '');
  const turnosUrl = `${safeBaseUrl}/turnos.html?service=${encodeURIComponent(vars.servicio)}`;
  const calendarUrl = buildGoogleCalendarUrl({
    serviceName: vars.servicio,
    date: vars.fecha_iso,
    startTime: vars.hora_inicio,
    endTime: vars.hora_fin,
    clientName: vars.nombre,
    location: vars.ubicacion
  });
  const waClean = String(templates.studioWhatsapp || '5492914491141').replace(/\D/g, '');
  const waUrl = `https://wa.me/${waClean}`;
  const igHandle = String(templates.studioInstagram || '@mica.lashart').replace(/^@/, '');
  const igUrl = `https://instagram.com/${igHandle}`;

  const extraSectionHtml = isBooking
    ? `
      <div style="margin-top:22px;padding:18px 20px;border-radius:16px;background-color:#1c1320;border:1px solid #49233c;">
        <div style="font-size:13px;font-weight:700;color:#ffaed8;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">
          ${escapeHtml(cfg.tipsTitle || 'Indicaciones antes de asistir')}
        </div>
        <div style="font-size:13px;line-height:1.65;color:#e5d4e3;">
          ${renderVarsHtml(cfg.tips, vars)}
        </div>
      </div>
      <div style="text-align:center;margin-top:26px;">
        ${calendarUrl ? `
          <a href="${calendarUrl}" target="_blank" style="display:inline-block;padding:13px 26px;margin:4px 6px;border-radius:999px;background:linear-gradient(90deg,#ff2d85,#ff6ea7);background-color:#ff2d85;color:#ffffff;font-weight:700;font-size:13px;text-decoration:none;letter-spacing:0.4px;">
            📅 Sumar a Google Calendar
          </a>
        ` : ''}
        <a href="${safeBaseUrl}/turnos.html" target="_blank" style="display:inline-block;padding:13px 24px;margin:4px 6px;border-radius:999px;background-color:#241829;border:1px solid #ff3e96;color:#ffaed8;font-weight:700;font-size:13px;text-decoration:none;">
          Ver Mis Turnos Online
        </a>
      </div>
    `
    : `
      ${vars.motivo ? `
        <div style="margin-top:20px;padding:16px 18px;border-radius:14px;background-color:#29141e;border-left:4px solid #fb7185;color:#fecdd3;font-size:13px;line-height:1.6;">
          <strong style="color:#ffffff;display:block;margin-bottom:4px;">Mensaje del estudio:</strong>
          ${escapeHtml(vars.motivo)}
        </div>
      ` : ''}
      <div style="margin-top:20px;padding:18px 20px;border-radius:16px;background-color:#1c1320;border:1px solid #49233c;font-size:13px;line-height:1.65;color:#e5d4e3;">
        ${renderVarsHtml(cfg.rebookMessage, vars)}
      </div>
      <div style="text-align:center;margin-top:26px;">
        <a href="${turnosUrl}" target="_blank" style="display:inline-block;padding:14px 28px;border-radius:999px;background:linear-gradient(90deg,#ff2d85,#ff6ea7);background-color:#ff2d85;color:#ffffff;font-weight:700;font-size:13px;text-decoration:none;letter-spacing:0.5px;">
          ✨ Elegir un Nuevo Horario Online
        </a>
      </div>
    `;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0d0a0f;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f5edf5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0d0a0f;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background-color:#161218;border:2px solid ${badgeBorder};border-radius:24px;overflow:hidden;box-shadow:0 14px 40px rgba(255,45,133,0.18);">
          <!-- Header -->
          <tr>
            <td style="padding:28px 28px 20px;text-align:center;background:linear-gradient(180deg,#241122 0%,#161218 100%);border-bottom:1px solid #2e1e30;">
              <div style="display:inline-block;padding:6px 14px;border-radius:999px;background-color:${badgeBg};border:1px solid ${badgeBorder};color:#ffaed8;font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;">
                ${escapeHtml(cfg.badge)}
              </div>
              <div style="margin-top:14px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:0.3px;">
                ${escapeHtml(templates.studioName)} <span style="color:${accentColor};">♡</span>
              </div>
              <div style="font-size:11px;color:#d8c4d6;letter-spacing:1.5px;text-transform:uppercase;margin-top:3px;">
                Lash &amp; Brow Studio • Bahía Blanca
              </div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 12px;font-size:21px;line-height:1.35;color:#ffffff;font-weight:800;">
                ${escapeHtml(headingHtml)}
              </h1>
              <p style="margin:0 0 22px;font-size:14px;line-height:1.65;color:#e4d3e2;">
                ${introHtml}
              </p>

              <!-- Appointment Ticket Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0d0a0f;border:1px solid #3d2237;border-radius:18px;padding:18px 20px;">
                <tr>
                  <td style="padding:7px 0;border-bottom:1px solid #231824;font-size:13px;color:#b89fb6;">Clienta</td>
                  <td style="padding:7px 0;border-bottom:1px solid #231824;font-size:13px;color:#ffffff;font-weight:700;text-align:right;">${escapeHtml(vars.nombre)}</td>
                </tr>
                <tr>
                  <td style="padding:7px 0;border-bottom:1px solid #231824;font-size:13px;color:#b89fb6;">Tratamiento</td>
                  <td style="padding:7px 0;border-bottom:1px solid #231824;font-size:13px;color:#ffaed8;font-weight:700;text-align:right;">${escapeHtml(vars.servicio)}</td>
                </tr>
                <tr>
                  <td style="padding:7px 0;border-bottom:1px solid #231824;font-size:13px;color:#b89fb6;">Fecha</td>
                  <td style="padding:7px 0;border-bottom:1px solid #231824;font-size:13px;color:#ffffff;font-weight:700;text-align:right;text-transform:capitalize;">${escapeHtml(vars.fecha)}</td>
                </tr>
                <tr>
                  <td style="padding:7px 0;border-bottom:1px solid #231824;font-size:13px;color:#b89fb6;">Horario</td>
                  <td style="padding:7px 0;border-bottom:1px solid #231824;font-size:13px;color:#ffaed8;font-weight:700;text-align:right;">${escapeHtml(vars.hora)}</td>
                </tr>
                <tr>
                  <td style="padding:7px 0;border-bottom:1px solid #231824;font-size:13px;color:#b89fb6;">Especialista</td>
                  <td style="padding:7px 0;border-bottom:1px solid #231824;font-size:13px;color:#ffffff;font-weight:600;text-align:right;">${escapeHtml(vars.profesional)} (Master Artist)</td>
                </tr>
                ${isBooking ? `
                <tr>
                  <td style="padding:7px 0;border-bottom:1px solid #231824;font-size:13px;color:#b89fb6;">Inversión total</td>
                  <td style="padding:7px 0;border-bottom:1px solid #231824;font-size:14px;color:#ff6ea7;font-weight:800;text-align:right;">${escapeHtml(vars.precio)}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding:7px 0;font-size:13px;color:#b89fb6;">Ubicación</td>
                  <td style="padding:7px 0;font-size:12px;color:#e4d3e2;text-align:right;">${escapeHtml(vars.ubicacion)}</td>
                </tr>
              </table>

              ${vars.nota_clienta && isBooking ? `
                <div style="margin-top:14px;padding:12px 16px;border-radius:12px;background-color:#120d15;border:1px solid #2e1e30;font-size:12px;color:#d8c4d6;">
                  <strong style="color:#ffaed8;">Tu nota registrada:</strong> ${escapeHtml(vars.nota_clienta)}
                </div>
              ` : ''}

              ${extraSectionHtml}

              <p style="margin:26px 0 0;font-size:13px;line-height:1.6;color:#d8c4d6;text-align:center;font-style:italic;">
                ${footerNoteHtml}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 28px;background-color:#100c12;border-top:1px solid #2a1c2c;text-align:center;font-size:12px;color:#9f879d;">
              <div style="margin-bottom:8px;">
                <a href="${igUrl}" target="_blank" style="color:#ffaed8;text-decoration:none;font-weight:700;margin:0 8px;">Instagram ${escapeHtml(templates.studioInstagram)}</a>
                •
                <a href="${waUrl}" target="_blank" style="color:#25D366;text-decoration:none;font-weight:700;margin:0 8px;">WhatsApp Estudio</a>
              </div>
              <div>${escapeHtml(templates.studioName)} • ${escapeHtml(templates.studioLocation)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textLines = [
    `${templates.studioName} — ${cfg.badge}`,
    '',
    renderVarsPlain(cfg.heading, vars),
    renderVarsPlain(cfg.intro, vars),
    '',
    `• Clienta: ${vars.nombre}`,
    `• Tratamiento: ${vars.servicio}`,
    `• Fecha: ${vars.fecha}`,
    `• Horario: ${vars.hora}`,
    isBooking ? `• Inversión: ${vars.precio}` : `• Estado: Cancelado`,
    `• Ubicación: ${vars.ubicacion}`,
    vars.motivo ? `\nMotivo: ${vars.motivo}` : '',
    '',
    isBooking ? renderVarsPlain(cfg.tips, vars) : renderVarsPlain(cfg.rebookMessage, vars),
    '',
    isBooking ? `Gestionar turnos: ${safeBaseUrl}/turnos.html` : `Reprogramar turno: ${turnosUrl}`,
    '',
    renderVarsPlain(cfg.footerNote, vars)
  ].filter(Boolean).join('\n');

  return { subject, html, text: textLines };
}

function getProviderStatus(templatesOverride = null) {
  const tpl = templatesOverride || loadLocalTemplates();
  const ej = (tpl && tpl.emailjs) ? tpl.emailjs : {};
  const ejPublicKey = (ej.publicKey || process.env.EMAILJS_PUBLIC_KEY || '').trim();
  const ejServiceId = (ej.serviceId || process.env.EMAILJS_SERVICE_ID || '').trim();
  const ejTemplateId = (ej.templateId || process.env.EMAILJS_TEMPLATE_ID || '').trim();
  const ejSenderName = (ej.senderName || 'Mica Lashes').trim();
  const ejReplyTo = (ej.replyTo || process.env.SMTP_USER || 'micalashes.estudio@gmail.com').trim();

  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  const smtpUser = (process.env.SMTP_USER || ejReplyTo || 'micalashes.estudio@gmail.com').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const emailFrom = (process.env.EMAIL_FROM || `"${ejSenderName}" <${smtpUser}>`).trim();
  const adminEmail = (ej.adminEmail || process.env.ADMIN_EMAIL || smtpUser || 'micalashes.estudio@gmail.com').trim();

  const emailjsObj = {
    publicKey: ejPublicKey,
    serviceId: ejServiceId,
    templateId: ejTemplateId,
    senderName: ejSenderName,
    replyTo: ejReplyTo,
    adminEmail
  };

  if (ejPublicKey && ejServiceId && ejTemplateId) {
    return {
      configured: true,
      mode: 'emailjs',
      label: `EmailJS 24/7 Activo (${ejReplyTo})`,
      smtpHost,
      smtpPort,
      smtpUser,
      hasSmtpPass: Boolean(smtpPass),
      hasResendKey: Boolean(resendKey),
      emailFrom,
      adminEmail,
      emailjs: emailjsObj
    };
  }

  if (resendKey) {
    return {
      configured: true,
      mode: 'resend',
      label: 'Resend API Activo',
      smtpHost: '',
      smtpPort: 465,
      smtpUser: '',
      hasSmtpPass: false,
      hasResendKey: true,
      emailFrom,
      adminEmail,
      emailjs: emailjsObj
    };
  }

  if (smtpUser && smtpPass && smtpHost) {
    return {
      configured: true,
      mode: 'smtp',
      label: `SMTP Activo (${smtpUser})`,
      smtpHost,
      smtpPort,
      smtpUser,
      hasSmtpPass: true,
      hasResendKey: false,
      emailFrom,
      adminEmail,
      emailjs: emailjsObj
    };
  }

  return {
    configured: false,
    mode: 'preview',
    label: 'Falta conectar EmailJS (24/7 GitHub Pages) o Contraseña de Aplicación Gmail',
    smtpHost: smtpHost || 'smtp.gmail.com',
    smtpPort: smtpPort || 465,
    smtpUser,
    hasSmtpPass: Boolean(smtpPass),
    hasResendKey: false,
    emailFrom,
    adminEmail,
    emailjs: emailjsObj
  };
}

async function getNodemailerTransport() {
  const status = getProviderStatus();
  if (status.mode === 'smtp') {
    const key = `${status.smtpHost}:${status.smtpPort}:${status.smtpUser}:${process.env.SMTP_PASS}`;
    if (!cachedTransporter || cachedTransportKey !== key) {
      cachedTransporter = nodemailer.createTransport({
        host: status.smtpHost,
        port: status.smtpPort,
        secure: status.smtpPort === 465,
        auth: {
          user: status.smtpUser,
          pass: (process.env.SMTP_PASS || '').trim()
        }
      });
      cachedTransportKey = key;
    }
    return { transporter: cachedTransporter, mode: 'smtp', from: status.emailFrom };
  }

  // Fallback de desarrollo: cuenta temporal Ethereal para previsualizar correos reales
  if (!cachedTransporter || cachedTransportKey !== 'ethereal') {
    try {
      cachedEtherealAccount = await nodemailer.createTestAccount();
      cachedTransporter = nodemailer.createTransport({
        host: cachedEtherealAccount.smtp.host,
        port: cachedEtherealAccount.smtp.port,
        secure: cachedEtherealAccount.smtp.secure,
        auth: {
          user: cachedEtherealAccount.user,
          pass: cachedEtherealAccount.pass
        }
      });
      cachedTransportKey = 'ethereal';
    } catch (e) {
      return { transporter: null, mode: 'local_log', from: status.emailFrom };
    }
  }
  return {
    transporter: cachedTransporter,
    mode: 'preview',
    from: `"Mica Lashes" <${cachedEtherealAccount ? cachedEtherealAccount.user : 'micalashes@local'}>`
  };
}

async function dispatchRawEmail({ to, subject, html, text, vars = {}, templates = null }) {
  const status = getProviderStatus(templates);

  // Opción 0: EmailJS REST API (funciona tanto en GitHub Pages 24/7 como desde Node)
  if (status.mode === 'emailjs' && status.emailjs) {
    const ej = status.emailjs;
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost'
      },
      body: JSON.stringify({
        service_id: ej.serviceId,
        template_id: ej.templateId,
        user_id: ej.publicKey,
        template_params: {
          to_email: to,
          to_name: vars.nombre || 'Clienta',
          from_name: ej.senderName || 'Mica Lashes',
          reply_to: ej.replyTo || 'micalashes.estudio@gmail.com',
          subject,
          html_content: html,
          message: text,
          client_name: vars.nombre || '',
          first_name: vars.primer_nombre || '',
          service_name: vars.servicio || '',
          date: vars.fecha || '',
          time: vars.hora || '',
          price: vars.precio || '',
          location: vars.ubicacion || ''
        }
      })
    });
    const respText = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(respText || `EmailJS HTTP ${res.status}`);
    }
    return { sent: true, mode: 'emailjs', messageId: respText || 'ok', previewUrl: null };
  }

  // Opción 1: Resend HTTP API
  if (status.mode === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: status.emailFrom,
        to: [to],
        subject,
        html,
        text
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || `Resend HTTP ${res.status}`);
    }
    return { sent: true, mode: 'resend', messageId: data.id || null, previewUrl: null };
  }

  // Opción 2: SMTP real o Ethereal Preview con Nodemailer
  const { transporter, mode, from } = await getNodemailerTransport();
  if (!transporter) {
    return { sent: false, mode: 'local_log', messageId: null, previewUrl: null };
  }

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text
  });

  const previewUrl = mode === 'preview' ? (nodemailer.getTestMessageUrl(info) || null) : null;
  return {
    sent: mode === 'smtp',
    simulated: mode === 'preview',
    mode,
    messageId: info.messageId || null,
    previewUrl
  };
}

async function sendAppointmentEmail({ supabase, type, appointment, baseUrl, extra = {} }) {
  const recipient = String(appointment.clientEmail || appointment.client_email || appointment.email || '').trim();
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return { skipped: true, reason: 'Sin email válido de la clienta' };
  }

  const templates = await getEmailTemplates(supabase);
  const cfg = type === 'booking' ? templates.booking : templates.cancellation;
  if (cfg && cfg.enabled === false && !extra.forceSend) {
    return { skipped: true, reason: `Plantilla de ${type} desactivada` };
  }

  const vars = buildAppointmentVars(appointment, templates, extra);
  const { subject, html, text } = buildEmailLayout({ type, templates, vars, baseUrl });

  try {
    const result = await dispatchRawEmail({ to: recipient, subject, html, text, vars, templates });
    const logItem = appendEmailLog({
      type,
      to: recipient,
      clientName: vars.nombre,
      serviceName: vars.servicio,
      date: vars.fecha_iso,
      time: vars.hora,
      subject,
      mode: result.mode,
      status: result.sent ? 'sent' : 'preview',
      previewUrl: result.previewUrl || null,
      html
    });

    // Copia opcional de aviso al correo del admin si EmailJS / SMTP / Resend real está activo
    const prov = getProviderStatus(templates);
    if (
      templates.notifyAdmin &&
      prov.configured &&
      prov.adminEmail &&
      prov.adminEmail.toLowerCase() !== recipient.toLowerCase() &&
      !extra.isTest
    ) {
      const adminSubj = type === 'booking'
        ? `🔔 Nuevo turno agendado: ${vars.nombre} (${vars.fecha} - ${vars.hora_inicio} hs)`
        : `❌ Turno cancelado: ${vars.nombre} (${vars.fecha} - ${vars.hora_inicio} hs)`;
      dispatchRawEmail({ to: prov.adminEmail, subject: adminSubj, html, text, vars, templates }).catch(() => {});
    }

    return {
      success: true,
      to: recipient,
      subject,
      mode: result.mode,
      sent: Boolean(result.sent),
      simulated: Boolean(result.simulated),
      previewUrl: result.previewUrl,
      logId: logItem.id
    };
  } catch (err) {
    console.warn(`[Mailer] Error enviando email (${type}) a ${recipient}:`, err.message);
    appendEmailLog({
      type,
      to: recipient,
      clientName: vars.nombre,
      serviceName: vars.servicio,
      date: vars.fecha_iso,
      time: vars.hora,
      subject,
      mode: getProviderStatus().mode,
      status: 'error',
      error: err.message,
      html
    });
    return {
      success: false,
      to: recipient,
      error: err.message
    };
  }
}

function updateEmailEnvConfig(updates = {}) {
  const allowedKeys = [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'EMAIL_FROM',
    'ADMIN_EMAIL',
    'RESEND_API_KEY',
    'EMAILJS_PUBLIC_KEY',
    'EMAILJS_SERVICE_ID',
    'EMAILJS_TEMPLATE_ID'
  ];

  let envContent = '';
  try {
    if (fs.existsSync(ENV_FILE)) {
      envContent = fs.readFileSync(ENV_FILE, 'utf-8');
    }
  } catch (e) {}

  const lines = envContent ? envContent.split(/\r?\n/) : [];

  for (const key of allowedKeys) {
    if (updates[key] === undefined) continue;
    const val = String(updates[key]).replace(/[\r\n]/g, '').trim();
    // Si la contraseña viene enmascarada o vacía al editar sólo otros campos, conservar la existente
    if ((key === 'SMTP_PASS' || key === 'RESEND_API_KEY') && val === '••••••••') {
      continue;
    }

    process.env[key] = val;
    const lineRegex = new RegExp(`^\\s*${key}\\s*=`);
    const formattedLine = `${key}=${val}`;
    const existingIdx = lines.findIndex(l => lineRegex.test(l));
    if (existingIdx !== -1) {
      lines[existingIdx] = formattedLine;
    } else {
      lines.push(formattedLine);
    }
  }

  fs.writeFileSync(ENV_FILE, lines.join('\n').replace(/\n+$/, '\n'), 'utf-8');
  cachedTransporter = null;
  cachedTransportKey = '';
  return getProviderStatus();
}

module.exports = {
  DEFAULT_EMAIL_TEMPLATES,
  getEmailTemplates,
  saveEmailTemplates,
  getProviderStatus,
  updateEmailEnvConfig,
  loadEmailLogs,
  buildAppointmentVars,
  buildEmailLayout,
  sendAppointmentEmail
};

