/* Panel · pestaña "Torneo en vivo": sorteo, marcadores y eliminatoria */
(function () {
  const S = window.Store, T = window.Torneo, U = window.TorneoUI, esc = U.esc;
  const $ = (s) => document.querySelector(s);
  let cfg = {}, parejas = [], partidos = [], mapa = {};
  let sub = "partidos", filtro = "abiertos", animarSorteo = false, timer = null;
  const TODAS = ["grupos", "cuartos", "semis", "tercer", "final"];

  function toast(t, err) {
    const el = $("#toast"); el.textContent = t; el.style.borderColor = err ? "#ff3b2f" : "#444";
    el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 2800);
  }
  const editando = () => {
    const a = document.activeElement;
    return a && $("#tabTorneo").contains(a) && /INPUT|SELECT/.test(a.tagName);
  };

  /* ---------- pestañas del panel ---------- */
  document.querySelector(".atabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-atab]"); if (!b) return;
    document.querySelectorAll(".atabs .tab").forEach((x) => x.classList.toggle("on", x === b));
    const torneo = b.dataset.atab === "torneo";
    $("#tabTorneo").hidden = !torneo; $("#tabInsc").hidden = torneo;
    if (torneo) cargar();
  });
  $("#tSubtabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-st]"); if (!b) return;
    sub = b.dataset.st; pintarSub();
  });
  $("#tFiltro").addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]"); if (!b) return;
    filtro = b.dataset.f;
    document.querySelectorAll("#tFiltro .tab").forEach((x) => x.classList.toggle("on", x === b));
    pintarPartidos();
  });
  function pintarSub() {
    document.querySelectorAll("#tSubtabs .tab").forEach((x) => x.classList.toggle("on", x.dataset.st === sub));
    document.querySelectorAll("[data-sp]").forEach((p) => (p.hidden = p.dataset.sp !== sub));
  }

  /* ---------- datos ---------- */
  async function cargar() {
    try {
      const [c, ps, ms] = await Promise.all([S.getConfig(), S.listar(), S.getPartidos()]);
      cfg = c; partidos = ms;
      parejas = ps.filter((p) => p.estado !== "rechazado").map((p) => ({ ...p, foto_url: S.fotoUrl(p.foto_path) }));
      mapa = {}; parejas.forEach((p) => (mapa[p.id] = p));
      pintar();
    } catch (e) { toast(e.message, true); }
    if (!timer) timer = setInterval(() => { if (!$("#tabTorneo").hidden && !editando()) cargar(); }, 15000);
  }

  function pintar() {
    $("#tPublicar").checked = !!cfg.torneo_publicado;
    $("#tLink").href = "en-vivo.html" + (/[?&]demo=1/.test(location.search) ? "?demo=1" : "");
    const gp = partidos.filter((m) => m.fase === "grupos");
    pintarSorteo(gp);
    $("#tTorneo").hidden = !gp.length;
    if (!gp.length) return;
    pintarSub(); pintarPartidos(); pintarTablas(); pintarKO();
  }

  /* ---------- sorteo ---------- */
  function pintarSorteo(gp) {
    const box = $("#tSorteo");
    if (!gp.length) {
      const conf = parejas.filter((p) => p.estado === "confirmado").length;
      const otras = parejas.filter((p) => p.estado === "pendiente" || p.estado === "revision").length;
      box.innerHTML = `<h3>Sorteo de grupos</h3>
        <p class="hint">Se reparten las parejas al azar en 4 grupos y se arma el calendario: todos contra todos, repartido en las 3 estaciones por turnos.</p>
        <div class="trow" style="margin-bottom:12px"><span class="status-pill st-ok">${conf} confirmadas</span>${otras ? `<span class="status-pill st-pend">${otras} sin pago confirmado</span>` : ""}</div>
        ${otras ? `<label class="check" style="margin-bottom:12px"><input type="checkbox" id="tIncluir"> <span>Incluir también las ${otras} parejas sin pago confirmado</span></label>` : ""}
        <button class="btn" type="button" id="tSortear">Hacer sorteo</button>
        <p class="hint" style="margin:10px 0 0">Necesitas al menos 8 parejas. Lo ideal son 16 (4 grupos de 4).</p>`;
      $("#tSortear").addEventListener("click", sortear);
      return;
    }
    const jugado = partidos.some((m) => m.estado !== "pendiente");
    box.innerHTML = `<div class="trow" style="justify-content:space-between">
        <div><h3>Grupos sorteados</h3><p class="hint" style="margin:0">${parejas.filter((p) => p.grupo).length} parejas · ${gp.length} partidos de grupos</p></div>
        <div class="trow">
          ${jugado ? "" : `<button class="mini-btn" type="button" id="tRepetir">Repetir sorteo</button>`}
          <button class="mini-btn no" type="button" id="tBorrar">Borrar torneo</button>
        </div>
      </div>
      <div class="draw-grid">${T.GRUPOS.map((g, gi) => `<div class="draw-group"><div class="g-head">Grupo ${g}</div><ul>${parejas.filter((p) => p.grupo === g)
        .map((p, i) => `<li class="${animarSorteo ? "pop" : ""}" style="animation-delay:${(i * 4 + gi) * 0.18}s">${U.logo(p, "sm")}${esc(p.nombre_equipo)}</li>`).join("")}</ul></div>`).join("")}</div>`;
    animarSorteo = false;
    if (!jugado) $("#tRepetir").addEventListener("click", sortear);
    $("#tBorrar").addEventListener("click", async () => {
      if (!confirm("¿Borrar el sorteo, todos los partidos y resultados? No se puede deshacer.")) return;
      if (partidos.some((m) => m.estado === "finalizado") && !confirm("Ya hay resultados guardados. ¿Seguro que quieres borrar todo?")) return;
      try { await S.borrarPartidos(TODAS); toast("Torneo borrado"); cargar(); } catch (e) { toast(e.message, true); }
    });
  }

  async function sortear() {
    const incluir = $("#tIncluir") && $("#tIncluir").checked;
    const cand = parejas.filter((p) => p.estado === "confirmado" || (incluir && (p.estado === "pendiente" || p.estado === "revision")));
    if (cand.length < 8) return toast(`Solo hay ${cand.length} parejas para sortear. Se necesitan al menos 8.`, true);
    if (!confirm(`Se van a sortear ${cand.length} parejas en 4 grupos. ¿Continuar?`)) return;
    try {
      const grupos = T.sortear(cand);
      const asign = {}; T.GRUPOS.forEach((g) => grupos[g].forEach((p) => (asign[p.id] = g)));
      await S.borrarPartidos(TODAS);
      await S.asignarGrupos(asign);
      await S.crearPartidos(T.calendarioGrupos(grupos));
      animarSorteo = true; sub = "partidos";
      toast("¡Sorteo hecho! Ya puedes publicar la página en vivo.");
      await cargar();
    } catch (e) { toast(e.message, true); }
  }

  /* ---------- fila editable de partido ---------- */
  function amatch(m) {
    const L = mapa[m.local_id], V = mapa[m.visitante_id], ko = m.fase !== "grupos", ph = T.etiqueta(m.codigo);
    const listo = L && V, fin = m.estado === "finalizado";
    const v = (x) => (x == null ? "" : x);
    const pill = m.estado === "en_juego" ? '<span class="live">EN VIVO</span>' : fin ? '<span class="ftag">Final</span>' : '<span class="ptag">Por jugar</span>';
    const acts = !listo ? `<span class="hint" style="margin:0">Esperando rivales</span>`
      : m.estado === "pendiente" ? `<button class="mini-btn" data-a="iniciar">▶ Iniciar</button><button class="mini-btn ok" data-a="finalizar">✓ Resultado final</button>`
      : m.estado === "en_juego" ? `<button class="mini-btn" data-a="guardar">Guardar marcador</button><button class="mini-btn ok" data-a="finalizar">✓ Finalizar</button>`
      : `<button class="mini-btn" data-a="reabrir">Corregir</button>`;
    return `<div class="amatch ${m.estado}" data-id="${m.id}">
      <div class="am-meta"><span>${esc(U.meta(m))}</span>
        <span class="trow">Estación <select data-k="estacion">${[1, 2, 3].map((e) => `<option ${m.estacion === e ? "selected" : ""}>${e}</option>`).join("")}</select>${pill}</span></div>
      <div class="am-body">
        <div class="l">${U.equipo(L, ph.local)}</div>
        <div class="goals"><input data-k="goles_local" type="number" min="0" max="99" inputmode="numeric" value="${v(m.goles_local)}" ${fin || !listo ? "disabled" : ""} aria-label="Goles local">
          <i>-</i><input data-k="goles_visitante" type="number" min="0" max="99" inputmode="numeric" value="${v(m.goles_visitante)}" ${fin || !listo ? "disabled" : ""} aria-label="Goles visitante"></div>
        <div>${U.equipo(V, ph.visitante)}</div>
      </div>
      ${ko ? `<div class="am-pen">Penales <input data-k="pen_local" type="number" min="0" max="99" inputmode="numeric" value="${v(m.pen_local)}" ${fin || !listo ? "disabled" : ""}> - <input data-k="pen_visitante" type="number" min="0" max="99" inputmode="numeric" value="${v(m.pen_visitante)}" ${fin || !listo ? "disabled" : ""}> <span>solo si empatan</span></div>` : ""}
      <div class="am-acts">${acts}</div>
    </div>`;
  }

  function pintarPartidos() {
    const gp = partidos.filter((m) => m.fase === "grupos");
    const lista = gp.filter((m) => filtro === "todos" || (filtro === "finalizado" ? m.estado === "finalizado" : m.estado !== "finalizado"))
      .sort((a, b) => (b.estado === "en_juego") - (a.estado === "en_juego") || a.orden - b.orden);
    $("#tPartidos").innerHTML = lista.length ? lista.map(amatch).join("") :
      `<div class="empty-state"><b>${filtro === "abiertos" ? "¡Fase de grupos terminada!" : "No hay partidos aquí"}</b>${filtro === "abiertos" ? "Ve a la pestaña Eliminatoria para generar los cuartos de final." : ""}</div>`;
  }

  function pintarTablas() {
    $("#tTablas").innerHTML = T.GRUPOS.map((g) => {
      const ps = parejas.filter((p) => p.grupo === g);
      return ps.length ? U.tablaHTML(g, T.tabla(ps, partidos), { desempate: true }) : "";
    }).join("");
  }

  function pintarKO() {
    const gp = partidos.filter((m) => m.fase === "grupos"), ko = partidos.filter((m) => m.fase !== "grupos");
    const faltan = gp.filter((m) => m.estado !== "finalizado").length;
    const ctrl = $("#tKoCtrl");
    if (!ko.length) {
      const prev = T.generarCuadro(parejas.filter((p) => p.grupo), partidos).filter((m) => m.fase === "cuartos");
      ctrl.innerHTML = `<h3>Cuartos de final</h3>
        <p class="hint">${faltan ? `Faltan ${faltan} partidos de grupos. Los cruces de abajo son con la tabla actual.` : "Grupos terminados. Estos son los cruces:"}</p>
        <div class="mlist" style="margin-bottom:12px">${prev.map((m) => `<div class="mcard"><div class="mc-meta">${m.codigo} · ${T.etiqueta(m.codigo).local} vs ${T.etiqueta(m.codigo).visitante}</div>
          <div class="mc-body"><div class="mc-team l">${U.equipo(mapa[m.local_id])}</div><div class="mc-score"><span class="score vs">vs</span></div><div class="mc-team">${U.equipo(mapa[m.visitante_id])}</div></div></div>`).join("")}</div>
        <button class="btn" type="button" id="tGenerar">Generar eliminatoria</button>`;
      $("#tGenerar").addEventListener("click", async () => {
        if (faltan && !confirm(`Aún faltan ${faltan} partidos de grupos. ¿Generar la eliminatoria con la tabla actual?`)) return;
        try { await S.crearPartidos(T.generarCuadro(parejas.filter((p) => p.grupo), partidos)); toast("Eliminatoria generada"); cargar(); }
        catch (e) { toast(e.message, true); }
      });
      $("#tKoCuadro").innerHTML = ""; $("#tKoPartidos").innerHTML = "";
      return;
    }
    const empezada = ko.some((m) => m.estado !== "pendiente");
    ctrl.innerHTML = `<div class="trow" style="justify-content:space-between"><div><h3>Eliminatoria</h3><p class="hint" style="margin:0">Al finalizar cada partido, el ganador pasa solo a la siguiente ronda.</p></div>
      ${empezada ? "" : `<button class="mini-btn" type="button" id="tRehacer">Rehacer cruces con la tabla actual</button>`}</div>`;
    if (!empezada) $("#tRehacer").addEventListener("click", async () => {
      if (!confirm("¿Volver a armar los cuartos con la tabla actual?")) return;
      try { await S.borrarPartidos(["cuartos", "semis", "tercer", "final"]); await S.crearPartidos(T.generarCuadro(parejas.filter((p) => p.grupo), partidos)); cargar(); }
      catch (e) { toast(e.message, true); }
    });
    $("#tKoCuadro").innerHTML = U.bracketHTML(ko, mapa);
    $("#tKoPartidos").innerHTML = ko.slice().sort((a, b) => a.orden - b.orden).map(amatch).join("");
  }

  /* ---------- acciones sobre partidos ---------- */
  const num = (row, k) => { const el = row.querySelector(`[data-k="${k}"]`); if (!el || el.value === "") return null; return Math.max(0, Math.min(99, parseInt(el.value, 10) || 0)); };

  document.getElementById("tabTorneo").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const row = b.closest("[data-id]"), m = partidos.find((x) => x.id === row.dataset.id); if (!m) return;
    const ko = m.fase !== "grupos";
    const gl = num(row, "goles_local"), gv = num(row, "goles_visitante"), pl = num(row, "pen_local"), pv = num(row, "pen_visitante");
    let patch;
    switch (b.dataset.a) {
      case "iniciar": {
        const ocupada = partidos.find((x) => x.estado === "en_juego" && x.estacion === m.estacion && x.id !== m.id);
        const ocupado = partidos.find((x) => x.estado === "en_juego" && x.id !== m.id && [x.local_id, x.visitante_id].some((id) => id === m.local_id || id === m.visitante_id));
        if (ocupada && !confirm(`La estación ${m.estacion} ya tiene un partido en vivo. ¿Iniciar este igual?`)) return;
        if (ocupado && !confirm("Una de estas parejas ya está jugando en otra estación. ¿Iniciar igual?")) return;
        patch = { estado: "en_juego", goles_local: gl ?? 0, goles_visitante: gv ?? 0 };
        break;
      }
      case "guardar":
        patch = { goles_local: gl ?? 0, goles_visitante: gv ?? 0, pen_local: pl, pen_visitante: pv };
        break;
      case "finalizar":
        if (gl == null || gv == null) return toast("Escribe los goles de las dos parejas.", true);
        if (ko && gl === gv && (pl == null || pv == null || pl === pv)) return toast("Empate en eliminatoria: escribe el resultado de los penales (no puede quedar empatado).", true);
        patch = { estado: "finalizado", goles_local: gl, goles_visitante: gv, pen_local: ko && gl === gv ? pl : null, pen_visitante: ko && gl === gv ? pv : null };
        break;
      case "reabrir":
        patch = { estado: "en_juego" };
        break;
      default: return;
    }
    b.disabled = true;
    try {
      await S.actualizarPartido(m.id, patch);
      if (ko && patch.estado === "finalizado") await propagar({ ...m, ...patch });
      if (patch.estado === "finalizado") toast(`Resultado guardado: ${mapa[m.local_id].nombre_equipo} ${patch.goles_local} - ${patch.goles_visitante} ${mapa[m.visitante_id].nombre_equipo}`);
      else toast("Guardado ✓");
      await cargar();
    } catch (err) { toast(err.message, true); b.disabled = false; }
  });

  async function propagar(m) {
    for (const c of T.propagar(m)) {
      const dest = partidos.find((x) => x.codigo === c.codigo);
      if (!dest || dest[c.campo] === c.valor) continue;
      if (dest.estado === "finalizado" && !confirm(`El partido ${c.codigo} ya terminó y cambiaría una de sus parejas. ¿Actualizarlo igual?`)) continue;
      await S.actualizarPartido(dest.id, { [c.campo]: c.valor });
    }
  }

  document.getElementById("tabTorneo").addEventListener("change", async (e) => {
    const el = e.target;
    try {
      if (el.id === "tPublicar") {
        cfg = await S.guardarConfig({ torneo_publicado: el.checked });
        toast(el.checked ? "Página en vivo publicada ✓" : "Página en vivo oculta");
      } else if (el.dataset.k === "estacion") {
        await S.actualizarPartido(el.closest("[data-id]").dataset.id, { estacion: parseInt(el.value, 10) });
        toast("Estación cambiada"); cargar();
      } else if (el.dataset.desempate) {
        await S.actualizar(el.dataset.desempate, { desempate: Math.max(0, Math.min(9, parseInt(el.value, 10) || 0)) });
        toast("Desempate guardado"); cargar();
      }
    } catch (err) { toast(err.message, true); }
  });

  $("#tCopiar").addEventListener("click", async () => {
    const url = new URL("en-vivo.html", location.href).href;
    try { await navigator.clipboard.writeText(url); toast("Link copiado: " + url); } catch (_) { prompt("Copia el link:", url); }
  });
})();
