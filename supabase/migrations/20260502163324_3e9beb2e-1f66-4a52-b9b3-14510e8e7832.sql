-- Função de updated_at (cria se ainda não existir)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Tabela professionals
CREATE TABLE public.professionals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT professionals_user_email_unique UNIQUE (user_id, email)
);

CREATE INDEX idx_professionals_user_id ON public.professionals(user_id);

ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "professionals_select_own"
ON public.professionals
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "professionals_insert_own"
ON public.professionals
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "professionals_update_own"
ON public.professionals
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "professionals_delete_own"
ON public.professionals
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_professionals_updated_at
BEFORE UPDATE ON public.professionals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();