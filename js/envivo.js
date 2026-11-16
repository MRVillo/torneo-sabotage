(function () {
  const S = window.Store, T = window.Torneo, U = window.TorneoUI;
  const $ = (s) => document.querySelector(s);
  let tab = "grupos", filtro = "todos", ultimo = 0, tabElegida = false;

  async function cargar() {
    try {
      const [cfg, parejas, partidos] = await Promise.all([S.getConfig(), S.getInscritos(), S.getPartidos()]);
      ultimo = Date.now();
      pintar(cfg, parejas, partidos);
    } catch (e) {
      $("#actualizado").textContent = "Sin conexión, reintentando…";
    }
  }

  function pintar(cfg, parejas, partidos) {
    const publicado = cfg.torneo_publicado && partidos.length;
    $("#cerrado").hidden = !!publicado; $("#vivo").hidden = !publicado;
    $("#liveDot").classList.toggle("off", !publicado);
    if (!publicado) { $("#faseTxt").textContent = "Domingo 29 de noviembre · 2:00 p.m."; return; }

    const mapa = {}; parejas.forEach((p) => (mapa[p.id] = p));
    const grupos = partidos.filter((m) => m.fase === "grupos");
    const ko = partidos.filter((m) => m.fase !== "grupos");
    const jugando = partidos.filter((m) => m.estado === "en_juego");
    const hechos = partidos.filter((m) => m.estado === "finalizado").length;

    // fase actual
    const f = partidos.find((m) => m.codigo === "F");
    let fase = "Fase de grupos";
    if (f && T.ganador(f)) fase = "Torneo terminado";
    else if (ko.some((m) => m.estado !== "pendiente")) fase = T.FASES[(jugando[0] || ko.find((m) => m.estado === "pendiente" && m.local_id) || ko[0]).fase];
    else if (ko.length) fase = "Cuartos de final";
    $("#faseTxt").textContent = `${fase} · ${hechos} de ${partidos.length} partidos jugados`;

    if (!tabElegida) { tab = ko.length ? "cuadro" : "grupos"; marcarTab(); }

    $("#campeon").innerHTML = U.campeon(partidos, mapa);

    // estaciones: qué se juega ahora y qué viene
    const pend = partidos.filter((m) => m.estado === "pendiente" && m.local_id && m.visitante_id);
    $("#estaciones").innerHTML = [1, 2, 3].map((e) => {
      const ahora = jugando.find((m) => m.estacion === e);
      const prox = pend.find((m) => m.estacion === e);
      const nom = (id) => U.esc(mapa[id] ? mapa[id].nombre_equipo : "Por definir");
      return `<div class="snow ${ahora ? "on" : ""}">
        <div class="sn-head">Estación ${e}${ahora ? '<span class="live">EN VIVO</span>' : '<span class="ptag">Libre</span>'}</div>
        ${ahora ? `<div class="sn-match"><span>${nom(ahora.local_id)}</span><b>${ahora.goles_local ?? 0} - ${ahora.goles_visitante ?? 0}</b><span>${nom(ahora.visitante_id)}</span></div>
          <div class="sn-meta">${U.esc(U.meta(ahora))}</div>` : `<div class="sn-idle">Esperando partido</div>`}
        ${prox ? `<div class="sn-next">Próximo: <b>${nom(prox.local_id)}</b> vs <b>${nom(prox.visitante_id)}</b></div>` : ""}
      </div>`;
    }).join("");

    // grupos
    $("#grupos").innerHTML = T.GRUPOS.map((g) => {
      const ps = parejas.filter((p) => p.grupo === g);
      if (!ps.length) return "";
      const ms = grupos.filter((m) => m.grupo === g);
      return `<div class="gblock">${U.tablaHTML(g, T.tabla(ps, partidos))}
        <div class="mlist compact">${ms.map((m) => U.partidoCard(m, mapa)).join("")}</div></div>`;
    }).join("");

    // eliminatoria
    $("#cuadro").innerHTML = ko.length ? U.bracketHTML(ko, mapa) :
      `<div class="empty-state"><b>La eliminatoria arranca al terminar los grupos</b>Pasan los 2 primeros de cada grupo a cuartos de final.</div>`;

    // lista de partidos
    const lista = partidos.filter((m) => filtro === "todos" || m.estado === filtro)
      .sort((a, b) => (a.estado === "en_juego" ? -1 : 0) - (b.estado === "en_juego" ? -1 : 0) || a.orden - b.orden);
    $("#partidos").innerHTML = lista.length ? lista.map((m) => U.partidoCard(m, mapa)).join("") : `<div class="empty-state"><b>No hay partidos aquí</b></div>`;
  }

  function marcarTab() {
    document.querySelectorAll(".ltabs .tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    document.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== tab));
  }
  document.querySelector(".ltabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    tab = b.dataset.tab; tabElegida = true; marcarTab();
  });
  $("#filtroPartidos").addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]"); if (!b) return;
    filtro = b.dataset.f;
    document.querySelectorAll("#filtroPartidos .tab").forEach((x) => x.classList.toggle("on", x === b));
    cargar();
  });

  setInterval(() => {
    if (!ultimo) return;
    const s = Math.round((Date.now() - ultimo) / 1000);
    $("#actualizado").textContent = s < 5 ? "Actualizado ahora" : `Actualizado hace ${s} s`;
  }, 1000);

  cargar();
  setInterval(() => { if (!document.hidden) cargar(); }, 8000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) cargar(); });
})();
