# 🚀 Guía de Configuración del Backend Supabase — Mica Lash Art

Este proyecto cuenta con un **backend completo y funcional para Supabase**, listo para producción. Incluye base de datos PostgreSQL, autenticación de clientas, gestión de turnos en tiempo real, inscripciones a cursos y panel de administración.

---

## 📋 Pasos para Conectar tu Base de Datos en Supabase

### 1. Crear Proyecto Gratuito en Supabase
1. Ingresá en [supabase.com](https://supabase.com) e iniciá sesión con tu cuenta de GitHub o email.
2. Hacé clic en **"New Project"**.
3. Elegí un nombre para tu proyecto (ej. `mica-lashart`) y definí una contraseña segura para la base de datos.
4. Seleccioná la región más cercana (ej. `South America (São Paulo)`).

---

### 2. Ejecutar el Script de la Base de Datos
1. En el menú lateral izquierdo de tu proyecto en Supabase, hacé clic en el ícono de **SQL Editor** (o visitá `https://supabase.com/dashboard/project/_/sql`).
2. Hacé clic en **"New query"**.
3. Abrí el archivo [`supabase-schema.sql`](file:///C:/Users/PC/.gemini/antigravity-ide/scratch/mica-lashart/supabase-schema.sql) de este proyecto, copiá todo su contenido y pegalo en el editor.
4. Presioná el botón verde **"Run"** (Ejecutar).

> **¿Qué crea este script automáticamente?**
> * ✅ **Tabla `services`:** Los 6 tratamientos oficiales con precios en ARS, duraciones y fotos.
> * ✅ **Tabla `professionals`:** Perfil de Micaela (Master Lash Artist).
> * ✅ **Tabla `weekly_schedule`:** Horarios de atención de lunes a sábado de 10:00 a 19:00 hs.
> * ✅ **Tabla `appointments`:** Turnos con fecha, hora, estado, seña y cliente.
> * ✅ **Tabla `courses` & `course_enrollments`:** Los 3 cursos oficiales y registro de alumnas.
> * ✅ **Tabla `profiles` & `clients`:** Vinculación con Supabase Auth y directorio de clientas.
> * ✅ **Triggers y Políticas RLS:** Seguridad completa para que las clientas vean solo sus turnos y la administradora tenga control total.

---

### 3. Configurar tus Claves de Entorno
1. En Supabase, andá a **Project Settings** (ícono de engranaje ⚙️) > **API**.
2. Copiá dos valores:
   * **Project URL** (ejemplo: `https://abcdefghijklm.supabase.co`)
   * **Project API keys: `anon` / `public`** (clave larga que comienza con `ey...`)
3. Abrí el archivo [`.env`](file:///C:/Users/PC/.gemini/antigravity-ide/scratch/mica-lashart/.env) en este proyecto y pegá tus valores:

```env
PORT=3456
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=
STUDIO_WHATSAPP=5492914491141
ADMIN_EMAIL=micaela@lashart.com
```

---

### 4. Iniciar el Servidor y Probar la Conexión
1. Reiniciá el servidor ejecutando en tu terminal:
   ```bash
   node server.js
   ```
2. Abrí en tu navegador:
   * **Página Principal:** [http://localhost:3456](http://localhost:3456)
   * **Pedir Turno Online:** [http://localhost:3456/turnos.html](http://localhost:3456/turnos.html)
   * **Iniciar Sesión:** [http://localhost:3456/login.html](http://localhost:3456/login.html)
   * **Panel Administrador VIP:** [http://localhost:3456/admin.html](http://localhost:3456/admin.html)
   * **Chequeo de Salud del Backend:** [http://localhost:3456/api/health](http://localhost:3456/api/health)

---

## 🛠️ Endpoints de la API Backend Disponibles

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/health` | Estado del backend y verificación de conexión con Supabase. |
| `GET` | `/api/config` | Configuración pública del estudio y estado de Supabase. |
| `GET` | `/api/services` | Catálogo de tratamientos activos desde Supabase. |
| `GET` | `/api/turnos/availability?date=YYYY-MM-DD` | Franjas horarias disponibles para una fecha específica (excluye horarios ya reservados). |
| `POST` | `/api/turnos` | Crea una nueva reserva en la tabla `appointments`. |
| `GET` | `/api/turnos` | Lista turnos agendados (filtrables por email o estado). |
| `PATCH` | `/api/turnos/:id` | Modifica el estado de un turno (`confirmed`, `completed`, `cancelled`). |
| `POST` | `/api/courses/enroll` | Registra una inscripción de alumna a un curso. |

---

## 💡 Modo Local / Demo Automático
Si aún no configuraste las credenciales en `.env`, el sistema **no se rompe**: entra automáticamente en **Modo Local / Demo**, guardando los turnos y usuarios de prueba de manera transparente en el navegador. En cuanto cargues tu URL y clave de Supabase, cambiará de inmediato a **Modo Supabase Conectado**.
