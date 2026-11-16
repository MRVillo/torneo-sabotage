/* Capa de datos: Supabase (producción) o navegador (modo demo).
   Ambas exponen la misma API: window.Store */
(function () {
  const C = window.SABOTAGE_CONFIG;
  const ACTIVOS = ["pendiente", "revision", "confirmado"];
  const norm = (s) => (s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const soloDigitos = (s) => (s || "").replace(/\D/g, "");

  /* ---------- utilidades de imagen ---------- */
  function cargarImagen(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("No pudimos leer la imagen. Usa JPG o PNG.")); };
      img.src = url;
    });
  }
  // Logos: si vienen en PNG/WebP se conserva la transparencia
  const esTransparente = (file) => /png|webp|gif/.test(file && file.type);
  async function comprimir(file, maxLado = 1200, calidad = 0.82, png = false) {
    if (!file) return null;
    if (!/^image\//.test(file.type)) throw new Error("El archivo debe ser una imagen (JPG o PNG).");
    if (file.size > 15 * 1024 * 1024) throw new Error("La imagen pesa más de 15 MB.");
    const img = await cargarImagen(file);
    const k = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    const ctx = c.getContext("2d");
    if (!png) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return new Promise((res) => c.toBlob((b) => res(b), png ? "image/png" : "image/jpeg", calidad));
  }
  const aDataURL = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });

  function validar(d) {
    const nombre = (d.nombre_equipo || "").trim();
    const club = (d.club || "").trim();
    if (nombre.length < 2 || nombre.length > 40) throw new Error("El nombre del equipo debe tener entre 2 y 40 caracteres.");
    if (club.length < 2 || club.length > 40) throw new Error("Escribe el club que van a usar.");
    if ((d.jugador1 || "").trim().length < 3 || (d.jugador2 || "").trim().length < 3) throw new Error("Escribe el nombre de los dos jugadores.");
    if (soloDigitos(d.telefono).length < 10) throw new Error("El WhatsApp debe tener 10 dígitos.");
  }

  /* =================== MODO DEMO =================== */
  const LS = "sabotage_parejas_demo_v1";
  function leer() { try { return JSON.parse(localStorage.getItem(LS)); } catch (e) { return null; } }
  function guardar(s) {
    try { localStorage.setItem(LS, JSON.stringify(s)); }
    catch (e) { throw new Error("Modo demo: el navegador se quedó sin espacio para más fotos."); }
  }
  function estado() {
    let s = leer();
    if (!s) { s = { config: { ...C.configInicial }, parejas: [] }; guardar(s); }
    return s;
  }
  const codigo = () => "SB-" + Math.random().toString(36).slice(2, 7).toUpperCase();
  const hoyBogota = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);

  const demo = {
    modo: "demo",
    async getConfig() { return estado().config; },
    async getInscritos() {
      return estado().parejas
        .filter((p) => p.estado !== "rechazado")
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map(({ id, nombre_equipo, club, foto_path, estado, created_at, grupo, desempate }) => ({ id, nombre_equipo, club, foto_url: foto_path, estado, created_at, grupo: grupo || null, desempate: desempate || 0 }));
    },
    /* ---- torneo en vivo ---- */
    async getPartidos() { return (estado().partidos || []).slice().sort((a, b) => a.orden - b.orden); },
    async crearPartidos(rows) {
      const s = estado(); s.partidos = s.partidos || [];
      rows.forEach((r) => s.partidos.push({ pen_local: null, pen_visitante: null, goles_local: null, goles_visitante: null, ...r, id: crypto.randomUUID(), updated_at: new Date().toISOString() }));
      guardar(s);
    },
    async actualizarPartido(id, patch) {
      const s = estado(); const m = (s.partidos || []).find((x) => x.id === id);
      if (!m) throw new Error("No existe ese partido.");
      Object.assign(m, patch, { updated_at: new Date().toISOString() }); guardar(s); return m;
    },
    async borrarPartidos(fases) {
      const s = estado(); s.partidos = (s.partidos || []).filter((m) => !fases.includes(m.fase));
      if (fases.includes("grupos")) s.parejas.forEach((p) => { p.grupo = null; p.desempate = 0; });
      guardar(s);
    },
    async asignarGrupos(mapa) {
      const s = estado(); s.parejas.forEach((p) => { p.grupo = mapa[p.id] || null; }); guardar(s);
    },
    async registrar(d) {
      validar(d);
      const s = estado(), cfg = s.config;
      if (!cfg.inscripciones_abiertas) throw new Error("Las inscripciones están cerradas.");
      if (cfg.fecha_limite && hoyBogota() > cfg.fecha_limite) throw new Error("Ya pasó la fecha límite de inscripción.");
      const vivos = s.parejas.filter((p) => p.estado !== "rechazado");
      if (vivos.some((p) => norm(p.club) === norm(d.club))) throw new Error(`El club "${d.club}" ya lo eligió otra pareja. Escoge otro.`);
      if (vivos.some((p) => norm(p.nombre_equipo) === norm(d.nombre_equipo))) throw new Error("Ya hay una pareja con ese nombre.");
      const ocupados = s.parejas.filter((p) => ACTIVOS.includes(p.estado)).length;
      const foto = d.foto ? await aDataURL(await comprimir(d.foto, 360, 0.8, esTransparente(d.foto))) : null;
      const comp = d.comprobante ? await aDataURL(await comprimir(d.comprobante, 900, 0.7)) : null;
      const est = ocupados >= cfg.cupos ? "espera" : comp ? "revision" : "pendiente";
      const p = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        codigo: codigo(),
        nombre_equipo: d.nombre_equipo.trim(), club: d.club.trim(),
        jugador1: d.jugador1.trim(), jugador2: d.jugador2.trim(),
        telefono: soloDigitos(d.telefono), telefono2: soloDigitos(d.telefono2) || null,
        foto_path: foto, comprobante_path: comp, estado: est, notas: "",
        created_at: new Date().toISOString(), pagado_at: null,
      };
      s.parejas.push(p); guardar(s);
      return { codigo: p.codigo, estado: est };
    },
    async consultar(cod, tel) {
      const p = estado().parejas.find((x) => x.codigo === (cod || "").trim().toUpperCase() && x.telefono === soloDigitos(tel));
      if (!p) throw new Error("No encontramos una inscripción con ese código y WhatsApp.");
      return { nombre_equipo: p.nombre_equipo, club: p.club, estado: p.estado, tiene_comprobante: !!p.comprobante_path };
    },
    async subirComprobante(cod, tel, file) {
      const s = estado();
      const p = s.parejas.find((x) => x.codigo === (cod || "").trim().toUpperCase() && x.telefono === soloDigitos(tel));
      if (!p) throw new Error("No encontramos una inscripción con ese código y WhatsApp.");
      if (p.estado === "rechazado") throw new Error("Esta inscripción fue anulada. Escríbenos por WhatsApp.");
      p.comprobante_path = await aDataURL(await comprimir(file, 900, 0.7));
      if (p.estado === "pendiente") p.estado = "revision";
      guardar(s);
      return { estado: p.estado };
    },
    /* ---- admin ---- */
    async sesion() { try { return sessionStorage.getItem("sb_demo_admin") ? { email: "demo" } : null; } catch (e) { return null; } },
    async login(_email, pass) {
      if (pass !== C.demoPin) throw new Error("Clave incorrecta.");
      try { sessionStorage.setItem("sb_demo_admin", "1"); } catch (e) {}
      return { email: "demo" };
    },
    async logout() { try { sessionStorage.removeItem("sb_demo_admin"); } catch (e) {} },
    async listar() { return estado().parejas.slice().sort((a, b) => a.created_at.localeCompare(b.created_at)); },
    async actualizar(id, patch) {
      const s = estado(); const p = s.parejas.find((x) => x.id === id);
      if (!p) throw new Error("No existe esa pareja.");
      if (patch.club && s.parejas.some((x) => x.id !== id && x.estado !== "rechazado" && norm(x.club) === norm(patch.club))) throw new Error("Ese club ya lo tiene otra pareja.");
      Object.assign(p, patch); guardar(s); return p;
    },
    async eliminar(id) { const s = estado(); s.parejas = s.parejas.filter((x) => x.id !== id); guardar(s); },
    async guardarConfig(cfg) { const s = estado(); s.config = { ...s.config, ...cfg }; guardar(s); return s.config; },
    async urlComprobante(path) { return path; },
    fotoUrl(path) { return path; },
    async reiniciarDemo() { localStorage.removeItem(LS); },
  };

  /* =================== SUPABASE =================== */
  function crearSupabase() {
    const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey);
    const fotoUrl = (path) => (path ? sb.storage.from("equipos").getPublicUrl(path).data.publicUrl : null);
    const err = (e) => { throw new Error((e && (e.message || e.error_description)) || "Error de conexión. Intenta de nuevo."); };
    async function subir(bucket, blob) {
      const png = blob.type === "image/png";
      const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${png ? "png" : "jpg"}`;
      const { error } = await sb.storage.from(bucket).upload(path, blob, { contentType: png ? "image/png" : "image/jpeg", upsert: false });
      if (error) err({ message: "No se pudo subir la imagen: " + error.message });
      return path;
    }
    return {
      modo: "supabase",
      async getConfig() { const { data, error } = await sb.from("config").select("*").eq("id", 1).single(); if (error) err(error); return data; },
      async getInscritos() {
        const { data, error } = await sb.rpc("inscritos_publicos"); if (error) err(error);
        return data.map((p) => ({ ...p, foto_url: fotoUrl(p.foto_path) }));
      },
      async registrar(d) {
        validar(d);
        const foto = d.foto ? await subir("equipos", await comprimir(d.foto, 600, 0.85, esTransparente(d.foto))) : null;
        const comp = d.comprobante ? await subir("comprobantes", await comprimir(d.comprobante, 1400, 0.8)) : null;
        const { data, error } = await sb.rpc("registrar_pareja", {
          p_nombre: d.nombre_equipo.trim(), p_club: d.club.trim(),
          p_jugador1: d.jugador1.trim(), p_jugador2: d.jugador2.trim(),
          p_telefono: soloDigitos(d.telefono), p_telefono2: soloDigitos(d.telefono2) || null,
          p_foto: foto, p_comprobante: comp,
        });
        if (error) err(error);
        return data;
      },
      async consultar(cod, tel) {
        const { data, error } = await sb.rpc("consultar_pareja", { p_codigo: (cod || "").trim().toUpperCase(), p_telefono: soloDigitos(tel) });
        if (error) err(error); return data;
      },
      async subirComprobante(cod, tel, file) {
        const path = await subir("comprobantes", await comprimir(file, 1400, 0.8));
        const { data, error } = await sb.rpc("subir_comprobante", { p_codigo: (cod || "").trim().toUpperCase(), p_telefono: soloDigitos(tel), p_path: path });
        if (error) err(error); return data;
      },
      async sesion() {
        const { data } = await sb.auth.getSession();
        if (!data.session) return null;
        const { data: ok } = await sb.rpc("es_admin");
        if (!ok) { await sb.auth.signOut(); throw new Error("Este correo no está autorizado como administrador."); }
        return data.session.user;
      },
      async login(email, pass) {
        const { error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) err({ message: "Correo o contraseña incorrectos." });
        return this.sesion();
      },
      async logout() { await sb.auth.signOut(); },
      async listar() { const { data, error } = await sb.from("parejas").select("*").order("created_at"); if (error) err(error); return data; },
      async actualizar(id, patch) {
        const { data, error } = await sb.from("parejas").update(patch).eq("id", id).select().single();
        if (error) err(error.code === "23505" ? { message: "Ese club o nombre ya lo tiene otra pareja." } : error);
        return data;
      },
      async eliminar(id) {
        const { data: p } = await sb.from("parejas").select("foto_path,comprobante_path").eq("id", id).single();
        const { error } = await sb.from("parejas").delete().eq("id", id); if (error) err(error);
        if (p && p.foto_path) await sb.storage.from("equipos").remove([p.foto_path]);
        if (p && p.comprobante_path) await sb.storage.from("comprobantes").remove([p.comprobante_path]);
      },
      async guardarConfig(cfg) {
        const { data, error } = await sb.from("config").update({ ...cfg, updated_at: new Date().toISOString() }).eq("id", 1).select().single();
        if (error) err(error); return data;
      },
      /* ---- torneo en vivo ---- */
      async getPartidos() {
        const { data, error } = await sb.from("partidos").select("*").order("orden"); if (error) err(error); return data;
      },
      async crearPartidos(rows) {
        const { error } = await sb.from("partidos").insert(rows); if (error) err(error);
      },
      async actualizarPartido(id, patch) {
        const { data, error } = await sb.from("partidos").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select().single();
        if (error) err(error); return data;
      },
      async borrarPartidos(fases) {
        const { error } = await sb.from("partidos").delete().in("fase", fases); if (error) err(error);
        if (fases.includes("grupos")) {
          const r = await sb.from("parejas").update({ grupo: null, desempate: 0 }).not("grupo", "is", null); if (r.error) err(r.error);
        }
      },
      async asignarGrupos(mapa) {
        const r0 = await sb.from("parejas").update({ grupo: null }).not("grupo", "is", null); if (r0.error) err(r0.error);
        for (const g of ["A", "B", "C", "D"]) {
          const ids = Object.keys(mapa).filter((id) => mapa[id] === g);
          if (!ids.length) continue;
          const { error } = await sb.from("parejas").update({ grupo: g }).in("id", ids); if (error) err(error);
        }
      },
      async urlComprobante(path) {
        if (!path) return null;
        const { data, error } = await sb.storage.from("comprobantes").createSignedUrl(path, 3600);
        if (error) err(error); return data.signedUrl;
      },
      fotoUrl,
    };
  }

  // ?demo=1 en la URL fuerza el modo demo (para practicar sin tocar los datos reales)
  const forzarDemo = /[?&]demo=1\b/.test(location.search);
  const usarSupabase = !forzarDemo && C.supabaseUrl && C.supabaseKey && window.supabase;
  window.Store = usarSupabase ? crearSupabase() : demo;
  window.Store.ACTIVOS = ACTIVOS;
  window.Store.soloDigitos = soloDigitos;
  window.Store.ESTADOS = {
    pendiente: { txt: "Cupo reservado · falta pago", corto: "Reservado", cls: "st-pend" },
    revision: { txt: "Pago en revisión", corto: "En revisión", cls: "st-rev" },
    confirmado: { txt: "Inscripción confirmada", corto: "Confirmada", cls: "st-ok" },
    espera: { txt: "Lista de espera", corto: "En espera", cls: "st-wait" },
    rechazado: { txt: "Anulada", corto: "Anulada", cls: "st-no" },
  };
})();
