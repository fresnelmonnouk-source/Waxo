-- 0004 · Réglages « Mentions légales » (clé settings.legal)
-- Ajoute la ligne `legal` PUBLIQUE par défaut (toutes les valeurs vides : aucune information inventée).
-- Lue par la boutique (pages légales de l'agent « pages d'infos ») ; éditée depuis /admin/reglages (service_role).
-- Idempotent : peut être rejouée sans effet (on conflict do nothing → ne remplace jamais une valeur déjà saisie).
-- RLS : la table `settings` est déjà protégée (0001) — lecture publique si is_public, aucune écriture pour anon/authenticated.

insert into public.settings (key, value, is_public) values
  ('legal',
   '{"companyName":"","legalForm":"","ifu":"","rccm":"","address":"","phone":"","email":"","hostName":"","hostAddress":"","publicationDirector":"","apdpReceipt":""}'::jsonb,
   true)
on conflict (key) do nothing;
