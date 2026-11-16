-- =====================================================================
--  Torneo en Parejas Sabotage — base de datos (Supabase / Postgres)
--  Ejecutar completo una sola vez en: Supabase > SQL Editor > New query
-- =====================================================================

-- ---------- Configuración del torneo (una sola fila) ----------
create table if not exists public.config (
  id int primary key default 1 check (id = 1),
  precio int,                                   -- COP por pareja; null = "Por confirmar"
  cupos int not null default 16 check (cupos between 2 and 256),
  fecha_limite date default '2026-11-28',
  inscripciones_abiertas boolean not null default true,
  horas_reserva int not null default 48,
  direccion text default 'Sabotage Bar · Montería, Córdoba',
  maps_url text default 'https://www.google.com/maps/search/?api=1&query=Sabotage+Bar+Monteria',
  pago_metodo text default 'Nequi',
  pago_numero text,
  pago_titular text,
  updated_at timestamptz default now()
);
insert into public.config (id) values (1) on conflict do nothing;

-- ---------- Parejas inscritas ----------
create table if not exists public.parejas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre_equipo text not null check (char_length(nombre_equipo) between 2 and 40),
  club text not null check (char_length(club) between 2 and 40),
  jugador1 text not null check (char_length(jugador1) between 3 and 60),
  jugador2 text not null check (char_length(jugador2) between 3 and 60),
  telefono text not null check (telefono ~ '^[0-9]{10,13}$'),
  telefono2 text,
  foto_path text,
  comprobante_path text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','revision','confirmado','espera','rechazado')),
  notas text,
  created_at timestamptz not null default now(),
  pagado_at timestamptz
);
-- Un club y un nombre no se repiten entre parejas activas
create unique index if not exists parejas_club_unico on public.parejas (lower(club)) where estado <> 'rechazado';
create unique index if not exists parejas_nombre_unico on public.parejas (lower(nombre_equipo)) where estado <> 'rechazado';

-- ---------- Administradores (correos autorizados para el panel) ----------
create table if not exists public.admins (email text primary key);
-- ⚠️ CAMBIA ESTOS CORREOS por los de los organizadores:
-- insert into public.admins (email) values ('organizador@correo.com');

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where lower(a.email) = lower(auth.jwt() ->> 'email'));
$$;

-- ---------- Seguridad (RLS) ----------
alter table public.config  enable row level security;
alter table public.parejas enable row level security;
alter table public.admins  enable row level security;

drop policy if exists "config lectura publica" on public.config;
create policy "config lectura publica" on public.config for select to anon, authenticated using (true);
drop policy if exists "config admin edita" on public.config;
create policy "config admin edita" on public.config for update to authenticated using (public.es_admin()) with check (public.es_admin());

-- El público NO lee la tabla parejas directamente (tiene teléfonos); usa las funciones de abajo.
drop policy if exists "parejas admin todo" on public.parejas;
create policy "parejas admin todo" on public.parejas for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admins se ven" on public.admins;
create policy "admins se ven" on public.admins for select to authenticated using (lower(email) = lower(auth.jwt() ->> 'email'));

