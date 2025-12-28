-- Criar cron job para enviar lembretes de vencimento todos os dias às 8h
SELECT cron.schedule(
  'desafio-lembrete-vencimento-diario',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ghzwyigouhvljubitowt.supabase.co/functions/v1/desafio-lembrete-vencimento',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdoend5aWdvdWh2bGp1Yml0b3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNTAyMDEsImV4cCI6MjA3MDYyNjIwMX0.N18DkGrlF-0X8Gcg-7kePK0ZJ86-1wyiZu9SeUCjWvY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);