import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
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

export default function RegrasClassificacao() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [rules, setRules] = useState<Rule[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
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
        if (!user) return;
        loadRules();
        loadCategories();
        loadBeneficiaries();
    }, [user]);

    const loadRules = async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from("classification_rules" as any)
            .select(`
        id,
        term,
        category_id,
        beneficiary_id,
        category:categories(name),
        beneficiary:beneficiaries(name)
      `)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (error) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
            return;
        }

        const mapped: Rule[] = (data || []).map((r: any) => ({
            id: r.id,
            term: r.term,
            category_id: r.category_id,
            beneficiary_id: r.beneficiary_id,
            category_name: r.category?.name,
            beneficiary_name: r.beneficiary?.name,
        }));
        setRules(mapped);
    };

    const loadCategories = async () => {
        if (!user) return;
        const { data } = await supabase
            .from("categories")
            .select("id, name")
            .eq("user_id", user.id)
            .not("parent_id", "is", null)
            .order("name");
        setCategories(data || []);
    };

    const loadBeneficiaries = async () => {
        if (!user) return;
        const { data } = await supabase
            .from("beneficiaries")
            .select("id, name")
            .eq("user_id", user.id)
            .order("name");
        setBeneficiaries(data || []);
    };

    const addRule = async () => {
        if (!user || !newTerm.trim()) {
            toast({ title: "Erro", description: "Preencha o termo de busca", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.from("classification_rules" as any).insert({
                user_id: user.id,
                term: newTerm.trim(),
                category_id: newCategoryId || null,
                beneficiary_id: newBeneficiaryId || null,
            });

            if (error) throw error;

            toast({ title: "Sucesso", description: "Regra criada" });
            setNewTerm("");
            setNewCategoryId("");
            setNewBeneficiaryId("");
            loadRules();
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const deleteRule = async (id: string) => {
        if (!user) return;
        const { error } = await supabase.from("classification_rules" as any).delete().eq("id", id).eq("user_id", user.id);
        if (error) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
            return;
        }
        toast({ title: "Sucesso", description: "Regra excluída" });
        loadRules();
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
                            <Button onClick={addRule} disabled={loading}>
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
