import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.1edba083fdf94605b000606ee74e7a0e',
  appName: 'meu-contas-em-dia',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://1edba083-fdf9-4605-b000-606ee74e7a0e.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;