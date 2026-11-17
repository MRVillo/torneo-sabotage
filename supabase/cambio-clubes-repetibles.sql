-- 17 nov 2026: varias parejas pueden usar el mismo club o selección (cada pareja lo usa todo el torneo);
-- solo se prohíbe el Equipo de Estrellas.
-- Correr una vez en Supabase → SQL Editor (o ya aplicado si dice "ya existe").

drop index if exists public.parejas_club_unico;

create or replace function public.registrar_pareja(
  p_nombre text, p_club text, p_jugador1 text, p_jugador2 text,
  p_telefono text, p_telefono2 text default null,
  p_foto text default null, p_comprobante text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare
  cfg public.config;
  ocupados int;
  v_estado text;
  v_codigo text;
begin
  lock table public.parejas in share row exclusive mode;
  select * into cfg from public.config where id = 1;

  if not cfg.inscripciones_abiertas then raise exception 'Las inscripciones están cerradas.'; end if;
  if cfg.fecha_limite is not null and (now() at time zone 'America/Bogota')::date > cfg.fecha_limite then
    raise exception 'Ya pasó la fecha límite de inscripción.';
  end if;
  -- Clubes y selecciones se pueden repetir; solo se prohíbe el Equipo de Estrellas
  if lower(p_club) like '%estrella%' or lower(p_club) like '%all%star%' then
    raise exception 'El Equipo de Estrellas no está permitido. Elige un club o una selección.';
  end if;
  if exists (select 1 from public.parejas where estado <> 'rechazado' and lower(nombre_equipo) = lower(trim(p_nombre))) then
    raise exception 'Ya hay una pareja con ese nombre.';
  end if;

  select count(*) into ocupados from public.parejas where estado in ('pendiente','revision','confirmado');
  v_estado := case when ocupados >= cfg.cupos then 'espera'
                   when p_comprobante is not null then 'revision'
                   else 'pendiente' end;

  loop
    v_codigo := 'SB-' || upper(substr(md5(random()::text), 1, 5));
    exit when not exists (select 1 from public.parejas where codigo = v_codigo);
  end loop;

  insert into public.parejas (codigo, nombre_equipo, club, jugador1, jugador2, telefono, telefono2, foto_path, comprobante_path, estado)
  values (v_codigo, trim(p_nombre), trim(p_club), trim(p_jugador1), trim(p_jugador2), p_telefono, nullif(p_telefono2, ''), p_foto, p_comprobante, v_estado);

  return json_build_object('codigo', v_codigo, 'estado', v_estado);
end $$;
