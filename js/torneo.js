/* Lógica compartida del torneo (panel y página en vivo):
   sorteo, calendario de grupos, tabla de posiciones y cuadro final. */
(function () {
  const GRUPOS = ["A", "B", "C", "D"];
  const ESTACIONES = 3;

  /* ---------- sorteo ---------- */
  function barajar(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const r = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
      [a[i], a[r]] = [a[r], a[i]];
    }
    return a;
  }
  // Reparte las parejas en 4 grupos lo más parejos posible (16 → 4 de 4)
  function sortear(parejas) {
    const orden = barajar(parejas);
    const grupos = { A: [], B: [], C: [], D: [] };
    orden.forEach((p, i) => grupos[GRUPOS[i % 4]].push(p));
    return grupos;
  }

  /* ---------- calendario todos contra todos (método del círculo) ---------- */
  function jornadas(ids) {
    const t = ids.slice();
    if (t.length % 2) t.push(null);
    const n = t.length, out = [];
    for (let r = 0; r < n - 1; r++) {
      const ronda = [];
      for (let i = 0; i < n / 2; i++) {
        const a = t[i], b = t[n - 1 - i];
        if (a && b) ronda.push(r % 2 ? [b, a] : [a, b]);
      }
      out.push(ronda);
      t.splice(1, 0, t.pop()); // rotar dejando fijo el primero
    }
    return out;
  }
  // Partidos de grupos con turno y estación asignados
  function calendarioGrupos(grupos) {
    const porJornada = {};
    GRUPOS.forEach((g) => {
      jornadas(grupos[g].map((p) => p.id)).forEach((ronda, j) => {
        (porJornada[j] = porJornada[j] || []).push(...ronda.map(([l, v]) => ({ grupo: g, jornada: j + 1, local_id: l, visitante_id: v })));
      });
    });
    const lista = Object.keys(porJornada).sort((a, b) => a - b).flatMap((j) => porJornada[j]);
    return lista.map((m, i) => ({ ...m, fase: "grupos", codigo: null, orden: i + 1, estacion: (i % ESTACIONES) + 1, estado: "pendiente" }));
  }

  /* ---------- tabla de posiciones ---------- */
  function tabla(parejasGrupo, partidos) {
    const fila = {};
    parejasGrupo.forEach((p) => (fila[p.id] = { pareja: p, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 }));
    const jugados = partidos.filter((m) => m.fase === "grupos" && m.estado === "finalizado" && fila[m.local_id] && fila[m.visitante_id]);
    jugados.forEach((m) => {
      const L = fila[m.local_id], V = fila[m.visitante_id], gl = m.goles_local || 0, gv = m.goles_visitante || 0;
      L.pj++; V.pj++; L.gf += gl; L.gc += gv; V.gf += gv; V.gc += gl;
      if (gl > gv) { L.g++; V.p++; L.pts += 3; } else if (gl < gv) { V.g++; L.p++; V.pts += 3; } else { L.e++; V.e++; L.pts++; V.pts++; }
    });
    const filas = Object.values(fila);
    filas.forEach((f) => (f.dg = f.gf - f.gc));
    const h2h = (a, b) => {
      const m = jugados.find((x) => (x.local_id === a && x.visitante_id === b) || (x.local_id === b && x.visitante_id === a));
      if (!m) return 0;
      const ga = m.local_id === a ? m.goles_local : m.goles_visitante, gb = m.local_id === a ? m.goles_visitante : m.goles_local;
      return gb - ga; // negativo = a va primero
    };
    filas.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || h2h(a.pareja.id, b.pareja.id) ||
      (b.pareja.desempate || 0) - (a.pareja.desempate || 0) || a.pareja.nombre_equipo.localeCompare(b.pareja.nombre_equipo));
    return filas;
  }

  /* ---------- eliminación directa ---------- */
  const CUADRO = [
    { codigo: "C1", fase: "cuartos", orden: 101, estacion: 1, local: "1A", visitante: "2B" },
    { codigo: "C2", fase: "cuartos", orden: 102, estacion: 2, local: "1B", visitante: "2A" },
    { codigo: "C3", fase: "cuartos", orden: 103, estacion: 3, local: "1C", visitante: "2D" },
    { codigo: "C4", fase: "cuartos", orden: 104, estacion: 1, local: "1D", visitante: "2C" },
    { codigo: "S1", fase: "semis", orden: 105, estacion: 1, local: "Gan. C1", visitante: "Gan. C3" },
    { codigo: "S2", fase: "semis", orden: 106, estacion: 2, local: "Gan. C2", visitante: "Gan. C4" },
    { codigo: "T", fase: "tercer", orden: 107, estacion: 2, local: "Perd. S1", visitante: "Perd. S2" },
    { codigo: "F", fase: "final", orden: 108, estacion: 1, local: "Gan. S1", visitante: "Gan. S2" },
  ];
  // A dónde pasa el ganador (y el perdedor) de cada partido
  const AVANCE = {
    C1: [["S1", "local_id"]], C3: [["S1", "visitante_id"]],
    C2: [["S2", "local_id"]], C4: [["S2", "visitante_id"]],
    S1: [["F", "local_id"], ["T", "local_id", "perdedor"]],
    S2: [["F", "visitante_id"], ["T", "visitante_id", "perdedor"]],
  };
  function ganador(m) {
    if (m.estado !== "finalizado" || !m.local_id || !m.visitante_id) return null;
    const gl = m.goles_local ?? 0, gv = m.goles_visitante ?? 0;
    if (gl !== gv) return gl > gv ? m.local_id : m.visitante_id;
    if (m.pen_local != null && m.pen_visitante != null && m.pen_local !== m.pen_visitante) return m.pen_local > m.pen_visitante ? m.local_id : m.visitante_id;
    return null;
  }
  const perdedor = (m) => { const g = ganador(m); return g ? (g === m.local_id ? m.visitante_id : m.local_id) : null; };

  function generarCuadro(parejas, partidos) {
    const pos = {};
    GRUPOS.forEach((g) => {
      const t = tabla(parejas.filter((p) => p.grupo === g), partidos);
      pos["1" + g] = t[0] && t[0].pareja.id; pos["2" + g] = t[1] && t[1].pareja.id;
    });
    return CUADRO.map((c) => ({
      fase: c.fase, codigo: c.codigo, grupo: null, jornada: null, orden: c.orden, estacion: c.estacion, estado: "pendiente",
      local_id: pos[c.local] || null, visitante_id: pos[c.visitante] || null,
    }));
  }
  // Cambios a aplicar en el cuadro cuando termina un partido de eliminación
  function propagar(m) {
    const dest = AVANCE[m.codigo]; if (!dest) return [];
    const gan = ganador(m), per = perdedor(m);
    return dest.map(([codigo, campo, quien]) => ({ codigo, campo, valor: quien === "perdedor" ? per : gan }));
  }

  const FASES = { grupos: "Fase de grupos", cuartos: "Cuartos de final", semis: "Semifinal", tercer: "Tercer lugar", final: "Final" };
  const etiqueta = (codigo) => (CUADRO.find((c) => c.codigo === codigo) || {});

  window.Torneo = { GRUPOS, ESTACIONES, sortear, calendarioGrupos, tabla, generarCuadro, ganador, perdedor, propagar, CUADRO, FASES, etiqueta };
})();
