import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Plus, Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

type Rule = {
    id: string;
    term: string;
    category_id: string | null;
    beneficiary_id: string | null;
    category_name?: string;
    beneficiary_name?: string;
};

type Category = {
    id: string;
    name: string;
};

type Beneficiary = {
    id: string;
    name: string;
};

type UserOpt = {
    id: string;
    label: string;
};

export default function RegrasClassificacao() {
    const { user } = useAuth();
    const { isAdmin, loading: roleLoading } = useUserRole();
    const { toast } = useToast();
    const [rules, setRules] = useState<Rule[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
    const [userOptions, setUserOptions] = useState<UserOpt[]>([]);
    const [scopeUserId, setScopeUserId] = useState<string>("");
    const [newTerm, setNewTerm] = useState("");
    const [newCategoryId, setNewCategoryId] = useState("");
    const [newBeneficiaryId, setNewBeneficiaryId] = useState("");
    const [loading, setLoading] = useState(false);
    const [openCategory, setOpenCategory] = useState(false);
    const [openBeneficiary, setOpenBeneficiary] = useState(false);
    const [categorySearch, setCategorySearch] = useState("");
    const [beneficiarySearch, setBeneficiarySearch] = useState("");

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        if (!user || roleLoading) return;

        if (!scopeUserId) setScopeUserId(isAdmin ? "__ALL__" : user.id);

        if (isAdmin) {
            supabase
                .from("profiles")
                .select("auth_user_id,email,name")
                .order("created_at", { ascending: false })
                .then(({ data, error }) => {
                    if (error) return;
                    const opts: UserOpt[] = (data || [])
                        .map((p) => {
                            const id = p.auth_user_id as string | null;
                            if (!id) return null;
                            const label = (p.name || p.email || id) as string;
                            return { id, label };
                        })
                        .filter((x): x is UserOpt => !!x);
                    setUserOptions(opts);
                });
        } else {
            setUserOptions([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, roleLoading, isAdmin]);

    useEffect(() => {
        if (!user || roleLoading) return;
        const target = isAdmin ? scopeUserId : user.id;
        if (!target) return;
        loadRules(target);
        if (target === "__ALL__") {
            setCategories([]);
            setBeneficiaries([]);
            setNewCategoryId("");
            setNewBeneficiaryId("");
            return;
        }
        loadCategories(target);
        loadBeneficiaries(target);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, roleLoading, isAdmin, scopeUserId]);

    const loadRules = async (targetUserId: string) => {
        if (!user) return;
        let q = supabase
            .from("classification_rules")
            .select(`
        id,
        term,
        category_id,
        beneficiary_id,
        category:categories(name),
        beneficiary:beneficiaries(name)
      `)
            .order("created_at", { ascending: false });
        if (!isAdmin || targetUserId !== "__ALL__") {
            q = q.eq("user_id", targetUserId === "__ALL__" ? user.id : targetUserId);
        }

        const { data, error } = await q;

        if (error) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
            return;
        }

        type RuleRow = {
            id: string;
            term: string;
            category_id: string | null;
            beneficiary_id: string | null;
            category?: { name?: string | null } | null;
            beneficiary?: { name?: string | null } | null;
        };
        const mapped: Rule[] = (data || []).map((r: RuleRow) => ({
            id: r.id,
            term: r.term,
            category_id: r.category_id,
            beneficiary_id: r.beneficiary_id,
            category_name: r.category?.name,
            beneficiary_name: r.beneficiary?.name,
        }));
        setRules(mapped);
    };

    const loadCategories = async (targetUserId: string) => {
        if (!user) return;
        const { data, error } = await supabase
            .from("categories")
            .select("id, name")
            .eq("user_id", targetUserId)
            .order("tipo")
            .order("name");
        if (error) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
            return;
        }
        setCategories(data || []);
    };

    const loadBeneficiaries = async (targetUserId: string) => {
        if (!user) return;
        const { data } = await supabase
            .from("beneficiaries")
            .select("id, name")
            .eq("user_id", targetUserId)
            .order("name");
        setBeneficiaries(data || []);
    };

    const addRule = async () => {
        if (!user || !newTerm.trim()) {
            toast({ title: "Erro", description: "Preencha o termo de busca", variant: "destructive" });
            return;
        }

        const targetUserId = isAdmin ? scopeUserId : user.id;
        if (isAdmin && targetUserId === "__ALL__") {
            toast({ title: "Usuário", description: "Selecione um usuário específico para criar a regra.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.from("classification_rules").insert({
                user_id: targetUserId,
                term: newTerm.trim(),
                category_id: newCategoryId || null,
                beneficiary_id: newBeneficiaryId || null,
            });

            if (error) throw error;

            toast({ title: "Sucesso", description: "Regra criada" });
            setNewTerm("");
            setNewCategoryId(""
            );
            setNewBeneficiaryId("");
            loadRules(targetUserId);
        } catch (error: unknown) {
            toast({ title: "Erro", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const deleteRule = async (id: string) => {
        if (!user) return;
        let q = supabase.from("classification_rules").delete().eq("id", id);
        if (!isAdmin) q = q.eq("user_id", user.id);
        const { error } = await q;
        if (error) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
            return;
        }
        toast({ title: "Sucesso", description: "Regra excluída" });
        const targetUserId = isAdmin ? scopeUserId : user.id;
        loadRules(targetUserId || user.id);
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Regras de Classificação</h1>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Nova Regra</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4">
                            {isAdmin ? (
                                <div>
                                    <Label>Usuário</Label>
                                    <Select value={scopeUserId} onValueChange={setScopeUserId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione um usuário" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__ALL__">Todos os usuários</SelectItem>
                                            {userOptions.map((u) => (
                                                <SelectItem key={u.id} value={u.id}>
                                                    {u.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : null}
                            <div>
                                <Label>Se a descrição contiver</Label>
                                <Input
                                    placeholder="Ex: Pix recebido"
                                    value={newTerm}
                                    onChange={(e) => setNewTerm(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Definir Categoria</Label>
                                <Popover open={openCategory} onOpenChange={setOpenCategory}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between">
                                            {newCategoryId ? categories.find(c => c.id === newCategoryId)?.name : "Selecione uma categoria"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0">
                                        <Command>
                                            <CommandInput placeholder="Buscar categoria..." value={categorySearch} onValueChange={setCategorySearch} />
                                            <CommandList>
                                                <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                                                <CommandGroup>
                                                    {categories
                                                        .filter(c => categorySearch.length < 3 || c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                                                        .map(c => (
                                                            <CommandItem
                                                                key={c.id}
                                                                value={c.name}
                                                                onSelect={() => {
                                                                    setNewCategoryId(c.id);
                                                                    setOpenCategory(false);
                                                                    setCategorySearch("");
                                                                }}
                                                            >
                                                                <Check className={cn("mr-2 h-4 w-4", newCategoryId === c.id ? "opacity-100" : "opacity-0")} />
                                                                {c.name}
                                                            </CommandItem>
                                                        ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div>
                                <Label>Definir Beneficiário</Label>
                                <Popover open={openBeneficiary} onOpenChange={setOpenBeneficiary}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between">
                                            {newBeneficiaryId ? beneficiaries.find(b => b.id === newBeneficiaryId)?.name : "Selecione um beneficiário"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0">
                                        <Command>
                                            <CommandInput placeholder="Buscar beneficiário..." value={beneficiarySearch} onValueChange={setBeneficiarySearch} />
                                            <CommandList>
                                                <CommandEmpty>Nenhum beneficiário encontrado.</CommandEmpty>
                                                <CommandGroup>
                                                    {beneficiaries
                                                        .filter(b => beneficiarySearch.length < 3 || b.name.toLowerCase().includes(beneficiarySearch.toLowerCase()))
                                                        .map(b => (
                                                            <CommandItem
                                                                key={b.id}
                                                                value={b.name}
                                                                onSelect={() => {
                                                                    setNewBeneficiaryId(b.id);
                                                                    setOpenBeneficiary(false);
                                                                    setBeneficiarySearch("");
                                                                }}
                                                            >
                                                                <Check className={cn("mr-2 h-4 w-4", newBeneficiaryId === b.id ? "opacity-100" : "opacity-0")} />
                                                                {b.name}
                                                            </CommandItem>
                                                        ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <Button onClick={addRule} disabled={loading || (isAdmin && scopeUserId === "__ALL__")}>
                                <Plus className="w-4 h-4 mr-2" />
                                Adicionar Regra
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Regras Existentes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {rules.length === 0 ? (
                            <p className="text-muted-foreground text-center py-4">Nenhuma regra cadastrada</p>
                        ) : (
                            <div className="space-y-2">
                                {rules.map((rule) => (
                                    <div key={rule.id} className="flex items-center justify-between p-3 border rounded">
                                        <div className="flex-1">
                                            <div className="font-medium">"{rule.term}"</div>
                                            <div className="text-sm text-muted-foreground">
                                                {rule.category_name && <span>Categoria: {rule.category_name}</span>}
                                                {rule.category_name && rule.beneficiary_name && <span> • </span>}
                                                {rule.beneficiary_name && <span>Beneficiário: {rule.beneficiary_name}</span>}
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => deleteRule(rule.id)}>
                                            <Trash2 className="w-4 h-4 text-red-600" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