-- ---------- Funciones públicas ----------
-- Lista pública (sin teléfonos ni comprobantes)
create or replace function public.inscritos_publicos()
returns table (id uuid, nombre_equipo text, club text, foto_path text, estado text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nombre_equipo, p.club, p.foto_path, p.estado, p.created_at
  from public.parejas p where p.estado <> 'rechazado' order by p.created_at;
$$;

-- Inscripción con control de cupos (atómica)
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
  -- serializa inscripciones simultáneas para que nadie se pase de los cupos
  lock table public.parejas in share row exclusive mode;
  select * into cfg from public.config where id = 1;

  if not cfg.inscripciones_abiertas then raise exception 'Las inscripciones están cerradas.'; end if;
  if cfg.fecha_limite is not null and (now() at time zone 'America/Bogota')::date > cfg.fecha_limite then
    raise exception 'Ya pasó la fecha límite de inscripción.';
  end if;
  if exists (select 1 from public.parejas where estado <> 'rechazado' and lower(club) = lower(trim(p_club))) then
    raise exception 'El club "%" ya lo eligió otra pareja. Escoge otro.', trim(p_club);
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

-- Consultar estado (pide código + WhatsApp)
create or replace function public.consultar_pareja(p_codigo text, p_telefono text)
returns json language plpgsql stable security definer set search_path = '' as $$
declare p public.parejas;
begin
  select * into p from public.parejas where codigo = upper(trim(p_codigo)) and telefono = p_telefono;
  if not found then raise exception 'No encontramos una inscripción con ese código y WhatsApp.'; end if;
  return json_build_object('nombre_equipo', p.nombre_equipo, 'club', p.club, 'estado', p.estado,
                           'tiene_comprobante', p.comprobante_path is not null);
end $$;

-- Adjuntar comprobante de pago después de inscribirse
create or replace function public.subir_comprobante(p_codigo text, p_telefono text, p_path text)
returns json language plpgsql security definer set search_path = '' as $$
declare p public.parejas;
begin
  select * into p from public.parejas where codigo = upper(trim(p_codigo)) and telefono = p_telefono for update;
  if not found then raise exception 'No encontramos una inscripción con ese código y WhatsApp.'; end if;
  if p.estado = 'rechazado' then raise exception 'Esta inscripción fue anulada. Escríbenos por WhatsApp.'; end if;
  update public.parejas
     set comprobante_path = p_path,
         estado = case when estado = 'pendiente' then 'revision' else estado end
   where id = p.id returning estado into p.estado;
  return json_build_object('estado', p.estado);
end $$;

revoke all on function public.registrar_pareja(text,text,text,text,text,text,text,text) from public;
grant execute on function public.inscritos_publicos() to anon, authenticated;
grant execute on function public.registrar_pareja(text,text,text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.consultar_pareja(text,text) to anon, authenticated;
grant execute on function public.subir_comprobante(text,text,text) to anon, authenticated;
revoke execute on function public.es_admin() from anon, public;
grant execute on function public.es_admin() to authenticated;

-- ---------- Almacenamiento de fotos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('equipos', 'equipos', true, 5242880, array['image/jpeg','image/png','image/webp']),
       ('comprobantes', 'comprobantes', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "sube foto equipo" on storage.objects;
create policy "sube foto equipo" on storage.objects for insert to anon, authenticated with check (bucket_id = 'equipos');
drop policy if exists "sube comprobante" on storage.objects;
create policy "sube comprobante" on storage.objects for insert to anon, authenticated with check (bucket_id = 'comprobantes');
drop policy if exists "admin lee comprobantes" on storage.objects;
create policy "admin lee comprobantes" on storage.objects for select to authenticated using (bucket_id = 'comprobantes' and public.es_admin());
drop policy if exists "admin borra imagenes" on storage.objects;
create policy "admin borra imagenes" on storage.objects for delete to authenticated using (bucket_id in ('equipos','comprobantes') and public.es_admin());

-- =====================================================================
--  Torneo en vivo: grupos, partidos y marcadores
-- =====================================================================
alter table public.parejas add column if not exists grupo text check (grupo in ('A','B','C','D'));
alter table public.parejas add column if not exists desempate int not null default 0;
alter table public.config add column if not exists torneo_publicado boolean not null default false;

create table if not exists public.partidos (
  id uuid primary key default gen_random_uuid(),
  fase text not null check (fase in ('grupos','cuartos','semis','tercer','final')),
  codigo text,
  grupo text check (grupo in ('A','B','C','D')),
  jornada int,
  orden int not null default 0,
  estacion int check (estacion between 1 and 9),
  local_id uuid references public.parejas(id) on delete set null,
  visitante_id uuid references public.parejas(id) on delete set null,
  goles_local int check (goles_local between 0 and 99),
  goles_visitante int check (goles_visitante between 0 and 99),
  pen_local int check (pen_local between 0 and 99),
  pen_visitante int check (pen_visitante between 0 and 99),
  estado text not null default 'pendiente' check (estado in ('pendiente','en_juego','finalizado')),
  updated_at timestamptz not null default now()
);
create index if not exists partidos_orden on public.partidos (orden);
alter table public.partidos enable row level security;
drop policy if exists "partidos lectura publica" on public.partidos;
create policy "partidos lectura publica" on public.partidos for select to anon, authenticated using (true);
drop policy if exists "partidos admin escribe" on public.partidos;
create policy "partidos admin escribe" on public.partidos for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop function if exists public.inscritos_publicos();
create function public.inscritos_publicos()
returns table (id uuid, nombre_equipo text, club text, foto_path text, estado text, created_at timestamptz, grupo text, desempate int)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nombre_equipo, p.club, p.foto_path, p.estado, p.created_at, p.grupo, p.desempate
  from public.parejas p where p.estado <> 'rechazado' order by p.created_at;
$$;
grant execute on function public.inscritos_publicos() to anon, authenticated;
