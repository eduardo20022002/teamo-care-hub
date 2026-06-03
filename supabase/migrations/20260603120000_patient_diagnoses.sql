-- Migration: 20260603120000_patient_diagnoses.sql
-- Propósito: Adicionar array de diagnósticos estruturado à tabela children.
-- A coluna `diagnosis` (text) é mantida por compatibilidade; o formulário novo usa `diagnoses` (jsonb).

ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS diagnoses jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Migra dados existentes da coluna text para o array jsonb
UPDATE public.children
  SET diagnoses = jsonb_build_array(diagnosis)
  WHERE diagnosis IS NOT NULL AND diagnosis <> '' AND diagnoses = '[]'::jsonb;
