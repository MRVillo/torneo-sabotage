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
5. Si una reserva pasa las *horas de reserva* sin pagar, el panel la marca en rojo. **Anular / liberar cupo** suelta el cupo, y **Darle cupo** sube a alguien de la lista de espera.
6. El nombre del equipo no se repite (lo valida la base de datos). Los clubes y selecciones sí se pueden repetir; solo se rechaza el Equipo de Estrellas.

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

## Torneo en vivo (día del torneo)

- **Página pública:** `en-vivo.html` (solo lectura, se actualiza sola cada 8 segundos). Muestra qué se juega en cada estación, las tablas de grupos, todos los partidos y el cuadro final.
- **Panel → pestaña "Torneo en vivo":**
  1. **Hacer sorteo:** reparte al azar las parejas confirmadas en 4 grupos y arma los 24 partidos repartidos en las 3 estaciones por turnos.
  2. **Publicar en vivo:** activa la página pública (antes de eso muestra "se publica el día del torneo").
  3. **Partidos de grupos:** ▶ Iniciar → escribir goles → Guardar marcador (se ve en vivo) → ✓ Finalizar. "Corregir" reabre un resultado.
  4. **Tablas:** posiciones automáticas (puntos, diferencia de gol, goles a favor, resultado directo). El campo "Des." sirve para desempatar a mano tras penales.
  5. **Eliminatoria:** "Generar eliminatoria" arma cuartos (1A-2B, 1B-2A, 1C-2D, 1D-2C). Al finalizar cada partido el ganador pasa solo a semis/final y los perdedores de semis al 3er lugar. Si empatan, pide penales.
- **Practicar sin tocar datos reales:** abre `admin.html?demo=1` (clave demo en `config.js`) y `en-vivo.html?demo=1`.
