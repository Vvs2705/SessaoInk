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
  Clock,
  CalendarDays,
  RefreshCw,
  Plus,
  Download,
  Trash2,
  ShieldAlert,
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
  horario_funcionamento: Record<string, { abre: string; fecha: string }> | null;
  agenda_ics_url: string | null;
  has_logo: boolean;
  has_foto: boolean;

  endereco_cep: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  endereco_pais: string | null;
  google_negocio_url: string | null;
  latitude: string | null;
  longitude: string | null;
  endereco_completo: string | null;
  como_chegar_url: string | null;
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

interface Convite {
  id: string;
  email: string;
  role: "ARTISTA" | "RECEPCIONISTA";
  status: "PENDENTE" | "ACEITO" | "EXPIRADO" | "REVOGADO";
  expira_em: string;
  criado_em: string;
  convite_url?: string | null;
}

const CONVITE_STATUS_BADGE: Record<string, string> = {
  PENDENTE: "bg-warning/15 text-warning",
  ACEITO: "bg-teal-ink/15 text-teal-ink",
  EXPIRADO: "bg-text-subtle/15 text-text-subtle",
  REVOGADO: "bg-error-red/15 text-error-red",
};

const CONVITE_STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  ACEITO: "Aceito",
  EXPIRADO: "Expirado",
  REVOGADO: "Revogado",
};

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
        "fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-[14px] border shadow-ink-lg z-50 animate-in slide-in-from-bottom-4",
        tipo === "sucesso"
          ? "bg-ink-bg border-teal-ink/40 text-teal-ink"
          : "bg-ink-bg border-error-red/40 text-error-red"
      )}
    >
      {tipo === "sucesso" ? (
        <CheckCircle size={16} />
      ) : (
        <AlertCircle size={16} />
      )}
      <span className="text-sm font-medium text-porcelain-ink">{mensagem}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}

const TIPO_BADGE: Record<string, string> = {
  ADMIN: "bg-teal-ink/15 text-teal-ink",
  ARTISTA: "bg-copper-needle/15 text-copper-needle",
  RECEPCIONISTA: "bg-text-subtle/15 text-text-subtle",
};

const TIPO_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  ARTISTA: "Artista",
  RECEPCIONISTA: "Recepção",
};

