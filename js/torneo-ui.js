/* Piezas visuales compartidas: tabla de grupo, tarjeta de partido y cuadro final */
(function () {
  const T = window.Torneo;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function logo(p, size = "") {
    if (!p) return `<span class="tlogo ${size} empty">?</span>`;
    return p.foto_url
      ? `<span class="tlogo ${size}"><img src="${esc(p.foto_url)}" alt="" loading="lazy"></span>`
      : `<span class="tlogo ${size} empty">${esc((p.nombre_equipo || "?").slice(0, 2).toUpperCase())}</span>`;
  }
  function equipo(p, placeholder) {
    if (!p) return `<span class="tname tbd">${esc(placeholder || "Por definir")}</span>`;
    return `<span class="tname">${esc(p.nombre_equipo)}<small>${esc(p.club)}</small></span>`;
  }

  function tablaHTML(grupo, filas, opts = {}) {
    const rows = filas.map((f, i) => `
      <tr class="${i < 2 ? "qual" : ""}">
        <td class="pos">${i + 1}</td>
        <td class="team">${logo(f.pareja, "sm")}${equipo(f.pareja)}</td>
        <td>${f.pj}</td><td>${f.g}</td><td>${f.e}</td><td>${f.p}</td>
        <td class="hide-sm">${f.gf}</td><td class="hide-sm">${f.gc}</td><td>${f.dg > 0 ? "+" + f.dg : f.dg}</td>
        <td class="pts">${f.pts}</td>
        ${opts.desempate ? `<td><input class="desemp" type="number" min="0" max="9" value="${f.pareja.desempate || 0}" data-desempate="${f.pareja.id}" title="Desempate manual"></td>` : ""}
      </tr>`).join("");
    return `<div class="gtable">
      <div class="g-head">Grupo ${grupo}</div>
      <table><thead><tr><th>#</th><th class="team">Pareja</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th class="hide-sm">GF</th><th class="hide-sm">GC</th><th>DG</th><th>Pts</th>${opts.desempate ? "<th title='Desempate manual'>Des.</th>" : ""}</tr></thead>
      <tbody>${rows || `<tr><td colspan="10" class="muted">Sin parejas</td></tr>`}</tbody></table></div>`;
  }

  function marcador(m) {
    if (m.estado === "pendiente") return `<span class="score vs">vs</span>`;
    const pen = m.pen_local != null && m.pen_visitante != null && m.goles_local === m.goles_visitante ? `<small class="pens">(${m.pen_local}-${m.pen_visitante} pen.)</small>` : "";
    return `<span class="score">${m.goles_local ?? 0}<i>-</i>${m.goles_visitante ?? 0}</span>${pen}`;
  }
  function estadoTag(m) {
    if (m.estado === "en_juego") return `<span class="live">EN VIVO</span>`;
    if (m.estado === "finalizado") return `<span class="ftag">Final</span>`;
    return `<span class="ptag">Estación ${m.estacion || "–"}</span>`;
  }
  function meta(m) {
    if (m.fase === "grupos") return `Turno ${Math.ceil(m.orden / T.ESTACIONES)} · Grupo ${m.grupo} · Estación ${m.estacion || "–"}`;
    return `${T.FASES[m.fase]}${m.codigo && m.fase !== "final" && m.fase !== "tercer" ? " " + m.codigo.slice(1) : ""} · Estación ${m.estacion || "–"}`;
  }
  // Tarjeta de partido de solo lectura
  function partidoCard(m, mapa) {
    const L = mapa[m.local_id], V = mapa[m.visitante_id], g = T.ganador(m);
    const ph = T.etiqueta(m.codigo);
    return `<div class="mcard ${m.estado}">
      <div class="mc-meta">${esc(meta(m))}${estadoTag(m)}</div>
      <div class="mc-body">
        <div class="mc-team l ${g && g === m.local_id ? "win" : ""}">${equipo(L, ph.local)}${logo(L)}</div>
        <div class="mc-score">${marcador(m)}</div>
        <div class="mc-team v ${g && g === m.visitante_id ? "win" : ""}">${logo(V)}${equipo(V, ph.visitante)}</div>
      </div>
    </div>`;
  }

  // Cuadro de eliminación directa (cuartos → semis → final, + tercer lugar)
  function bracketHTML(partidos, mapa) {
    const by = {}; partidos.forEach((m) => m.codigo && (by[m.codigo] = m));
    const slot = (m, lado) => {
      const id = m && m[lado + "_id"], p = mapa[id], g = m && T.ganador(m);
      const ph = T.etiqueta(m && m.codigo)[lado === "local" ? "local" : "visitante"];
      const goles = m && m.estado !== "pendiente" ? (lado === "local" ? m.goles_local : m.goles_visitante) ?? 0 : "";
      const pen = m && m.estado !== "pendiente" && m.goles_local === m.goles_visitante && m.pen_local != null ? `<sup>${lado === "local" ? m.pen_local : m.pen_visitante}</sup>` : "";
      return `<div class="bslot ${g && id && g === id ? "win" : ""} ${g && id && g !== id ? "lose" : ""}">${logo(p, "xs")}<span class="bn">${p ? esc(p.nombre_equipo) : `<em>${esc(ph || "Por definir")}</em>`}</span><b>${goles}${pen}</b></div>`;
    };
    const match = (c, label) => {
      const m = by[c];
      return `<div class="bmatch ${m ? m.estado : ""}"><div class="blabel">${label}${m && m.estado === "en_juego" ? '<span class="live">EN VIVO</span>' : m ? `<span>Est. ${m.estacion || "–"}</span>` : ""}</div>${slot(m, "local")}${slot(m, "visitante")}</div>`;
    };
    return `<div class="bracket-wrap"><div class="bracket live-bracket">
      <div class="round"><h4>Cuartos</h4>${match("C1", "C1")}${match("C3", "C3")}${match("C2", "C2")}${match("C4", "C4")}</div>
      <div class="round"><h4>Semifinal</h4>${match("S1", "S1")}${match("S2", "S2")}</div>
      <div class="round"><h4>Final</h4><div class="final-slot">${match("F", "Final")}</div>${match("T", "3er lugar")}</div>
    </div></div>`;
  }

  function campeon(partidos, mapa) {
    const f = partidos.find((m) => m.codigo === "F"), t = partidos.find((m) => m.codigo === "T");
    const g = f && T.ganador(f);
    if (!g) return "";
    const p1 = mapa[g], p2 = mapa[T.perdedor(f)], p3 = t && mapa[T.ganador(t)];
    return `<div class="champ">
      <div class="champ-main">${logo(p1, "xl")}<div><div class="kicker">Campeones · 1er Torneo en Parejas</div><h3>${esc(p1.nombre_equipo)}</h3><p>${esc(p1.club)}</p></div></div>
      <div class="champ-rest"><span><b>2.º</b> ${esc(p2 ? p2.nombre_equipo : "")}</span>${p3 ? `<span><b>3.º</b> ${esc(p3.nombre_equipo)}</span>` : ""}</div>
    </div>`;
  }

  window.TorneoUI = { esc, logo, equipo, tablaHTML, partidoCard, bracketHTML, campeon, meta };
})();
