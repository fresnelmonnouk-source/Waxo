-- 0023_conversations.sql : espace « Discussion » (fil client <-> équipe), remplace la boîte `messages`.
-- Un client écrit (formulaire de contact, assistant), reçoit par e-mail un LIEN PRIVÉ /{lang}/discussion/{jeton} pour lire
-- le fil et répondre ; connecté, il retrouve aussi ses demandes dans « Mon compte ».
--
-- Jetons : 32 octets aléatoires (base64url), JAMAIS stockés en clair. Seul leur SHA-256 (hex) est conservé, dans
-- `conversation_links` : chaque e-mail envoyé au client porte un nouveau jeton (le serveur ne peut pas relire l'ancien),
-- et tous les liens déjà envoyés restent valides.
--
-- Droits : aucune lecture ni écriture pour `anon`. Un client connecté LIT ses conversations (user_id = auth.uid()) et leurs
-- messages SAUF les notes internes. Toutes les écritures passent par les routes serveur (service_role) et les fonctions
-- ci-dessous, exécutables par service_role seulement.
--
-- Reprise : chaque ligne de `messages` devient une conversation (même id) avec son premier message. La table `messages`
-- n'est NI modifiée NI supprimée. Rejouable : if not exists / create or replace / drop ... if exists / on conflict.

-- ───────────────────────── Tables ─────────────────────────
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'question' check (category in ('question', 'plainte', 'retour', 'commande', 'autre')),
  status text not null default 'nouveau' check (status in ('nouveau', 'en_cours', 'resolu')),
  subject text not null default '' check (length(subject) <= 160),
  order_number text check (order_number is null or length(order_number) <= 40),
  customer_name text not null check (length(customer_name) between 1 and 120),
  -- E-mail et/ou téléphone saisis par le client (jamais envoyés à l'IA).
  customer_contact text not null check (length(customer_contact) between 3 and 200),
  user_id uuid references auth.users(id) on delete set null,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  source text not null default 'contact' check (source in ('contact', 'assistant', 'suivi', 'compte')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unread_admin boolean not null default true,
  unread_customer boolean not null default false
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  author text not null check (author in ('client', 'equipe', 'note_interne')),
  body text not null check (length(body) between 1 and 3000),
  author_admin_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Liens privés : SHA-256 hex du jeton (64 caractères). Le jeton lui-même n'est jamais écrit en base.
create table if not exists public.conversation_links (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Index ─────────────────────────
create index if not exists conversations_last_idx on public.conversations (last_message_at desc);
create index if not exists conversations_status_idx on public.conversations (status, last_message_at desc);
create index if not exists conversations_user_idx on public.conversations (user_id, last_message_at desc) where user_id is not null;
-- Pastille du menu admin : « à traiter » = nouvelle ou réponse client non lue.
create index if not exists conversations_todo_idx on public.conversations (last_message_at desc) where status = 'nouveau' or unread_admin;
create index if not exists conversation_messages_conv_idx on public.conversation_messages (conversation_id, created_at);
create index if not exists conversation_links_conv_idx on public.conversation_links (conversation_id);

-- ───────────────────────── RLS et droits ─────────────────────────
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.conversation_links enable row level security;

-- Aucun accès direct pour les visiteurs anonymes (le fil par lien passe par le serveur).
revoke all on public.conversations, public.conversation_messages, public.conversation_links from anon;
-- Aucune écriture directe pour un client connecté ; aucun accès aux liens.
revoke insert, update, delete, truncate, references, trigger on public.conversations, public.conversation_messages from authenticated;
revoke all on public.conversation_links from authenticated;
-- Messages : le client connecté ne voit pas l'identifiant de l'admin qui a répondu.
revoke select on public.conversation_messages from authenticated;
grant select (id, conversation_id, author, body, created_at) on public.conversation_messages to authenticated;
grant select on public.conversations to authenticated;
grant all on public.conversations, public.conversation_messages, public.conversation_links to service_role;

drop policy if exists conversations_owner_read on public.conversations;
create policy conversations_owner_read on public.conversations for select to authenticated
  using (user_id is not null and user_id = (select auth.uid()));
drop policy if exists conversations_admin_read on public.conversations;
create policy conversations_admin_read on public.conversations for select to authenticated
  using (public.is_admin());

drop policy if exists conversation_messages_owner_read on public.conversation_messages;
create policy conversation_messages_owner_read on public.conversation_messages for select to authenticated
  using (
    author <> 'note_interne'
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id is not null and c.user_id = (select auth.uid()))
  );
drop policy if exists conversation_messages_admin_read on public.conversation_messages;
create policy conversation_messages_admin_read on public.conversation_messages for select to authenticated
  using (public.is_admin());
-- conversation_links : aucune politique, donc inaccessible hors service_role.

-- ───────────────────────── Fonctions (service_role seulement) ─────────────────────────
-- Ouvre une conversation : conversation + premier message du client + lien privé, en une transaction.
create or replace function public.conversation_open(
  p_category text,
  p_subject text,
  p_order_number text,
  p_name text,
  p_contact text,
  p_user_id uuid,
  p_locale text,
  p_source text,
  p_body text,
  p_token_hash text
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  insert into public.conversations (category, subject, order_number, customer_name, customer_contact, user_id, locale, source)
  values (p_category, left(coalesce(p_subject, ''), 160), nullif(p_order_number, ''), p_name, p_contact, p_user_id,
          coalesce(p_locale, 'fr'), coalesce(p_source, 'contact'))
  returning id into v_id;
  insert into public.conversation_messages (conversation_id, author, body) values (v_id, 'client', p_body);
  if p_token_hash is not null then
    insert into public.conversation_links (token_hash, conversation_id) values (p_token_hash, v_id);
  end if;
  return v_id;
end $$;

-- Ajoute un message et met à jour les indicateurs, ligne verrouillée (deux réponses simultanées restent cohérentes).
--  client       : non lu côté équipe ; une demande résolue est rouverte (en_cours).
--  equipe       : non lu côté client ; une demande nouvelle passe en_cours ; lue côté équipe.
--  note_interne : jamais visible du client ; ne change ni l'ordre du fil ni les indicateurs client.
-- Renvoie une ligne vide si la conversation n'existe pas.
create or replace function public.conversation_post(
  p_conversation uuid,
  p_author text,
  p_body text,
  p_admin uuid default null
) returns table (message_id uuid, was_unread_admin boolean, new_status text)
language plpgsql security invoker set search_path = public as $$
declare
  v_unread boolean;
  v_status text;
  v_msg uuid;
begin
  select c.unread_admin, c.status into v_unread, v_status from public.conversations c where c.id = p_conversation for update;
  if not found then
    return;
  end if;
  insert into public.conversation_messages (conversation_id, author, body, author_admin_id)
  values (p_conversation, p_author, p_body, case when p_author = 'client' then null else p_admin end)
  returning id into v_msg;
  if p_author = 'client' then
    v_status := case when v_status = 'resolu' then 'en_cours' else v_status end;
    update public.conversations set unread_admin = true, unread_customer = false, last_message_at = now(), status = v_status
      where id = p_conversation;
  elsif p_author = 'equipe' then
    v_status := case when v_status = 'nouveau' then 'en_cours' else v_status end;
    update public.conversations set unread_customer = true, unread_admin = false, last_message_at = now(), status = v_status
      where id = p_conversation;
  end if;
  message_id := v_msg;
  was_unread_admin := v_unread;
  new_status := v_status;
  return next;
end $$;

revoke execute on function public.conversation_open(text, text, text, text, text, uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.conversation_post(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.conversation_open(text, text, text, text, text, uuid, text, text, text, text) to service_role;
grant execute on function public.conversation_post(uuid, text, text, uuid) to service_role;

-- ───────────────────────── Reprise des messages existants ─────────────────────────
-- Même id que le message d'origine : rejouer la migration n'en crée jamais deux. À rejouer après le déploiement pour
-- reprendre les messages arrivés entre l'application de ce fichier et la mise en ligne du nouveau formulaire.
insert into public.conversations (id, category, status, subject, order_number, customer_name, customer_contact, locale, source,
                                  last_message_at, created_at, unread_admin, unread_customer)
select
  m.id,
  case m.subject
    when 'Commande' then 'commande'
    when 'Livraison' then 'commande'
    when 'Retour ou échange' then 'retour'
    when 'Produit' then 'question'
    else 'autre'
  end,
  case when m.done then 'resolu' else 'nouveau' end,
  left(coalesce(m.subject, ''), 160),
  nullif(left(coalesce(m.order_number, ''), 40), ''),
  m.name,
  m.contact,
  'fr',
  'contact',
  m.created_at,
  m.created_at,
  not m.done,
  false
from public.messages m
on conflict (id) do nothing;

insert into public.conversation_messages (id, conversation_id, author, body, created_at)
select m.id, m.id, 'client', m.body, m.created_at
from public.messages m
where exists (select 1 from public.conversations c where c.id = m.id)
on conflict (id) do nothing;
