"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, UserCircle, Phone, Instagram, X, Mail, Calendar, FileText } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  instagram: string | null;
  email: string | null;
  data_nascimento: string | null;
  notas: string | null;
}

interface ClienteForm {
  nome: string;
  telefone: string;
  instagram: string;
  email: string;
  data_nascimento: string;
  notas: string;
}

const FORM_VAZIO: ClienteForm = {
  nome: "",
  telefone: "",
  instagram: "",
  email: "",
  data_nascimento: "",
  notas: "",
};

function clienteToForm(c: Cliente): ClienteForm {
  return {
    nome: c.nome,
    telefone: c.telefone ?? "",
    instagram: c.instagram ?? "",
    email: c.email ?? "",
    data_nascimento: c.data_nascimento ?? "",
    notas: c.notas ?? "",
  };
}

function buildPayload(form: ClienteForm): Record<string, unknown> {
  const p: Record<string, unknown> = { nome: form.nome.trim() };
  p.telefone        = form.telefone.trim()        || null;
  p.instagram       = form.instagram.trim()       || null;
  p.email           = form.email.trim()           || null;
  p.data_nascimento = form.data_nascimento.trim() || null;
  p.notas           = form.notas.trim()           || null;
  return p;
}

interface ClienteModalProps {
  cliente?: Cliente;
  onClose: () => void;
}

