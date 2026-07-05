"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

const PAPEL_LABEL: Record<string, string> = {
  ARTISTA: "Artista",
  RECEPCIONISTA: "Recepção",
};

interface ConviteInfo {
  email: string;
  role: string;
  nome_estudio: string;
  expira_em: string;
}

export default function AceitarConvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = Array.isArray(params.token) ? params.token[0] : params.token ?? "";

  const [info, setInfo] = useState<ConviteInfo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroInfo, setErroInfo] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/v1/convites/info/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body?.detail ?? "Convite inválido, expirado ou já utilizado.",
          );
        }
        return res.json();
      })
      .then((data: ConviteInfo) => setInfo(data))
      .catch((e) => setErroInfo(e instanceof Error ? e.message : "Convite inválido."))
      .finally(() => setCarregando(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (nome.trim().length < 2) {
      setErro("Informe seu nome completo.");
      return;
    }
    if (senha.length < 8) {
      setErro("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/convites/aceitar/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nome: nome.trim(), senha }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Erro ${res.status}`);
      }
      setSucesso(true);
      // Conta criada; manda para o login para a primeira entrada.
      setTimeout(() => router.push("/login"), 2200);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível aceitar o convite.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-app flex items-center justify-center bg-ink-night px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(47,146,133,0.14),transparent_42%)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-7 flex justify-center">
          <BrandLogo layout="wide" size="lg" scaling={false} />
        </div>

        <div className="rounded-[2rem] border border-mist-line bg-ink-bg/90 p-6 shadow-popover backdrop-blur-xl sm:p-8">
          {carregando ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Loader2 size={26} className="animate-spin text-teal-ink" />
              <p className="text-sm text-text-subtle">Validando seu convite…</p>
            </div>
          ) : erroInfo ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-lg border border-mist-line bg-ink-night">
                <AlertCircle size={26} className="text-error-red" />
              </div>
              <h1 className="text-xl font-black text-porcelain-ink">Convite indisponível</h1>
              <p className="text-sm leading-relaxed text-text-subtle">{erroInfo}</p>
              <a
                href="/login"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-ink hover:text-ink-gold"
              >
                Ir para o login <ArrowRight size={14} />
              </a>
            </div>
          ) : sucesso ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-teal-ink/15 shadow-[0_0_30px_rgba(47,146,133,0.25)]">
                <CheckCircle size={30} className="text-teal-ink" />
              </div>
              <h1 className="text-2xl font-black text-porcelain-ink">Conta criada!</h1>
              <p className="text-sm leading-relaxed text-text-subtle">
                Você agora faz parte de{" "}
                <strong className="text-porcelain-ink">{info?.nome_estudio}</strong>.
                Redirecionando para o login…
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-black tracking-tight text-porcelain-ink">
                  Entrar no estúdio
                </h1>
                <p className="mt-2 text-sm leading-6 text-text-subtle">
                  Você foi convidado(a) para{" "}
                  <strong className="text-porcelain-ink">{info?.nome_estudio}</strong> como{" "}
                  <strong className="text-teal-ink">
                    {PAPEL_LABEL[info?.role ?? ""] ?? info?.role}
                  </strong>
                  . Crie sua senha para acessar.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-subtle">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={info?.email ?? ""}
                    disabled
                    className="h-12 w-full cursor-not-allowed rounded-lg border border-mist-line bg-ink-night px-4 text-base text-text-subtle"
                  />
                </div>

                <div>
                  <label
                    htmlFor="nome"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-subtle"
                  >
                    Seu nome
                  </label>
                  <input
                    id="nome"
                    type="text"
                    autoComplete="name"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome completo"
                    className="h-12 w-full rounded-lg border border-mist-line bg-surface-raised px-4 text-base text-porcelain-ink outline-none transition placeholder:text-text-subtle focus:border-teal-ink focus:ring-2 focus:ring-teal-ink/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="senha"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-subtle"
                  >
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      id="senha"
                      type={showSenha ? "text" : "password"}
                      autoComplete="new-password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="h-12 w-full rounded-lg border border-mist-line bg-surface-raised px-4 pr-12 text-base text-porcelain-ink outline-none transition placeholder:text-text-subtle focus:border-teal-ink focus:ring-2 focus:ring-teal-ink/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle transition-colors hover:text-smoke-text"
                      aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showSenha ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>
                </div>

                {erro && (
                  <p className="rounded-lg border border-error-red/30 bg-error-red/10 p-3 text-sm text-error-red">
                    {erro}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={enviando}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-ink px-4 font-bold text-ink-night transition hover:bg-ink-gold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {enviando ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Criando conta…
                    </>
                  ) : (
                    "Aceitar e criar conta"
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-xs text-text-subtle">
                Ambiente seguro — seus dados ficam protegidos no SessãoInk.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
