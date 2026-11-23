(function () {
  const C = window.SABOTAGE_CONFIG;
  const S = window.Store;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cop = (n) => "$" + Number(n || 0).toLocaleString("es-CO");
  const fmtTel = (t) => String(t || "").replace(/(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3");
  const fecha = (iso) => new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  let cfg = {}, parejas = [], filtro = "todas", q = "";

  function toast(t, err) {
    const el = $("#toast"); el.textContent = t; el.style.borderColor = err ? "#ff3b2f" : "#444";
    el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 2600);
  }

  /* ---------------- login ---------------- */
  async function iniciar() {
    if (S.modo === "demo") {
      $("#emailField").hidden = true; $("#passLbl").textContent = "Clave del panel (modo demo)";
      $("#loginHint").innerHTML = "Modo demo: los datos viven en este navegador. La clave está en <code>config.js</code> (demoPin).";
    }
    let u = null;
    try { u = await S.sesion(); } catch (e) { $("#loginForm").hidden = false; return msgLogin(e.message); }
    u ? entrar(u) : ($("#loginForm").hidden = false);
  }
  function msgLogin(t) { const m = $("#loginMsg"); m.className = "form-msg err"; m.textContent = t; }
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try { const u = await S.login($("#lEmail").value.trim(), $("#lPass").value); entrar(u); }
    catch (err) { msgLogin(err.message); }
  });
  $("#logout").addEventListener("click", async () => { await S.logout(); location.reload(); });

  function entrar(u) {
    $("#loginForm").hidden = true; $("#panel").hidden = false; $("#logout").hidden = false;
    $("#who").textContent = S.modo === "demo" ? "Modo demo" : u.email;
    cargar(); setInterval(cargar, 30000);
    document.dispatchEvent(new CustomEvent("admin:entrar"));
  }

  /* ---------------- datos ---------------- */
  async function cargar() {
    try {
      [cfg, parejas] = await Promise.all([S.getConfig(), S.listar()]);
      pintarCfg(); pintar();
    } catch (e) { toast(e.message, true); }
  }

  function pintarCfg() {
    if (document.activeElement && $("#cfgForm").contains(document.activeElement)) return; // no pisar mientras se edita
    $("#cPrecio").value = cfg.precio ?? "";
    $("#cCupos").value = cfg.cupos ?? 16;
    $("#cHoras").value = cfg.horas_reserva ?? 48;
    $("#cLimite").value = cfg.fecha_limite || "";
    $("#cAbiertas").checked = !!cfg.inscripciones_abiertas;
    $("#cMetodo").value = cfg.pago_metodo || "";
    $("#cNumero").value = cfg.pago_numero || "";
    $("#cTitular").value = cfg.pago_titular || "";
    $("#cDir").value = cfg.direccion || "";
    $("#cMaps").value = cfg.maps_url || "";
  }

  $("#cfgForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const precio = S.soloDigitos($("#cPrecio").value);
    const nuevo = {
      precio: precio ? Number(precio) : null,
      cupos: Math.max(2, Number($("#cCupos").value) || 16),
      horas_reserva: Math.max(1, Number($("#cHoras").value) || 48),
      fecha_limite: $("#cLimite").value || null,
      inscripciones_abiertas: $("#cAbiertas").checked,
      pago_metodo: $("#cMetodo").value.trim() || null,
      pago_numero: S.soloDigitos($("#cNumero").value) || null,
      pago_titular: $("#cTitular").value.trim() || null,
      direccion: $("#cDir").value.trim() || null,
      maps_url: $("#cMaps").value.trim() || null,
    };
    try { cfg = await S.guardarConfig(nuevo); document.activeElement.blur(); pintar(); toast("Configuración guardada ✓"); }
    catch (err) { toast(err.message, true); }
  });

  /* ---------------- render ---------------- */
  const vencida = (p) => p.estado === "pendiente" && Date.now() - new Date(p.created_at).getTime() > (cfg.horas_reserva || 48) * 36e5;

  function pintar() {
    const cuenta = (e) => parejas.filter((p) => p.estado === e).length;
    const ok = cuenta("confirmado"), pend = cuenta("pendiente"), rev = cuenta("revision"), esp = cuenta("espera");
    const ocupados = ok + pend + rev, total = cfg.cupos || 0;
    const venc = parejas.filter(vencida).length;
    $("#stats").innerHTML = `
      <div class="stat gold"><b>${ocupados}/${total}</b><span>Cupos ocupados</span></div>
      <div class="stat gold"><b>${ok}</b><span>Confirmadas</span></div>
      <div class="stat blue"><b>${rev}</b><span>Pago por revisar</span></div>
      <div class="stat red"><b>${pend}</b><span>Sin pagar${venc ? ` · ${venc} vencidas` : ""}</span></div>
      <div class="stat"><b>${esp}</b><span>Lista de espera</span></div>
      <div class="stat gold"><b>${cfg.precio ? cop(ok * cfg.precio) : "—"}</b><span>Recaudado</span></div>`;

    const tabs = [["todas", "Todas", parejas.length], ["revision", "Por revisar", rev], ["pendiente", "Sin pagar", pend], ["confirmado", "Confirmadas", ok], ["espera", "Espera", esp], ["rechazado", "Anuladas", cuenta("rechazado")]];
    $("#tabs").innerHTML = tabs.map(([k, t, n]) => `<button class="tab ${filtro === k ? "on" : ""}" data-f="${k}">${t}<small>${n}</small></button>`).join("");

    const lleno = ocupados >= total;
    let lista = parejas.filter((p) => filtro === "todas" || p.estado === filtro);
    if (q) {
      const s = q.toLowerCase();
      lista = lista.filter((p) => [p.nombre_equipo, p.club, p.jugador1, p.jugador2, p.codigo, p.telefono].join(" ").toLowerCase().includes(s));
    }
    if (!lista.length) { $("#rows").innerHTML = `<div class="empty-state"><b>No hay parejas aquí</b>${parejas.length ? "Prueba otro filtro." : "Cuando alguien se inscriba aparecerá en esta lista."}</div>`; return; }

    $("#rows").innerHTML = lista.map((p) => {
      const st = S.ESTADOS[p.estado];
      const foto = p.foto_path ? S.fotoUrl(p.foto_path) : null;
      const msgWa = p.estado === "confirmado"
        ? `¡Hola! Su pareja "${p.nombre_equipo}" quedó CONFIRMADA en el Torneo en Parejas Sabotage (código ${p.codigo}). Nos vemos el sábado 28 de nov a las 4:00 p.m. 🎮🔥`
        : `¡Hola! Les escribimos del Torneo en Parejas Sabotage por la inscripción de "${p.nombre_equipo}" (código ${p.codigo}).${cfg.precio ? ` El valor es ${cop(cfg.precio)}${cfg.pago_numero ? ` a ${cfg.pago_metodo || "Nequi"} ${cfg.pago_numero}` : ""}${(window.SABOTAGE_CONFIG.pagoBreB || {}).llave ? ` o a la llave Bre-B ${window.SABOTAGE_CONFIG.pagoBreB.llave}` : ""}.` : ""}`;
      const a = [];
      if (p.comprobante_path) a.push(`<button class="mini-btn" data-act="ver" data-id="${p.id}">Ver comprobante</button>`);
      if (p.estado !== "confirmado" && p.estado !== "rechazado") a.push(`<button class="mini-btn ok" data-act="confirmar" data-id="${p.id}">✓ Pago confirmado</button>`);
      if (p.estado === "confirmado") a.push(`<button class="mini-btn" data-act="pendiente" data-id="${p.id}">Quitar confirmación</button>`);
      if (p.estado === "espera") a.push(`<button class="mini-btn" data-act="subir" data-id="${p.id}" ${lleno ? 'title="No hay cupos libres"' : ""}>Darle cupo</button>`);
      if (p.estado === "rechazado") a.push(`<button class="mini-btn" data-act="restaurar" data-id="${p.id}">Restaurar</button>`);
      else a.push(`<button class="mini-btn no" data-act="anular" data-id="${p.id}">Anular / liberar cupo</button>`);
      a.push(`<a class="mini-btn wa" target="_blank" rel="noopener" href="https://wa.me/57${p.telefono}?text=${encodeURIComponent(msgWa)}">WhatsApp</a>`);
      if (p.estado === "rechazado") a.push(`<button class="mini-btn no" data-act="borrar" data-id="${p.id}">Eliminar</button>`);
      return `<div class="row ${vencida(p) ? "alert" : ""}">
        <div class="ph" style="${foto ? `background-image:url('${esc(foto)}')` : ""}">${foto ? "" : esc(p.nombre_equipo.slice(0, 2).toUpperCase())}</div>
        <div>
          <h4>${esc(p.nombre_equipo)} <span class="status-pill ${st.cls}" style="vertical-align:3px">${st.corto}</span></h4>
          <div class="meta"><b>${esc(p.club)}</b> · ${esc(p.jugador1)} & ${esc(p.jugador2)}</div>
          <div class="meta">${esc(p.codigo)} · ${fmtTel(p.telefono)}${p.telefono2 ? " / " + fmtTel(p.telefono2) : ""} · ${fecha(p.created_at)}
            ${vencida(p) ? `<span class="warn">· Reserva vencida (+${cfg.horas_reserva || 48} h sin pagar)</span>` : ""}
            ${p.pagado_at ? ` · Pagó ${fecha(p.pagado_at)}` : ""}</div>
        </div>
        <div class="acts">${a.join("")}</div>
        <input class="notes" data-notas="${p.id}" value="${esc(p.notas || "")}" placeholder="Notas internas (ej: pagó en efectivo, trae mandos propios…)">
      </div>`;
    }).join("");
  }

  /* ---------------- acciones ---------------- */
  $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (b) { filtro = b.dataset.f; pintar(); } });
  $("#buscar").addEventListener("input", (e) => { q = e.target.value.trim(); pintar(); });
  $("#recargar").addEventListener("click", cargar);

  $("#rows").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const p = parejas.find((x) => x.id === b.dataset.id); if (!p) return;
    const ocupados = parejas.filter((x) => S.ACTIVOS.includes(x.estado)).length;
    try {
      switch (b.dataset.act) {
        case "ver": {
          const url = await S.urlComprobante(p.comprobante_path);
          $("#modal img").src = url; $("#modalOpen").href = url; $("#modal").classList.add("on"); return;
        }
        case "confirmar":
          if (p.estado === "espera" && ocupados >= cfg.cupos && !confirm("No hay cupos libres. ¿Confirmar igual (se pasa del límite)?")) return;
          await S.actualizar(p.id, { estado: "confirmado", pagado_at: new Date().toISOString() }); toast(`${p.nombre_equipo} confirmada ✓`); break;
        case "pendiente":
          await S.actualizar(p.id, { estado: p.comprobante_path ? "revision" : "pendiente", pagado_at: null }); break;
        case "subir":
          if (ocupados >= cfg.cupos && !confirm("No hay cupos libres. ¿Darle cupo igual (se pasa del límite)?")) return;
          await S.actualizar(p.id, { estado: p.comprobante_path ? "revision" : "pendiente", created_at: new Date().toISOString() }); toast("Pasó de lista de espera a cupo reservado"); break;
        case "anular":
          if (!confirm(`¿Anular la inscripción de "${p.nombre_equipo}"? Se libera su cupo.`)) return;
          await S.actualizar(p.id, { estado: "rechazado" }); toast("Inscripción anulada, cupo liberado"); break;
        case "restaurar":
          await S.actualizar(p.id, { estado: ocupados >= cfg.cupos ? "espera" : "pendiente" }); break;
        case "borrar":
          if (!confirm(`¿Eliminar definitivamente "${p.nombre_equipo}" con su foto y comprobante? No se puede deshacer.`)) return;
          await S.eliminar(p.id); toast("Eliminada"); break;
      }
      await cargar();
    } catch (err) { toast(err.message, true); }
  });

  $("#rows").addEventListener("change", async (e) => {
    const id = e.target.dataset.notas; if (!id) return;
    try { await S.actualizar(id, { notas: e.target.value.trim() }); toast("Nota guardada"); const p = parejas.find((x) => x.id === id); if (p) p.notas = e.target.value.trim(); }
    catch (err) { toast(err.message, true); }
  });

  $("#modalClose").addEventListener("click", () => $("#modal").classList.remove("on"));
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("#modal").classList.remove("on"); });

  $("#exportar").addEventListener("click", () => {
    const cols = ["codigo", "nombre_equipo", "club", "jugador1", "jugador2", "telefono", "telefono2", "estado", "created_at", "pagado_at", "notas"];
    const csv = [cols.join(";")].concat(parejas.map((p) => cols.map((c) => `"${String(p[c] ?? "").replace(/"/g, '""')}"`).join(";"))).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "parejas-torneo-sabotage.csv"; a.click();
  });

  iniciar();
})();