function ClienteModal({ cliente, onClose }: ClienteModalProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(cliente);
  const [form, setForm] = useState<ClienteForm>(
    cliente ? clienteToForm(cliente) : FORM_VAZIO
  );
  const [erro, setErro] = useState<string | null>(null);

  const setField =
    (field: keyof ClienteForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      isEdit
        ? api.patch(`/api/v1/clientes/${cliente!.id}`, payload)
        : api.post("/api/v1/clientes/", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      onClose();
    },
    onError: (err: Error) => {
      setErro(err.message || "Erro ao salvar cliente.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!form.nome.trim()) {
      setErro("O nome é obrigatório.");
      return;
    }
    mutation.mutate(buildPayload(form));
  };

  const inputCls =
    "w-full h-10 px-3 rounded-[12px] bg-[#050B12] border border-[#243337] text-[#F0EADD] text-sm placeholder-[#87938F] focus:border-[#2F9285]/60 outline-none transition-colors";
  const labelCls = "block text-xs font-medium text-[#87938F] mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-[#0B171C] border border-[#243337] rounded-[18px] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#243337]">
          <div>
            <h2 className="text-base font-bold text-[#F0EADD]">
              {isEdit ? "Editar Cliente" : "Novo Cliente"}
            </h2>
            <p className="text-xs text-[#87938F] mt-0.5">
              {isEdit ? `Editando ${cliente!.nome}` : "Preencha os dados do cliente"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-[10px] text-[#87938F] hover:text-[#F0EADD] hover:bg-[#102128] transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
            {/* Nome */}
            <div>
              <label className={labelCls}>
                Nome <span className="text-[#E35D5B]">*</span>
              </label>
              <input
                value={form.nome}
                onChange={setField("nome")}
                placeholder="Nome completo"
                autoFocus
                className={inputCls}
              />
            </div>

            {/* Telefone + Instagram */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={cn(labelCls, "flex items-center gap-1")}>
                  <Phone size={11} />
                  Telefone / WhatsApp
                </label>
                <input
                  type="tel"
                  value={form.telefone}
                  onChange={setField("telefone")}
                  placeholder="(11) 99999-9999"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={cn(labelCls, "flex items-center gap-1")}>
                  <Instagram size={11} />
                  Instagram
                </label>
                <input
                  value={form.instagram}
                  onChange={setField("instagram")}
                  placeholder="@usuario"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Email + Data nascimento */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={cn(labelCls, "flex items-center gap-1")}>
                  <Mail size={11} />
                  E-mail
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={setField("email")}
                  placeholder="email@exemplo.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={cn(labelCls, "flex items-center gap-1")}>
                  <Calendar size={11} />
                  Data de Nascimento
                </label>
                <input
                  type="date"
                  value={form.data_nascimento}
                  onChange={setField("data_nascimento")}
                  className={cn(inputCls, "cursor-pointer")}
                />
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className={cn(labelCls, "flex items-center gap-1")}>
                <FileText size={11} />
                Notas
              </label>
              <textarea
                value={form.notas}
                onChange={setField("notas")}
                placeholder="Observações sobre o cliente, preferências, histórico..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-[12px] bg-[#050B12] border border-[#243337] text-[#F0EADD] text-sm placeholder-[#87938F] focus:border-[#2F9285]/60 outline-none transition-colors resize-none"
              />
            </div>

            {/* Erro */}
            {erro && (
              <div className="px-3 py-2.5 rounded-[10px] bg-[#E35D5B]/10 border border-[#E35D5B]/30 text-sm text-[#E35D5B]">
                {erro}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#243337]">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="h-9 px-4 rounded-[12px] text-sm text-[#87938F] hover:text-[#F0EADD] hover:bg-[#102128] border border-[#243337] transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="h-9 px-5 rounded-[12px] text-sm font-semibold bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {mutation.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#050B12]/30 border-t-[#050B12] rounded-full animate-spin" />
                  {isEdit ? "Salvando..." : "Criando..."}
                </>
              ) : (
                <>
                  <Plus size={15} />
                  {isEdit ? "Salvar Alterações" : "Criar Cliente"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ClientesPageContent() {
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const searchParams = useSearchParams();
  const destaqueId = searchParams.get("destaque");

  const { data = [], isLoading } = useQuery<Cliente[]>({
    queryKey: ["clientes"],
    queryFn: () => api.get("/api/v1/clientes/"),
  });

  useEffect(() => {
    if (destaqueId && data.length > 0) {
      const cliente = data.find(c => c.id === destaqueId);
      if (cliente) {
        setClienteEditando(cliente);
        setModalAberto(true);
      }
    }
  }, [destaqueId, data]);

  const filtrado = data.filter(c =>
    !busca ||
    [c.nome, c.telefone, c.instagram, c.email].some(v =>
      v?.toLowerCase().includes(busca.toLowerCase())
    )
  );

  const abrirNovoCliente = () => {
    setClienteEditando(null);
    setModalAberto(true);
  };

  const abrirEditarCliente = (c: Cliente) => {
    setClienteEditando(c);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setClienteEditando(null);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EADD]">Clientes</h1>
          <p className="text-sm text-[#87938F] mt-1">
            {isLoading
              ? "Carregando..."
              : `${data.length} cadastrado${data.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={abrirNovoCliente}
          className="flex items-center gap-2 h-10 px-4 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-semibold text-sm transition-all shrink-0"
        >
          <Plus size={16} />
          Novo Cliente
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#87938F]" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, telefone ou Instagram..."
          className="w-full h-10 pl-9 pr-4 rounded-[14px] bg-[#0B171C] border border-[#243337] text-[#F0EADD] text-sm placeholder-[#87938F] focus:outline-none focus:border-[#2F9285] transition-all"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-[#0B171C] border border-[#243337] rounded-[14px] animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtrado.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-[#0B171C] border border-[#243337] rounded-[18px]">
          <UserCircle size={48} className="text-[#243337] mb-4" />
          <h3 className="text-[#F0EADD] font-semibold mb-2">
            {busca ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          </h3>
          <p className="text-sm text-[#87938F] max-w-xs mb-6">
            {busca
              ? "Tente outros termos."
              : "Clientes são criados quando alguém envia um orçamento, ou adicione manualmente."}
          </p>
          {!busca && (
            <button
              onClick={abrirNovoCliente}
              className="flex items-center gap-2 h-10 px-5 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-semibold text-sm"
            >
              <Plus size={16} />
              Adicionar Cliente
            </button>
          )}
        </div>
      )}

      {/* Lista */}
      {!isLoading && filtrado.length > 0 && (
        <div className="space-y-2">
          {filtrado.map(c => (
            <div
              key={c.id}
              onClick={() => abrirEditarCliente(c)}
              className="flex items-center justify-between p-4 bg-[#0B171C] border border-[#243337] rounded-[14px] hover:border-[#2F9285]/40 hover:bg-[#102128] transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#102128] border border-[#243337] flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-[#2F9285]">
                    {c.nome.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#F0EADD]">{c.nome}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {c.telefone && (
                      <span className="flex items-center gap-1 text-xs text-[#87938F]">
                        <Phone size={10} />
                        {c.telefone}
                      </span>
                    )}
                    {c.instagram && (
                      <span className="flex items-center gap-1 text-xs text-[#87938F]">
                        <Instagram size={10} />
                        {c.instagram}
                      </span>
                    )}
                    {c.email && (
                      <span className="flex items-center gap-1 text-xs text-[#87938F]">
                        <Mail size={10} />
                        {c.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-xs text-[#2F9285]">Editar →</span>
            </div>
          ))}
        </div>
      )}

      {/* Modal criar/editar */}
      {modalAberto && (
        <ClienteModal
          cliente={clienteEditando ?? undefined}
          onClose={fecharModal}
        />
      )}
    </div>
  );
}

export default function ClientesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[#87938F]">Carregando...</div>}>
      <ClientesPageContent />
    </Suspense>
  );
}
