/* ============================================================
   CONFIGURACIÓN DE LA PÁGINA — Torneo en Parejas Sabotage
   ------------------------------------------------------------
   1) Mientras supabaseUrl y supabaseKey estén vacíos, la página
      funciona en MODO DEMO: las inscripciones se guardan solo en
      el navegador donde se hacen (sirve para probar).
   2) Para que funcione de verdad (inscripciones de todo el mundo
      en un solo lugar) pega aquí la URL y la "publishable key"
      de tu proyecto Supabase. Ver LEEME.md.
   ============================================================ */
window.SABOTAGE_CONFIG = {
  supabaseUrl: "https://esgavbotjkajvpfdvjws.supabase.co",
  supabaseKey: "sb_publishable_UerxQ1L4OmwHevSIohH3Kw_X5B_P0GG", // clave pública (se puede compartir)

  // Clave del panel admin SOLO en modo demo (con Supabase se usa correo + contraseña)
  demoPin: "sabotage2026",

  torneo: {
    nombre: "1er Torneo en Parejas",
    fechaISO: "2026-12-06T14:00:00-05:00", // Domingo 6 dic, 2:00 p.m. (hora Colombia)
    fechaTexto: "Domingo 6 de diciembre",
    horaTexto: "2:00 p.m.",
    juego: "EA SPORTS FC 27",
    consola: "PlayStation 5",
  },

  // Valores iniciales (luego se cambian desde el panel admin)
  configInicial: {
    precio: null,                 // valor por pareja en COP. null = "Por confirmar"
    cupos: 16,                    // número de parejas
    fecha_limite: "2026-12-05",   // último día para inscribirse
    inscripciones_abiertas: true,
    horas_reserva: 48,            // horas que se guarda un cupo sin pagar
    direccion: "Sabotage Bar · Montería, Córdoba",
    maps_url: "https://www.google.com/maps/search/?api=1&query=Sabotage+Bar+Monteria",
    pago_metodo: "Nequi",
    pago_numero: "",
    pago_titular: "",
  },

  // Llave Bre-B (se muestra junto al Nequi en la sección de pago). Deja llave vacía para ocultarla.
  pagoBreB: { llave: "@AAV619", entidad: "Nu", titular: "Aldair Arrieta" },

  // Foto real de una estación (opcional). Ej: "assets/estacion.jpg". Vacío = solo se muestra el diagrama.
  fotoEstacion: "",

  // WhatsApp de la organización (los mismos del flyer)
  contactos: [
    { nombre: "Aldair Arrieta", telefono: "3244665463", rol: "Inscripciones" },
    { nombre: "Jhonatan Pérez Soto", telefono: "3006584577", rol: "Inscripciones" },
    { nombre: "Erick García", telefono: "3014682086", rol: "Organizador" },
  ],

  patrocinadores: [
    { nombre: "Virge · Montajes & Estructuras", img: "assets/patrocinadores/virge.jpg" },
    { nombre: "David Rodríguez Pérez", img: "assets/patrocinadores/david-rodriguez.jpg" },
    { nombre: "Dedito Parao' Burger", img: "assets/patrocinadores/dedito-parao.jpg" },
    { nombre: "Red Kitchen", img: "assets/patrocinadores/red-kitchen.jpg" },
    { nombre: "Dr. José Jaime Sierra · Pediatra", img: "assets/patrocinadores/jose-jaime.jpg" },
    { nombre: "Muebles MT", img: "assets/patrocinadores/muebles-mt.jpg" },
    { nombre: "Buserco S.A.S.", img: "assets/patrocinadores/buserco.jpg" },
    { nombre: "Baloco Urueta · Auditores", img: "assets/patrocinadores/baloco-urueta.jpg" },
    { nombre: "Transportadora La Fe", img: "assets/patrocinadores/transportadora-la-fe.jpg" },
  ],

  clubesSugeridos: [
    "Real Madrid", "FC Barcelona", "Manchester City", "Liverpool", "Arsenal", "Chelsea",
    "Manchester United", "Tottenham", "Newcastle", "Aston Villa", "Bayern München",
    "Borussia Dortmund", "Bayer Leverkusen", "Paris Saint-Germain", "Inter", "Milan",
    "Juventus", "Napoli", "Atlético de Madrid", "Athletic Club", "Real Sociedad",
    "Benfica", "Porto", "Sporting CP", "Ajax", "PSV", "Galatasaray", "Fenerbahçe",
    "Al Nassr", "Al Hilal", "Inter Miami", "Boca Juniors", "River Plate", "Flamengo",
    "Palmeiras",
    // Selecciones
    "Brasil", "Argentina", "Colombia", "Francia", "España", "Inglaterra", "Alemania",
    "Portugal", "Países Bajos", "Italia", "Bélgica", "Croacia", "Uruguay", "México",
    "Estados Unidos", "Marruecos", "Japón",
  ],
};
