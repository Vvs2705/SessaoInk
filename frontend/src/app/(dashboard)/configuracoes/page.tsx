"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  User,
  Globe,
  Users,
  Lock,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  X,
  Copy,
  ExternalLink,
  Bell,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Estudio {
  id: string;
  nome: string;
  slug: string;
  bio: string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  instagram: string | null;
  email_notificacao: string | null;
}

interface MembroEquipe {
  id: string;
  nome: string;
  email: string;
  tipo: "ADMIN" | "ARTISTA" | "RECEPCIONISTA";
}

type AbaAtiva = "perfil" | "portal" | "equipe" | "seguranca";

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function Toast({
  tipo,
  mensagem,
  onClose,
}: {
  tipo: "sucesso" | "erro";
  mensagem: string;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-[14px] border shadow-xl z-50 animate-in slide-in-from-bottom-4",
        tipo === "sucesso"
          ? "bg-[#0B171C] border-[#2F9285]/40 text-[#2F9285]"
          : "bg-[#0B171C] border-[#E35D5B]/40 text-[#E35D5B]"
      )}
    >
      {tipo === "sucesso" ? (
        <CheckCircle size={16} />
      ) : (
        <AlertCircle size={16} />
      )}
      <span className="text-sm font-medium text-[#F0EADD]">{mensagem}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}

const TIPO_BADGE: Record<string, string> = {
  ADMIN: "bg-[#2F9285]/15 text-[#2F9285]",
  ARTISTA: "bg-[#C36B3F]/15 text-[#C36B3F]",
  RECEPCIONISTA: "bg-[#87938F]/15 text-[#87938F]",
};

