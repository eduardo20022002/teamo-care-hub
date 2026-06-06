-- F-01: Expandir allowed_mime_types do bucket 'attachments' para cobrir
-- os tipos de arquivo usados por agenda_observation_attachments.
--
-- A migration 20260514200000 restringiu o bucket a PDF/JPG/PNG.
-- O módulo de agenda (20260517000000), adicionado depois, permite áudio e vídeo
-- na tabela agenda_observation_attachments — mas o bucket rejeitava esses uploads
-- silenciosamente, exibindo apenas "Não foi possível concluir" ao usuário.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  -- Documentos e imagens (record_attachments + child_attachments)
  'application/pdf',
  'image/jpeg',
  'image/png',
  -- Imagens adicionais (agenda_observation_attachments)
  'image/webp',
  -- Áudio (agenda_observation_attachments)
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/webm',
  -- Vídeo (agenda_observation_attachments)
  'video/mp4',
  'video/webm',
  'video/quicktime'
]
WHERE id = 'attachments';
