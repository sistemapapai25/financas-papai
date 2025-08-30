-- Add email and observacoes columns to beneficiaries table
ALTER TABLE public.beneficiaries 
ADD COLUMN email TEXT,
ADD COLUMN observacoes TEXT;