const TIPO_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  ARTISTA: "Artista",
  RECEPCIONISTA: "Recepção",
};

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function ConfiguracoesPage() {
  const queryClient = useQueryClient();
  const [aba, setAba] = useState<AbaAtiva>("perfil");
  const [toast, setToast] = useState<{
    tipo: "sucesso" | "erro";
    mensagem: string;
  } | null>(null);

  // Formulário do estúdio
  const [formEstudio, setFormEstudio] = useState<Partial<Estudio>>({});
  const [formEditado, setFormEditado] = useState(false);

  // Formulário de senha
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [mostrarSenhas, setMostrarSenhas] = useState(false);

  const showToast = (tipo: "sucesso" | "erro", mensagem: string) => {
    setToast({ tipo, mensagem });
    setTimeout(() => setToast(null), 4000);
  };

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const { data: estudio, isLoading: loadingEstudio } = useQuery({
    queryKey: ["estudio"],
    queryFn: () => api.get<Estudio>("/api/v1/estudio/"),
    staleTime: 1000 * 60 * 5,
  });

  const { data: equipe, isLoading: loadingEquipe } = useQuery({
    queryKey: ["equipe"],
    queryFn: () => api.get<MembroEquipe[]>("/api/v1/estudio/equipe"),
    enabled: aba === "equipe",
  });

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const atualizarEstudio = useMutation({
    mutationFn: (dados: Partial<Estudio>) =>
      api.patch<Estudio>("/api/v1/estudio/", dados),
    onSuccess: (data) => {
      queryClient.setQueryData(["estudio"], data);
      setFormEditado(false);
      showToast("sucesso", "Dados do estúdio atualizados com sucesso!");
    },
    onError: () => showToast("erro", "Erro ao salvar. Tente novamente."),
  });

  const alterarSenha = useMutation({
    mutationFn: () =>
      api.post("/api/v1/auth/alterar-senha", {
        senha_atual: senhaAtual,
        senha_nova: senhaNova,
      }),
    onSuccess: () => {
      setSenhaAtual("");
      setSenhaNova("");
      setSenhaConfirm("");
      showToast("sucesso", "Senha alterada com sucesso!");
    },
    onError: (err: any) =>
      showToast("erro", err?.detail ?? "Erro ao alterar senha."),
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCampoEstudio = (campo: keyof Estudio, valor: string) => {
    setFormEstudio((prev) => ({ ...prev, [campo]: valor }));
    setFormEditado(true);
  };

  const handleSalvarEstudio = () => {
    if (!formEditado || Object.keys(formEstudio).length === 0) return;
    atualizarEstudio.mutate(formEstudio);
  };

  const handleAlterarSenha = () => {
    if (senhaNova !== senhaConfirm) {
      showToast("erro", "As senhas novas não coincidem.");
      return;
    }
    if (senhaNova.length < 8) {
      showToast("erro", "A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    alterarSenha.mutate();
  };

  const val = (campo: keyof Estudio) =>
    formEstudio[campo] !== undefined
      ? (formEstudio[campo] as string)
      : (estudio?.[campo] as string) ?? "";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const ABAS: { id: AbaAtiva; icon: typeof User; label: string }[] = [
    { id: "perfil", icon: User, label: "Perfil do Estúdio" },
    { id: "portal", icon: Globe, label: "Portal Público" },
    { id: "equipe", icon: Users, label: "Equipe" },
    { id: "seguranca", icon: Lock, label: "Segurança" },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-[#0B171C] rounded-[10px] border border-[#243337]">
          <Settings size={20} className="text-[#2F9285]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#F0EADD]">Configurações</h1>
          <p className="text-sm text-[#87938F]">Gerencie seu estúdio e conta</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar de abas */}
        <nav className="w-48 shrink-0 space-y-1">
          {ABAS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all text-left",
                aba === id
                  ? "bg-[#2F9285]/10 text-[#2F9285] border border-[#2F9285]/20"
                  : "text-[#87938F] hover:bg-[#0B171C] hover:text-[#F0EADD] border border-transparent"
              )}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          {/* ---- ABA: PERFIL DO ESTÚDIO ---- */}
          {aba === "perfil" && (
            <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6">
              <h2 className="text-base font-semibold text-[#F0EADD] mb-5">
                Informações do Estúdio
              </h2>

              {loadingEstudio ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="h-10 bg-[#102128] rounded-[10px] animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-[#87938F] mb-1.5 block">
                      Nome do estúdio *
                    </label>
                    <input
                      value={val("nome")}
                      onChange={(e) => handleCampoEstudio("nome", e.target.value)}
                      className="w-full bg-[#050B12] border border-[#243337] rounded-[10px] px-3 py-2.5 text-sm text-[#F0EADD] focus:outline-none focus:border-[#2F9285]/50 transition-colors"
                      placeholder="Nome do seu estúdio"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#87938F] mb-1.5 block">
                      Bio / Apresentação
                    </label>
                    <textarea
                      value={val("bio")}
                      onChange={(e) => handleCampoEstudio("bio", e.target.value)}
                      rows={3}
                      className="w-full bg-[#050B12] border border-[#243337] rounded-[10px] px-3 py-2.5 text-sm text-[#F0EADD] focus:outline-none focus:border-[#2F9285]/50 transition-colors resize-none"
                      placeholder="Apresentação do estúdio para o portal público..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-[#87938F] mb-1.5 block">
                        Cidade
                      </label>
                      <input
                        value={val("cidade")}
                        onChange={(e) =>
                          handleCampoEstudio("cidade", e.target.value)
                        }
                        className="w-full bg-[#050B12] border border-[#243337] rounded-[10px] px-3 py-2.5 text-sm text-[#F0EADD] focus:outline-none focus:border-[#2F9285]/50 transition-colors"
                        placeholder="São Paulo"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#87938F] mb-1.5 block">
                        UF
                      </label>
                      <input
                        value={val("uf")}
                        onChange={(e) =>
                          handleCampoEstudio("uf", e.target.value.toUpperCase().slice(0, 2))
                        }
                        maxLength={2}
                        className="w-full bg-[#050B12] border border-[#243337] rounded-[10px] px-3 py-2.5 text-sm text-[#F0EADD] focus:outline-none focus:border-[#2F9285]/50 transition-colors"
                        placeholder="SP"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#87938F] mb-1.5 block">
                      WhatsApp / Telefone
                    </label>
                    <input
                      value={val("telefone")}
                      onChange={(e) =>
                        handleCampoEstudio("telefone", e.target.value)
                      }
                      className="w-full bg-[#050B12] border border-[#243337] rounded-[10px] px-3 py-2.5 text-sm text-[#F0EADD] focus:outline-none focus:border-[#2F9285]/50 transition-colors"
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#87938F] mb-1.5 block">
                      Instagram
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#87938F]">@</span>
                      <input
                        value={val("instagram")}
                        onChange={(e) =>
                          handleCampoEstudio(
                            "instagram",
                            e.target.value.replace("@", "")
                          )
                        }
                        className="flex-1 bg-[#050B12] border border-[#243337] rounded-[10px] px-3 py-2.5 text-sm text-[#F0EADD] focus:outline-none focus:border-[#2F9285]/50 transition-colors"
                        placeholder="seu.estudio"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSalvarEstudio}
                      disabled={!formEditado || atualizarEstudio.isPending}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium transition-all",
                        formEditado
                          ? "bg-[#2F9285] text-[#050B12] hover:bg-[#2F9285]/90"
                          : "bg-[#243337] text-[#87938F] cursor-not-allowed"
                      )}
                    >
                      <Save size={14} />
                      {atualizarEstudio.isPending ? "Salvando..." : "Salvar alterações"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---- ABA: PORTAL PÚBLICO ---- */}
          {aba === "portal" && (
            <div className="space-y-4">
              {/* Card do link */}
              <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6 space-y-4">
                <h2 className="text-base font-semibold text-[#F0EADD]">
                  Link do seu portal
                </h2>

                {(() => {
                  const BASE = "https://sessao-ink.vercel.app";
                  const portalUrl = `${BASE}/${estudio?.slug ?? ""}`;
                  return (
                    <>
                      {/* URL com botões */}
                      <div>
                        <label className="text-xs font-medium text-[#87938F] mb-1.5 block">
                          URL pública — compartilhe com seus clientes
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-0 bg-[#050B12] border border-[#243337] rounded-[10px] px-3 py-2.5 min-w-0">
                            <span className="text-sm text-[#87938F] shrink-0">sessao-ink.vercel.app/</span>
                            <span className="text-sm text-[#2F9285] font-bold truncate">{estudio?.slug ?? "..."}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(portalUrl);
                              showToast("sucesso", "Link copiado para a área de transferência!");
                            }}
                            title="Copiar link"
                            className="shrink-0 h-10 w-10 flex items-center justify-center rounded-[10px] bg-[#2F9285]/10 border border-[#2F9285]/30 hover:bg-[#2F9285] hover:text-[#050B12] text-[#2F9285] transition-all"
                          >
                            <Copy size={15} />
                          </button>
                          <a
                            href={portalUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Abrir portal"
                            className="shrink-0 h-10 w-10 flex items-center justify-center rounded-[10px] bg-[#0B171C] border border-[#243337] hover:bg-[#102128] text-[#87938F] hover:text-[#F0EADD] transition-all"
                          >
                            <ExternalLink size={15} />
                          </a>
                        </div>
                        <p className="text-xs text-[#87938F] mt-1.5">
                          O slug não pode ser alterado após criação. Entre em contato com o suporte se necessário.
                        </p>
                      </div>

                      {/* O que o cliente vê */}
                      <div className="bg-[#050B12] border border-[#243337] rounded-[14px] p-4 space-y-2">
                        <p className="text-xs font-semibold text-[#87938F] uppercase tracking-wider">O que seu cliente vê no portal</p>
                        <div className="flex flex-col gap-1.5 text-xs text-[#87938F]">
                          <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#2F9285] shrink-0" />Perfil do estúdio com foto, bio e localização</div>
                          <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#2F9285] shrink-0" />Portfólio público de trabalhos</div>
                          <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#2F9285] shrink-0" />Flash arts disponíveis para agendamento</div>
                          <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#2F9285] shrink-0" />Formulário de pedido de orçamento</div>
                        </div>
                      </div>

                      <div className="bg-[#2F9285]/5 border border-[#2F9285]/15 rounded-[12px] p-3">
                        <p className="text-xs text-[#87938F]">
                          <span className="text-[#2F9285] font-medium">Como compartilhar:</span> Cole o link na bio do Instagram, envie pelo WhatsApp ou crie um QR Code em qr-code-generator.com. O cliente preenche o formulário e o pedido aparece automaticamente em Atendimentos.
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Card de notificação por email */}
              <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-[#2F9285]" />
                  <h2 className="text-base font-semibold text-[#F0EADD]">
                    Notificações por e-mail
                  </h2>
                </div>
                <p className="text-sm text-[#87938F]">
                  Cadastre um e-mail para receber uma notificação toda vez que um cliente preencher o formulário de orçamento.
                </p>

                <div>
                  <label className="text-xs font-medium text-[#87938F] mb-1.5 block">
                    E-mail para receber orçamentos
                  </label>
                  <input
                    type="email"
                    value={val("email_notificacao")}
                    onChange={(e) => handleCampoEstudio("email_notificacao", e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full bg-[#050B12] border border-[#243337] rounded-[10px] px-3 py-2.5 text-sm text-[#F0EADD] focus:outline-none focus:border-[#2F9285]/50 transition-colors"
                  />
                  <p className="text-xs text-[#87938F] mt-1.5">
                    Deixe em branco para desativar as notificações.
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSalvarEstudio}
                    disabled={!formEditado || atualizarEstudio.isPending}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium transition-all",
                      formEditado
                        ? "bg-[#2F9285] text-[#050B12] hover:bg-[#2F9285]/90"
                        : "bg-[#243337] text-[#87938F] cursor-not-allowed"
                    )}
                  >
                    <Save size={14} />
                    {atualizarEstudio.isPending ? "Salvando..." : "Salvar"}
                  </button>
                </div>

                <div className="bg-[#2F9285]/5 border border-[#2F9285]/20 rounded-[12px] p-3">
                  <p className="text-xs text-[#87938F]">
                    <span className="text-[#2F9285] font-medium">✓ Serviço de email ativo.</span> Os emails são enviados automaticamente via Resend assim que um cliente preencher o formulário do portal. Basta salvar seu e-mail acima.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ---- ABA: EQUIPE ---- */}
          {aba === "equipe" && (
            <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-[#F0EADD]">
                  Equipe e Artistas
                </h2>
                <span className="text-xs text-[#87938F] bg-[#050B12] border border-[#243337] px-2 py-1 rounded-[6px]">
                  {equipe?.length ?? 0} membro{equipe?.length !== 1 ? "s" : ""}
                </span>
              </div>

              {loadingEquipe ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="h-14 bg-[#102128] rounded-[10px] animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {(equipe ?? []).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 p-3 bg-[#050B12] border border-[#243337] rounded-[10px]"
                    >
                      <div className="w-9 h-9 rounded-full bg-[#2F9285]/20 flex items-center justify-center text-sm font-bold text-[#2F9285] shrink-0">
                        {m.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#F0EADD] truncate">
                          {m.nome}
                        </p>
                        <p className="text-xs text-[#87938F] truncate">{m.email}</p>
                      </div>
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-[6px] font-medium shrink-0",
                          TIPO_BADGE[m.tipo]
                        )}
                      >
                        {TIPO_LABEL[m.tipo]}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-[#243337]">
                <p className="text-xs text-[#87938F]">
                  Para adicionar novos membros à equipe, entre em contato com o suporte. Funcionalidade de convite disponível na V1.1.
                </p>
              </div>
            </div>
          )}

          {/* ---- ABA: SEGURANÇA ---- */}
          {aba === "seguranca" && (
            <div className="space-y-4">
              {/* Alterar senha */}
              <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6">
                <h2 className="text-base font-semibold text-[#F0EADD] mb-5">
                  Alterar Senha
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-[#87938F] mb-1.5 block">
                      Senha atual
                    </label>
                    <div className="relative">
                      <input
                        type={mostrarSenhas ? "text" : "password"}
                        value={senhaAtual}
                        onChange={(e) => setSenhaAtual(e.target.value)}
                        className="w-full bg-[#050B12] border border-[#243337] rounded-[10px] px-3 py-2.5 pr-10 text-sm text-[#F0EADD] focus:outline-none focus:border-[#2F9285]/50 transition-colors"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenhas(!mostrarSenhas)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#87938F] hover:text-[#F0EADD]"
                      >
                        {mostrarSenhas ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#87938F] mb-1.5 block">
                      Nova senha
                    </label>
                    <input
                      type={mostrarSenhas ? "text" : "password"}
                      value={senhaNova}
                      onChange={(e) => setSenhaNova(e.target.value)}
                      className="w-full bg-[#050B12] border border-[#243337] rounded-[10px] px-3 py-2.5 text-sm text-[#F0EADD] focus:outline-none focus:border-[#2F9285]/50 transition-colors"
                      placeholder="Mínimo 8 caracteres"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#87938F] mb-1.5 block">
                      Confirmar nova senha
                    </label>
                    <input
                      type={mostrarSenhas ? "text" : "password"}
                      value={senhaConfirm}
                      onChange={(e) => setSenhaConfirm(e.target.value)}
                      className={cn(
                        "w-full bg-[#050B12] border rounded-[10px] px-3 py-2.5 text-sm text-[#F0EADD] focus:outline-none transition-colors",
                        senhaConfirm && senhaNova !== senhaConfirm
                          ? "border-[#E35D5B]/50 focus:border-[#E35D5B]"
                          : "border-[#243337] focus:border-[#2F9285]/50"
                      )}
                      placeholder="Repita a nova senha"
                    />
                    {senhaConfirm && senhaNova !== senhaConfirm && (
                      <p className="text-xs text-[#E35D5B] mt-1">
                        As senhas não coincidem
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleAlterarSenha}
                      disabled={
                        !senhaAtual ||
                        !senhaNova ||
                        senhaNova !== senhaConfirm ||
                        alterarSenha.isPending
                      }
                      className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium bg-[#2F9285] text-[#050B12] hover:bg-[#2F9285]/90 disabled:bg-[#243337] disabled:text-[#87938F] disabled:cursor-not-allowed transition-all"
                    >
                      <Lock size={14} />
                      {alterarSenha.isPending ? "Alterando..." : "Alterar senha"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Informações de sessão */}
              <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6">
                <h2 className="text-base font-semibold text-[#F0EADD] mb-4">
                  Sessão e Segurança
                </h2>
                <div className="space-y-3">
                  {[
                    {
                      label: "Autenticação",
                      valor: "JWT em cookie httpOnly",
                      ok: true,
                    },
                    {
                      label: "Token de acesso",
                      valor: "Expira em 15 minutos",
                      ok: true,
                    },
                    {
                      label: "Refresh token",
                      valor: "Rotação automática (7 dias)",
                      ok: true,
                    },
                    {
                      label: "Proteção brute force",
                      valor: "5 tentativas → bloqueio 15 min",
                      ok: true,
                    },
                    {
                      label: "Privacidade de imagens",
                      valor: "Privado por padrão (ADR-005)",
                      ok: true,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between py-2 border-b border-[#243337] last:border-0"
                    >
                      <span className="text-sm text-[#87938F]">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#F0EADD]">{item.valor}</span>
                        <CheckCircle size={13} className="text-[#2F9285]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          tipo={toast.tipo}
          mensagem={toast.mensagem}
          onClose={() => setToast(null)}
        />
      )}

      <div className="mt-8 pt-6 border-t border-[#243337]">
        <p className="text-xs text-[#87938F] text-center">
          SessãoInk v1.0 · Ambiente local · Backend em localhost:8001
        </p>
      </div>
    </div>
  );
}
