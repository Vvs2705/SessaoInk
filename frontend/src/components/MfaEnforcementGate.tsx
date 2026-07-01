"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api/client";
import type { Usuario } from "@/lib/auth/types";

/** Dias de carência para o ADMIN ativar o 2º fator antes do bloqueio total. */
const CARENCIA_DIAS = 15;

/**
 * MFA obrigatório para ADMIN, com carência de {@link CARENCIA_DIAS} dias.
 *
 * O dono do estúdio (ADMIN) é o alvo mais valioso para takeover de conta, então
 * exigimos que ele configure a verificação em duas etapas. O ADMIN não é o
 * adversário — a aplicação correta é *forçar a configuração*: uma vez ativa, o
 * login passa a exigir o 2º fator (já implementado no fluxo de login).
 *
 * - Nos primeiros {@link CARENCIA_DIAS} dias após o cadastro: aviso NÃO
 *   bloqueante e dispensável (não atrapalha o onboarding).
 * - Depois da carência: overlay bloqueia o uso do app até o 2º fator ser ativado.
 *
 * A rota `/configuracoes` é isenta — é onde ele ativa o MFA. Ambos somem sozinhos
 * quando o setup invalida a query `["usuario"]`. Se `criado_em` for desconhecido,
 * tratamos como dentro da carência (nunca travar por falta de dado).
 */
export function MfaEnforcementGate() {
  const pathname = usePathname();
  const [avisoDispensado, setAvisoDispensado] = useState(false);
  const { data: usuario, isLoading } = useQuery<Usuario>({
    queryKey: ["usuario"],
    queryFn: () => api.get<Usuario>("/api/v1/auth/me"),
  });

  // Evita flash durante o carregamento e não bloqueia a própria tela de setup.
  if (isLoading || !usuario) return null;
  if (pathname?.startsWith("/configuracoes")) return null;

  const isAdmin = usuario.tipo === "ADMIN";
  const temMfa = Boolean(usuario.mfa_totp_ativo || usuario.mfa_email_ativo);
  if (!isAdmin || temMfa) return null;

  const diasDesdeCadastro = usuario.criado_em
    ? Math.floor(
        (Date.now() - new Date(usuario.criado_em).getTime()) / 86_400_000
      )
    : null;
  // criado_em ausente ⇒ dentro da carência (não travar por falta de dado).
  const dentroCarencia =
    diasDesdeCadastro === null || diasDesdeCadastro < CARENCIA_DIAS;

  // Dentro da carência: aviso não-bloqueante e dispensável.
  if (dentroCarencia) {
    if (avisoDispensado) return null;
    const diasRestantes =
      diasDesdeCadastro === null
        ? CARENCIA_DIAS
        : Math.max(1, CARENCIA_DIAS - diasDesdeCadastro);
    return (
      <div
        role="status"
        className="fixed bottom-20 left-4 right-4 z-50 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm"
      >
        <div className="flex items-start gap-3 rounded-[14px] border border-warning/30 bg-ink-bg p-4 shadow-2xl">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-porcelain-ink">
              Ative a verificação em duas etapas
            </p>
            <p className="mt-0.5 text-xs text-text-subtle leading-relaxed">
              Obrigatória para administradores em{" "}
              <strong className="text-porcelain-ink">
                {diasRestantes} dia{diasRestantes > 1 ? "s" : ""}
              </strong>
              . Proteja o acesso aos dados dos seus clientes.
            </p>
            <Link
              href="/configuracoes"
              className="mt-2 inline-flex min-h-[36px] items-center rounded-[10px] bg-teal-ink px-3 py-1.5 text-xs font-semibold text-ink-night transition-all hover:bg-teal-ink/90"
            >
              Configurar agora
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setAvisoDispensado(true)}
            aria-label="Dispensar aviso"
            className="shrink-0 text-text-subtle transition-colors hover:text-porcelain-ink"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Após a carência: bloqueio total.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mfa-gate-titulo"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink-night/90 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-[18px] border border-mist-line bg-ink-bg shadow-2xl overflow-hidden">
        <div className="flex flex-col items-center gap-3 px-6 pt-7 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/15 text-warning">
            <ShieldAlert size={26} aria-hidden="true" />
          </div>
          <h2 id="mfa-gate-titulo" className="text-porcelain-ink font-bold text-base">
            Ative a verificação em duas etapas
          </h2>
          <p className="text-sm text-text-subtle leading-relaxed">
            Sua conta é de <strong className="text-porcelain-ink">administrador</strong> do
            estúdio. Por segurança, a verificação em duas etapas é obrigatória
            antes de continuar — ela protege o acesso aos dados dos seus clientes.
          </p>
        </div>
        <div className="p-6">
          <Link
            href="/configuracoes"
            className="flex min-h-[44px] w-full items-center justify-center rounded-[12px] bg-teal-ink px-4 py-2.5 text-sm font-semibold text-ink-night transition-all hover:bg-teal-ink/90"
          >
            Configurar agora
          </Link>
          <p className="mt-3 text-center text-xs text-text-subtle">
            Leva menos de um minuto com o app autenticador ou por e-mail.
          </p>
        </div>
      </div>
    </div>
  );
}
