-- Função RPC para agregar diagnósticos comórbidos das crianças.
-- Usada exclusivamente pelo painel admin via supabaseAdmin (service_role).
-- SECURITY DEFINER: executada com os privilégios do owner (postgres),
-- mas chamável apenas internamente via service_role — sem exposição ao cliente.

CREATE OR REPLACE FUNCTION public.get_diagnoses_stats()
RETURNS TABLE(diagnosis text, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jsonb_array_elements_text(diagnoses) AS diagnosis,
    COUNT(*)                             AS count
  FROM public.children
  WHERE jsonb_array_length(diagnoses) > 0
  GROUP BY diagnosis
  ORDER BY count DESC
  LIMIT 10;
$$;

-- Revogar acesso público à função (apenas service_role pode chamar via supabaseAdmin)
REVOKE ALL ON FUNCTION public.get_diagnoses_stats() FROM PUBLIC, anon, authenticated;
