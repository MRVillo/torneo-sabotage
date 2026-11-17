(function () {
  const C = window.SABOTAGE_CONFIG;
  const S = window.Store;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cop = (n) => "$" + Number(n).toLocaleString("es-CO");
  const fmtTel = (t) => String(t).replace(/(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3");
  const wa = (tel, msg) => `https://wa.me/57${tel}?text=${encodeURIComponent(msg)}`;
  const contactoPrincipal = C.contactos[0];

  let cfg = { ...C.configInicial };
  let inscritos = [];

  /* ---------------- cuenta regresiva ---------------- */
  const objetivo = new Date(C.torneo.fechaISO).getTime();
  function tick() {
    let d = Math.max(0, objetivo - Date.now());
    const u = { d: Math.floor(d / 864e5), h: Math.floor(d / 36e5) % 24, m: Math.floor(d / 6e4) % 60, s: Math.floor(d / 1e3) % 60 };
    for (const k in u) { const el = $(`[data-u="${k}"]`); if (el) el.textContent = String(u[k]).padStart(2, "0"); }
  }
  tick(); setInterval(tick, 1000);

  /* ---------------- config en pantalla ---------------- */
  function pintarConfig() {
    const precio = cfg.precio ? cop(cfg.precio) : null;
    const ph = $("#precioHero");
    ph.textContent = precio || "Por confirmar";
    ph.classList.toggle("tbd", !precio);
    $("#precioInfo").innerHTML = (precio || "Por confirmar") + "<small>Valor por pareja</small>";
    $("#horasReserva").textContent = cfg.horas_reserva || 48;

    const dir = cfg.direccion || "Sabotage Bar · Montería";
    $("#direccionTxt").textContent = dir;
    const partes = dir.split("·").map((s) => s.trim());
    $("#lugarInfo").innerHTML = esc(partes[0] || "Sabotage Bar") + "<small>" + esc(partes.slice(1).join(" · ") || "Montería, Córdoba") + "</small>";
    $("#mapsBtn").href = cfg.maps_url || "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(dir);
    const mf = $("#mapFrame"), q = "https://maps.google.com/maps?q=" + encodeURIComponent(dir.replace("·", ",")) + "&z=15&output=embed";
    if (mf.getAttribute("src") !== q) mf.src = q;

    // pago
    if (precio && cfg.pago_numero) {
      $("#payHint").textContent = `Valor por pareja: ${precio}. Transfiere y sube el comprobante, o envíalo por WhatsApp con tu código.`;
      $("#payBox").hidden = false;
      $("#payMetodo").textContent = cfg.pago_metodo || "Nequi";
      $("#payNumero").textContent = fmtTel(cfg.pago_numero);
      $("#payTitular").textContent = cfg.pago_titular ? "A nombre de " + cfg.pago_titular : "";
    } else if (precio) {
      $("#payHint").textContent = `Valor por pareja: ${precio}. Escríbenos por WhatsApp para recibir los datos de pago.`;
      $("#payBox").hidden = true;
    } else {
      $("#payHint").textContent = "El valor de la inscripción por pareja se anunciará pronto. Puedes separar tu cupo desde ya.";
      $("#payBox").hidden = true;
    }
    const bre = (window.SABOTAGE_CONFIG || {}).pagoBreB || {};
    const hayBre = !!(precio && bre.llave);
    $("#payBreB").hidden = !hayBre;
    if (hayBre) {
      $("#breLlave").textContent = bre.llave;
      $("#copyBre").dataset.copy = bre.llave;
      $("#breEntidad").textContent = bre.entidad ? "· " + bre.entidad : "";
      $("#breTitular").textContent = (bre.titular ? "A nombre de " + bre.titular + " · " : "") + "desde cualquier banco o billetera.";
      if (!cfg.pago_numero) $("#payHint").textContent = `Valor por pareja: ${precio}. Transfiere y sube el comprobante, o envíalo por WhatsApp con tu código.`;
    }
    $("#waPagar").href = wa(contactoPrincipal.telefono, "Hola, envío el comprobante de pago del Torneo en Parejas Sabotage. Mi código es: ");
  }

  /* ---------------- cupos ---------------- */
  function pintarCupos() {
    const total = Number(cfg.cupos) || 0;
    const ok = inscritos.filter((p) => p.estado === "confirmado").length;
    const res = inscritos.filter((p) => p.estado === "pendiente" || p.estado === "revision").length;
    const libres = Math.max(0, total - ok - res);
    const espera = inscritos.filter((p) => p.estado === "espera").length;
    $("#cuposLibres").textContent = libres;
    $("#cuposTxt").textContent = libres === 1 ? "disponible" : "disponibles";
    $("#nOk").textContent = ok; $("#nRes").textContent = res; $("#nTot").textContent = total;
    $("#mOk").style.width = total ? (ok / total) * 100 + "%" : 0;
    $("#mRes").style.width = total ? (Math.min(res, total - ok) / total) * 100 + "%" : 0;
    $("#meter").setAttribute("aria-label", `${ok} confirmadas y ${res} reservadas de ${total} cupos`);

    const form = $("#regForm");
    if (!form) return; // ya se mostró el ticket de inscripción
    const abiertas = cfg.inscripciones_abiertas && !(cfg.fecha_limite && new Date(Date.now() - 5 * 36e5).toISOString().slice(0, 10) > cfg.fecha_limite);
    const hint = $("#cuposHint");
    if (!abiertas) hint.textContent = "";
    else if (libres === 0) hint.innerHTML = `<b style="color:#ff8a80">Cupos llenos.</b> Si te inscribes quedas en lista de espera${espera ? ` (hay ${espera})` : ""}.`;
    else hint.textContent = `Quedan ${libres} ${libres === 1 ? "cupo" : "cupos"}.`;

    let banner = $("#closedBanner");
    if (!abiertas) {
      if (!banner) {
        banner = document.createElement("div"); banner.id = "closedBanner"; banner.className = "closed-banner";
        banner.textContent = "Las inscripciones están cerradas. Escríbenos por WhatsApp si quieres quedar en lista de espera.";
        form.prepend(banner);
      }
      form.querySelectorAll("input,button").forEach((el) => (el.disabled = true));
    } else if (banner) {
      banner.remove(); form.querySelectorAll("input,button").forEach((el) => (el.disabled = false));
    }

    // clubes ocupados
    const usados = inscritos.map((p) => p.club);
    const t = $("#takenClubs");
    t.hidden = !usados.length;
    t.innerHTML = usados.length ? "Clubes ya elegidos: " + usados.map((c) => `<span>${esc(c)}</span>`).join("") : "";
    const libresClub = C.clubesSugeridos.filter((c) => !usados.some((u) => u.toLowerCase() === c.toLowerCase()));
    $("#clubes").innerHTML = libresClub.map((c) => `<option value="${esc(c)}">`).join("");
  }

  /* ---------------- lista de parejas ---------------- */
  function pintarParejas() {
    const box = $("#teams");
    if (!inscritos.length) {
      box.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><b>Todavía no hay parejas inscritas</b>¡Sean los primeros en entrar al cuadro!<br><br><a class="btn btn-sm" href="#inscripcion">Inscribir pareja</a></div>`;
      return;
    }
    const orden = { confirmado: 0, revision: 1, pendiente: 1, espera: 2 };
    let n = 0;
    box.innerHTML = inscritos
      .slice()
      .sort((a, b) => (orden[a.estado] - orden[b.estado]) || a.created_at.localeCompare(b.created_at))
      .map((p) => {
        const st = S.ESTADOS[p.estado] || S.ESTADOS.pendiente;
        const num = p.estado === "espera" ? "E" : ++n;
        const ini = esc((p.nombre_equipo || "?").trim().slice(0, 2).toUpperCase());
        const pic = p.foto_url
          ? `<div class="pic logo"><img src="${esc(p.foto_url)}" alt="Logo de ${esc(p.nombre_equipo)}" loading="lazy">`
          : `<div class="pic empty"><span>${ini}</span>`;
        return `<article class="team ${p.estado === "espera" ? "wait" : ""}">${pic}<span class="num">${num}</span></div>
          <div class="body"><h4>${esc(p.nombre_equipo)}</h4><div class="club">${esc(p.club)}</div><span class="status-pill ${st.cls}">${st.corto}</span></div></article>`;
      })
      .join("");
  }

  async function refrescar() {
    try {
      const [c, l] = await Promise.all([S.getConfig(), S.getInscritos()]);
      if (c) cfg = c;
      inscritos = l || [];
    } catch (e) { console.warn(e); }
    pintarConfig(); pintarCupos(); pintarParejas();
  }

  /* ---------------- subida de fotos (preview + drag) ---------------- */
  function prepararDrop(dropId, inputId, thumbId, txtId, textoOk) {
    const drop = $(dropId), input = $(inputId), thumb = $(thumbId), txt = $(txtId);
    const original = txt.textContent;
    function mostrar(file) {
      if (!file) { drop.classList.remove("has"); thumb.style.backgroundImage = ""; txt.textContent = original; return; }
      const url = URL.createObjectURL(file);
      thumb.style.backgroundImage = `url('${url}')`; drop.classList.add("has"); txt.textContent = textoOk;
    }
    input.addEventListener("change", () => mostrar(input.files[0]));
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("drag"); }));
    drop.addEventListener("drop", (e) => {
      const f = e.dataTransfer.files[0]; if (!f) return;
      const dt = new DataTransfer(); dt.items.add(f); input.files = dt.files; mostrar(f);
    });
    return () => { input.value = ""; mostrar(null); };
  }
  const limpiarFoto = prepararDrop("#dropFoto", "#fFoto", "#thumbFoto", "#fotoTxt", "Logo listo ✓ (toca para cambiar)");
  const limpiarComp = prepararDrop("#dropComp", "#fComp", "#thumbComp", "#compTxt", "Comprobante listo ✓");

  /* ---------------- inscripción ---------------- */
  function msg(el, tipo, html) { el.className = "form-msg " + tipo; el.innerHTML = html; }

  $("#regForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, box = $("#formMsg"), btn = $("#btnSubmit");
    f.querySelectorAll(".bad").forEach((x) => x.classList.remove("bad"));
    const d = {
      nombre_equipo: $("#fNombre").value, club: $("#fClub").value,
      jugador1: $("#fJ1").value, jugador2: $("#fJ2").value,
      telefono: $("#fTel").value, telefono2: $("#fTel2").value,
      foto: $("#fFoto").files[0] || null, comprobante: $("#fComp").files[0] || null,
    };
    const faltan = [["#fNombre", d.nombre_equipo.trim().length >= 2], ["#fClub", d.club.trim().length >= 2], ["#fJ1", d.jugador1.trim().length >= 3], ["#fJ2", d.jugador2.trim().length >= 3], ["#fTel", S.soloDigitos(d.telefono).length >= 10]]
      .filter(([, ok]) => !ok).map(([id]) => id);
    if (faltan.length) { faltan.forEach((id) => $(id).classList.add("bad")); $(faltan[0]).focus(); return msg(box, "err", "Revisa los campos marcados: nombre del equipo, club, los dos jugadores y un WhatsApp de 10 dígitos."); }
    if (!$("#fAcepto").checked) return msg(box, "err", "Deben aceptar el reglamento para inscribirse.");

    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Inscribiendo…';
    try {
      const r = await S.registrar(d);
      await refrescar();
      mostrarTicket(r, d);
    } catch (err) {
      msg(box, "err", esc(err.message));
      if (/club/i.test(err.message)) $("#fClub").classList.add("bad");
    } finally {
      btn.disabled = false; btn.textContent = "Inscribir pareja";
    }
  });

  function mostrarTicket(r, d) {
    const st = S.ESTADOS[r.estado];
    const precio = cfg.precio ? cop(cfg.precio) : null;
    const pasos = r.estado === "espera"
      ? `<li>Los cupos están llenos: quedaron de <b>lista de espera</b>.</li><li>Si se libera un cupo te escribimos al WhatsApp ${esc(fmtTel(S.soloDigitos(d.telefono)))}.</li>`
      : r.estado === "revision"
      ? `<li>Recibimos tu comprobante. La organización lo revisa y confirma tu cupo.</li><li>Guarda tu código para consultar el estado.</li>`
      : `<li>Tu cupo queda reservado por <b>${cfg.horas_reserva || 48} horas</b>.</li>
         <li>${precio ? `Paga <b>${precio}</b>${cfg.pago_numero ? ` a ${esc(cfg.pago_metodo || "Nequi")} <b>${esc(fmtTel(cfg.pago_numero))}</b>` : ""}${(window.SABOTAGE_CONFIG.pagoBreB || {}).llave ? ` o a la llave Bre-B <b>${esc(window.SABOTAGE_CONFIG.pagoBreB.llave)}</b>` : ""}.` :"El valor de la inscripción se anunciará pronto; te avisamos por WhatsApp."}</li>
         <li>Sube el comprobante con tu código en la sección «¿Ya se inscribieron?» o envíalo por WhatsApp.</li>`;
    const texto = `Hola, inscribí la pareja "${d.nombre_equipo.trim()}" (${d.club.trim()}) al Torneo en Parejas Sabotage. Código: ${r.codigo}.`;
    $("#formZone").innerHTML = `
      <div class="ticket" role="status">
        <div class="kicker">¡Pareja inscrita!</div>
        <h3 class="h-section" style="font-size:40px;margin:4px 0 10px">${esc(d.nombre_equipo)}</h3>
        <div class="hint" style="margin:0 0 4px">Tu código de inscripción</div>
        <div class="code">${esc(r.codigo)}<button class="copy" type="button" data-copy="${esc(r.codigo)}">Copiar</button></div>
        <p style="margin:12px 0 0"><span class="status-pill ${st.cls}">${st.txt}</span></p>
        <ol>${pasos}</ol>
        <div class="form-actions">
          <a class="btn btn-wa" target="_blank" rel="noopener" href="${wa(contactoPrincipal.telefono, texto)}"><svg><use href="#i-wa"/></svg>Avisar por WhatsApp</a>
          <button class="btn btn-ghost btn-sm" type="button" id="otraPareja">Inscribir otra pareja</button>
        </div>
      </div>`;
    $("#cCodigo").value = r.codigo; $("#cTel").value = S.soloDigitos(d.telefono);
    $("#formZone").scrollIntoView({ behavior: "smooth", block: "start" });
    $("#otraPareja").addEventListener("click", () => location.reload());
  }

  /* ---------------- consulta / comprobante ---------------- */
  $("#consultaForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const box = $("#consultaMsg");
    try {
      const r = await S.consultar($("#cCodigo").value, $("#cTel").value);
      const st = S.ESTADOS[r.estado];
      msg(box, "ok", `<b>${esc(r.nombre_equipo)}</b> · ${esc(r.club)}<br><span class="status-pill ${st.cls}" style="margin-top:6px">${st.txt}</span>${r.tiene_comprobante ? "<br><small>Comprobante recibido ✓</small>" : ""}`);
    } catch (err) { msg(box, "err", esc(err.message)); }
  });
  $("#cComp").addEventListener("change", async (e) => {
    const file = e.target.files[0], box = $("#consultaMsg");
    if (!file) return;
    if (!$("#cCodigo").value.trim() || S.soloDigitos($("#cTel").value).length < 10) {
      e.target.value = ""; return msg(box, "err", "Primero escribe tu código y el WhatsApp con el que te inscribiste.");
    }
    msg(box, "ok", "Subiendo comprobante…");
    try {
      const r = await S.subirComprobante($("#cCodigo").value, $("#cTel").value, file);
      msg(box, "ok", `¡Comprobante recibido! Estado: <b>${S.ESTADOS[r.estado].txt}</b>. Te avisamos cuando quede confirmado.`);
      refrescar();
    } catch (err) { msg(box, "err", esc(err.message)); }
    e.target.value = "";
  });

  /* ---------------- copiar ---------------- */
  document.addEventListener("click", async (e) => {
    const b = e.target.closest(".copy"); if (!b) return;
    const v = b.dataset.copy || S.soloDigitos($("#payNumero").textContent);
    try { await navigator.clipboard.writeText(v); b.textContent = "¡Copiado!"; setTimeout(() => (b.textContent = "Copiar"), 1500); } catch (_) {}
  });

  /* ---------------- patrocinadores y contactos ---------------- */
  $("#sponsors").innerHTML = C.patrocinadores
    .map((p) => `<figure class="sp"><div class="im"><img src="${esc(p.img)}" alt="${esc(p.nombre)}" loading="lazy"></div><figcaption>${esc(p.nombre)}</figcaption></figure>`)
    .join("");
  $("#contacts").innerHTML = C.contactos
    .map((c) => `<a class="contact" target="_blank" rel="noopener" href="${wa(c.telefono, "Hola, quiero información del Torneo en Parejas de Sabotage 🎮")}">
      <span class="wa"><svg><use href="#i-wa"/></svg></span><span><b>${fmtTel(c.telefono)}</b><small>${esc(c.nombre)} · ${esc(c.rol)}</small></span></a>`)
    .join("");

  /* ---------------- lightbox ---------------- */
  const lb = $("#lightbox");
  document.querySelectorAll("[data-zoom]").forEach((f) => f.addEventListener("click", () => { lb.querySelector("img").src = f.dataset.zoom; lb.classList.add("on"); }));
  lb.addEventListener("click", () => lb.classList.remove("on"));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") lb.classList.remove("on"); });

  /* ---------------- animaciones ---------------- */
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { threshold: 0.08 }) : null;
  document.querySelectorAll(".reveal").forEach((el) => (io ? io.observe(el) : el.classList.add("in")));

  // ocultar botón flotante cuando el formulario está a la vista
  const fab = $("#fab");
  if ("IntersectionObserver" in window) new IntersectionObserver(([x]) => (fab.style.display = x.isIntersecting ? "none" : ""), { threshold: 0.05 }).observe($("#inscripcion"));

  if (C.fotoEstacion) {
    const f = $("#estacionFoto"); f.querySelector("img").src = C.fotoEstacion; f.hidden = false;
  }

  if (S.modo === "demo") {
    const b = document.createElement("div"); b.className = "demo-badge";
    b.innerHTML = "<b>Modo demo:</b> las inscripciones solo se guardan en este navegador. Conecta Supabase en config.js para publicarla.";
    $(".nav").after(b);
  }

  refrescar();
  setInterval(refrescar, 20000);
})();
