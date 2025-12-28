import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { Menu, LogOut } from 'lucide-react';

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;
  const subLinkCls = (path: string) => `py-3 border-b-2 ${isActive(path) ? 'border-blue-700 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`;
  const groupCls = (paths: string[]) => `py-3 border-b-2 ${paths.some(p => isActive(p)) ? 'border-blue-700 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`;
  const groupTitleCls = (paths: string[]) => `px-3 py-1 text-xs font-semibold ${paths.some(p => isActive(p)) ? 'text-blue-700' : 'text-muted-foreground'}`;

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="bg-blue-700 text-white">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-white">
            <img src="/lovable-uploads/ddde374a-4e76-43e2-88da-fbfaa022f04c.png" alt="Logo" className="w-6 h-6 object-contain" />
            <span className="font-bold text-lg">Finanças Papai</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-sm opacity-90">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={signOut} className="hidden sm:flex bg-white text-blue-700 hover:bg-white/90">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="md:hidden text-white" aria-label="Abrir menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <div className="flex flex-col h-full">
                  <div className="pb-4 border-b">
                    <div className="flex items-center gap-2 mb-2">
                      <img src="/lovable-uploads/ddde374a-4e76-43e2-88da-fbfaa022f04c.png" alt="Logo" className="w-5 h-5 object-contain" />
                      <span className="font-semibold">Finanças Papai</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                  </div>
                  <div className="flex-1 py-4">
                    <nav className="flex flex-col space-y-4">
                      <Link to="/" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Dashboard</Link>

                      <div>
                        <div className={groupTitleCls(['/meus-desafios', '/meus-desafios/gestao-carnes'])}>Desafios Financeiros</div>
                        <div className="flex flex-col">
                          <Link to="/meus-desafios" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Desafios</Link>
                          <Link to="/meus-desafios/gestao-carnes" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Gestão de Carnês</Link>
                        </div>
                      </div>

                      <div>
                        <div className={groupTitleCls(['/financeiro/agenda', '/contas-a-pagar', '/contas-pagas', '/relatorio-pagamentos', '/financeiro/resumo-anual'])}>Movimentações</div>
                        <div className="flex flex-col">
                          <Link to="/financeiro/agenda" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Agenda Financeira</Link>
                          <Link to="/contas-a-pagar" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Contas a Pagar</Link>
                          <Link to="/contas-pagas" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Contas Pagas</Link>
                          <Link to="/relatorio-pagamentos" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Relatório de Pagamentos</Link>
                          <Link to="/financeiro/resumo-anual" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Resumo Anual</Link>
                        </div>
                      </div>

                      <div>
                        <div className={groupTitleCls(['/movimentacoes/entradas-culto', '/lista-cultos'])}>Cultos</div>
                        <div className="flex flex-col">
                          <Link to="/movimentacoes/entradas-culto" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Entradas de Culto</Link>
                          <Link to="/lista-cultos" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Lista de Cultos</Link>
                        </div>
                      </div>

                      <div>
                        <div className={groupTitleCls(['/financeiro/lancamentos', '/movimentacoes/importar-extrato', '/financeiro/resumo-anual'])}>Conciliação</div>
                        <div className="flex flex-col">
                          <Link to="/financeiro/lancamentos" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Lançamentos</Link>
                          <Link to="/movimentacoes/importar-extrato" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Importar Extrato</Link>
                          <Link to="/financeiro/resumo-anual" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Resumo Anual</Link>
                        </div>
                      </div>

                      <div>
                        <div className={groupTitleCls(['/cadastros/beneficiarios', '/cadastros/categorias', '/cadastros/contas-financeiras', '/cadastros/tipos-culto', '/cadastros/pessoas', '/cadastros/usuarios'])}>Cadastros</div>
                        <div className="flex flex-col">
                          <Link to="/cadastros/beneficiarios" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Beneficiários</Link>
                          <Link to="/cadastros/categorias" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Categorias</Link>
                          <Link to="/cadastros/contas-financeiras" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Contas Financeiras</Link>
                          <Link to="/cadastros/tipos-culto" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Tipos de Culto</Link>
                          <Link to="/cadastros/pessoas" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Participantes</Link>
                          <Link to="/cadastros/usuarios" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Usuários</Link>
                        </div>
                      </div>

                      <div>
                        <div className={groupTitleCls(['/configuracoes/regras-classificacao','/configuracoes/igreja'])}>Configurações</div>
                        <div className="flex flex-col">
                          <Link to="/configuracoes/regras-classificacao" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Regras de Classificação</Link>
                          <Link to="/configuracoes/igreja" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setIsOpen(false)}>Configuração da Igreja</Link>
                        </div>
                      </div>
                    </nav>
                  </div>
                  <div className="pt-4 border-t">
                    <Button variant="outline" className="w-full" onClick={() => { signOut(); setIsOpen(false); }}>
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
      <div className="bg-background border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-6 overflow-x-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={groupCls(['/meus-desafios', '/meus-desafios/gestao-carnes'])}>Desafios Financeiros</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem asChild>
                  <Link to="/meus-desafios">Desafios</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/meus-desafios/gestao-carnes">Gestão de Carnês</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={groupCls(['/financeiro/agenda', '/contas-a-pagar', '/contas-pagas', '/relatorio-pagamentos', '/financeiro/resumo-anual'])}>Movimentações</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem asChild>
                  <Link to="/financeiro/agenda">Agenda Financeira</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/contas-a-pagar">Contas a Pagar</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/contas-pagas">Contas Pagas</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/relatorio-pagamentos">Relatório de Pagamentos</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/financeiro/resumo-anual">Resumo Anual</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={groupCls(['/movimentacoes/entradas-culto', '/lista-cultos'])}>Cultos</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem asChild>
                  <Link to="/movimentacoes/entradas-culto">Entradas de Culto</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/lista-cultos">Lista de Cultos</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={groupCls(['/financeiro/lancamentos', '/movimentacoes/importar-extrato', '/financeiro/resumo-anual'])}>Conciliação</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem asChild>
                  <Link to="/financeiro/lancamentos">Lançamentos</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/movimentacoes/importar-extrato">Importar Extrato</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/financeiro/resumo-anual">Resumo Anual</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={groupCls(['/cadastros/beneficiarios', '/cadastros/categorias', '/cadastros/contas-financeiras', '/cadastros/tipos-culto', '/cadastros/pessoas', '/cadastros/usuarios'])}>Cadastros</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem asChild>
                  <Link to="/cadastros/beneficiarios">Beneficiários</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/cadastros/categorias">Categorias</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/cadastros/contas-financeiras">Contas Financeiras</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/cadastros/tipos-culto">Tipos de Culto</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/cadastros/pessoas">Participantes</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/cadastros/usuarios">Usuários</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={groupCls(['/configuracoes/regras-classificacao','/configuracoes/igreja'])}>Configurações</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem asChild>
                  <Link to="/configuracoes/regras-classificacao">Regras de Classificação</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/configuracoes/igreja">Configuração da Igreja</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navigation;
