# Página del Torneo en Parejas · Sabotage

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Página pública: info, cuenta regresiva, cupos en vivo, inscripción con foto, pago, parejas inscritas, reglamento, ganadores, patrocinadores y ubicación. |
| `admin.html` | Panel de organizadores: confirmar pagos, ver comprobantes, lista de espera, anular/liberar cupos, notas, WhatsApp directo, descargar CSV y cambiar precio, cupos, datos de pago y dirección. |
| `config.js` | Datos que casi no cambian: fecha, WhatsApp, patrocinadores y clubes sugeridos. |
| `supabase/setup.sql` | Crea la base de datos (tablas, seguridad, control de cupos y almacenamiento de fotos). |

## Cómo funcionan los cupos

1. La pareja se inscribe → recibe un **código** (ej. `SB-4K2QX`) y su cupo queda **Reservado** (falta pago).
2. Si sube el comprobante → queda **En revisión**.
3. Un organizador revisa en `admin.html` y pulsa **✓ Pago confirmado** → queda **Confirmada**.
4. Cupos ocupados = reservadas + en revisión + confirmadas. Si están llenos, la inscripción entra a **Lista de espera**.
5. Si una reserva pasa las *horas de reserva* sin pagar, el panel la marca en rojo. **Anular / liberar cupo** suelta el cupo y el club, y **Darle cupo** sube a alguien de la lista de espera.
6. Ningún club ni nombre de equipo se repite (lo valida la base de datos).

## Estado actual

**Conectada a Supabase** (proyecto `esgavbotjkajvpfdvjws`, ya con tablas, cupos y almacenamiento de fotos). Los pasos 1 y 2 de abajo ya están hechos; faltan el 3, 4 y 5 (admins) y publicar.

Si vacías `supabaseUrl` en `config.js`, la página vuelve a modo demo (todo se guarda solo en el navegador; clave del panel = `demoPin`).

## Ponerla en línea de verdad

### 1. Base de datos (Supabase, gratis)
1. Crea un proyecto en https://supabase.com (plan Free).
2. **SQL Editor → New query**: pega todo `supabase/setup.sql` y dale **Run**.
3. Agrega los correos de los organizadores:
   ```sql
   insert into public.admins (email) values ('correo-del-organizador@gmail.com');
   ```
4. **Authentication → Users → Add user**: crea ese mismo correo con una contraseña.
5. **Authentication → Sign In / Providers**: desactiva *Allow new users to sign up* (así nadie más crea cuentas).
6. **Project Settings → API**: copia la *Project URL* y la *publishable key* (o *anon key*) en `config.js`:
   ```js
   supabaseUrl: "https://xxxx.supabase.co",
   supabaseKey: "sb_publishable_...",
   ```

### 2. Publicar la página (gratis)
- **Netlify Drop**: entra a https://app.netlify.com/drop y arrastra la carpeta `web`. Te da un link para compartir.
- O GitHub Pages / Vercel con la misma carpeta.

### 3. Antes de compartir el link
En `admin.html` completa: **valor por pareja**, **cupos**, **número de Nequi y titular**, **dirección exacta** y **link de Google Maps** del bar.

## Probar en tu computador
```bash
python -m http.server 8080 --directory web
```
Abre http://localhost:8080 (página) y http://localhost:8080/admin.html (panel).
