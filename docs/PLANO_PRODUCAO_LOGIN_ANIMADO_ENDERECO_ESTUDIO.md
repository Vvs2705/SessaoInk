# Plano de Produção — Login Animado, Recuperação de Senha e Endereço Completo do Estúdio

## Objetivo

Implementar uma nova experiência de login para o SessãoInk e melhorar o perfil público do estúdio com endereço completo e botão de rota.

Este documento já inclui a regra correta da animação:

> A animação complexa da mão com maquininha deve aparecer somente no primeiro acesso do dia, por navegador/dispositivo.

---

# Escopo da entrega

## Frontend

- Reformular tela de login.
- Criar painel lateral explicativo do produto.
- Criar animação visual de mão/maquininha desenhando a área de login.
- Exibir animação somente uma vez por dia.
- Preservar login atual.
- Preservar MFA atual.
- Adicionar link “Esqueceu a senha?”.
- Criar telas públicas:
  - `/esqueci-senha`
  - `/resetar-senha?token=...`
- Atualizar configurações do estúdio para endereço completo.
- Atualizar portal público do estúdio com botão “Como chegar”.

## Backend

- Criar endpoints de recuperação de senha.
- Criar tokens seguros de reset no Redis.
- Criar envio de e-mail de reset.
- Criar campos de endereço completo no banco.
- Criar migration Alembic.
- Atualizar responses do estúdio.
- Atualizar portal público.
- Validar links do Google Maps/Google Negócios.

---

# Parte 1 — Nova experiência de login

## Resultado esperado

A tela de login deve ter:

- No desktop:
  - Painel esquerdo institucional.
  - Card de login à direita.
  - Animação da mão com maquininha na área do card.
- No mobile:
  - Layout vertical.
  - Texto mais curto.
  - Card central.
  - Animação leve e limitada.
- A animação aparece somente uma vez por dia.
- Usuários com `prefers-reduced-motion` não veem a animação.
- MFA atual continua funcionando.
- Cadastro atual continua funcionando.
- Login atual continua usando `/api/v1/auth/login`.
- MFA continua usando:
  - `/api/v1/auth/mfa/email/solicitar`
  - `/api/v1/auth/mfa/verificar`

---

## Criar componente de painel institucional

Criar:

`frontend/src/components/auth/AuthMarketingPanel.tsx`

```tsx
import { CalendarCheck, FileSignature, Image, Wallet } from "lucide-react";

const BENEFICIOS = [
  {
    titulo: "Agenda sem confusão",
    texto: "Organize horários, retornos, sessões e encaixes com clareza.",
    icon: CalendarCheck,
  },
  {
    titulo: "Cliente com histórico",
    texto: "Tenha dados, referências, consentimentos e evolução de cada atendimento.",
    icon: FileSignature,
  },
  {
    titulo: "Financeiro na mão",
    texto: "Acompanhe entradas, pendências, custos e resultados do estúdio.",
    icon: Wallet,
  },
  {
    titulo: "Portal público",
    texto: "Mostre portfólio, flash arts e receba pedidos de orçamento por link.",
    icon: Image,
  },
];

export function AuthMarketingPanel() {
  return (
    <aside className="relative hidden min-h-app overflow-hidden border-r border-[#243337] bg-[#050B12] px-10 py-10 text-[#F0EADD] lg:flex lg:flex-col lg:justify-between">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#2F9285]/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 right-0 h-80 w-80 rounded-full bg-[#C36B3F]/10 blur-3xl" />

      <div className="relative z-10 max-w-xl">
        <div className="mb-8 inline-flex rounded-full border border-[#2F9285]/30 bg-[#2F9285]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#2F9285]">
          SessãoInk
        </div>

        <h1 className="text-4xl font-black leading-tight tracking-tight xl:text-5xl">
          Gestão feita para tatuadores que querem viver da arte sem se perder na operação.
        </h1>

        <p className="mt-5 max-w-lg text-base leading-7 text-[#87938F]">
          Agenda, clientes, atendimentos, financeiro, portfólio, flash arts e documentos em um só lugar.
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-4">
        {BENEFICIOS.map(({ titulo, texto, icon: Icon }) => (
          <article
            key={titulo}
            className="rounded-3xl border border-[#243337] bg-[#0B171C]/80 p-5 shadow-2xl shadow-black/20 backdrop-blur"
          >
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl border border-[#2F9285]/25 bg-[#2F9285]/10 text-[#2F9285]">
              <Icon size={21} />
            </div>

            <h2 className="text-sm font-bold text-[#F0EADD]">{titulo}</h2>
            <p className="mt-2 text-xs leading-5 text-[#87938F]">{texto}</p>
          </article>
        ))}
      </div>
    </aside>
  );
}
````

---

## Criar animação SVG

Criar:

`frontend/src/components/auth/TattooLoginIllustration.tsx`

```tsx
export function TattooLoginIllustration() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]"
      aria-hidden="true"
    >
      <svg
        className="tattoo-login-svg absolute -right-12 -top-10 h-[360px] w-[360px] opacity-80 sm:h-[430px] sm:w-[430px]"
        viewBox="0 0 420 420"
        fill="none"
      >
        <defs>
          <linearGradient id="tattooInk" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#2F9285" />
            <stop offset="55%" stopColor="#F0EADD" />
            <stop offset="100%" stopColor="#C36B3F" />
          </linearGradient>

          <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          className="tattoo-line tattoo-line-one"
          d="M79 274 C131 196 207 184 288 224 C326 243 343 279 329 305 C315 331 267 338 221 319 C171 299 139 302 107 339"
          stroke="url(#tattooInk)"
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#softGlow)"
        />

        <path
          className="tattoo-line tattoo-line-two"
          d="M112 238 C152 195 221 172 283 190 C324 202 351 233 355 268"
          stroke="#2F9285"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.75"
        />

        <path
          className="tattoo-line tattoo-line-three"
          d="M151 292 C187 264 239 260 284 285"
          stroke="#F0EADD"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.55"
        />

        <g className="tattoo-machine">
          <path
            d="M260 70 C282 64 307 73 319 94 L336 124 C344 139 338 158 323 166 L296 181 C281 189 262 184 254 169 L236 134 C223 109 234 78 260 70Z"
            fill="#141F26"
            stroke="#34484B"
            strokeWidth="3"
          />

          <path
            d="M259 111 L219 154"
            stroke="#87938F"
            strokeWidth="10"
            strokeLinecap="round"
          />

          <path
            d="M213 160 L185 192"
            stroke="#2F9285"
            strokeWidth="5"
            strokeLinecap="round"
          />

          <circle cx="289" cy="116" r="19" fill="#2F9285" opacity="0.9" />
          <circle cx="289" cy="116" r="7" fill="#F0EADD" />

          <path
            d="M214 157 C202 149 187 150 176 158 L148 178 C132 190 112 195 93 190 L80 187"
            stroke="#5F6F70"
            strokeWidth="12"
            strokeLinecap="round"
          />

          <path
            d="M177 158 C172 181 181 204 201 216"
            stroke="#8D5B42"
            strokeWidth="18"
            strokeLinecap="round"
          />

          <path
            d="M187 189 C204 193 218 204 225 220"
            stroke="#A86E4E"
            strokeWidth="14"
            strokeLinecap="round"
          />
        </g>

        <g className="tattoo-sparks">
          <circle cx="141" cy="237" r="3" fill="#2F9285" />
          <circle cx="176" cy="217" r="2.5" fill="#F0EADD" />
          <circle cx="210" cy="207" r="2" fill="#C36B3F" />
          <circle cx="247" cy="215" r="2.5" fill="#2F9285" />
        </g>
      </svg>
    </div>
  );
}
```

---

## Criar controle de animação uma vez por dia

Criar:

`frontend/src/components/auth/DailyTattooLoginAnimation.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";

