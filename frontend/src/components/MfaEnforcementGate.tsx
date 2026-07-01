"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { api } from "@/lib/api/client";
import type { Usuario } from "@/lib/auth/types";

/**
 * MFA obrigatório para ADMIN.
 *
 * O dono do estúdio (ADMIN) é o alvo mais valioso para takeover de conta, então
 * exigimos que ele configure a verificação em duas etapas. O ADMIN não é o
 * adversário — a aplicação correta é *forçar a configuração*: uma vez ativa, o
 * login passa a exigir o 2º fator (já implementado no fluxo de login).
 *
 * Enquanto não houver TOTP nem OTP por e-mail ativos, um overlay bloqueia o uso
 * do app. A rota `/configuracoes` é isenta — é exatamente onde ele ativa o MFA.
 * O overlay some sozinho quando o setup invalida a query `["usuario"]`.
 */
export function MfaEnforcementGate() {
  const pathname = usePathname();
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
