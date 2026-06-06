-- ─── A-02: Remover política UPDATE desnecessária e perigosa em care_invites ───
-- Todas as mutações de care_invites passam por ServerFns com supabaseAdmin.
-- A política authenticated UPDATE permitia que o owner alterasse qualquer campo,
-- incluindo status, accepted_by e token — sem passar pelo fluxo de ServerFn.
DROP POLICY IF EXISTS "care_invites_update_owner" ON public.care_invites;

-- ─── A-04: Sincronizar profiles.email quando auth.users.email muda ────────────
-- O trigger handle_new_user copia o email no signup, mas sem este trigger,
-- mudanças de email em auth.users não refletem em profiles.
-- Isso causava checkEmailTypeServer a retornar resultado desatualizado.
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email();

REVOKE EXECUTE ON FUNCTION public.sync_profile_email() FROM PUBLIC, anon, authenticated;

-- ─── A-05: Restringir professionals_select_care à criança do co-cuidador ──────
-- A política anterior expunha todos os profissionais do owner quando o co-cuidador
-- tinha acesso a QUALQUER filho — incluindo filhos aos quais não tinha acesso.
-- A nova política só expõe profissionais que aparecem em registros/agenda
-- das crianças às quais o co-cuidador tem acesso ativo.
DROP POLICY IF EXISTS "professionals_select_care" ON public.professionals;

CREATE POLICY "professionals_select_care" ON public.professionals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.care_access ca
      WHERE ca.caregiver_id = auth.uid()
        AND ca.status = 'active'
        AND (
          EXISTS (
            SELECT 1 FROM public.attendance_records ar
            WHERE ar.professional_id = professionals.id
              AND ar.child_id = ca.child_id
          )
          OR EXISTS (
            SELECT 1 FROM public.agenda_events ae
            WHERE ae.professional_id = professionals.id
              AND ae.child_id = ca.child_id
          )
        )
    )
  );