import { TattooLoginIllustration } from "@/components/auth/TattooLoginIllustration";

const LAST_SEEN_KEY = "sessaoink:login-animation:last-seen-date";
const PENDING_UNTIL_KEY = "sessaoink:login-animation:pending-until";
const ANIMATION_DURATION_MS = 5600;

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function safeStorageGet(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // Storage bloqueado: a regra não será persistida nesse navegador.
  }
}

function safeStorageRemove(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Storage bloqueado: nada a remover.
  }
}

function shouldRespectReducedMotion() {
  if (typeof window === "undefined") {
    return true;
  }

  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function isPreviewModeEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);

  return (
    process.env.NODE_ENV !== "production" &&
    params.get("previewAnimation") === "1"
  );
}

export function DailyTattooLoginAnimation() {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const previewMode = isPreviewModeEnabled();
    const today = getLocalDateKey();
    const now = Date.now();

    if (shouldRespectReducedMotion() && !previewMode) {
      safeStorageSet(window.localStorage, LAST_SEEN_KEY, today);
      return;
    }

    const pendingUntilRaw = safeStorageGet(
      window.sessionStorage,
      PENDING_UNTIL_KEY,
    );

    const pendingUntil = Number(pendingUntilRaw ?? "0");
    const lastSeenDate = safeStorageGet(window.localStorage, LAST_SEEN_KEY);

    let mustShowAnimation = previewMode;
    let visibleForMs = ANIMATION_DURATION_MS;

    if (!mustShowAnimation && pendingUntil > now) {
      mustShowAnimation = true;
      visibleForMs = Math.max(800, pendingUntil - now);
    }

    if (!mustShowAnimation && lastSeenDate !== today) {
      const newPendingUntil = now + ANIMATION_DURATION_MS;

      safeStorageSet(window.localStorage, LAST_SEEN_KEY, today);
      safeStorageSet(
        window.sessionStorage,
        PENDING_UNTIL_KEY,
        String(newPendingUntil),
      );

      mustShowAnimation = true;
      visibleForMs = ANIMATION_DURATION_MS;
    }

    if (!mustShowAnimation) {
      return;
    }

    setShouldRender(true);

    const timeoutId = window.setTimeout(() => {
      setShouldRender(false);

      if (!previewMode) {
        safeStorageRemove(window.sessionStorage, PENDING_UNTIL_KEY);
      }
    }, visibleForMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="tattoo-login-once" aria-hidden="true">
      <TattooLoginIllustration />
    </div>
  );
}
```

---

## Adicionar CSS da animação

Acrescentar ao final de:

`frontend/src/styles/globals.css`

```css
.tattoo-login-svg {
  transform-origin: 70% 28%;
}

.tattoo-line {
  stroke-dasharray: 620;
  stroke-dashoffset: 620;
  animation: tattooDraw 4.8s ease-in-out infinite;
}

.tattoo-line-two {
  animation-delay: 0.45s;
}

.tattoo-line-three {
  animation-delay: 0.85s;
}

.tattoo-machine {
  transform-origin: 260px 130px;
  animation: tattooMachineMove 4.8s ease-in-out infinite;
}

.tattoo-sparks {
  animation: tattooSparkPulse 1.2s ease-in-out infinite;
}

.tattoo-login-once {
  opacity: 1;
  animation: tattooLoginLayerFadeOut 5.6s ease forwards;
  contain: layout paint;
}

.tattoo-login-once .tattoo-line,
.tattoo-login-once .tattoo-machine,
.tattoo-login-once .tattoo-sparks {
  animation-iteration-count: 1;
}

.tattoo-login-once .tattoo-line {
  animation-fill-mode: forwards;
}

@keyframes tattooDraw {
  0% {
    stroke-dashoffset: 620;
    opacity: 0;
  }

  14% {
    opacity: 1;
  }

  55% {
    stroke-dashoffset: 0;
    opacity: 1;
  }

  78% {
    stroke-dashoffset: 0;
    opacity: 0.9;
  }

  100% {
    stroke-dashoffset: -620;
    opacity: 0;
  }
}

@keyframes tattooMachineMove {
  0% {
    transform: translate3d(28px, -12px, 0) rotate(-10deg);
  }

  28% {
    transform: translate3d(-18px, 44px, 0) rotate(8deg);
  }

  52% {
    transform: translate3d(-68px, 96px, 0) rotate(14deg);
  }

  76% {
    transform: translate3d(-26px, 34px, 0) rotate(2deg);
  }

  100% {
    transform: translate3d(28px, -12px, 0) rotate(-10deg);
  }
}

@keyframes tattooSparkPulse {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.8);
  }

  45% {
    opacity: 1;
    transform: scale(1);
  }

  70% {
    opacity: 0.25;
    transform: scale(1.2);
  }
}

@keyframes tattooLoginLayerFadeOut {
  0%,
  82% {
    opacity: 1;
  }

  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tattoo-line,
  .tattoo-machine,
  .tattoo-sparks,
  .tattoo-login-once {
    animation: none !important;
  }

  .tattoo-line {
    stroke-dashoffset: 0;
    opacity: 0.65;
  }
}
```

---

## Corrigir layout de autenticação

Substituir:

`frontend/src/app/(auth)/layout.tsx`

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-app bg-[#050B12] text-[#F0EADD]">
      {children}
    </main>
  );
}
```

---

## Substituir página de login

Substituir:

