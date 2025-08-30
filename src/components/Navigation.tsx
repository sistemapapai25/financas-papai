// src/components/Navigation.tsx
import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import {
  Home,
  Receipt,
  FileCheck2,
  Users,
  UserPlus,
  Tag,
  Menu,
  LogOut,
  DollarSign,
  FileBarChart,
  Church,
  Landmark, // ✅ ícone para Contas Financeiras
} from 'lucide-react';

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const location = useLocation();

  const menuItems = [{ title: 'Dashboard', href: '/', icon: Home }];

  // ✅ Entradas de Culto (3ª) e Relatório por último
  const movimentacoesItems = [
    { title: 'Contas a Pagar', href: '/contas-a-pagar', icon: Receipt },
    { title: 'Contas Pagas', href: '/contas-pagas', icon: FileCheck2 },
    { title: 'Entradas de Culto', href: '/movimentacoes/entradas-culto', icon: DollarSign },
    { title: 'Lista de Cultos', href: '/lista-cultos', icon: Church },
    { title: 'Relatório de Pagamentos', href: '/relatorio-pagamentos', icon: FileBarChart },
  ];

  // ✅ Inclui “Contas Financeiras” e “Tipos de Culto”
  const cadastroItems = [
    { title: 'Beneficiários', href: '/cadastros/beneficiarios', icon: UserPlus },
    { title: 'Categorias', href: '/cadastros/categorias', icon: Tag },
    { title: 'Usuários', href: '/cadastros/usuarios', icon: Users },
    { title: 'Contas Financeiras', href: '/cadastros/contas-financeiras', icon: Landmark }, // ✅ novo
    { title: 'Tipos de Culto', href: '/cadastros/tipos-culto', icon: Church },
  ];

  const isActive = (path: string) => location.pathname === path;

  const inMovimentacoes = useMemo(
    () =>
      ['/contas-a-pagar', '/contas-pagas', '/movimentacoes/entradas-culto', '/lista-cultos', '/relatorio-pagamentos'].some((p) =>
        location.pathname.startsWith(p),
      ),
    [location.pathname],
  );

  const inCadastros = useMemo(
    () => ['/cadastros/'].some((p) => location.pathname.startsWith(p)),
    [location.pathname],
  );

  const NavLinks = ({
    mobile = false,
    onItemClick,
  }: {
    mobile?: boolean;
    onItemClick?: () => void;
  }) => (
    <nav className={mobile ? 'flex flex-col space-y-2' : 'hidden md:flex md:items-center md:space-x-6'}>
      {/* Principal */}
      <div className={mobile ? 'space-y-2' : 'flex items-center space-x-2'}>
        {menuItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onClick={onItemClick}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive(item.href)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.title}
          </Link>
        ))}
      </div>

      {mobile && <hr className="border-border" />}

      {/* Movimentações - Mobile */}
      <div className={mobile ? 'space-y-2' : 'hidden'}>
        {mobile && (
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide px-3">
            Movimentações
          </h3>
        )}
        {movimentacoesItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onClick={onItemClick}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive(item.href)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.title}
          </Link>
        ))}
      </div>

      {mobile && <hr className="border-border" />}

      {/* Cadastros - Mobile */}
      <div className={mobile ? 'space-y-2' : 'hidden'}>
        {mobile && (
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide px-3">
            Cadastros
          </h3>
        )}
        {cadastroItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onClick={onItemClick}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive(item.href)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.title}
          </Link>
        ))}
      </div>

      {/* Dropdown Movimentações - Desktop */}
      {!mobile && (
        <div className="relative group">
          <Button
            variant={inMovimentacoes ? 'secondary' : 'ghost'}
            className={`flex items-center gap-1 ${inMovimentacoes ? 'text-foreground' : ''}`}
          >
            <DollarSign className="w-4 h-4" />
            Movimentações
          </Button>
          <div className="absolute top-full left-0 mt-2 w-64 bg-background border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            {movimentacoesItems.map((item, idx, arr) => (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors ${
                  idx === 0 ? 'rounded-t-md' : ''
                } ${idx === arr.length - 1 ? 'rounded-b-md' : ''} ${
                  isActive(item.href) ? 'bg-muted text-primary' : ''
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Dropdown Cadastros - Desktop */}
      {!mobile && (
        <div className="relative group">
          <Button
            variant={inCadastros ? 'secondary' : 'ghost'}
            className={`flex items-center gap-1 ${inCadastros ? 'text-foreground' : ''}`}
          >
            <Tag className="w-4 h-4" />
            Cadastros
          </Button>
          <div className="absolute top-full left-0 mt-2 w-56 bg-background border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            {cadastroItems.map((item, idx, arr) => (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors ${
                  idx === 0 ? 'rounded-t-md' : ''
                } ${idx === arr.length - 1 ? 'rounded-b-md' : ''} ${
                  isActive(item.href) ? 'bg-muted text-primary' : ''
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/lovable-uploads/ddde374a-4e76-43e2-88da-fbfaa022f04c.png"
              alt="Logo Igreja"
              className="w-6 h-6 object-contain"
            />
            <span className="font-bold text-lg">Finanças Papai</span>
          </Link>

          {/* Navegação Desktop */}
          <NavLinks />

          {/* Usuário + Ações */}
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-sm text-muted-foreground">{user?.email}</span>

            {/* Botão Sair - Desktop */}
            <Button variant="outline" size="sm" onClick={signOut} className="hidden sm:flex">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>

            {/* Menu Mobile (hambúrguer) */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="md:hidden" aria-label="Abrir menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <div className="flex flex-col h-full">
                  {/* Cabeçalho Mobile */}
                  <div className="pb-4 border-b">
                    <div className="flex items-center gap-2 mb-2">
                      <img
                        src="/lovable-uploads/ddde374a-4e76-43e2-88da-fbfaa022f04c.png"
                        alt="Logo Igreja"
                        className="w-5 h-5 object-contain"
                      />
                      <span className="font-semibold">Finanças Papai</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                  </div>

                  {/* Navegação Mobile */}
                  <div className="flex-1 py-4">
                    <NavLinks mobile onItemClick={() => setIsOpen(false)} />
                  </div>

                  {/* Botão Sair - Mobile */}
                  <div className="pt-4 border-t">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        signOut();
                        setIsOpen(false);
                      }}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sair
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navigation;