// 0=segunda … 6=domingo (mesmo índice usado pelo backend)
const DIAS_SEMANA = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];

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
  const [showMfaEmailActivateModal, setShowMfaEmailActivateModal] = useState(false);
  const [mfaEmailActivatePassword, setMfaEmailActivatePassword] = useState("");

  // LGPD — direitos do titular
  const [exportandoDados, setExportandoDados] = useState(false);
  const [showExclusaoModal, setShowExclusaoModal] = useState(false);
  const [solicitandoExclusao, setSolicitandoExclusao] = useState(false);

  // Horário de funcionamento (0=segunda … 6=domingo)
  const [horarioFunc, setHorarioFunc] = useState<
    Record<string, { abre: string; fecha: string }>
  >({});
  const [horarioEditado, setHorarioEditado] = useState(false);
  const [horarioInicializado, setHorarioInicializado] = useState(false);

  // Link iCalendar (Google Agenda)
  const [icsCopiado, setIcsCopiado] = useState(false);

  // Convites de equipe
  const [conviteEmail, setConviteEmail] = useState("");
  const [conviteRole, setConviteRole] = useState<"ARTISTA" | "RECEPCIONISTA">("ARTISTA");
  const [conviteCriado, setConviteCriado] = useState<Convite | null>(null);
  const [linkConviteCopiado, setLinkConviteCopiado] = useState(false);

  // Estados de Assinatura / Checkout
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string>("profissional");
  const [selectedCycle, setSelectedCycle] = useState<string>("mensal");
  const [checkoutPending, setCheckoutPending] = useState(false);

  const showToast = (tipo: "sucesso" | "erro", mensagem: string) => {
    setToast({ tipo, mensagem });
    setTimeout(() => setToast(null), 4000);
  };

  // Rede de segurança: consulta ativamente o Mercado Pago e reconcilia cobranças
  // pendentes do estúdio (caso o webhook de pagamento se perca). Idempotente.
  const reconciliarMutation = useMutation({
    mutationFn: () => api.post<{ ativada: boolean }>("/api/v1/pagamentos/reconciliar"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assinatura-resumo"] });
    },
  });

  const verificarPagamento = async (manual: boolean) => {
    try {
      const res = await reconciliarMutation.mutateAsync();
      if (res?.ativada) {
        showToast("sucesso", "Assinatura ativada com sucesso! 🎉");
      } else if (manual) {
        showToast(
          "sucesso",
          "Ainda sem pagamento aprovado. Se você acabou de pagar, aguarde alguns segundos e clique novamente.",
        );
      }
    } catch {
      if (manual) showToast("erro", "Não foi possível verificar o pagamento agora.");
    }
  };

  // Efeito para capturar parâmetros de retorno de pagamento
  useEffect(() => {
    const pagamento = searchParams.get("pagamento");
    const assinatura = searchParams.get("assinatura");
    const voltouDoCheckout = pagamento === "sucesso" || pagamento === "pendente" || assinatura === "ok";

    if (pagamento === "sucesso" || assinatura === "ok") {
      showToast("sucesso", "Pagamento recebido! Confirmando a ativação…");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (pagamento === "pendente") {
      showToast("sucesso", "Pagamento pendente. A ativação ocorrerá assim que confirmado.");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (pagamento === "falha") {
      showToast("erro", "O pagamento não foi processado. Tente novamente.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Reconciliação ativa ao voltar do checkout (com uma 2ª tentativa, pois o
    // pagamento pode levar alguns segundos para constar no gateway).
    if (voltouDoCheckout) {
      verificarPagamento(false);
      const t = setTimeout(() => verificarPagamento(false), 5000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Resumo da assinatura vigente (status/trial). Shape vindo de
  // backend/app/services/assinatura.py::resumo — `ciclo`/`trial_expira_em` só
  // existem quando há assinatura.
  const { data: assinaturaResumo, isLoading: loadingAssinatura } = useQuery({
    queryKey: ["assinatura-resumo"],
    queryFn: () =>
      api.get<{
        status: string;
        plano_slug: string | null;
        plano_nome: string | null;
        ciclo?: string | null;
        acesso_liberado: boolean;
        trial: boolean;
        dias_restantes_trial: number | null;
        trial_expira_em?: string | null;
        precisa_assinar: boolean;
      }>("/api/v1/pagamentos/assinatura"),
    enabled: isAdmin,
  });

  const selectedPlan = planosData?.planos?.find((p: any) => p.slug === selectedPlanSlug);

  // Todos os ciclos do plano (mensal, trimestral, semestral, anual) com seus
  // descontos. A recorrência mensal (preapproval) é reconciliada no webhook do
  // backend, então pode ser ofertada normalmente.
  const ciclosVisiveis: any[] = selectedPlan?.tabela_precos ?? [];

  // Garante que o ciclo selecionado é sempre um ciclo válido do plano atual; se
  // ficar um ciclo inexistente selecionado, cai para o primeiro disponível.
  useEffect(() => {
    if (ciclosVisiveis.length === 0) return;
    const valido = ciclosVisiveis.some((p: any) => p.ciclo === selectedCycle);
    if (!valido) {
      setSelectedCycle(ciclosVisiveis[0].ciclo);
    }
  }, [selectedPlanSlug, ciclosVisiveis, selectedCycle]);

  // Inicializa o novoSlug com o slug atual do estúdio
  useEffect(() => {
    if (estudio?.slug && !novoSlug) {
      setNovoSlug(estudio.slug);
    }
  }, [estudio?.slug]);

  // Inicializa o editor de horário de funcionamento com os dados do estúdio
  useEffect(() => {
    if (estudio && !horarioInicializado) {
      setHorarioFunc(estudio.horario_funcionamento ?? {});
      setHorarioInicializado(true);
    }
  }, [estudio, horarioInicializado]);

  const salvarHorario = useMutation({
    mutationFn: () =>
      api.patch<Estudio>("/api/v1/estudio/", {
        horario_funcionamento:
          Object.keys(horarioFunc).length > 0 ? horarioFunc : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estudio"] });
      setHorarioEditado(false);
      showToast("sucesso", "Horário de funcionamento salvo!");
    },
    onError: (e: Error) =>
      showToast("erro", e instanceof ApiError ? e.detail : "Erro ao salvar horário."),
  });

  const gerarLinkIcs = useMutation({
    mutationFn: () => api.post<Estudio>("/api/v1/estudio/agenda-ics"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estudio"] });
      showToast("sucesso", "Link de agenda gerado! Adicione no seu Google Agenda.");
    },
    onError: () => showToast("erro", "Erro ao gerar o link da agenda."),
  });

  const revogarLinkIcs = useMutation({
    mutationFn: () => api.delete<Estudio>("/api/v1/estudio/agenda-ics"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estudio"] });
      showToast("sucesso", "Link de agenda revogado.");
    },
    onError: () => showToast("erro", "Erro ao revogar o link da agenda."),
  });

  const toggleDiaAberto = (dia: string) => {
    setHorarioEditado(true);
    setHorarioFunc((prev) => {
      const novo = { ...prev };
      if (novo[dia]) {
        delete novo[dia];
      } else {
        novo[dia] = { abre: "09:00", fecha: "19:00" };
      }
      return novo;
    });
  };

  const setHoraDia = (dia: string, campo: "abre" | "fecha", valor: string) => {
    setHorarioEditado(true);
    setHorarioFunc((prev) => ({
      ...prev,
      [dia]: { ...(prev[dia] ?? { abre: "09:00", fecha: "19:00" }), [campo]: valor },
    }));
  };

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

  // Convites (apenas ADMIN). Lista também aceitos/expirados para histórico.
  const { data: convites } = useQuery<Convite[]>({
    queryKey: ["convites"],
    queryFn: () => api.get<Convite[]>("/api/v1/convites/"),
    enabled: aba === "equipe" && isAdmin,
  });

  const criarConvite = useMutation({
    mutationFn: (payload: { email: string; role: string }) =>
      api.post<Convite>("/api/v1/convites/", payload),
    onSuccess: (novo) => {
      queryClient.invalidateQueries({ queryKey: ["convites"] });
      setConviteEmail("");
      setConviteCriado(novo);
      showToast("sucesso", "Convite criado! Copie o link ou avise o e-mail.");
    },
    onError: (err) =>
      showToast("erro", err instanceof ApiError ? err.detail : "Erro ao criar convite."),
  });

  const revogarConvite = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/convites/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convites"] });
      showToast("sucesso", "Convite revogado.");
    },
    onError: (err) =>
      showToast("erro", err instanceof ApiError ? err.detail : "Erro ao revogar convite."),
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
    if (!mfaEmailActivatePassword) return;
    setMfaEmailActivating(true);
    try {
      await api.post("/api/v1/auth/mfa/email/ativar", {
        senha: mfaEmailActivatePassword,
      });
      showToast("sucesso", "Autenticação por E-mail ativada com sucesso!");
      setShowMfaEmailActivateModal(false);
      setMfaEmailActivatePassword("");
      queryClient.invalidateQueries({ queryKey: ["usuario"] });
    } catch (e: any) {
      showToast("erro", e.detail || "Senha incorreta. Tente novamente.");
    } finally {
      setMfaEmailActivating(false);
    }
  };

  // LGPD — exporta os dados pessoais do titular (acesso/portabilidade, art. 18).
  // O backend retorna JSON; o download é montado no cliente (o proxy reescreve headers).
  const handleExportarDados = async () => {
    setExportandoDados(true);
    try {
      const dados = await api.get<unknown>("/api/v1/lgpd/exportar");
      const blob = new Blob([JSON.stringify(dados, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sessaoink-meus-dados.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("sucesso", "Seus dados foram exportados.");
    } catch (e: any) {
      showToast("erro", e.detail || "Não foi possível exportar seus dados.");
    } finally {
      setExportandoDados(false);
    }
  };

  const handleSolicitarExclusao = async () => {
    setSolicitandoExclusao(true);
    try {
      const res = await api.post<{ message?: string }>(
        "/api/v1/lgpd/solicitar-exclusao"
      );
      setShowExclusaoModal(false);
      showToast("sucesso", res?.message || "Solicitação de exclusão registrada.");
    } catch (e: any) {
      showToast("erro", e.detail || "Não foi possível registrar a solicitação.");
    } finally {
      setSolicitandoExclusao(false);
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
        <div className="p-2 bg-ink-bg rounded-[10px] border border-mist-line">
          <Settings size={20} className="text-teal-ink" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-porcelain-ink">Configurações</h1>
          <p className="text-sm text-text-subtle">Gerencie seu estúdio e conta</p>
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
                  ? "bg-teal-ink/10 text-teal-ink border border-teal-ink/20"
                  : "text-text-subtle hover:bg-ink-bg hover:text-porcelain-ink border border-transparent"
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
                  <div className="bg-ink-bg border border-mist-line rounded-[18px] p-6 space-y-4">
                    <div className="h-6 bg-surface-raised rounded-[6px] w-48 animate-pulse" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="h-28 bg-surface-raised rounded-[14px] animate-pulse" />
                      <div className="h-28 bg-surface-raised rounded-[24px] animate-pulse" />
                    </div>
                  </div>
                  <div className="bg-ink-bg border border-mist-line rounded-[18px] p-6 space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="h-10 bg-surface-raised rounded-[10px] animate-pulse"
                      />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {/* Card Identidade Visual */}
                  <div className="bg-ink-bg border border-mist-line rounded-[18px] p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-porcelain-ink">
                          Identidade Visual
                        </h2>
                        <p className="text-xs text-text-subtle">
                          Personalize a marca e a foto de perfil do seu estúdio no portal
                        </p>
                      </div>
                      {!isAdmin && (
                        <span className="text-[10px] bg-copper-needle/10 border border-copper-needle/20 text-copper-needle font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Lock size={10} /> Apenas Admin
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* LOGO */}
                      <div className="space-y-3">
                        <label className="text-xs font-semibold text-text-subtle block">
                          Logo do Estúdio
                        </label>
                        <div className="flex items-center gap-4">
                          <div className="relative w-28 h-28 bg-ink-night border border-mist-line rounded-[14px] overflow-hidden flex items-center justify-center group shrink-0">
                            {estudio?.has_logo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/v1/estudio/logo?t=${logoTimestamp}`}
                                alt="Logo do estúdio"
                                className="w-full h-full object-contain p-2"
                              />
                            ) : (
                              <div className="text-center p-2">
                                <ImageIcon size={24} className="text-mist-line mx-auto mb-1" />
                                <span className="text-[10px] text-text-subtle">Sem logo</span>
                              </div>
                            )}
                            {logoUploading && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <Loader2 className="w-5 h-5 text-teal-ink animate-spin" />
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => logoInputRef.current?.click()}
                                disabled={!isAdmin || logoUploading}
                                className="px-3 py-1.5 rounded-[8px] bg-teal-ink/10 border border-teal-ink/30 hover:bg-teal-ink hover:text-ink-night text-teal-ink disabled:opacity-50 disabled:hover:bg-teal-ink/10 disabled:hover:text-teal-ink text-xs font-medium transition-all"
                              >
                                Alterar Logo
                              </button>
                              {estudio?.has_logo && (
                                <button
                                  type="button"
                                  onClick={handleRemoveLogo}
                                  disabled={!isAdmin || logoUploading}
                                  className="px-3 py-1.5 rounded-[8px] bg-transparent border border-error-red/30 hover:bg-error-red hover:text-porcelain-ink text-error-red disabled:opacity-50 text-xs font-medium transition-all"
                                >
                                  Remover
                                </button>
                              )}
                            </div>
                            <p className="text-[10px] text-text-subtle">
                              JPEG, PNG ou WebP. Máx 15MB.
                            </p>
                            {logoError && (
                              <p className="text-[10px] text-error-red font-medium">
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
                        <label className="text-xs font-semibold text-text-subtle block">
                          Foto / Avatar do Estúdio
                        </label>
                        <div className="flex items-center gap-4">
                          <div className="relative w-28 h-28 bg-ink-night border border-mist-line rounded-[24px] overflow-hidden flex items-center justify-center group shrink-0">
                            {estudio?.has_foto ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/v1/estudio/foto?t=${fotoTimestamp}`}
                                alt="Foto do estúdio"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="text-center p-2">
                                <User size={24} className="text-mist-line mx-auto mb-1" />
                                <span className="text-[10px] text-text-subtle">Sem foto</span>
                              </div>
                            )}
                            {fotoUploading && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <Loader2 className="w-5 h-5 text-teal-ink animate-spin" />
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => fotoInputRef.current?.click()}
                                disabled={!isAdmin || fotoUploading}
                                className="px-3 py-1.5 rounded-[8px] bg-teal-ink/10 border border-teal-ink/30 hover:bg-teal-ink hover:text-ink-night text-teal-ink disabled:opacity-50 disabled:hover:bg-teal-ink/10 disabled:hover:text-teal-ink text-xs font-medium transition-all"
                              >
                                Alterar Foto
                              </button>
                              {estudio?.has_foto && (
                                <button
                                  type="button"
                                  onClick={handleRemoveFoto}
                                  disabled={!isAdmin || fotoUploading}
                                  className="px-3 py-1.5 rounded-[8px] bg-transparent border border-error-red/30 hover:bg-error-red hover:text-porcelain-ink text-error-red disabled:opacity-50 text-xs font-medium transition-all"
                                >
                                  Remover
                                </button>
                              )}
                            </div>
                            <p className="text-[10px] text-text-subtle">
                              JPEG, PNG ou WebP. Máx 15MB.
                            </p>
                            {fotoError && (
                              <p className="text-[10px] text-error-red font-medium">
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
                  <div className="bg-ink-bg border border-mist-line rounded-[18px] p-6">
                    <h2 className="text-base font-semibold text-porcelain-ink mb-5">
                      Informações do Estúdio
                    </h2>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-text-subtle mb-1.5 block">
                          Nome do estúdio *
                        </label>
                        <input
                          value={val("nome")}
                          onChange={(e) => handleCampoEstudio("nome", e.target.value)}
                          className="w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors"
                          placeholder="Nome do seu estúdio"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-text-subtle mb-1.5 block">
                          Bio / Apresentação
                        </label>
                        <textarea
                          value={val("bio")}
                          onChange={(e) => handleCampoEstudio("bio", e.target.value)}
                          rows={3}
                          className="w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors resize-none"
                          placeholder="Apresentação do estúdio para o portal público..."
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-text-subtle mb-1.5 block">
                            Cidade
                          </label>
                          <input
                            value={val("cidade")}
                            onChange={(e) =>
                              handleCampoEstudio("cidade", e.target.value)
                            }
                            className="w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors"
                            placeholder="São Paulo"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-text-subtle mb-1.5 block">
                            UF
                          </label>
                          <input
                            value={val("uf")}
                            onChange={(e) =>
                              handleCampoEstudio("uf", e.target.value.toUpperCase().slice(0, 2))
                            }
                            maxLength={2}
                            className="w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors"
                            placeholder="SP"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-text-subtle mb-1.5 block">
                          WhatsApp / Telefone
                        </label>
                        <input
                          value={val("telefone")}
                          onChange={(e) =>
                            handleCampoEstudio("telefone", e.target.value)
                          }
                          className="w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors"
                          placeholder="(11) 99999-9999"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-text-subtle mb-1.5 block">
                          Instagram
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-text-subtle">@</span>
                          <input
                            value={val("instagram")}
                            onChange={(e) =>
                              handleCampoEstudio(
                                "instagram",
                                e.target.value.replace("@", "")
                              )
                            }
                            className="flex-1 bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors"
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
                              ? "bg-teal-ink text-ink-night hover:bg-teal-ink/90"
                              : "bg-mist-line text-text-subtle cursor-not-allowed"
                          )}
                        >
                          <Save size={14} />
                          {atualizarEstudio.isPending ? "Salvando..." : "Salvar alterações"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Endereço do Estúdio */}
                  <div className="rounded-[18px] border border-mist-line bg-ink-bg p-6 space-y-6">
                    <div>
                      <h2 className="text-base font-semibold text-porcelain-ink">
                        Endereço do Estúdio
                      </h2>
                      <p className="text-xs text-text-subtle">
                        Essas informações aparecem no portal público para o cliente saber como chegar.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-text-subtle mb-1.5 block">
                          CEP
                        </label>
                        <input
                          value={val("endereco_cep")}
                          onChange={(event) => handleCampoEstudio("endereco_cep", event.target.value)}
                          className="w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors"
                          placeholder="00000-000"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-text-subtle mb-1.5 block">
                          Bairro
                        </label>
                        <input
                          value={val("endereco_bairro")}
                          onChange={(event) => handleCampoEstudio("endereco_bairro", event.target.value)}
                          className="w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors"
                          placeholder="Centro"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-text-subtle mb-1.5 block">
                          Rua / Logradouro
                        </label>
                        <input
                          value={val("endereco_logradouro")}
                          onChange={(event) => handleCampoEstudio("endereco_logradouro", event.target.value)}
                          className="w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors"
                          placeholder="Rua Exemplo"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-text-subtle mb-1.5 block">
                          Número
                        </label>
                        <input
                          value={val("endereco_numero")}
                          onChange={(event) => handleCampoEstudio("endereco_numero", event.target.value)}
                          className="w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors"
                          placeholder="123"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-text-subtle mb-1.5 block">
                          Complemento
                        </label>
                        <input
                          value={val("endereco_complemento")}
                          onChange={(event) => handleCampoEstudio("endereco_complemento", event.target.value)}
                          className="w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors"
                          placeholder="Sala 2, fundos, etc."
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-text-subtle mb-1.5 block">
                          Cidade
                        </label>
                        <input
                          value={val("endereco_cidade")}
                          onChange={(event) => handleCampoEstudio("endereco_cidade", event.target.value)}
                          className="w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors"
                          placeholder="São Paulo"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-text-subtle mb-1.5 block">
                          UF
                        </label>
                        <input
                          value={val("endereco_uf")}
                          onChange={(event) =>
                            handleCampoEstudio("endereco_uf", event.target.value.toUpperCase().slice(0, 2))
                          }
                          maxLength={2}
                          className="w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 text-sm uppercase text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors"
                          placeholder="SP"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-text-subtle mb-1.5 block">
                          Link do Google Negócios / Google Maps
                        </label>
                        <input
                          value={val("google_negocio_url")}
                          onChange={(event) => handleCampoEstudio("google_negocio_url", event.target.value)}
                          className="w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors"
                          placeholder="https://maps.app.goo.gl/..."
                        />
                        <p className="text-[10px] text-text-subtle mt-1">
                          Esse link será usado no botão “Como chegar” do portal público.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      {estudio?.como_chegar_url ? (
                        <a
                          href={estudio.como_chegar_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center justify-center rounded-[10px] border border-teal-ink/30 bg-teal-ink/10 px-4 text-xs font-semibold text-teal-ink hover:bg-teal-ink hover:text-ink-night transition-colors"
                        >
                          Testar como chegar
                        </a>
                      ) : (
                        <div />
                      )}

                      <button
                        type="button"
                        onClick={handleSalvarEstudio}
                        disabled={!formEditado || atualizarEstudio.isPending}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium transition-all",
                          formEditado
                            ? "bg-teal-ink text-ink-night hover:bg-teal-ink/90"
                            : "bg-mist-line text-text-subtle cursor-not-allowed"
                        )}
                      >
                        <Save size={14} />
                        {atualizarEstudio.isPending ? "Salvando..." : "Salvar alterações"}
                      </button>
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
              <div className="bg-ink-bg border border-mist-line rounded-[18px] p-6 space-y-4">
                <h2 className="text-base font-semibold text-porcelain-ink">
                  Link do seu portal
                </h2>

                {(() => {
                  const BASE = "https://sessao-ink.vercel.app";
                  const portalUrl = `${BASE}/${estudio?.slug ?? ""}`;
                  return (
                    <>
                      {/* URL com botões */}
                      <div>
                        <label className="text-xs font-medium text-text-subtle mb-1.5 block">
                          URL pública atual — compartilhe com seus clientes
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-0 bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 min-w-0">
                            <span className="text-sm text-text-subtle shrink-0">sessao-ink.vercel.app/</span>
                            <span className="text-sm text-teal-ink font-bold truncate">{estudio?.slug ?? "..."}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(portalUrl);
                              showToast("sucesso", "Link copiado para a área de transferência!");
                            }}
                            title="Copiar link"
                            className="shrink-0 h-10 w-10 flex items-center justify-center rounded-[10px] bg-teal-ink/10 border border-teal-ink/30 hover:bg-teal-ink hover:text-ink-night text-teal-ink transition-all"
                          >
                            <Copy size={15} />
                          </button>
                          <a
                            href={portalUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Abrir portal"
                            className="shrink-0 h-10 w-10 flex items-center justify-center rounded-[10px] bg-ink-bg border border-mist-line hover:bg-surface-raised text-text-subtle hover:text-porcelain-ink transition-all"
                          >
                            <ExternalLink size={15} />
                          </a>
                        </div>
                      </div>

                      {/* Input de edição do link (apenas Admin) */}
                      {isAdmin ? (
                        <div className="space-y-3 pt-4 border-t border-mist-line">
                          <label className="text-xs font-medium text-text-subtle block">
                            Alterar link personalizado (slug)
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center gap-0 bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 min-w-0">
                              <span className="text-sm text-text-subtle shrink-0">sessao-ink.vercel.app/</span>
                              <input
                                type="text"
                                value={novoSlug}
                                onChange={(e) => setNovoSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                                disabled={atualizarSlug.isPending}
                                className="w-full bg-transparent text-sm text-teal-ink font-bold focus:outline-none placeholder-gray-600"
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
                                  ? "bg-teal-ink text-ink-night hover:bg-ink-gold"
                                  : "bg-mist-line text-text-subtle cursor-not-allowed"
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
                                  <Loader2 size={13} className="text-text-subtle animate-spin" />
                                  <span className="text-text-subtle">Verificando disponibilidade...</span>
                                </>
                              ) : slugDisponivel ? (
                                <>
                                  <CheckCircle size={13} className="text-teal-ink" />
                                  <span className="text-teal-ink">Endereço disponível!</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle size={13} className="text-error-red" />
                                  <span className="text-error-red">{motivoSlug ?? "Link indisponível."}</span>
                                </>
                              )}
                            </div>
                          )}

                          <p className="text-[10px] text-text-subtle">
                            Regras do link: 3 a 50 caracteres, apenas letras minúsculas (sem acentos), números e hífens.
                          </p>
                        </div>
                      ) : (
                        <div className="pt-4 border-t border-mist-line flex items-start gap-2 text-xs text-text-subtle">
                          <Lock size={14} className="text-copper-needle shrink-0 mt-0.5" />
                          <span>Apenas administradores podem alterar o endereço do portal.</span>
                        </div>
                      )}

                      {/* O que o cliente vê */}
                      <div className="bg-ink-night border border-mist-line rounded-[14px] p-4 space-y-2">
                        <p className="text-xs font-semibold text-text-subtle uppercase tracking-wider">O que seu cliente vê no portal</p>
                        <div className="flex flex-col gap-1.5 text-xs text-text-subtle">
                          <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-teal-ink shrink-0" />Perfil do estúdio com foto, bio e localização</div>
                          <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-teal-ink shrink-0" />Portfólio público de trabalhos</div>
                          <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-teal-ink shrink-0" />Flash arts disponíveis para agendamento</div>
                          <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-teal-ink shrink-0" />Formulário de pedido de orçamento</div>
                        </div>
                      </div>

                      <div className="bg-teal-ink/5 border border-teal-ink/15 rounded-[12px] p-3">
                        <p className="text-xs text-text-subtle">
                          <span className="text-teal-ink font-medium">Como compartilhar:</span> Cole o link na bio do Instagram, envie pelo WhatsApp ou crie um QR Code em qr-code-generator.com. O cliente preenche o formulário e o pedido aparece automaticamente em Atendimentos.
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Card de notificação por email */}
              <div className="bg-ink-bg border border-mist-line rounded-[18px] p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-teal-ink" />
                  <h2 className="text-base font-semibold text-porcelain-ink">
                    Notificações por e-mail
                  </h2>
                </div>
                <p className="text-sm text-text-subtle">
                  Cadastre um e-mail para receber uma notificação toda vez que um cliente preencher o formulário de orçamento.
                </p>

                <div>
                  <label className="text-xs font-medium text-text-subtle mb-1.5 block">
                    E-mail para receber orçamentos
                  </label>
                  <input
                    type="email"
                    value={val("email_notificacao")}
                    onChange={(e) => handleCampoEstudio("email_notificacao", e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors"
                  />
                  <p className="text-xs text-text-subtle mt-1.5">
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
                        ? "bg-teal-ink text-ink-night hover:bg-teal-ink/90"
                        : "bg-mist-line text-text-subtle cursor-not-allowed"
                    )}
                  >
                    <Save size={14} />
                    {atualizarEstudio.isPending ? "Salvando..." : "Salvar"}
                  </button>
                </div>

                <div className="bg-teal-ink/5 border border-teal-ink/20 rounded-[12px] p-3">
                  <p className="text-xs text-text-subtle">
                    <span className="text-teal-ink font-medium">✓ Serviço de email ativo.</span> Os emails são enviados automaticamente via Resend assim que um cliente preencher o formulário do portal. Basta salvar seu e-mail acima.
                  </p>
                </div>
              </div>

              {/* Card de horário de funcionamento */}
              <div className="bg-ink-bg border border-mist-line rounded-[18px] p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-teal-ink" />
                  <h2 className="text-base font-semibold text-porcelain-ink">
                    Horário de funcionamento
                  </h2>
                </div>
                <p className="text-sm text-text-subtle">
                  Define quais dias o cliente pode sugerir no formulário de orçamento.
                  Dias fechados aparecem desabilitados para ele — e pedidos fora do
                  padrão chegam marcados como &quot;horário personalizado&quot;.
                </p>

                <div className="space-y-2">
                  {DIAS_SEMANA.map((nome, i) => {
                    const dia = String(i);
                    const faixa = horarioFunc[dia];
                    return (
                      <div
                        key={dia}
                        className="flex flex-wrap items-center gap-3 p-2.5 bg-ink-night border border-mist-line rounded-[10px]"
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer min-w-[120px]">
                          <input
                            type="checkbox"
                            checked={Boolean(faixa)}
                            onChange={() => toggleDiaAberto(dia)}
                            disabled={!isAdmin}
                          />
                          <span
                            className={cn(
                              "text-sm font-medium",
                              faixa ? "text-porcelain-ink" : "text-text-subtle"
                            )}
                          >
                            {nome}
                          </span>
                        </label>
                        {faixa ? (
                          <div className="flex items-center gap-2 text-sm text-porcelain-ink">
                            <input
                              type="time"
                              value={faixa.abre}
                              onChange={(e) => setHoraDia(dia, "abre", e.target.value)}
                              disabled={!isAdmin}
                              aria-label={`Abertura ${nome}`}
                              className="bg-ink-bg border border-mist-line rounded-[8px] px-2 py-1.5 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50"
                            />
                            <span className="text-text-subtle text-xs">às</span>
                            <input
                              type="time"
                              value={faixa.fecha}
                              onChange={(e) => setHoraDia(dia, "fecha", e.target.value)}
                              disabled={!isAdmin}
                              aria-label={`Fechamento ${nome}`}
                              className="bg-ink-bg border border-mist-line rounded-[8px] px-2 py-1.5 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-text-subtle italic">Fechado</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {isAdmin && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => salvarHorario.mutate()}
                      disabled={!horarioEditado || salvarHorario.isPending}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium transition-all",
                        horarioEditado
                          ? "bg-teal-ink text-ink-night hover:bg-teal-ink/90"
                          : "bg-mist-line text-text-subtle cursor-not-allowed"
                      )}
                    >
                      {salvarHorario.isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}
                      {salvarHorario.isPending ? "Salvando..." : "Salvar horário"}
                    </button>
                  </div>
                )}
              </div>

              {/* Card de sincronização com Google Agenda (feed iCalendar) */}
              <div className="bg-ink-bg border border-mist-line rounded-[18px] p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <CalendarDays size={16} className="text-teal-ink" />
                  <h2 className="text-base font-semibold text-porcelain-ink">
                    Sincronizar agenda com o celular
                  </h2>
                </div>
                <p className="text-sm text-text-subtle">
                  Gere um link privado da sua agenda e adicione no Google Agenda, Apple
                  Calendar ou Outlook. Suas sessões aparecem automaticamente no
                  calendário do celular, com notificações — sem precisar de conta Google
                  vinculada.
                </p>

                {estudio?.agenda_ics_url ? (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={estudio.agenda_ics_url}
                        aria-label="Link privado da agenda"
                        className="flex-1 bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 text-xs text-text-subtle font-mono focus:outline-none min-w-0"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(estudio.agenda_ics_url!);
                          setIcsCopiado(true);
                          setTimeout(() => setIcsCopiado(false), 2000);
                        }}
                        className="shrink-0 h-10 px-3 flex items-center gap-1.5 rounded-[10px] bg-teal-ink text-ink-night text-xs font-semibold hover:bg-ink-gold transition-all"
                      >
                        {icsCopiado ? <CheckCircle size={14} /> : <Copy size={14} />}
                        {icsCopiado ? "Copiado!" : "Copiar"}
                      </button>
                    </div>

                    <div className="bg-teal-ink/5 border border-teal-ink/15 rounded-[12px] p-3">
                      <p className="text-xs text-text-subtle leading-relaxed">
                        <span className="text-teal-ink font-medium">Como adicionar no Google Agenda:</span>{" "}
                        abra calendar.google.com → no menu lateral, clique em &quot;+&quot; ao lado de
                        &quot;Outras agendas&quot; → &quot;A partir do URL&quot; → cole o link acima.
                        No celular, a agenda sincroniza sozinha depois disso.
                      </p>
                    </div>

                    {isAdmin && (
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => gerarLinkIcs.mutate()}
                          disabled={gerarLinkIcs.isPending}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-medium border border-mist-line text-text-subtle hover:text-porcelain-ink hover:bg-surface-raised transition-all"
                        >
                          <RefreshCw size={13} className={gerarLinkIcs.isPending ? "animate-spin" : ""} />
                          Gerar novo link
                        </button>
                        <button
                          type="button"
                          onClick={() => revogarLinkIcs.mutate()}
                          disabled={revogarLinkIcs.isPending}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-medium border border-error-red/30 text-error-red hover:bg-error-red/10 transition-all"
                        >
                          <X size={13} />
                          Revogar link
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] text-text-subtle">
                      Atenção: este link dá acesso de leitura à sua agenda. Não compartilhe.
                      Gerar um novo link invalida o anterior.
                    </p>
                  </>
                ) : isAdmin ? (
                  <button
                    type="button"
                    onClick={() => gerarLinkIcs.mutate()}
                    disabled={gerarLinkIcs.isPending}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-teal-ink text-ink-night text-sm font-semibold hover:bg-ink-gold transition-all disabled:opacity-60"
                  >
                    {gerarLinkIcs.isPending ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <CalendarDays size={15} />
                    )}
                    Gerar link da agenda
                  </button>
                ) : (
                  <div className="flex items-start gap-2 text-xs text-text-subtle">
                    <Lock size={14} className="text-copper-needle shrink-0 mt-0.5" />
                    <span>Peça a um administrador para gerar o link da agenda.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---- ABA: EQUIPE ---- */}
          {aba === "equipe" && (
            <div className="bg-ink-bg border border-mist-line rounded-[18px] p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-porcelain-ink">
                  Equipe e Artistas
                </h2>
                <span className="text-xs text-text-subtle bg-ink-night border border-mist-line px-2 py-1 rounded-[6px]">
                  {equipe?.length ?? 0} membro{equipe?.length !== 1 ? "s" : ""}
                </span>
              </div>

              {loadingEquipe ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="h-14 bg-surface-raised rounded-[10px] animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {(equipe ?? []).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 p-3 bg-ink-night border border-mist-line rounded-[10px]"
                    >
                      <div className="w-9 h-9 rounded-full bg-teal-ink/20 flex items-center justify-center text-sm font-bold text-teal-ink shrink-0">
                        {m.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-porcelain-ink truncate">
                          {m.nome}
                        </p>
                        <p className="text-xs text-text-subtle truncate">{m.email}</p>
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

              {/* Convidar novo membro (ADMIN) */}
              {isAdmin ? (
                <div className="mt-5 pt-5 border-t border-mist-line space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-porcelain-ink">Convidar membro</h3>
                    <p className="text-xs text-text-subtle mt-0.5">
                      Envie um convite por e-mail ou compartilhe o link gerado. O convite expira em 7 dias.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      value={conviteEmail}
                      onChange={(e) => setConviteEmail(e.target.value)}
                      placeholder="email@dapessoa.com"
                      className="flex-1 h-11 bg-ink-night border border-mist-line rounded-[12px] px-3.5 text-sm text-porcelain-ink placeholder-text-subtle focus:outline-none focus:border-teal-ink/50 transition-colors"
                    />
                    <select
                      value={conviteRole}
                      onChange={(e) => setConviteRole(e.target.value as "ARTISTA" | "RECEPCIONISTA")}
                      className="h-11 bg-ink-night border border-mist-line rounded-[12px] px-3 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors cursor-pointer"
                    >
                      <option value="ARTISTA">Artista</option>
                      <option value="RECEPCIONISTA">Recepção</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const email = conviteEmail.trim().toLowerCase();
                        if (!email || !email.includes("@") || !email.includes(".")) {
                          showToast("erro", "Informe um e-mail válido.");
                          return;
                        }
                        criarConvite.mutate({ email, role: conviteRole });
                      }}
                      disabled={criarConvite.isPending}
                      className="h-11 px-5 rounded-[12px] bg-teal-ink hover:bg-ink-gold disabled:opacity-60 text-ink-night font-semibold text-sm flex items-center justify-center gap-2 transition-colors shrink-0"
                    >
                      {criarConvite.isPending ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Plus size={15} />
                      )}
                      Convidar
                    </button>
                  </div>

                  {/* Link recém-gerado — copiável */}
                  {conviteCriado?.convite_url && (
                    <div className="bg-teal-ink/5 border border-teal-ink/20 rounded-[12px] p-3 space-y-2">
                      <p className="text-xs text-text-subtle">
                        Convite para <strong className="text-porcelain-ink">{conviteCriado.email}</strong> criado.
                        Compartilhe o link abaixo (também enviamos por e-mail):
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={conviteCriado.convite_url}
                          aria-label="Link do convite"
                          className="flex-1 bg-ink-night border border-mist-line rounded-[10px] px-3 py-2 text-xs text-text-subtle font-mono focus:outline-none min-w-0"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(conviteCriado.convite_url!);
                            setLinkConviteCopiado(true);
                            setTimeout(() => setLinkConviteCopiado(false), 2000);
                          }}
                          className="shrink-0 h-9 px-3 flex items-center gap-1.5 rounded-[10px] bg-teal-ink text-ink-night text-xs font-semibold hover:bg-ink-gold transition-colors"
                        >
                          {linkConviteCopiado ? <CheckCircle size={13} /> : <Copy size={13} />}
                          {linkConviteCopiado ? "Copiado!" : "Copiar"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Lista de convites */}
                  {(convites ?? []).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-text-subtle uppercase tracking-wider">Convites</p>
                      {(convites ?? []).map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-3 p-3 bg-ink-night border border-mist-line rounded-[10px]"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-porcelain-ink truncate">{c.email}</p>
                            <p className="text-xs text-text-subtle">
                              {TIPO_LABEL[c.role]} ·{" "}
                              {c.status === "PENDENTE"
                                ? `expira ${new Date(c.expira_em).toLocaleDateString("pt-BR")}`
                                : CONVITE_STATUS_LABEL[c.status]}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-[6px] font-medium shrink-0",
                              CONVITE_STATUS_BADGE[c.status]
                            )}
                          >
                            {CONVITE_STATUS_LABEL[c.status]}
                          </span>
                          {c.status === "PENDENTE" && (
                            <button
                              type="button"
                              onClick={() => revogarConvite.mutate(c.id)}
                              disabled={revogarConvite.isPending}
                              title="Revogar convite"
                              aria-label="Revogar convite"
                              className="shrink-0 p-1.5 rounded-[8px] text-text-subtle hover:text-error-red hover:bg-error-red/10 transition-colors"
                            >
                              <X size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 pt-4 border-t border-mist-line">
                  <p className="text-xs text-text-subtle">
                    Apenas administradores podem convidar novos membros para a equipe.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ---- ABA: SEGURANÇA ---- */}
          {aba === "seguranca" && (
            <div className="space-y-4">
              {/* Alterar senha */}
              <div className="bg-ink-bg border border-mist-line rounded-[18px] p-6">
                <h2 className="text-base font-semibold text-porcelain-ink mb-5">
                  Alterar Senha
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-text-subtle mb-1.5 block">
                      Senha atual
                    </label>
                    <div className="relative">
                      <input
                        type={mostrarSenhas ? "text" : "password"}
                        value={senhaAtual}
                        onChange={(e) => setSenhaAtual(e.target.value)}
                        className="w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 pr-10 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenhas(!mostrarSenhas)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-porcelain-ink"
                      >
                        {mostrarSenhas ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-subtle mb-1.5 block">
                      Nova senha
                    </label>
                    <input
                      type={mostrarSenhas ? "text" : "password"}
                      value={senhaNova}
                      onChange={(e) => setSenhaNova(e.target.value)}
                      className="w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors"
                      placeholder="Mínimo 8 caracteres"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-subtle mb-1.5 block">
                      Confirmar nova senha
                    </label>
                    <input
                      type={mostrarSenhas ? "text" : "password"}
                      value={senhaConfirm}
                      onChange={(e) => setSenhaConfirm(e.target.value)}
                      className={cn(
                        "w-full bg-ink-night border rounded-[10px] px-3 py-2.5 text-sm text-porcelain-ink focus:outline-none transition-colors",
                        senhaConfirm && senhaNova !== senhaConfirm
                          ? "border-error-red/50 focus:border-error-red"
                          : "border-mist-line focus:border-teal-ink/50"
                      )}
                      placeholder="Repita a nova senha"
                    />
                    {senhaConfirm && senhaNova !== senhaConfirm && (
                      <p className="text-xs text-error-red mt-1">
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
                      className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium bg-teal-ink text-ink-night hover:bg-teal-ink/90 disabled:bg-mist-line disabled:text-text-subtle disabled:cursor-not-allowed transition-all"
                    >
                      <Lock size={14} />
                      {alterarSenha.isPending ? "Alterando..." : "Alterar senha"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Autenticação de Dois Fatores (MFA) */}
              <div className="bg-ink-bg border border-mist-line rounded-[18px] p-6 space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-porcelain-ink">
                    Autenticação de Dois Fatores (MFA)
                  </h2>
                  <p className="text-xs text-text-subtle mt-1">
                    Adicione uma camada extra de segurança à sua conta exigindo um código de verificação ao fazer login.
                  </p>
                </div>

                <div className="divide-y divide-mist-line space-y-4">
                  {/* TOTP Option */}
                  <div className="flex items-center justify-between pt-4 first:pt-0">
                    <div className="space-y-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-porcelain-ink">
                          Aplicativo Autenticador (TOTP)
                        </span>
                        {usuario?.mfa_totp_ativo ? (
                          <span className="text-[10px] bg-teal-ink/15 text-teal-ink font-semibold px-2 py-0.5 rounded-full border border-teal-ink/20">
                            Ativo
                          </span>
                        ) : (
                          <span className="text-[10px] bg-text-subtle/15 text-text-subtle font-semibold px-2 py-0.5 rounded-full border border-text-subtle/10">
                            Inativo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-subtle">
                        Use aplicativos como Google Authenticator, Microsoft Authenticator ou Authy para gerar códigos de segurança de uso único.
                      </p>
                    </div>
                    <div>
                      {usuario?.mfa_totp_ativo ? (
                        <button
                          type="button"
                          onClick={() => setShowMfaDisableModal({ type: "totp" })}
                          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-4 py-2.5 text-xs font-semibold rounded-[10px] border border-error-red/30 hover:bg-error-red hover:text-porcelain-ink text-error-red transition-all shrink-0"
                        >
                          Desativar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleStartTotpSetup}
                          disabled={totpSetupPending}
                          aria-busy={totpSetupPending}
                          className="min-h-[44px] min-w-[44px] px-4 py-2.5 text-xs font-semibold rounded-[10px] bg-teal-ink/10 border border-teal-ink/30 hover:bg-teal-ink hover:text-ink-night text-teal-ink transition-all inline-flex items-center justify-center gap-1.5 shrink-0"
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
                        <span className="text-sm font-medium text-porcelain-ink">
                          Código por E-mail (OTP)
                        </span>
                        {usuario?.mfa_email_ativo ? (
                          <span className="text-[10px] bg-teal-ink/15 text-teal-ink font-semibold px-2 py-0.5 rounded-full border border-teal-ink/20">
                            Ativo
                          </span>
                        ) : (
                          <span className="text-[10px] bg-text-subtle/15 text-text-subtle font-semibold px-2 py-0.5 rounded-full border border-text-subtle/10">
                            Inativo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-subtle">
                        Receba um código numérico temporário diretamente no seu e-mail cadastrado a cada tentativa de login.
                      </p>
                    </div>
                    <div>
                      {usuario?.mfa_email_ativo ? (
                        <button
                          type="button"
                          onClick={() => setShowMfaDisableModal({ type: "email" })}
                          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-4 py-2.5 text-xs font-semibold rounded-[10px] border border-error-red/30 hover:bg-error-red hover:text-porcelain-ink text-error-red transition-all shrink-0"
                        >
                          Desativar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowMfaEmailActivateModal(true)}
                          className="min-h-[44px] min-w-[44px] px-4 py-2.5 text-xs font-semibold rounded-[10px] bg-teal-ink/10 border border-teal-ink/30 hover:bg-teal-ink hover:text-ink-night text-teal-ink transition-all inline-flex items-center justify-center gap-1.5 shrink-0"
                        >
                          Ativar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Informações de sessão */}
              <div className="bg-ink-bg border border-mist-line rounded-[18px] p-6">
                <h2 className="text-base font-semibold text-porcelain-ink mb-4">
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
                      className="flex items-center justify-between py-2 border-b border-mist-line last:border-0"
                    >
                      <span className="text-sm text-text-subtle">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-porcelain-ink">{item.valor}</span>
                        <CheckCircle size={13} className="text-teal-ink" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Privacidade e seus dados (LGPD art. 18) */}
              <div className="bg-ink-bg border border-mist-line rounded-[18px] p-6">
                <h2 className="text-base font-semibold text-porcelain-ink mb-1">
                  Privacidade e seus dados
                </h2>
                <p className="text-xs text-text-subtle mb-4">
                  Seus direitos como titular de dados (LGPD). Estes controles se aplicam à sua conta.
                </p>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3 py-2 border-b border-mist-line">
                    <div className="min-w-0">
                      <p className="text-sm text-porcelain-ink">Exportar meus dados</p>
                      <p className="text-xs text-text-subtle">
                        Baixe uma cópia dos dados da sua conta em JSON.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportarDados}
                      disabled={exportandoDados}
                      aria-busy={exportandoDados}
                      className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 text-xs font-semibold rounded-[10px] border border-mist-line hover:bg-surface-raised text-porcelain-ink transition-all shrink-0 disabled:opacity-50"
                    >
                      {exportandoDados ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Download size={13} />
                      )}
                      Exportar
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm text-porcelain-ink">Solicitar exclusão da conta</p>
                      <p className="text-xs text-text-subtle">
                        Registra seu pedido de eliminação de dados.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowExclusaoModal(true)}
                      className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 text-xs font-semibold rounded-[10px] border border-error-red/30 hover:bg-error-red hover:text-porcelain-ink text-error-red transition-all shrink-0"
                    >
                      <Trash2 size={13} />
                      Solicitar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---- ABA: ASSINATURA ---- */}
          {aba === "assinatura" && isAdmin && (
            <div className="space-y-6">
              <div className="bg-ink-bg border border-mist-line rounded-[18px] p-6 space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-porcelain-ink">
                    Assinatura do Estúdio
                  </h2>
                  <p className="text-xs text-text-subtle mt-1">
                    Gerencie seu plano e ciclo de faturamento com segurança através do Mercado Pago.
                  </p>
                </div>

                {loadingPlanos || loadingGatewayConfig ? (
                  <div className="space-y-4">
                    <div className="h-24 bg-surface-raised rounded-[14px] animate-pulse" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-48 bg-surface-raised rounded-[14px] animate-pulse" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* F2: estado da assinatura vigente (trial/ativa/etc.).
                        Sem dados fake — enquanto carrega mostra skeleton; sem
                        assinatura mostra um aviso neutro. */}
                    {loadingAssinatura ? (
                      <div className="h-20 bg-surface-raised rounded-[14px] animate-pulse" />
                    ) : assinaturaResumo ? (
                      (() => {
                        const r = assinaturaResumo;
                        const emTrial = r.trial;
                        const ativa = r.status === "ATIVA";
                        const dias = r.dias_restantes_trial;
                        const tom = ativa
                          ? "bg-teal-ink/10 border-teal-ink/25 text-teal-ink"
                          : emTrial
                            ? "bg-surface-raised border-mist-line text-porcelain-ink"
                            : "bg-copper-needle/10 border-copper-needle/25 text-copper-needle";
                        return (
                          <div className={cn("p-4 rounded-[14px] border flex items-start gap-3", tom)}>
                            {ativa ? (
                              <CheckCircle size={18} className="shrink-0 mt-0.5" />
                            ) : emTrial ? (
                              <Clock size={18} className="shrink-0 mt-0.5 text-teal-ink" />
                            ) : (
                              <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                              {ativa ? (
                                <>
                                  <p className="text-sm font-semibold">
                                    Plano ativo{r.plano_nome ? `: ${r.plano_nome}` : ""}
                                  </p>
                                  <p className="text-xs text-text-subtle mt-0.5">
                                    Sua assinatura está em dia. Obrigado por usar o SessãoInk!
                                  </p>
                                </>
                              ) : emTrial ? (
                                <>
                                  <p className="text-sm font-semibold">
                                    {dias !== null
                                      ? `Trial: ${dias} ${dias === 1 ? "dia restante" : "dias restantes"}`
                                      : "Período de avaliação ativo"}
                                    {r.plano_nome ? ` — ${r.plano_nome}` : ""}
                                  </p>
                                  <p className="text-xs text-text-subtle mt-0.5">
                                    Aproveite o período de avaliação. Escolha um plano abaixo para
                                    continuar sem interrupções.
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="text-sm font-semibold">
                                    {r.status === "SEM_ASSINATURA"
                                      ? "Nenhuma assinatura ativa"
                                      : "Sua assinatura precisa de atenção"}
                                  </p>
                                  <p className="text-xs text-text-subtle mt-0.5">
                                    Escolha um plano abaixo para liberar todos os recursos do
                                    estúdio.
                                  </p>
                                </>
                              )}
                            </div>
                            {!ativa && (
                              <button
                                type="button"
                                onClick={() => verificarPagamento(true)}
                                disabled={reconciliarMutation.isPending}
                                title="Já paguei — verificar no Mercado Pago"
                                className="shrink-0 self-center h-9 px-3 rounded-[10px] border border-teal-ink/40 text-teal-ink text-xs font-semibold hover:bg-teal-ink/10 disabled:opacity-50 inline-flex items-center gap-1.5"
                              >
                                {reconciliarMutation.isPending ? (
                                  <><Loader2 size={13} className="animate-spin" /> Verificando…</>
                                ) : (
                                  <><RefreshCw size={13} /> Já paguei</>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })()
                    ) : null}

                    {/* Status do Gateway */}
                    {gatewayConfig && !gatewayConfig.go_live && (
                      <div className="p-3 bg-copper-needle/10 border border-copper-needle/20 text-copper-needle text-xs rounded-[10px] flex items-start gap-2.5">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Ambiente de Testes (go_live desligado)</p>
                          <p className="mt-0.5">As transações reais estão desabilitadas. Checkouts retornarão erro 503 pelo servidor do estúdio.</p>
                        </div>
                      </div>
                    )}

                    {/* Catálogo de Planos */}
                    <div className="space-y-4">
                      <label className="text-xs font-semibold text-text-subtle uppercase tracking-wider block">
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
                                // Se o ciclo atual não existir no novo plano,
                                // cai para o primeiro ciclo disponível.
                                const ciclosDoPlano = plano.tabela_precos ?? [];
                                const hasCycle = ciclosDoPlano.some((t: any) => t.ciclo === selectedCycle);
                                if (!hasCycle && ciclosDoPlano.length > 0) {
                                  setSelectedCycle(ciclosDoPlano[0].ciclo);
                                }
                              }}
                              className={cn(
                                "flex flex-col text-left p-5 rounded-[16px] border transition-all relative overflow-hidden group",
                                isSelected
                                  ? "bg-surface-raised border-teal-ink shadow-[0_4px_20px_rgba(47,146,133,0.15)]"
                                  : "bg-ink-night border-mist-line hover:border-text-subtle/30"
                              )}
                            >
                              {isPopular && (
                                <div className="absolute top-0 right-0 bg-teal-ink text-ink-night text-[9px] font-bold px-2 py-0.5 rounded-bl-[10px]">
                                  {plano.badge || "Recomendado"}
                                </div>
                              )}
                              <h3 className="text-porcelain-ink font-bold text-sm">{plano.nome}</h3>
                              <p className="text-[10px] text-text-subtle mt-1 line-clamp-2">
                                {plano.descricao}
                              </p>
                              
                              <div className="mt-4 flex items-baseline gap-1">
                                <span className="text-base font-bold text-porcelain-ink">
                                  R$ {plano.preco_mensal.toFixed(0)}
                                </span>
                                <span className="text-[10px] text-text-subtle">/mês</span>
                              </div>

                              {plano.promocao && (
                                <p className="text-[9px] text-teal-ink mt-1 font-medium bg-teal-ink/10 px-1.5 py-0.5 rounded">
                                  {plano.promocao.descricao}
                                </p>
                              )}

                              <div className="mt-4 pt-3 border-t border-mist-line/50 w-full space-y-1.5">
                                {plano.recursos?.slice(0, 4).map((rec: any, idx: number) => (
                                  <div key={idx} className="flex items-center gap-1.5 text-[10px] text-smoke-text">
                                    <CheckCircle size={10} className="text-teal-ink shrink-0" />
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
                      <label className="text-xs font-semibold text-text-subtle uppercase tracking-wider block">
                        2. Escolha o Ciclo de Faturamento
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Todos os ciclos do plano: mensal, trimestral, semestral e anual. */}
                        {ciclosVisiveis.map((preco: any) => {
                          const isSelected = selectedCycle === preco.ciclo;
                          return (
                            <button
                              key={preco.ciclo}
                              type="button"
                              onClick={() => setSelectedCycle(preco.ciclo)}
                              className={cn(
                                "flex items-start text-left p-4 rounded-[14px] border transition-all",
                                isSelected
                                  ? "bg-surface-raised border-teal-ink"
                                  : "bg-ink-night border-mist-line hover:border-text-subtle/30"
                              )}
                            >
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-porcelain-ink">{preco.label}</span>
                                  {preco.desconto_pix_pct > 0 && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-ink/15 text-teal-ink">
                                      -{preco.desconto_pix_pct}% no Pix
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-text-subtle mt-1">{preco.obs}</p>
                              </div>
                              <div className="text-right shrink-0">
                                {preco.ciclo === "mensal" ? (
                                  <>
                                    <p className="text-xs font-bold text-porcelain-ink">R$ {preco.preco_cheio}/mês</p>
                                    <p className="text-[9px] text-text-subtle">recorrente</p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-xs font-bold text-porcelain-ink">R$ {preco.pix_total}</p>
                                    <p className="text-[9px] text-text-subtle line-through">R$ {preco.preco_cheio}</p>
                                    {preco.cartao_modo === "parcelado" && (
                                      <p className="text-[9px] text-teal-ink">
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
                    {/* F2: quando o gateway está fora do ar (go_live=false), a cobrança
                        não está habilitada no backend (responde 503). Degradamos com
                        elegância: botão desabilitado + aviso, em vez de deixar o usuário
                        clicar e só descobrir a indisponibilidade no erro 503. */}
                    {(() => {
                      const pagamentosIndisponiveis = gatewayConfig
                        ? !gatewayConfig.go_live
                        : false;
                      return (
                        <div className="pt-4 border-t border-mist-line space-y-3">
                          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div>
                              <p className="text-xs text-text-subtle">Plano e ciclo selecionados:</p>
                              <p className="text-sm font-bold text-porcelain-ink">
                                {selectedPlan?.nome} — {selectedPlan?.tabela_precos?.find((p: any) => p.ciclo === selectedCycle)?.label}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={handleCheckout}
                              disabled={checkoutPending || pagamentosIndisponiveis}
                              aria-busy={checkoutPending}
                              title={
                                pagamentosIndisponiveis
                                  ? "A cobrança ainda não está habilitada neste estúdio. Em breve você poderá assinar por aqui."
                                  : undefined
                              }
                              className="w-full md:w-auto px-6 h-11 bg-teal-ink hover:bg-ink-gold text-ink-night font-semibold text-sm rounded-[12px] flex items-center justify-center gap-2 transition-all shadow-[0_4px_12px_rgba(47,146,133,0.2)] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none"
                            >
                              {checkoutPending ? (
                                <>
                                  <Loader2 size={16} className="animate-spin" />
                                  Redirecionando...
                                </>
                              ) : pagamentosIndisponiveis ? (
                                <>
                                  <Clock size={16} />
                                  Pagamentos em breve
                                </>
                              ) : (
                                <>
                                  <CreditCard size={16} />
                                  Assinar com Mercado Pago
                                </>
                              )}
                            </button>
                          </div>

                          {pagamentosIndisponiveis && (
                            <p className="text-[11px] text-text-subtle flex items-start gap-1.5">
                              <AlertCircle size={13} className="shrink-0 mt-0.5 text-copper-needle" />
                              A assinatura paga ainda não está disponível neste estúdio. Estamos
                              finalizando a configuração da cobrança — você será avisado assim
                              que puder assinar.
                            </p>
                          )}
                        </div>
                      );
                    })()}
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
          <div className="bg-ink-bg border border-mist-line w-full max-w-md rounded-[18px] shadow-popover overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-mist-line">
              <h2 className="text-porcelain-ink font-bold text-sm">Configurar App Autenticador</h2>
              <button
                onClick={() => {
                  setShowTotpSetupModal(false);
                  setTotpSetupData(null);
                  setTotpVerificationCode("");
                }}
                className="text-text-subtle hover:text-porcelain-ink"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-text-subtle leading-relaxed">
                1. Escaneie o QR Code abaixo com seu aplicativo autenticador (ex: Google Authenticator, Authy):
              </p>
              
              <div className="flex justify-center p-3 bg-white rounded-xl w-48 h-48 mx-auto border border-mist-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={totpSetupData.qr_code} alt="QR Code MFA" className="w-full h-full object-contain" />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-text-subtle">
                  Ou insira a chave manual no aplicativo:
                </p>
                <div className="flex items-center gap-2 bg-ink-night border border-mist-line rounded-[10px] px-3 py-2 text-xs font-mono text-porcelain-ink">
                  <span className="flex-1 truncate">{totpSetupData.secret}</span>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="text-teal-ink hover:text-ink-gold shrink-0"
                  >
                    {copiedSecret ? "Copiado!" : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label htmlFor="verify-totp-code" className="text-xs font-medium text-text-subtle block">
                  2. Digite o código de 6 dígitos gerado pelo aplicativo para confirmar:
                </label>
                <input
                  id="verify-totp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={totpVerificationCode}
                  onChange={(e) => setTotpVerificationCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2 text-center text-sm font-mono tracking-[0.2em] text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors"
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
                  className="flex-1 h-10 rounded-[12px] border border-mist-line hover:bg-surface-raised text-porcelain-ink font-semibold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={totpSetupPending || totpVerificationCode.length < 6}
                  onClick={handleActivateTotp}
                  className="flex-1 h-10 rounded-[12px] bg-teal-ink hover:bg-ink-gold disabled:opacity-50 disabled:cursor-not-allowed text-ink-night font-semibold text-sm transition-all flex items-center justify-center gap-2"
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
          <div className="bg-ink-bg border border-mist-line w-full max-w-md rounded-[18px] shadow-popover overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-mist-line">
              <h2 className="text-porcelain-ink font-bold text-sm">
                Desativar {showMfaDisableModal.type === "totp" ? "App Autenticador" : "Código por E-mail"}
              </h2>
              <button
                onClick={() => {
                  setShowMfaDisableModal(null);
                  setMfaDisablePassword("");
                }}
                className="text-text-subtle hover:text-porcelain-ink"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-text-subtle leading-relaxed">
                Por motivos de segurança, digite sua senha atual para confirmar a desativação da autenticação de dois fatores.
              </p>

              <div className="space-y-1.5">
                <label htmlFor="disable-mfa-pass" className="text-xs font-medium text-text-subtle block">
                  Sua senha
                </label>
                <input
                  id="disable-mfa-pass"
                  type="password"
                  autoComplete="current-password"
                  value={mfaDisablePassword}
                  onChange={(e) => setMfaDisablePassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowMfaDisableModal(null);
                    setMfaDisablePassword("");
                  }}
                  className="flex-1 h-10 rounded-[12px] border border-mist-line hover:bg-surface-raised text-porcelain-ink font-semibold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={mfaDisablePending || !mfaDisablePassword}
                  onClick={handleDisableMfa}
                  className="flex-1 h-10 rounded-[12px] bg-error-red hover:bg-error-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {mfaDisablePending && <Loader2 size={14} className="animate-spin" />}
                  Confirmar e Desativar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de ativação do 2º fator por e-mail (step-up: exige a senha) */}
      {showMfaEmailActivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-ink-bg border border-mist-line w-full max-w-md rounded-[18px] shadow-popover overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-mist-line">
              <h2 className="text-porcelain-ink font-bold text-sm">
                Ativar Código por E-mail
              </h2>
              <button
                onClick={() => {
                  setShowMfaEmailActivateModal(false);
                  setMfaEmailActivatePassword("");
                }}
                className="text-text-subtle hover:text-porcelain-ink"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-text-subtle leading-relaxed">
                Por motivos de segurança, digite sua senha atual para confirmar a ativação da verificação em duas etapas por e-mail.
              </p>

              <div className="space-y-1.5">
                <label htmlFor="activate-mfa-pass" className="text-xs font-medium text-text-subtle block">
                  Sua senha
                </label>
                <input
                  id="activate-mfa-pass"
                  type="password"
                  autoComplete="current-password"
                  value={mfaEmailActivatePassword}
                  onChange={(e) => setMfaEmailActivatePassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowMfaEmailActivateModal(false);
                    setMfaEmailActivatePassword("");
                  }}
                  className="flex-1 h-10 rounded-[12px] border border-mist-line hover:bg-surface-raised text-porcelain-ink font-semibold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={mfaEmailActivating || !mfaEmailActivatePassword}
                  onClick={handleActivateEmailMfa}
                  className="flex-1 h-10 rounded-[12px] bg-teal-ink hover:bg-teal-ink/90 disabled:opacity-50 disabled:cursor-not-allowed text-ink-night font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {mfaEmailActivating && <Loader2 size={14} className="animate-spin" />}
                  Confirmar e Ativar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de solicitação de exclusão (LGPD art. 18, VI) */}
      {showExclusaoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-ink-bg border border-mist-line w-full max-w-md rounded-[18px] shadow-popover overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-mist-line">
              <div className="flex items-center gap-2">
                <ShieldAlert size={18} className="text-error-red" />
                <h2 className="text-porcelain-ink font-bold text-sm">
                  Solicitar exclusão da conta
                </h2>
              </div>
              <button
                onClick={() => setShowExclusaoModal(false)}
                className="text-text-subtle hover:text-porcelain-ink"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-text-subtle leading-relaxed">
                Vamos registrar seu pedido de exclusão e processá-lo dentro do prazo
                legal. Alguns dados podem ser mantidos por obrigação legal/fiscal
                (por exemplo, registros de pagamento). Você receberá retorno pelo
                e-mail cadastrado.
              </p>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowExclusaoModal(false)}
                  className="flex-1 h-10 rounded-[12px] border border-mist-line hover:bg-surface-raised text-porcelain-ink font-semibold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={solicitandoExclusao}
                  onClick={handleSolicitarExclusao}
                  className="flex-1 h-10 rounded-[12px] bg-error-red hover:bg-error-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {solicitandoExclusao && <Loader2 size={14} className="animate-spin" />}
                  Confirmar solicitação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação do slug */}
      {showModalSlug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-ink-bg border border-mist-line w-full max-w-md rounded-[18px] shadow-popover overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-mist-line">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-copper-needle" />
                <h2 className="text-porcelain-ink font-bold text-sm">Alterar link do portal?</h2>
              </div>
              <button onClick={() => setShowModalSlug(false)} className="text-text-subtle hover:text-porcelain-ink">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-text-subtle leading-relaxed">
                Tem certeza que deseja alterar o endereço do seu estúdio de{" "}
                <strong className="text-porcelain-ink">sessao-ink.vercel.app/{estudio?.slug}</strong> para{" "}
                <strong className="text-teal-ink">sessao-ink.vercel.app/{novoSlug}</strong>?
              </p>
              <div className="p-3 bg-error-red/5 border border-error-red/20 text-error-red text-xs rounded-[10px] space-y-1">
                <p className="font-semibold">Atenção:</p>
                <p>O link antigo deixará de funcionar imediatamente. Seus clientes que usam o link antigo não conseguirão mais acessar a página.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModalSlug(false)}
                  className="flex-1 h-10 rounded-[12px] border border-mist-line hover:bg-surface-raised text-porcelain-ink font-semibold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={atualizarSlug.isPending}
                  onClick={() => atualizarSlug.mutate(novoSlug)}
                  className="flex-1 h-10 rounded-[12px] bg-error-red hover:bg-error-hover disabled:opacity-60 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
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

      <div className="mt-8 pt-6 border-t border-mist-line">
        <p className="text-xs text-text-subtle text-center">
          SessãoInk v1.0 · Ambiente local · Backend em localhost:8001
        </p>
      </div>
    </div>
  );
}