`frontend/src/app/(auth)/login/page.tsx`

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { AuthMarketingPanel } from "@/components/auth/AuthMarketingPanel";
import { DailyTattooLoginAnimation } from "@/components/auth/DailyTattooLoginAnimation";
import { BrandLogo } from "@/components/BrandLogo";
import { api, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

type LoginApiResponse = {
  message?: string;
  token_type?: string;
  mfa_required?: boolean;
  metodos?: string[];
  desafio?: string | null;
};

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();

  const rawFrom = params.get("from") ?? "/";
  const from = rawFrom.startsWith("/") && !rawFrom.startsWith("/api/")
    ? rawFrom
    : "/";

  const [showPass, setShowPass] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaMetodos, setMfaMetodos] = useState<string[]>([]);
  const [mfaDesafio, setMfaDesafio] = useState<string | null>(null);
  const [selectedMetodo, setSelectedMetodo] = useState<"totp" | "email">("totp");
  const [mfaCodigo, setMfaCodigo] = useState("");
  const [emailEnviado, setEmailEnviado] = useState(false);
  const [mfaSubmitting, setMfaSubmitting] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setApiError(null);

    try {
      const res = (await api.post("/api/v1/auth/login", {
        email: data.email,
        senha: data.senha,
      })) as LoginApiResponse;

      if (res?.mfa_required) {
        setMfaRequired(true);
        setMfaMetodos(res.metodos ?? []);
        setMfaDesafio(res.desafio ?? null);

        if (res.metodos?.includes("totp")) {
          setSelectedMetodo("totp");
        } else if (res.metodos?.includes("email")) {
          setSelectedMetodo("email");
        }

        return;
      }

      router.push(from);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        let message = "Erro na requisição. Verifique os dados.";

        const detail = error.detail as unknown;

        if (typeof detail === "string") {
          message =
            detail === "Email ou senha incorretos"
              ? "E-mail ou senha incorretos. Verifique e tente novamente."
              : detail;
        } else if (Array.isArray(detail)) {
          message = detail
            .map((item: unknown) => {
              if (
                typeof item === "object" &&
                item !== null &&
                "msg" in item
              ) {
                return String((item as { msg: unknown }).msg);
              }

              return JSON.stringify(item);
            })
            .join(", ");
        } else if (detail && typeof detail === "object") {
          message = JSON.stringify(detail);
        }

        setApiError(message);
      } else {
        setApiError("Erro de conexão. Verifique se o servidor está rodando.");
      }
    }
  };

  const handleVerifyMfa = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!mfaDesafio || !mfaCodigo) {
      return;
    }

    setMfaError(null);
    setMfaSubmitting(true);

    try {
      await api.post("/api/v1/auth/mfa/verificar", {
        desafio: mfaDesafio,
        codigo: mfaCodigo,
        metodo: selectedMetodo,
      });

      router.push(from);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 429) {
          setMfaError("Muitas tentativas. Por favor, aguarde alguns minutos.");
        } else if (error.status === 401) {
          setMfaError(
            "Desafio de verificação expirado. Volte e faça login novamente.",
          );
        } else {
          setMfaError(error.detail || "Código de verificação inválido.");
        }
      } else {
        setMfaError("Erro de conexão. Verifique se o servidor está rodando.");
      }
    } finally {
      setMfaSubmitting(false);
    }
  };

  const handleSolicitarEmailOtp = async () => {
    if (!mfaDesafio) {
      return;
    }

    setMfaError(null);
    setMfaSubmitting(true);

    try {
      await api.post("/api/v1/auth/mfa/email/solicitar", {
        desafio: mfaDesafio,
      });

      setEmailEnviado(true);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 429) {
          setMfaError("Limite de envios excedido. Aguarde alguns minutos.");
        } else {
          setMfaError(error.detail || "Erro ao enviar código por e-mail.");
        }
      } else {
        setMfaError("Erro de conexão. Verifique se o servidor está rodando.");
      }
    } finally {
      setMfaSubmitting(false);
    }
  };

  const handleBackToCredentials = () => {
    setMfaRequired(false);
    setMfaDesafio(null);
    setMfaMetodos([]);
    setMfaCodigo("");
    setEmailEnviado(false);
    setMfaError(null);
  };

  return (
    <div className="grid min-h-app lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <AuthMarketingPanel />

      <section className="relative flex min-h-app items-center justify-center overflow-hidden px-4 py-8 sm:px-6 lg:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(47,146,133,0.18),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(195,107,63,0.12),transparent_34%)]" />

        <div className="relative z-10 w-full max-w-md">
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <BrandLogo layout="full" size="lg" scaling={false} />
            <p className="mt-4 text-sm leading-6 text-[#87938F]">
              Gestão para tatuadores organizarem agenda, clientes, financeiro,
              portfólio e atendimentos em um só lugar.
            </p>
          </div>

          <DailyTattooLoginAnimation />

          <div className="relative overflow-hidden rounded-[2rem] border border-[#243337] bg-[#0B171C]/90 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
            <div className="mb-7 hidden justify-center lg:flex">
              <BrandLogo layout="full" size="lg" scaling={false} />
            </div>

            <div className="mb-6 text-center">
              <h1 className="text-2xl font-black tracking-tight text-[#F0EADD]">
                {mfaRequired ? "Confirme sua identidade" : "Acesse seu estúdio"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#87938F]">
                {mfaRequired
                  ? "Selecione o método e informe o código de segurança."
                  : "Entre para gerenciar seus atendimentos, clientes e agenda."}
              </p>
            </div>

            {mfaRequired ? (
              <form onSubmit={handleVerifyMfa} className="space-y-4">
                {mfaMetodos.includes("totp") && mfaMetodos.includes("email") && (
                  <div className="flex rounded-xl border border-[#243337] bg-[#050B12] p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMetodo("totp");
                        setMfaError(null);
                      }}
                      className={cn(
                        "flex-1 rounded-[10px] py-2 text-xs font-semibold transition-all",
                        selectedMetodo === "totp"
                          ? "bg-[#2F9285] text-[#050B12]"
                          : "text-[#87938F] hover:text-[#F0EADD]",
                      )}
                    >
                      App autenticador
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMetodo("email");
                        setMfaError(null);
                      }}
                      className={cn(
                        "flex-1 rounded-[10px] py-2 text-xs font-semibold transition-all",
                        selectedMetodo === "email"
                          ? "bg-[#2F9285] text-[#050B12]"
                          : "text-[#87938F] hover:text-[#F0EADD]",
                      )}
                    >
                      Código por e-mail
                    </button>
                  </div>
                )}

                {selectedMetodo === "totp" && (
                  <div>
                    <label
                      htmlFor="mfa-totp"
                      className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#87938F]"
                    >
                      Código do app
                    </label>
                    <input
                      id="mfa-totp"
                      inputMode="numeric"
                      maxLength={6}
                      value={mfaCodigo}
                      onChange={(event) =>
                        setMfaCodigo(event.target.value.replace(/\D/g, ""))
                      }
                      className="h-12 w-full rounded-2xl border border-[#243337] bg-[#102128] px-4 text-center font-mono text-base tracking-[0.5em] text-[#F0EADD] outline-none transition focus:border-[#2F9285] focus:ring-2 focus:ring-[#2F9285]/20"
                      required
                    />
                  </div>
                )}

                {selectedMetodo === "email" && (
                  <div className="space-y-4">
                    {!emailEnviado ? (
                      <div className="rounded-2xl border border-[#243337] bg-[#050B12] p-4">
                        <p className="text-sm leading-6 text-[#87938F]">
                          Enviaremos um código de uso único para o e-mail cadastrado.
                        </p>

                        <button
                          type="button"
                          onClick={handleSolicitarEmailOtp}
                          disabled={mfaSubmitting}
                          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2F9285] px-4 text-sm font-bold text-[#050B12] transition hover:bg-[#3AA99A] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {mfaSubmitting && (
                            <Loader2 size={17} className="animate-spin" />
                          )}
                          Solicitar código
                        </button>
                      </div>
                    ) : (
                      <div>
                        <label
                          htmlFor="mfa-email"
                          className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#87938F]"
                        >
                          Código recebido por e-mail
                        </label>
                        <input
                          id="mfa-email"
                          inputMode="numeric"
                          maxLength={6}
                          value={mfaCodigo}
                          onChange={(event) =>
                            setMfaCodigo(event.target.value.replace(/\D/g, ""))
                          }
                          className="h-12 w-full rounded-2xl border border-[#243337] bg-[#102128] px-4 text-center font-mono text-base tracking-[0.5em] text-[#F0EADD] outline-none transition focus:border-[#2F9285] focus:ring-2 focus:ring-[#2F9285]/20"
                          required
                        />

                        <button
                          type="button"
                          onClick={handleSolicitarEmailOtp}
                          disabled={mfaSubmitting}
                          className="mt-3 text-xs font-semibold text-[#2F9285] hover:text-[#3AA99A] disabled:opacity-60"
                        >
                          Reenviar código por e-mail
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {mfaError && (
                  <p className="rounded-2xl border border-[#E35D5B]/30 bg-[#E35D5B]/10 p-3 text-sm text-[#E35D5B]">
                    {mfaError}
                  </p>
                )}

                {(selectedMetodo === "totp" || emailEnviado) && (
                  <button
                    type="submit"
                    disabled={mfaSubmitting}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#2F9285] px-4 font-bold text-[#050B12] transition hover:bg-[#3AA99A] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {mfaSubmitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      "Confirmar e entrar"
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleBackToCredentials}
                  className="h-11 w-full rounded-xl border border-[#243337] text-sm font-semibold text-[#87938F] transition hover:text-[#F0EADD]"
                >
                  Voltar para o login
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#87938F]"
                  >
                    E-mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...register("email")}
                    className="h-12 w-full rounded-2xl border border-[#243337] bg-[#102128] px-4 text-base text-[#F0EADD] outline-none transition placeholder:text-[#5F6F70] focus:border-[#2F9285] focus:ring-2 focus:ring-[#2F9285]/20"
                    placeholder="voce@email.com"
                  />
                  {errors.email && (
                    <p className="mt-2 text-xs text-[#E35D5B]">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="senha"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#87938F]"
                  >
                    Senha
                  </label>

                  <div className="relative">
                    <input
                      id="senha"
                      type={showPass ? "text" : "password"}
                      autoComplete="current-password"
                      {...register("senha")}
                      className="h-12 w-full rounded-2xl border border-[#243337] bg-[#102128] px-4 pr-12 text-base text-[#F0EADD] outline-none transition placeholder:text-[#5F6F70] focus:border-[#2F9285] focus:ring-2 focus:ring-[#2F9285]/20"
                      placeholder="Sua senha"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPass((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#87938F] transition-colors hover:text-[#B8C2BF]"
                      aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPass ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>

                  {errors.senha && (
                    <p className="mt-2 text-xs text-[#E35D5B]">
                      {errors.senha.message}
                    </p>
                  )}

                  <div className="mt-2 flex justify-end">
                    <Link
                      href="/esqueci-senha"
                      className="text-xs font-semibold text-[#2F9285] hover:text-[#3AA99A]"
                    >
                      Esqueceu a senha?
                    </Link>
                  </div>
                </div>

                {apiError && (
                  <p className="rounded-2xl border border-[#E35D5B]/30 bg-[#E35D5B]/10 p-3 text-sm text-[#E35D5B]">
                    {apiError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#2F9285] px-4 font-bold text-[#050B12] transition hover:bg-[#3AA99A] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </button>
              </form>
            )}

            {!mfaRequired && (
              <p className="mt-5 text-center text-sm text-[#87938F]">
                Não tem conta?{" "}
                <Link
                  href="/cadastro"
                  className="font-semibold text-[#2F9285] hover:text-[#3AA99A]"
                >
                  Criar conta grátis
                </Link>
              </p>
            )}

            <p className="mt-6 text-center text-xs text-[#5F6F70]">
              Ambiente seguro — seus dados ficam protegidos no SessãoInk.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
```

---

# Parte 2 — Recuperação de senha

## Criar páginas públicas

Criar:

```txt
frontend/src/app/(auth)/esqueci-senha/page.tsx
frontend/src/app/(auth)/resetar-senha/page.tsx
```

---

## Página “Esqueci a senha”

Criar:

`frontend/src/app/(auth)/esqueci-senha/page.tsx`

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Loader2, Mail } from "lucide-react";

import { api } from "@/lib/api/client";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCarregando(true);

    try {
      await api.post("/api/v1/auth/esqueci-senha", {
        email,
      });

      setEnviado(true);
    } catch {
      setEnviado(true);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <section className="flex min-h-app items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-[2rem] border border-[#243337] bg-[#0B171C] p-6 shadow-2xl shadow-black/30 sm:p-8">
        <Link
          href="/login"
          className="mb-6 inline-flex items-center gap-2 text-sm text-[#87938F] hover:text-[#F0EADD]"
        >
          <ArrowLeft size={16} />
          Voltar ao login
        </Link>

        <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-[#2F9285]/10 text-[#2F9285]">
          <Mail size={23} />
        </div>

        <h1 className="text-2xl font-bold text-[#F0EADD]">Recuperar senha</h1>
        <p className="mt-2 text-sm leading-6 text-[#87938F]">
          Informe seu e-mail. Se existir uma conta vinculada, enviaremos um link seguro para redefinir sua senha.
        </p>

        {enviado ? (
          <div className="mt-6 rounded-2xl border border-[#2F9285]/25 bg-[#2F9285]/10 p-4 text-sm leading-6 text-[#BFE8DF]">
            Pronto. Verifique sua caixa de entrada e siga as instruções para criar uma nova senha.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#87938F]"
              >
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#243337] bg-[#102128] px-4 text-base text-[#F0EADD] outline-none transition focus:border-[#2F9285] focus:ring-2 focus:ring-[#2F9285]/20"
                placeholder="voce@email.com"
              />
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#2F9285] px-4 font-bold text-[#050B12] transition hover:bg-[#3AA99A] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {carregando && <Loader2 size={18} className="animate-spin" />}
              Enviar link de recuperação
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
```

---

## Página “Resetar senha”

Criar:

`frontend/src/app/(auth)/resetar-senha/page.tsx`

```tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";

import { api } from "@/lib/api/client";

export default function ResetarSenhaPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro(null);

    if (!token) {
      setErro("Link inválido ou expirado.");
      return;
    }

    if (senha.length < 8) {
      setErro("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (senha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }

    setCarregando(true);

    try {
      await api.post("/api/v1/auth/resetar-senha", {
        token,
        senha_nova: senha,
      });

      setSucesso(true);
    } catch {
      setErro("Não foi possível redefinir a senha. Solicite um novo link.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <section className="flex min-h-app items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-[2rem] border border-[#243337] bg-[#0B171C] p-6 shadow-2xl shadow-black/30 sm:p-8">
        <Link
          href="/login"
          className="mb-6 inline-flex items-center gap-2 text-sm text-[#87938F] hover:text-[#F0EADD]"
        >
          <ArrowLeft size={16} />
          Voltar ao login
        </Link>

        {sucesso ? (
          <div>
            <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-[#2F9285]/10 text-[#2F9285]">
              <CheckCircle size={24} />
            </div>

            <h1 className="text-2xl font-bold text-[#F0EADD]">Senha alterada</h1>
            <p className="mt-2 text-sm leading-6 text-[#87938F]">
              Sua senha foi redefinida com sucesso. Entre novamente para acessar o painel.
            </p>

            <Link
              href="/login"
              className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-[#2F9285] px-4 font-bold text-[#050B12] transition hover:bg-[#3AA99A]"
            >
              Ir para login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-[#F0EADD]">Criar nova senha</h1>
            <p className="mt-2 text-sm leading-6 text-[#87938F]">
              Escolha uma senha segura para acessar sua conta.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="senha"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#87938F]"
                >
                  Nova senha
                </label>
                <input
                  id="senha"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-[#243337] bg-[#102128] px-4 text-base text-[#F0EADD] outline-none transition focus:border-[#2F9285] focus:ring-2 focus:ring-[#2F9285]/20"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmacao"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#87938F]"
                >
                  Confirmar senha
                </label>
                <input
                  id="confirmacao"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmacao}
                  onChange={(event) => setConfirmacao(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-[#243337] bg-[#102128] px-4 text-base text-[#F0EADD] outline-none transition focus:border-[#2F9285] focus:ring-2 focus:ring-[#2F9285]/20"
                />
              </div>

              {erro && (
                <p className="rounded-2xl border border-[#E35D5B]/30 bg-[#E35D5B]/10 p-3 text-sm text-[#E35D5B]">
                  {erro}
                </p>
              )}

              <button
                type="submit"
                disabled={carregando}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#2F9285] px-4 font-bold text-[#050B12] transition hover:bg-[#3AA99A] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {carregando && <Loader2 size={18} className="animate-spin" />}
                Salvar nova senha
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
```

---

# Parte 3 — Backend de recuperação de senha

## Atualizar schemas

Arquivo:

`backend/app/api/v1/auth/schemas.py`

Adicionar:

```py
class EsqueciSenhaRequest(BaseModel):
    email: EmailStr


class ResetarSenhaRequest(BaseModel):
    token: str = Field(min_length=20, max_length=300)
    senha_nova: str = Field(min_length=8, max_length=200)
```

---

## Atualizar Redis

Arquivo:

`backend/app/core/redis.py`

Adicionar ao final:

```py
# ---------------------------------------------------------------------------
# Recuperação de senha
# ---------------------------------------------------------------------------

RESET_SENHA_PREFIX = "reset_senha:"
RESET_SENHA_RATE_PREFIX = "reset_senha_rate:"
RESET_SENHA_TTL_SEGUNDOS = 30 * 60
RESET_SENHA_MAX_SOLICITACOES = 5


async def salvar_token_reset_senha(usuario_id: str) -> str:
    """Cria um token opaco de reset e salva somente o hash no Redis."""
    from app.core.security import hash_refresh_token

    token = secrets.token_urlsafe(32)

    async with get_redis() as r:
        await r.set(
            f"{RESET_SENHA_PREFIX}{hash_refresh_token(token)}",
            usuario_id,
            ex=RESET_SENHA_TTL_SEGUNDOS,
        )

    return token


async def obter_usuario_do_token_reset_senha(token: str) -> str | None:
    """Retorna o usuario_id do token de reset ou None."""
    from app.core.security import hash_refresh_token

    async with get_redis() as r:
        return await r.get(f"{RESET_SENHA_PREFIX}{hash_refresh_token(token)}")


async def revogar_token_reset_senha(token: str) -> None:
    """Consome o token de reset."""
    from app.core.security import hash_refresh_token

    async with get_redis() as r:
        await r.delete(f"{RESET_SENHA_PREFIX}{hash_refresh_token(token)}")


async def registrar_solicitacao_reset_senha(ip: str) -> int:
    """Conta solicitações de reset por IP."""
    async with get_redis() as r:
        chave = f"{RESET_SENHA_RATE_PREFIX}{ip}"
        total = await r.incr(chave)

        if total == 1:
            await r.expire(chave, RESET_SENHA_TTL_SEGUNDOS)

        return total


async def verificar_limite_reset_senha(ip: str) -> bool:
    """Retorna True quando o IP excedeu o limite."""
    async with get_redis() as r:
        val = await r.get(f"{RESET_SENHA_RATE_PREFIX}{ip}")
        return int(val) >= RESET_SENHA_MAX_SOLICITACOES if val else False
```

---

## Atualizar envio de e-mail

Arquivo:

`backend/app/core/email.py`

Adicionar:

```py
async def enviar_email_reset_senha(
    email_destino: str,
    nome: str,
    reset_url: str,
) -> bool:
    """Envia e-mail com link de redefinição de senha."""
    if not _resend_configurado():
        logger.info(
            "reset_senha_email_sem_resend",
            extra={"extra": {"email": email_destino, "reset_url": reset_url}},
        )
        return False

    html = f"""
    <div style="font-family:Arial,sans-serif;background:#050B12;color:#F0EADD;padding:32px">
      <div style="max-width:560px;margin:0 auto;background:#0B171C;border:1px solid #243337;border-radius:24px;padding:28px">
        <p style="color:#2F9285;font-weight:700;letter-spacing:.12em;text-transform:uppercase">SessãoInk</p>
        <h1 style="margin:0 0 12px;font-size:24px">Redefinição de senha</h1>
        <p style="color:#87938F;line-height:1.6">Olá {nome}, recebemos uma solicitação para redefinir sua senha.</p>
        <p style="color:#87938F;line-height:1.6">O link abaixo expira em 30 minutos.</p>
        <p style="margin:28px 0">
          <a href="{reset_url}" style="background:#2F9285;color:#050B12;padding:14px 18px;border-radius:14px;text-decoration:none;font-weight:700">
            Criar nova senha
          </a>
        </p>
        <p style="color:#87938F;font-size:13px;line-height:1.6">
          Se você não solicitou essa alteração, ignore este e-mail.
        </p>
      </div>
    </div>
    """

    try:
        await asyncio.to_thread(
            _enviar_sync,
            email_destino,
            "[SessãoInk] Redefinição de senha",
            html,
        )
        logger.info(f"Email de reset enviado para {email_destino}")
        return True
    except Exception as exc:
        logger.warning(f"Falha ao enviar email de reset: {exc}")
        return False
```

---

## Atualizar router de auth

Arquivo:

`backend/app/api/v1/auth/router.py`

Adicionar imports:

```py
from app.api.v1.auth.schemas import EsqueciSenhaRequest, ResetarSenhaRequest
from app.core.email import enviar_email_reset_senha
from app.core.redis import (
    obter_usuario_do_token_reset_senha,
    registrar_solicitacao_reset_senha,
    revogar_token_reset_senha,
    salvar_token_reset_senha,
    verificar_limite_reset_senha,
)
```

Adicionar endpoints:

```py
@router.post("/esqueci-senha", status_code=status.HTTP_202_ACCEPTED)
async def esqueci_senha(
    dados: EsqueciSenhaRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    ip = get_client_ip(request)

    if await verificar_limite_reset_senha(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas solicitações. Aguarde alguns minutos.",
        )

    await registrar_solicitacao_reset_senha(ip)

    email = dados.email.lower().strip()

    usuario = await session.scalar(
        select(Usuario).where(
            Usuario.email == email,
            Usuario.ativo,
        )
    )

    mensagem_generica = {
        "message": "Se o e-mail existir, enviaremos instruções de recuperação."
    }

    if not usuario:
        return mensagem_generica

    token = await salvar_token_reset_senha(str(usuario.id))
    reset_url = f"{settings.APP_URL}/resetar-senha?token={token}"

    await enviar_email_reset_senha(usuario.email, usuario.nome, reset_url)

    await log_event(
        session,
        acao="auth.password_reset.request",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="usuario",
        entidade_id=str(usuario.id),
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
        commit=True,
    )

    return mensagem_generica


@router.post("/resetar-senha", status_code=status.HTTP_204_NO_CONTENT)
async def resetar_senha(
    dados: ResetarSenhaRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    usuario_id_str = await obter_usuario_do_token_reset_senha(dados.token)

    if not usuario_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Link inválido ou expirado.",
        )

    try:
        usuario_id = uuid.UUID(usuario_id_str)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Link inválido ou expirado.",
        ) from exc

    usuario = await session.scalar(
        select(Usuario).where(
            Usuario.id == usuario_id,
            Usuario.ativo,
        )
    )

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Link inválido ou expirado.",
        )

    usuario.senha_hash = hash_senha(dados.senha_nova)

    await revogar_token_reset_senha(dados.token)
    await revogar_todas_sessoes_usuario(str(usuario.id))

    await log_event(
        session,
        acao="auth.password_reset.success",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="usuario",
        entidade_id=str(usuario.id),
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    await session.commit()
```

---

# Parte 4 — Endereço completo do estúdio

## Atualizar model

Arquivo:

`backend/app/models/usuario.py`

Na classe `Estudio`, adicionar:

```py
endereco_cep: Mapped[str | None] = mapped_column(String(12), nullable=True)
endereco_logradouro: Mapped[str | None] = mapped_column(String(180), nullable=True)
endereco_numero: Mapped[str | None] = mapped_column(String(30), nullable=True)
endereco_complemento: Mapped[str | None] = mapped_column(String(120), nullable=True)
endereco_bairro: Mapped[str | None] = mapped_column(String(120), nullable=True)
endereco_cidade: Mapped[str | None] = mapped_column(String(100), nullable=True)
endereco_uf: Mapped[str | None] = mapped_column(String(2), nullable=True)
endereco_pais: Mapped[str | None] = mapped_column(String(80), nullable=True, default="Brasil")
google_negocio_url: Mapped[str | None] = mapped_column(String(600), nullable=True)
latitude: Mapped[str | None] = mapped_column(String(40), nullable=True)
longitude: Mapped[str | None] = mapped_column(String(40), nullable=True)
```

Manter `cidade` e `uf` por compatibilidade.

---

## Criar migration Alembic

Criar:

`backend/migrations/versions/xxxx_add_endereco_estudio.py`

```py
"""add_endereco_estudio

Revision ID: xxxx_add_endereco_estudio
Revises: COLOCAR_REVISION_ANTERIOR
Create Date: 2026-06-03
"""

from alembic import op
import sqlalchemy as sa

revision = "xxxx_add_endereco_estudio"
down_revision = "COLOCAR_REVISION_ANTERIOR"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("estudios", sa.Column("endereco_cep", sa.String(length=12), nullable=True))
    op.add_column("estudios", sa.Column("endereco_logradouro", sa.String(length=180), nullable=True))
    op.add_column("estudios", sa.Column("endereco_numero", sa.String(length=30), nullable=True))
    op.add_column("estudios", sa.Column("endereco_complemento", sa.String(length=120), nullable=True))
    op.add_column("estudios", sa.Column("endereco_bairro", sa.String(length=120), nullable=True))
    op.add_column("estudios", sa.Column("endereco_cidade", sa.String(length=100), nullable=True))
    op.add_column("estudios", sa.Column("endereco_uf", sa.String(length=2), nullable=True))
    op.add_column("estudios", sa.Column("endereco_pais", sa.String(length=80), nullable=True))
    op.add_column("estudios", sa.Column("google_negocio_url", sa.String(length=600), nullable=True))
    op.add_column("estudios", sa.Column("latitude", sa.String(length=40), nullable=True))
    op.add_column("estudios", sa.Column("longitude", sa.String(length=40), nullable=True))


def downgrade() -> None:
    op.drop_column("estudios", "longitude")
    op.drop_column("estudios", "latitude")
    op.drop_column("estudios", "google_negocio_url")
    op.drop_column("estudios", "endereco_pais")
    op.drop_column("estudios", "endereco_uf")
    op.drop_column("estudios", "endereco_cidade")
    op.drop_column("estudios", "endereco_bairro")
    op.drop_column("estudios", "endereco_complemento")
    op.drop_column("estudios", "endereco_numero")
    op.drop_column("estudios", "endereco_logradouro")
    op.drop_column("estudios", "endereco_cep")
```

---

## Criar utilitário de endereço

Criar:

`backend/app/utils/endereco.py`

```py
from urllib.parse import quote_plus

from app.models.usuario import Estudio


def endereco_completo_estudio(estudio: Estudio) -> str | None:
    linha_1 = ", ".join(
        [
            parte
            for parte in [
                estudio.endereco_logradouro,
                estudio.endereco_numero,
            ]
            if parte
        ]
    )

    linha_2 = " - ".join(
        [
            parte
            for parte in [
                estudio.endereco_bairro,
                estudio.endereco_cidade or estudio.cidade,
                estudio.endereco_uf or estudio.uf,
                estudio.endereco_cep,
            ]
            if parte
        ]
    )

    endereco = " · ".join([parte for parte in [linha_1, linha_2] if parte])

    return endereco or None


def como_chegar_url_estudio(estudio: Estudio) -> str | None:
    if estudio.google_negocio_url:
        return estudio.google_negocio_url

    endereco = endereco_completo_estudio(estudio)

    if not endereco:
        return None

    return f"https://www.google.com/maps/search/?api=1&query={quote_plus(endereco)}"


def validar_google_url(url: str | None) -> str | None:
    if not url:
        return None

    permitido = (
        "https://www.google.com/maps",
        "https://google.com/maps",
        "https://maps.app.goo.gl",
        "https://g.page",
        "https://business.google.com",
    )

    if not url.startswith(permitido):
        raise ValueError("Informe um link válido do Google Maps ou Google Negócios.")

    return url
```

---

# Parte 5 — Atualizar APIs de estúdio

## Atualizar response do estúdio

No router/schema de estúdio, adicionar campos:

```py
endereco_cep: str | None = None
endereco_logradouro: str | None = None
endereco_numero: str | None = None
endereco_complemento: str | None = None
endereco_bairro: str | None = None
endereco_cidade: str | None = None
endereco_uf: str | None = None
endereco_pais: str | None = None
google_negocio_url: str | None = None
latitude: str | None = None
longitude: str | None = None
endereco_completo: str | None = None
como_chegar_url: str | None = None
```

Na montagem da response, usar:

```py
from app.utils.endereco import endereco_completo_estudio, como_chegar_url_estudio

endereco_completo=endereco_completo_estudio(estudio),
como_chegar_url=como_chegar_url_estudio(estudio),
```

---

## Atualizar request de edição do estúdio

Adicionar campos:

```py
endereco_cep: str | None = None
endereco_logradouro: str | None = None
endereco_numero: str | None = None
endereco_complemento: str | None = None
endereco_bairro: str | None = None
endereco_cidade: str | None = None
endereco_uf: str | None = None
endereco_pais: str | None = None
google_negocio_url: str | None = None
latitude: str | None = None
longitude: str | None = None
```

No endpoint de atualização:

```py
from app.utils.endereco import validar_google_url

campos = dados.model_dump(exclude_unset=True)

if "google_negocio_url" in campos:
    try:
        campos["google_negocio_url"] = validar_google_url(campos["google_negocio_url"])
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

if "endereco_uf" in campos and campos["endereco_uf"]:
    campos["endereco_uf"] = campos["endereco_uf"].upper()[:2]

if "uf" in campos and campos["uf"]:
    campos["uf"] = campos["uf"].upper()[:2]

for campo, valor in campos.items():
    setattr(estudio, campo, valor)
```

---

# Parte 6 — Portal público

## Atualizar response pública

Adicionar:

```py
endereco_completo: str | None = None
como_chegar_url: str | None = None
```

Na response pública:

```py
from app.utils.endereco import endereco_completo_estudio, como_chegar_url_estudio

endereco_completo=endereco_completo_estudio(estudio),
como_chegar_url=como_chegar_url_estudio(estudio),
```

---

## Atualizar frontend do portal público

Arquivo:

`frontend/src/app/[slug]/page.tsx`

Atualizar interface:

```ts
interface EstudioPublico {
  slug: string;
  nome: string;
  bio: string | null;
  cidade: string | null;
  uf: string | null;
  instagram: string | null;
  has_logo: boolean;
  has_foto: boolean;
  endereco_completo: string | null;
  como_chegar_url: string | null;
}
```

Substituir bloco de localização por:

```tsx
{(estudio.endereco_completo || estudio.cidade || estudio.uf) && (
  <div className="mt-4 flex flex-col items-center gap-3">
    <div className="flex max-w-xl items-center justify-center gap-2 text-center text-sm text-[#87938F]">
      <MapPin size={16} className="shrink-0 text-[#2F9285]" />
      <span>
        {estudio.endereco_completo ||
          [estudio.cidade, estudio.uf].filter(Boolean).join(" — ")}
      </span>
    </div>

    {estudio.como_chegar_url && (
      <a
        href={estudio.como_chegar_url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-11 items-center justify-center rounded-full border border-[#2F9285]/30 bg-[#2F9285]/10 px-5 text-sm font-bold text-[#2F9285] transition hover:bg-[#2F9285] hover:text-[#050B12]"
      >
        Como chegar
      </a>
    )}
  </div>
)}
```

---

# Parte 7 — Configurações do estúdio

Arquivo:

`frontend/src/app/(dashboard)/configuracoes/page.tsx`

Atualizar interface do estúdio:

```ts
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
```

Adicionar card de endereço na aba de perfil:

```tsx
<div className="rounded-[18px] border border-[#243337] bg-[#0B171C] p-4 sm:p-6">
  <h2 className="text-base font-semibold text-[#F0EADD]">
    Endereço do Estúdio
  </h2>

  <p className="mt-1 text-sm text-[#87938F]">
    Essas informações aparecem no portal público para o cliente saber como chegar.
  </p>

  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#87938F]">
        CEP
      </label>
      <input
        value={val("endereco_cep")}
        onChange={(event) => handleCampoEstudio("endereco_cep", event.target.value)}
        className="h-12 w-full rounded-xl border border-[#243337] bg-[#050B12] px-4 text-base text-[#F0EADD] outline-none focus:border-[#2F9285]"
        placeholder="00000-000"
      />
    </div>

    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#87938F]">
        Bairro
      </label>
      <input
        value={val("endereco_bairro")}
        onChange={(event) => handleCampoEstudio("endereco_bairro", event.target.value)}
        className="h-12 w-full rounded-xl border border-[#243337] bg-[#050B12] px-4 text-base text-[#F0EADD] outline-none focus:border-[#2F9285]"
        placeholder="Centro"
      />
    </div>

    <div className="sm:col-span-2">
      <label className="mb-1.5 block text-xs font-medium text-[#87938F]">
        Rua / Logradouro
      </label>
      <input
        value={val("endereco_logradouro")}
        onChange={(event) => handleCampoEstudio("endereco_logradouro", event.target.value)}
        className="h-12 w-full rounded-xl border border-[#243337] bg-[#050B12] px-4 text-base text-[#F0EADD] outline-none focus:border-[#2F9285]"
        placeholder="Rua Exemplo"
      />
    </div>

    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#87938F]">
        Número
      </label>
      <input
        value={val("endereco_numero")}
        onChange={(event) => handleCampoEstudio("endereco_numero", event.target.value)}
        className="h-12 w-full rounded-xl border border-[#243337] bg-[#050B12] px-4 text-base text-[#F0EADD] outline-none focus:border-[#2F9285]"
        placeholder="123"
      />
    </div>

    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#87938F]">
        Complemento
      </label>
      <input
        value={val("endereco_complemento")}
        onChange={(event) => handleCampoEstudio("endereco_complemento", event.target.value)}
        className="h-12 w-full rounded-xl border border-[#243337] bg-[#050B12] px-4 text-base text-[#F0EADD] outline-none focus:border-[#2F9285]"
        placeholder="Sala 2, fundos, etc."
      />
    </div>

    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#87938F]">
        Cidade
      </label>
      <input
        value={val("endereco_cidade")}
        onChange={(event) => handleCampoEstudio("endereco_cidade", event.target.value)}
        className="h-12 w-full rounded-xl border border-[#243337] bg-[#050B12] px-4 text-base text-[#F0EADD] outline-none focus:border-[#2F9285]"
        placeholder="São Paulo"
      />
    </div>

    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#87938F]">
        UF
      </label>
      <input
        value={val("endereco_uf")}
        onChange={(event) =>
          handleCampoEstudio("endereco_uf", event.target.value.toUpperCase().slice(0, 2))
        }
        maxLength={2}
        className="h-12 w-full rounded-xl border border-[#243337] bg-[#050B12] px-4 text-base uppercase text-[#F0EADD] outline-none focus:border-[#2F9285]"
        placeholder="SP"
      />
    </div>

    <div className="sm:col-span-2">
      <label className="mb-1.5 block text-xs font-medium text-[#87938F]">
        Link do Google Negócios / Google Maps
      </label>
      <input
        value={val("google_negocio_url")}
        onChange={(event) => handleCampoEstudio("google_negocio_url", event.target.value)}
        className="h-12 w-full rounded-xl border border-[#243337] bg-[#050B12] px-4 text-base text-[#F0EADD] outline-none focus:border-[#2F9285]"
        placeholder="https://maps.app.goo.gl/..."
      />
      <p className="mt-1.5 text-xs text-[#87938F]">
        Esse link será usado no botão “Como chegar” do portal público.
      </p>
    </div>
  </div>

  {estudio?.como_chegar_url && (
    <a
      href={estudio.como_chegar_url}
      target="_blank"
      rel="noreferrer"
      className="mt-4 inline-flex h-11 items-center justify-center rounded-xl border border-[#2F9285]/30 bg-[#2F9285]/10 px-4 text-sm font-semibold text-[#2F9285] hover:bg-[#2F9285] hover:text-[#050B12]"
    >
      Testar como chegar
    </a>
  )}
</div>
```

---

# Segurança obrigatória

## Animação

* Não pode rodar em loop permanente.
* Deve renderizar somente no primeiro acesso do dia.
* Deve respeitar `prefers-reduced-motion`.
* Deve poder ser testada em desenvolvimento com:

```txt
/login?previewAnimation=1
```

## Recuperação de senha

* Nunca informar se o e-mail existe.
* Token puro nunca deve ser salvo.
* Salvar apenas hash do token.
* TTL do token: 30 minutos.
* Revogar token após uso.
* Revogar sessões antigas após troca de senha.
* Aplicar rate limit por IP.
* Auditar solicitação e sucesso.

## Link Google

* Aceitar apenas links do Google Maps/Google Negócios.
* Não aceitar `javascript:`.
* Não aceitar domínio externo.
* Abrir em nova aba com `target="_blank"` e `rel="noreferrer"`.

---

# Checklist de aceite

## Login

* [ ] Tela de login desktop tem painel lateral.
* [ ] Tela de login mobile não quebra.
* [ ] Animação aparece no primeiro acesso do dia.
* [ ] Animação não aparece novamente no mesmo dia.
* [ ] Animação não roda em loop permanente.
* [ ] `prefers-reduced-motion` desativa a animação.
* [ ] `/login?previewAnimation=1` funciona em desenvolvimento.
* [ ] Login continua funcionando.
* [ ] MFA continua funcionando.
* [ ] Criar conta continua funcionando.
* [ ] Esqueci senha aparece abaixo do campo de senha.

## Recuperação de senha

* [ ] `/esqueci-senha` envia solicitação.
* [ ] `/resetar-senha?token=...` aceita token válido.
* [ ] Token inválido exibe erro.
* [ ] Token expirado exibe erro.
* [ ] Token é consumido após uso.
* [ ] Sessões antigas são revogadas.
* [ ] Rate limit funciona.
* [ ] Mensagem não revela se o e-mail existe.

## Endereço

* [ ] Admin salva endereço completo.
* [ ] Admin salva link Google.
* [ ] Link inválido é recusado.
* [ ] Portal público exibe endereço completo.
* [ ] Portal público exibe botão “Como chegar”.
* [ ] Sem link Google, backend gera URL por endereço.
* [ ] Sem endereço, portal continua funcionando.
* [ ] Mobile não tem overflow.

---

# Testes obrigatórios

## Backend

Executar:

```bash
cd backend
ruff check .
pyright
pytest -q
alembic upgrade head
```

Criar testes:

```txt
tests/integration/test_auth_password_reset.py
tests/integration/test_estudio_endereco.py
tests/integration/test_publico_endereco.py
```

## Frontend

Executar:

```bash
cd frontend
npm run typecheck
npm run build
npm run test
```

Testar manualmente:

```txt
/login
/login?previewAnimation=1
/esqueci-senha
/resetar-senha?token=fake
/configuracoes
/[slug]
```

---

# Ordem recomendada de produção

## Fase 1 — Backend endereço

1. Atualizar model `Estudio`.
2. Criar migration.
3. Criar utilitário `backend/app/utils/endereco.py`.
4. Atualizar response privada do estúdio.
5. Atualizar update do estúdio.
6. Atualizar portal público.
7. Criar testes.

## Fase 2 — Frontend endereço

1. Atualizar interfaces.
2. Adicionar card de endereço em configurações.
3. Atualizar portal público.
4. Testar mobile.

## Fase 3 — Backend recuperação de senha

1. Adicionar schemas.
2. Adicionar helpers Redis.
3. Adicionar envio de e-mail.
4. Adicionar endpoints.
5. Criar testes.

## Fase 4 — Frontend login

1. Criar `AuthMarketingPanel`.
2. Criar `TattooLoginIllustration`.
3. Criar `DailyTattooLoginAnimation`.
4. Adicionar CSS.
5. Atualizar layout de auth.
6. Substituir `login/page.tsx`.
7. Criar páginas de recuperação.
8. Testar MFA.

## Fase 5 — QA final

1. Testar em desktop.
2. Testar em mobile 360px, 390px, 414px e 430px.
3. Testar Android real.
4. Testar iPhone quando possível.
5. Validar Lighthouse básico.
6. Validar build de produção.
7. Validar fluxo completo:

   * cadastro
   * login
   * MFA
   * esqueci senha
   * reset de senha
   * configurações
   * portal público
   * botão “Como chegar”

---

# Observação final

A animação deve ser tratada como impacto visual de entrada, não como elemento permanente da interface.

O objetivo da tela de login é vender rapidamente a ideia do SessãoInk:

> O SessãoInk ajuda o tatuador a organizar agenda, clientes, atendimentos, financeiro, documentos e portfólio sem depender de planilhas, conversas perdidas no WhatsApp ou anotações soltas.

```

Esse arquivo único substitui os anteriores e já deixa a equipe alinhada para executar sem retrabalho.
::contentReference[oaicite:1]{index=1}
```

[1]: https://raw.githubusercontent.com/Vvs2705/SessaoInk/main/frontend/src/app/%28auth%29/login/page.tsx "raw.githubusercontent.com"
