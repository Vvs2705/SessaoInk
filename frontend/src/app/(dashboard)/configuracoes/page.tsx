"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
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
  Loader2,
  Upload,
  Image as ImageIcon,
  CreditCard,
} from "lucide-react";
import { api, ApiError, withCsrfHeaders } from "@/lib/api/client";
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
  has_logo: boolean;
  has_foto: boolean;
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo: "ADMIN" | "ARTISTA" | "RECEPCIONISTA";
  estudio_id: string;
  mfa_totp_ativo: boolean;
  mfa_email_ativo: boolean;
}

interface MembroEquipe {
  id: string;
  nome: string;
  email: string;
  tipo: "ADMIN" | "ARTISTA" | "RECEPCIONISTA";
}

type AbaAtiva = "perfil" | "portal" | "equipe" | "seguranca" | "assinatura";

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
  const searchParams = useSearchParams();
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

  // Refs para inputs de arquivos (identidade visual)
  const logoInputRef = useRef<HTMLInputElement>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  // Estados de upload da identidade visual
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoTimestamp, setLogoTimestamp] = useState(Date.now());

  const [fotoUploading, setFotoUploading] = useState(false);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const [fotoTimestamp, setFotoTimestamp] = useState(Date.now());

  // Estados do slug (portal público)
  const [novoSlug, setNovoSlug] = useState("");
  const [slugDisponivel, setSlugDisponivel] = useState<boolean | null>(null);
  const [motivoSlug, setMotivoSlug] = useState<string | null>(null);
  const [validandoSlug, setValidandoSlug] = useState(false);
  const [showModalSlug, setShowModalSlug] = useState(false);

  // Estados do MFA
  const [showTotpSetupModal, setShowTotpSetupModal] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState<{ secret: string; otpauth_uri: string; qr_code: string } | null>(null);
  const [totpVerificationCode, setTotpVerificationCode] = useState("");
  const [totpSetupPending, setTotpSetupPending] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [showMfaDisableModal, setShowMfaDisableModal] = useState<{ type: "totp" | "email" } | null>(null);
  const [mfaDisablePassword, setMfaDisablePassword] = useState("");
  const [mfaDisablePending, setMfaDisablePending] = useState(false);

  const [mfaEmailActivating, setMfaEmailActivating] = useState(false);

  // Estados de Assinatura / Checkout
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string>("profissional");
  const [selectedCycle, setSelectedCycle] = useState<string>("mensal");
  const [checkoutPending, setCheckoutPending] = useState(false);

  const showToast = (tipo: "sucesso" | "erro", mensagem: string) => {
    setToast({ tipo, mensagem });
    setTimeout(() => setToast(null), 4000);
  };

  // Efeito para capturar parâmetros de retorno de pagamento
  useEffect(() => {
    const pagamento = searchParams.get("pagamento");
    const assinatura = searchParams.get("assinatura");

    if (pagamento === "sucesso" || assinatura === "ok") {
      showToast("sucesso", "Pagamento aprovado! Sua assinatura foi atualizada com sucesso.");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (pagamento === "pendente") {
      showToast("sucesso", "Pagamento pendente. A ativação ocorrerá assim que confirmado.");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (pagamento === "falha") {
      showToast("erro", "O pagamento não foi processado. Tente novamente.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams]);

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const { data: estudio, isLoading: loadingEstudio } = useQuery({
    queryKey: ["estudio"],
    queryFn: () => api.get<Estudio>("/api/v1/estudio/"),
    staleTime: 1000 * 60 * 5,
  });

  const { data: usuario } = useQuery<Usuario>({
    queryKey: ["usuario"],
    queryFn: () => api.get<Usuario>("/api/v1/auth/me"),
  });

  const isAdmin = usuario?.tipo === "ADMIN";

  const { data: planosData, isLoading: loadingPlanos } = useQuery({
    queryKey: ["planos"],
    queryFn: () => api.get<{ planos: any[]; trial_dias: number }>("/api/v1/public/planos"),
  });

  const { data: gatewayConfig, isLoading: loadingGatewayConfig } = useQuery({
    queryKey: ["gateway-config"],
    queryFn: () => api.get<{ public_key: string | null; go_live: boolean }>("/api/v1/pagamentos/config"),
    enabled: isAdmin,
  });

  const selectedPlan = planosData?.planos?.find((p: any) => p.slug === selectedPlanSlug);

  // Inicializa o novoSlug com o slug atual do estúdio
  useEffect(() => {
    if (estudio?.slug && !novoSlug) {
      setNovoSlug(estudio.slug);
    }
  }, [estudio?.slug]);

  // Validação em tempo real do slug com debounce
  useEffect(() => {
    if (!novoSlug) {
      setSlugDisponivel(null);
      setMotivoSlug(null);
      return;
    }

    if (novoSlug === estudio?.slug) {
      setSlugDisponivel(true);
      setMotivoSlug(null);
      return;
    }

    // Regras do slug: 3–50 chars, a-z 0-9 e hífens, sem acento/espaço
    const regexSlug = /^[a-z0-9-]+$/;
    if (novoSlug.length < 3 || novoSlug.length > 50) {
      setSlugDisponivel(false);
      setMotivoSlug("O link deve ter entre 3 e 50 caracteres.");
      return;
    }
    if (!regexSlug.test(novoSlug)) {
      setSlugDisponivel(false);
      setMotivoSlug("Use apenas letras minúsculas, números e hífens.");
      return;
    }

    setValidandoSlug(true);
    const handler = setTimeout(async () => {
      try {
        const res = await api.get<{ slug: string; disponivel: boolean; motivo?: string }>(
          `/api/v1/estudio/slug/sugestao?base=${encodeURIComponent(novoSlug)}`
        );
        setSlugDisponivel(res.disponivel);
        setMotivoSlug(res.motivo ?? null);
      } catch (e: any) {
        setSlugDisponivel(false);
        setMotivoSlug("Erro ao verificar disponibilidade.");
      } finally {
        setValidandoSlug(false);
      }
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [novoSlug, estudio?.slug]);

  // ---------------------------------------------------------------------------
  // Handlers para Identidade Visual e Slug
  // ---------------------------------------------------------------------------

  const handleUploadLogo = async (file: File) => {
    setLogoError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setLogoError("Apenas JPG, PNG ou WebP são permitidos.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setLogoError("Arquivo muito grande (máx 15MB).");
      return;
    }
    setLogoUploading(true);
    try {
      const form = new FormData();
      form.append("arquivo", file);
      const res = await fetch("/api/v1/estudio/logo", withCsrfHeaders({
        method: "POST",
        credentials: "include",
        body: form,
      }));
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Erro no upload da logo" }));
        throw new Error(err.detail ?? "Erro no upload da logo");
      }
      const data = await res.json();
      queryClient.setQueryData(["estudio"], data);
      queryClient.invalidateQueries({ queryKey: ["estudio"] });
      setLogoTimestamp(Date.now());
      showToast("sucesso", "Logo atualizada com sucesso!");
    } catch (e: any) {
      setLogoError(e.message ?? "Erro ao fazer upload da logo.");
      showToast("erro", e.message ?? "Erro ao fazer upload da logo.");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    setLogoError(null);
    setLogoUploading(true);
    try {
      const res = await api.delete<Estudio>("/api/v1/estudio/logo");
      queryClient.setQueryData(["estudio"], res);
      queryClient.invalidateQueries({ queryKey: ["estudio"] });
      setLogoTimestamp(Date.now());
      showToast("sucesso", "Logo removida com sucesso!");
    } catch (e: any) {
      setLogoError(e.detail ?? "Erro ao remover a logo.");
      showToast("erro", e.detail ?? "Erro ao remover a logo.");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleUploadFoto = async (file: File) => {
    setFotoError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFotoError("Apenas JPG, PNG ou WebP são permitidos.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setFotoError("Arquivo muito grande (máx 15MB).");
      return;
    }
    setFotoUploading(true);
    try {
      const form = new FormData();
      form.append("arquivo", file);
      const res = await fetch("/api/v1/estudio/foto", withCsrfHeaders({
        method: "POST",
        credentials: "include",
        body: form,
      }));
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Erro no upload da foto" }));
        throw new Error(err.detail ?? "Erro no upload da foto");
      }
      const data = await res.json();
      queryClient.setQueryData(["estudio"], data);
      queryClient.invalidateQueries({ queryKey: ["estudio"] });
      setFotoTimestamp(Date.now());
      showToast("sucesso", "Foto de perfil atualizada com sucesso!");
    } catch (e: any) {
      setFotoError(e.message ?? "Erro ao fazer upload da foto.");
      showToast("erro", e.message ?? "Erro ao fazer upload da foto.");
    } finally {
      setFotoUploading(false);
    }
  };

  const handleRemoveFoto = async () => {
    setFotoError(null);
    setFotoUploading(true);
    try {
      const res = await api.delete<Estudio>("/api/v1/estudio/foto");
      queryClient.setQueryData(["estudio"], res);
      queryClient.invalidateQueries({ queryKey: ["estudio"] });
      setFotoTimestamp(Date.now());
      showToast("sucesso", "Foto de perfil removida com sucesso!");
    } catch (e: any) {
      setFotoError(e.detail ?? "Erro ao remover a foto.");
      showToast("erro", e.detail ?? "Erro ao remover a foto.");
    } finally {
      setFotoUploading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const atualizarSlug = useMutation({
    mutationFn: (slug: string) => api.patch<Estudio>("/api/v1/estudio/slug", { slug }),
    onSuccess: (data) => {
      queryClient.setQueryData(["estudio"], data);
      queryClient.invalidateQueries({ queryKey: ["estudio"] });
      showToast("sucesso", "Link do portal alterado com sucesso!");
      setShowModalSlug(false);
    },
    onError: (err: any) => {
      showToast("erro", err?.detail ?? "Erro ao alterar o link.");
      setShowModalSlug(false);
    },
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

  // Handlers do MFA
  const handleStartTotpSetup = async () => {
    setTotpSetupPending(true);
    try {
      const res = await api.post<{ secret: string; otpauth_uri: string; qr_code: string }>(
        "/api/v1/auth/mfa/totp/setup"
      );
      setTotpSetupData(res);
      setShowTotpSetupModal(true);
    } catch (e: any) {
      showToast("erro", e.detail || "Erro ao iniciar configuração do App Autenticador.");
    } finally {
      setTotpSetupPending(false);
    }
  };

  const handleActivateTotp = async () => {
    if (!totpVerificationCode) return;
    setTotpSetupPending(true);
    try {
      await api.post("/api/v1/auth/mfa/totp/ativar", {
        codigo: totpVerificationCode,
      });
      showToast("sucesso", "Autenticação por App ativada com sucesso!");
      setShowTotpSetupModal(false);
      setTotpSetupData(null);
      setTotpVerificationCode("");
      queryClient.invalidateQueries({ queryKey: ["usuario"] });
    } catch (e: any) {
      showToast("erro", e.detail || "Código de verificação incorreto.");
    } finally {
      setTotpSetupPending(false);
    }
  };

  const handleCopySecret = () => {
    if (!totpSetupData) return;
    navigator.clipboard.writeText(totpSetupData.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleDisableMfa = async () => {
    if (!showMfaDisableModal || !mfaDisablePassword) return;
    const type = showMfaDisableModal.type;
    setMfaDisablePending(true);
    try {
      if (type === "totp") {
         await api.post("/api/v1/auth/mfa/totp/desativar", {
           senha: mfaDisablePassword,
         });
         showToast("sucesso", "Autenticação por App desativada com sucesso!");
      } else {
         await api.post("/api/v1/auth/mfa/email/desativar", {
           senha: mfaDisablePassword,
         });
         showToast("sucesso", "Autenticação por E-mail desativada com sucesso!");
      }
      setShowMfaDisableModal(null);
      setMfaDisablePassword("");
      queryClient.invalidateQueries({ queryKey: ["usuario"] });
    } catch (e: any) {
      showToast("erro", e.detail || "Senha incorreta. Tente novamente.");
    } finally {
      setMfaDisablePending(false);
    }
  };

  const handleActivateEmailMfa = async () => {
    setMfaEmailActivating(true);
    try {
      await api.post("/api/v1/auth/mfa/email/ativar");
      showToast("sucesso", "Autenticação por E-mail ativada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["usuario"] });
    } catch (e: any) {
      showToast("erro", e.detail || "Erro ao ativar autenticação por e-mail.");
    } finally {
      setMfaEmailActivating(false);
    }
  };

  // Handler de Checkout
  const handleCheckout = async () => {
    setCheckoutPending(true);
    try {
      const res = await api.post<{ init_point: string }>("/api/v1/pagamentos/checkout", {
        plano_slug: selectedPlanSlug,
        ciclo: selectedCycle,
      });
      if (res?.init_point) {
        window.location.href = res.init_point;
      } else {
        showToast("erro", "Init point de faturamento não retornado.");
      }
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 503) {
        showToast("erro", "Pagamentos em configuração — cobrança ainda não habilitada.");
      } else {
        showToast("erro", e.detail || "Erro ao iniciar processo de pagamento.");
      }
    } finally {
      setCheckoutPending(false);
    }
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
  if (isAdmin) {
    ABAS.push({ id: "assinatura", icon: CreditCard, label: "Assinatura" });
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
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

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar de abas */}
        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible w-full md:w-48 shrink-0 gap-1 md:space-y-1 pb-2 md:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ABAS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all text-left shrink-0 w-auto md:w-full",
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
          {/* ---- ABA: PERFIL DO ESTÚDIO ---- */}
          {aba === "perfil" && (
            <div className="space-y-6">
              {loadingEstudio ? (
                <>
                  <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6 space-y-4">
                    <div className="h-6 bg-[#102128] rounded-[6px] w-48 animate-pulse" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="h-28 bg-[#102128] rounded-[14px] animate-pulse" />
                      <div className="h-28 bg-[#102128] rounded-[24px] animate-pulse" />
                    </div>
                  </div>
                  <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6 space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="h-10 bg-[#102128] rounded-[10px] animate-pulse"
                      />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {/* Card Identidade Visual */}
                  <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-[#F0EADD]">
                          Identidade Visual
                        </h2>
                        <p className="text-xs text-[#87938F]">
                          Personalize a marca e a foto de perfil do seu estúdio no portal
                        </p>
                      </div>
                      {!isAdmin && (
                        <span className="text-[10px] bg-[#C36B3F]/10 border border-[#C36B3F]/20 text-[#C36B3F] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Lock size={10} /> Apenas Admin
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* LOGO */}
                      <div className="space-y-3">
                        <label className="text-xs font-semibold text-[#87938F] block">
                          Logo do Estúdio
                        </label>
                        <div className="flex items-center gap-4">
                          <div className="relative w-28 h-28 bg-[#050B12] border border-[#243337] rounded-[14px] overflow-hidden flex items-center justify-center group shrink-0">
                            {estudio?.has_logo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/v1/estudio/logo?t=${logoTimestamp}`}
                                alt="Logo do estúdio"
                                className="w-full h-full object-contain p-2"
                              />
                            ) : (
                              <div className="text-center p-2">
                                <ImageIcon size={24} className="text-[#243337] mx-auto mb-1" />
                                <span className="text-[10px] text-[#87938F]">Sem logo</span>
                              </div>
                            )}
                            {logoUploading && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <Loader2 className="w-5 h-5 text-[#2F9285] animate-spin" />
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => logoInputRef.current?.click()}
                                disabled={!isAdmin || logoUploading}
                                className="px-3 py-1.5 rounded-[8px] bg-[#2F9285]/10 border border-[#2F9285]/30 hover:bg-[#2F9285] hover:text-[#050B12] text-[#2F9285] disabled:opacity-50 disabled:hover:bg-[#2F9285]/10 disabled:hover:text-[#2F9285] text-xs font-medium transition-all"
                              >
                                Alterar Logo
                              </button>
                              {estudio?.has_logo && (
                                <button
                                  type="button"
                                  onClick={handleRemoveLogo}
                                  disabled={!isAdmin || logoUploading}
                                  className="px-3 py-1.5 rounded-[8px] bg-transparent border border-[#E35D5B]/30 hover:bg-[#E35D5B] hover:text-[#F0EADD] text-[#E35D5B] disabled:opacity-50 text-xs font-medium transition-all"
                                >
                                  Remover
                                </button>
                              )}
                            </div>
                            <p className="text-[10px] text-[#87938F]">
                              JPEG, PNG ou WebP. Máx 15MB.
                            </p>
                            {logoError && (
                              <p className="text-[10px] text-[#E35D5B] font-medium">
                                {logoError}
                              </p>
                            )}
                          </div>
                          <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadLogo(file);
                              e.target.value = "";
                            }}
                          />
                        </div>
                      </div>

                      {/* FOTO */}
                      <div className="space-y-3">
                        <label className="text-xs font-semibold text-[#87938F] block">
                          Foto / Avatar do Estúdio
                        </label>
                        <div className="flex items-center gap-4">
                          <div className="relative w-28 h-28 bg-[#050B12] border border-[#243337] rounded-[24px] overflow-hidden flex items-center justify-center group shrink-0">
                            {estudio?.has_foto ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/v1/estudio/foto?t=${fotoTimestamp}`}
                                alt="Foto do estúdio"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="text-center p-2">
                                <User size={24} className="text-[#243337] mx-auto mb-1" />
                                <span className="text-[10px] text-[#87938F]">Sem foto</span>
                              </div>
                            )}
                            {fotoUploading && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <Loader2 className="w-5 h-5 text-[#2F9285] animate-spin" />
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => fotoInputRef.current?.click()}
                                disabled={!isAdmin || fotoUploading}
                                className="px-3 py-1.5 rounded-[8px] bg-[#2F9285]/10 border border-[#2F9285]/30 hover:bg-[#2F9285] hover:text-[#050B12] text-[#2F9285] disabled:opacity-50 disabled:hover:bg-[#2F9285]/10 disabled:hover:text-[#2F9285] text-xs font-medium transition-all"
                              >
                                Alterar Foto
                              </button>
                              {estudio?.has_foto && (
                                <button
                                  type="button"
                                  onClick={handleRemoveFoto}
                                  disabled={!isAdmin || fotoUploading}
                                  className="px-3 py-1.5 rounded-[8px] bg-transparent border border-[#E35D5B]/30 hover:bg-[#E35D5B] hover:text-[#F0EADD] text-[#E35D5B] disabled:opacity-50 text-xs font-medium transition-all"
                                >
                                  Remover
                                </button>
                              )}
                            </div>
                            <p className="text-[10px] text-[#87938F]">
                              JPEG, PNG ou WebP. Máx 15MB.
                            </p>
                            {fotoError && (
                              <p className="text-[10px] text-[#E35D5B] font-medium">
                                {fotoError}
                              </p>
                            )}
                          </div>
                          <input
                            ref={fotoInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadFoto(file);
                              e.target.value = "";
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Informações do Estúdio */}
                  <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6">
                    <h2 className="text-base font-semibold text-[#F0EADD] mb-5">
                      Informações do Estúdio
                    </h2>

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
                          type="button"
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
                  </div>
                </>
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
                          URL pública atual — compartilhe com seus clientes
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
                      </div>

                      {/* Input de edição do link (apenas Admin) */}
                      {isAdmin ? (
                        <div className="space-y-3 pt-4 border-t border-[#243337]">
                          <label className="text-xs font-medium text-[#87938F] block">
                            Alterar link personalizado (slug)
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center gap-0 bg-[#050B12] border border-[#243337] rounded-[10px] px-3 py-2.5 min-w-0">
                              <span className="text-sm text-[#87938F] shrink-0">sessao-ink.vercel.app/</span>
                              <input
                                type="text"
                                value={novoSlug}
                                onChange={(e) => setNovoSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                                disabled={atualizarSlug.isPending}
                                className="w-full bg-transparent text-sm text-[#2F9285] font-bold focus:outline-none placeholder-gray-600"
                                placeholder="link-do-seu-estudio"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowModalSlug(true)}
                              disabled={!slugDisponivel || validandoSlug || novoSlug === estudio?.slug || atualizarSlug.isPending}
                              className={cn(
                                "shrink-0 h-10 px-4 flex items-center justify-center rounded-[10px] text-xs font-semibold transition-all",
                                slugDisponivel && novoSlug !== estudio?.slug
                                  ? "bg-[#2F9285] text-[#050B12] hover:bg-[#3AA99A]"
                                  : "bg-[#243337] text-[#87938F] cursor-not-allowed"
                              )}
                            >
                              {atualizarSlug.isPending ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                "Salvar link"
                              )}
                            </button>
                          </div>

                          {/* Status da validação em tempo real */}
                          {novoSlug && novoSlug !== estudio?.slug && (
                            <div className="flex items-center gap-1.5 text-xs mt-1">
                              {validandoSlug ? (
                                <>
                                  <Loader2 size={13} className="text-[#87938F] animate-spin" />
                                  <span className="text-[#87938F]">Verificando disponibilidade...</span>
                                </>
                              ) : slugDisponivel ? (
                                <>
                                  <CheckCircle size={13} className="text-[#2F9285]" />
                                  <span className="text-[#2F9285]">Endereço disponível!</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle size={13} className="text-[#E35D5B]" />
                                  <span className="text-[#E35D5B]">{motivoSlug ?? "Link indisponível."}</span>
                                </>
                              )}
                            </div>
                          )}

                          <p className="text-[10px] text-[#87938F]">
                            Regras do link: 3 a 50 caracteres, apenas letras minúsculas (sem acentos), números e hífens.
                          </p>
                        </div>
                      ) : (
                        <div className="pt-4 border-t border-[#243337] flex items-start gap-2 text-xs text-[#87938F]">
                          <Lock size={14} className="text-[#C36B3F] shrink-0 mt-0.5" />
                          <span>Apenas administradores podem alterar o endereço do portal.</span>
                        </div>
                      )}

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

              {/* Autenticação de Dois Fatores (MFA) */}
              <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6 space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-[#F0EADD]">
                    Autenticação de Dois Fatores (MFA)
                  </h2>
                  <p className="text-xs text-[#87938F] mt-1">
                    Adicione uma camada extra de segurança à sua conta exigindo um código de verificação ao fazer login.
                  </p>
                </div>

                <div className="divide-y divide-[#243337] space-y-4">
                  {/* TOTP Option */}
                  <div className="flex items-center justify-between pt-4 first:pt-0">
                    <div className="space-y-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#F0EADD]">
                          Aplicativo Autenticador (TOTP)
                        </span>
                        {usuario?.mfa_totp_ativo ? (
                          <span className="text-[10px] bg-[#2F9285]/15 text-[#2F9285] font-semibold px-2 py-0.5 rounded-full border border-[#2F9285]/20">
                            Ativo
                          </span>
                        ) : (
                          <span className="text-[10px] bg-[#87938F]/15 text-[#87938F] font-semibold px-2 py-0.5 rounded-full border border-[#87938F]/10">
                            Inativo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#87938F]">
                        Use aplicativos como Google Authenticator, Microsoft Authenticator ou Authy para gerar códigos de segurança de uso único.
                      </p>
                    </div>
                    <div>
                      {usuario?.mfa_totp_ativo ? (
                        <button
                          type="button"
                          onClick={() => setShowMfaDisableModal({ type: "totp" })}
                          className="px-3.5 py-2 text-xs font-semibold rounded-[10px] border border-[#E35D5B]/30 hover:bg-[#E35D5B] hover:text-[#F0EADD] text-[#E35D5B] transition-all shrink-0"
                        >
                          Desativar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleStartTotpSetup}
                          disabled={totpSetupPending}
                          className="px-3.5 py-2 text-xs font-semibold rounded-[10px] bg-[#2F9285]/10 border border-[#2F9285]/30 hover:bg-[#2F9285] hover:text-[#050B12] text-[#2F9285] transition-all flex items-center gap-1.5 shrink-0"
                        >
                          {totpSetupPending && <Loader2 size={12} className="animate-spin" />}
                          Ativar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Email Option */}
                  <div className="flex items-center justify-between pt-4">
                    <div className="space-y-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#F0EADD]">
                          Código por E-mail (OTP)
                        </span>
                        {usuario?.mfa_email_ativo ? (
                          <span className="text-[10px] bg-[#2F9285]/15 text-[#2F9285] font-semibold px-2 py-0.5 rounded-full border border-[#2F9285]/20">
                            Ativo
                          </span>
                        ) : (
                          <span className="text-[10px] bg-[#87938F]/15 text-[#87938F] font-semibold px-2 py-0.5 rounded-full border border-[#87938F]/10">
                            Inativo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#87938F]">
                        Receba um código numérico temporário diretamente no seu e-mail cadastrado a cada tentativa de login.
                      </p>
                    </div>
                    <div>
                      {usuario?.mfa_email_ativo ? (
                        <button
                          type="button"
                          onClick={() => setShowMfaDisableModal({ type: "email" })}
                          className="px-3.5 py-2 text-xs font-semibold rounded-[10px] border border-[#E35D5B]/30 hover:bg-[#E35D5B] hover:text-[#F0EADD] text-[#E35D5B] transition-all shrink-0"
                        >
                          Desativar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleActivateEmailMfa}
                          disabled={mfaEmailActivating}
                          className="px-3.5 py-2 text-xs font-semibold rounded-[10px] bg-[#2F9285]/10 border border-[#2F9285]/30 hover:bg-[#2F9285] hover:text-[#050B12] text-[#2F9285] transition-all flex items-center gap-1.5 shrink-0"
                        >
                          {mfaEmailActivating && <Loader2 size={12} className="animate-spin" />}
                          Ativar
                        </button>
                      )}
                    </div>
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

          {/* ---- ABA: ASSINATURA ---- */}
          {aba === "assinatura" && isAdmin && (
            <div className="space-y-6">
              <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6 space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-[#F0EADD]">
                    Assinatura do Estúdio
                  </h2>
                  <p className="text-xs text-[#87938F] mt-1">
                    Gerencie seu plano e ciclo de faturamento com segurança através do Mercado Pago.
                  </p>
                </div>

                {loadingPlanos || loadingGatewayConfig ? (
                  <div className="space-y-4">
                    <div className="h-24 bg-[#102128] rounded-[14px] animate-pulse" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-48 bg-[#102128] rounded-[14px] animate-pulse" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Status do Gateway */}
                    {gatewayConfig && !gatewayConfig.go_live && (
                      <div className="p-3 bg-[#C36B3F]/10 border border-[#C36B3F]/20 text-[#C36B3F] text-xs rounded-[10px] flex items-start gap-2.5">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Ambiente de Testes (go_live desligado)</p>
                          <p className="mt-0.5">As transações reais estão desabilitadas. Checkouts retornarão erro 503 pelo servidor do estúdio.</p>
                        </div>
                      </div>
                    )}

                    {/* Catálogo de Planos */}
                    <div className="space-y-4">
                      <label className="text-xs font-semibold text-[#87938F] uppercase tracking-wider block">
                        1. Selecione o Plano
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {planosData?.planos?.map((plano: any) => {
                          const isPopular = plano.destaque;
                          const isSelected = selectedPlanSlug === plano.slug;
                          return (
                            <button
                              key={plano.slug}
                              type="button"
                              onClick={() => {
                                setSelectedPlanSlug(plano.slug);
                                const hasCycle = plano.tabela_precos?.some((t: any) => t.ciclo === selectedCycle);
                                if (!hasCycle) {
                                  setSelectedCycle("mensal");
                                }
                              }}
                              className={cn(
                                "flex flex-col text-left p-5 rounded-[16px] border transition-all relative overflow-hidden group",
                                isSelected
                                  ? "bg-[#102128] border-[#2F9285] shadow-[0_4px_20px_rgba(47,146,133,0.15)]"
                                  : "bg-[#050B12] border-[#243337] hover:border-[#87938F]/30"
                              )}
                            >
                              {isPopular && (
                                <div className="absolute top-0 right-0 bg-[#2F9285] text-[#050B12] text-[9px] font-bold px-2 py-0.5 rounded-bl-[10px]">
                                  {plano.badge || "Recomendado"}
                                </div>
                              )}
                              <h3 className="text-[#F0EADD] font-bold text-sm">{plano.nome}</h3>
                              <p className="text-[10px] text-[#87938F] mt-1 line-clamp-2">
                                {plano.descricao}
                              </p>
                              
                              <div className="mt-4 flex items-baseline gap-1">
                                <span className="text-base font-bold text-[#F0EADD]">
                                  R$ {plano.preco_mensal.toFixed(0)}
                                </span>
                                <span className="text-[10px] text-[#87938F]">/mês</span>
                              </div>

                              {plano.promocao && (
                                <p className="text-[9px] text-[#2F9285] mt-1 font-medium bg-[#2F9285]/10 px-1.5 py-0.5 rounded">
                                  {plano.promocao.descricao}
                                </p>
                              )}

                              <div className="mt-4 pt-3 border-t border-[#243337]/50 w-full space-y-1.5">
                                {plano.recursos?.slice(0, 4).map((rec: any, idx: number) => (
                                  <div key={idx} className="flex items-center gap-1.5 text-[10px] text-[#B8C2BF]">
                                    <CheckCircle size={10} className="text-[#2F9285] shrink-0" />
                                    <span className="truncate">{rec.label}</span>
                                  </div>
                                ))}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Ciclos de Cobrança */}
                    <div className="space-y-3 pt-2">
                      <label className="text-xs font-semibold text-[#87938F] uppercase tracking-wider block">
                        2. Escolha o Ciclo de Faturamento
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {planosData?.planos?.find((p: any) => p.slug === selectedPlanSlug)?.tabela_precos?.map((preco: any) => {
                          const isSelected = selectedCycle === preco.ciclo;
                          return (
                            <button
                              key={preco.ciclo}
                              type="button"
                              onClick={() => setSelectedCycle(preco.ciclo)}
                              className={cn(
                                "flex items-start text-left p-4 rounded-[14px] border transition-all",
                                isSelected
                                  ? "bg-[#102128] border-[#2F9285]"
                                  : "bg-[#050B12] border-[#243337] hover:border-[#87938F]/30"
                              )}
                            >
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-[#F0EADD]">{preco.label}</span>
                                  {preco.desconto_pix_pct > 0 && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#2F9285]/15 text-[#2F9285]">
                                      -{preco.desconto_pix_pct}% no Pix
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-[#87938F] mt-1">{preco.obs}</p>
                              </div>
                              <div className="text-right shrink-0">
                                {preco.ciclo === "mensal" ? (
                                  <>
                                    <p className="text-xs font-bold text-[#F0EADD]">R$ {preco.preco_cheio}/mês</p>
                                    <p className="text-[9px] text-[#87938F]">recorrente</p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-xs font-bold text-[#F0EADD]">R$ {preco.pix_total}</p>
                                    <p className="text-[9px] text-[#87938F] line-through">R$ {preco.preco_cheio}</p>
                                    {preco.cartao_modo === "parcelado" && (
                                      <p className="text-[9px] text-[#2F9285]">
                                        Ou {preco.cartao_max_parcelas}x de R$ {preco.cartao_parcela}
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Resumo da Compra e Checkout */}
                    <div className="pt-4 border-t border-[#243337] flex flex-col md:flex-row items-center justify-between gap-4">
                      <div>
                        <p className="text-xs text-[#87938F]">Plano e ciclo selecionados:</p>
                        <p className="text-sm font-bold text-[#F0EADD]">
                          {selectedPlan?.nome} — {selectedPlan?.tabela_precos?.find((p: any) => p.ciclo === selectedCycle)?.label}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleCheckout}
                        disabled={checkoutPending}
                        className="w-full md:w-auto px-6 h-11 bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-semibold text-sm rounded-[12px] flex items-center justify-center gap-2 transition-all shadow-[0_4px_12px_rgba(47,146,133,0.2)] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none"
                      >
                        {checkoutPending ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Redirecionando...
                          </>
                        ) : (
                          <>
                            <CreditCard size={16} />
                            Assinar com Mercado Pago
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal TOTP Setup */}
      {showTotpSetupModal && totpSetupData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0B171C] border border-[#243337] w-full max-w-md rounded-[18px] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#243337]">
              <h2 className="text-[#F0EADD] font-bold text-sm">Configurar App Autenticador</h2>
              <button
                onClick={() => {
                  setShowTotpSetupModal(false);
                  setTotpSetupData(null);
                  setTotpVerificationCode("");
                }}
                className="text-[#87938F] hover:text-[#F0EADD]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-[#87938F] leading-relaxed">
                1. Escaneie o QR Code abaixo com seu aplicativo autenticador (ex: Google Authenticator, Authy):
              </p>
              
              <div className="flex justify-center p-3 bg-white rounded-xl w-48 h-48 mx-auto border border-[#243337]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={totpSetupData.qr_code} alt="QR Code MFA" className="w-full h-full object-contain" />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-[#87938F]">
                  Ou insira a chave manual no aplicativo:
                </p>
                <div className="flex items-center gap-2 bg-[#050B12] border border-[#243337] rounded-[10px] px-3 py-2 text-xs font-mono text-[#F0EADD]">
                  <span className="flex-1 truncate">{totpSetupData.secret}</span>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="text-[#2F9285] hover:text-[#3AA99A] shrink-0"
                  >
                    {copiedSecret ? "Copiado!" : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label htmlFor="verify-totp-code" className="text-xs font-medium text-[#87938F] block">
                  2. Digite o código de 6 dígitos gerado pelo aplicativo para confirmar:
                </label>
                <input
                  id="verify-totp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={totpVerificationCode}
                  onChange={(e) => setTotpVerificationCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-[#050B12] border border-[#243337] rounded-[10px] px-3 py-2 text-center text-sm font-mono tracking-[0.2em] text-[#F0EADD] focus:outline-none focus:border-[#2F9285]/50 transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTotpSetupModal(false);
                    setTotpSetupData(null);
                    setTotpVerificationCode("");
                  }}
                  className="flex-1 h-10 rounded-[12px] border border-[#243337] hover:bg-[#102128] text-[#F0EADD] font-semibold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={totpSetupPending || totpVerificationCode.length < 6}
                  onClick={handleActivateTotp}
                  className="flex-1 h-10 rounded-[12px] bg-[#2F9285] hover:bg-[#3AA99A] disabled:opacity-50 disabled:cursor-not-allowed text-[#050B12] font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {totpSetupPending && <Loader2 size={14} className="animate-spin" />}
                  Confirmar e Ativar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Desativar MFA */}
      {showMfaDisableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0B171C] border border-[#243337] w-full max-w-md rounded-[18px] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#243337]">
              <h2 className="text-[#F0EADD] font-bold text-sm">
                Desativar {showMfaDisableModal.type === "totp" ? "App Autenticador" : "Código por E-mail"}
              </h2>
              <button
                onClick={() => {
                  setShowMfaDisableModal(null);
                  setMfaDisablePassword("");
                }}
                className="text-[#87938F] hover:text-[#F0EADD]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-[#87938F] leading-relaxed">
                Por motivos de segurança, digite sua senha atual para confirmar a desativação da autenticação de dois fatores.
              </p>

              <div className="space-y-1.5">
                <label htmlFor="disable-mfa-pass" className="text-xs font-medium text-[#87938F] block">
                  Sua senha
                </label>
                <input
                  id="disable-mfa-pass"
                  type="password"
                  value={mfaDisablePassword}
                  onChange={(e) => setMfaDisablePassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full bg-[#050B12] border border-[#243337] rounded-[10px] px-3 py-2 text-sm text-[#F0EADD] focus:outline-none focus:border-[#2F9285]/50 transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowMfaDisableModal(null);
                    setMfaDisablePassword("");
                  }}
                  className="flex-1 h-10 rounded-[12px] border border-[#243337] hover:bg-[#102128] text-[#F0EADD] font-semibold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={mfaDisablePending || !mfaDisablePassword}
                  onClick={handleDisableMfa}
                  className="flex-1 h-10 rounded-[12px] bg-[#E35D5B] hover:bg-[#c94d4b] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {mfaDisablePending && <Loader2 size={14} className="animate-spin" />}
                  Confirmar e Desativar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação do slug */}
      {showModalSlug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0B171C] border border-[#243337] w-full max-w-md rounded-[18px] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#243337]">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-[#C36B3F]" />
                <h2 className="text-[#F0EADD] font-bold text-sm">Alterar link do portal?</h2>
              </div>
              <button onClick={() => setShowModalSlug(false)} className="text-[#87938F] hover:text-[#F0EADD]">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-[#87938F] leading-relaxed">
                Tem certeza que deseja alterar o endereço do seu estúdio de{" "}
                <strong className="text-[#F0EADD]">sessao-ink.vercel.app/{estudio?.slug}</strong> para{" "}
                <strong className="text-[#2F9285]">sessao-ink.vercel.app/{novoSlug}</strong>?
              </p>
              <div className="p-3 bg-[#E35D5B]/5 border border-[#E35D5B]/20 text-[#E35D5B] text-xs rounded-[10px] space-y-1">
                <p className="font-semibold">Atenção:</p>
                <p>O link antigo deixará de funcionar imediatamente. Seus clientes que usam o link antigo não conseguirão mais acessar a página.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModalSlug(false)}
                  className="flex-1 h-10 rounded-[12px] border border-[#243337] hover:bg-[#102128] text-[#F0EADD] font-semibold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={atualizarSlug.isPending}
                  onClick={() => atualizarSlug.mutate(novoSlug)}
                  className="flex-1 h-10 rounded-[12px] bg-[#E35D5B] hover:bg-[#c94d4b] disabled:opacity-60 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {atualizarSlug.isPending && <Loader2 size={14} className="animate-spin" />}
                  Confirmar e Mudar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
