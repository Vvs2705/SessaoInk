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
            <BrandLogo layout="wide" size="lg" scaling={false} />
            <p className="mt-4 text-sm leading-6 text-[#87938F]">
              Gestão para tatuadores organizarem agenda, clientes, financeiro,
              portfólio e atendimentos em um só lugar.
            </p>
          </div>

          <div className="relative">
            <DailyTattooLoginAnimation />

            <div className="relative overflow-hidden rounded-[2rem] border border-[#243337] bg-[#0B171C]/90 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
            <div className="mb-7 hidden justify-center lg:flex">
              <BrandLogo layout="wide" size="lg" scaling={false} />
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
        </div>
      </section>
    </div>
  );
}
