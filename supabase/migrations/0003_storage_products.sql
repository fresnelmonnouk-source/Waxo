-- Waxo (Wá xɔ) — 0003 : bucket Storage `products` (photos produits et packs).
-- À exécuter dans l'éditeur SQL Supabase (par Fresnel). Idempotent.
-- Lecture publique des fichiers ; AUCUNE écriture pour anon/authenticated : seule la clé service_role
-- (route POST /api/admin/upload, après vérification admin + signature d'octets) peut déposer ou supprimer.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('products', 'products', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Politiques sur storage.objects (la RLS y est déjà activée par Supabase).
drop policy if exists "products_public_read" on storage.objects;
create policy "products_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'products');

-- Défense en profondeur : on supprime d'éventuelles politiques d'écriture portant ces noms (rejouable) et on n'en recrée AUCUNE.
-- Sans politique INSERT/UPDATE/DELETE, la RLS refuse toute écriture à anon/authenticated ; service_role contourne la RLS.
drop policy if exists "products_insert" on storage.objects;
drop policy if exists "products_update" on storage.objects;
drop policy if exists "products_delete" on storage.objects;
