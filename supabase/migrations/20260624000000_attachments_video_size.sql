-- F-02: Permitir anexos de vídeo nos registros (diário dos pais).
--
-- A migration 20260514200000 fixou file_size_limit do bucket 'attachments' em 10 MB.
-- Vídeos de celular passam facilmente de 10 MB, então o upload era rejeitado pelo
-- Storage mesmo quando o MIME (video/mp4|webm|quicktime, liberado em 20260607230000)
-- era aceito — e o erro chegava silencioso ao usuário ("não ficou disponível").
--
-- Eleva o limite do bucket para 50 MB. A validação no cliente (src/lib/validation.ts)
-- aplica o limite por tipo: imagens/PDF/áudio = 10 MB, vídeo = 50 MB.

UPDATE storage.buckets
SET file_size_limit = 52428800  -- 50 MB em bytes
WHERE id = 'attachments';
