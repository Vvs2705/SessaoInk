"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";
import { BrandLogo } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  // Sanitizar: só aceitar paths de página, nunca /api/ ou caminhos externos
  const rawFrom = params.get("from") ?? "/";
  const from = rawFrom.startsWith("/") && !rawFrom.startsWith("/api/") ? rawFrom : "/";
  const [showPass, setShowPass] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Estados do MFA
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
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setApiError(null);
    try {
      const res = await api.post<any>("/api/v1/auth/login", { email: data.email, senha: data.senha });
      if (res?.mfa_required) {
        setMfaRequired(true);
        setMfaMetodos(res.metodos || []);
        setMfaDesafio(res.desafio || null);
        if (res.metodos?.includes("totp")) {
          setSelectedMetodo("totp");
        } else if (res.metodos?.includes("email")) {
          setSelectedMetodo("email");
        }
        return;
      }
      router.push(from);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        let msg = "Erro na requisição. Verifique os dados.";
        const detail = e.detail as any;
        if (typeof detail === "string") {
          msg = detail === "Email ou senha incorretos"
            ? "E-mail ou senha incorretos. Verifique e tente novamente."
            : detail;
        } else if (Array.isArray(detail)) {
          msg = detail.map((err: any) => err.msg || JSON.stringify(err)).join(", ");
        } else if (detail && typeof detail === "object") {
          msg = JSON.stringify(detail);
        }
        setApiError(msg);
      } else {
        setApiError("Erro de conexão. Verifique se o servidor está rodando.");
      }
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaDesafio || !mfaCodigo) return;
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
    } catch (e: any) {
      if (e instanceof ApiError) {
        if (e.status === 429) {
          setMfaError("Muitas tentativas. Por favor, aguarde alguns minutos.");
        } else if (e.status === 401) {
          setMfaError("Desafio de verificação expirado. Por favor, volte e faça login novamente.");
        } else {
          setMfaError(e.detail || "Código de verificação inválido.");
        }
      } else {
        setMfaError("Erro de conexão. Verifique se o servidor está rodando.");
      }
    } finally {
      setMfaSubmitting(false);
    }
  };

  const handleSolicitarEmailOtp = async () => {
    if (!mfaDesafio) return;
    setMfaError(null);
    setMfaSubmitting(true);
    try {
      await api.post("/api/v1/auth/mfa/email/solicitar", {
        desafio: mfaDesafio,
      });
      setEmailEnviado(true);
    } catch (e: any) {
      if (e instanceof ApiError) {
        if (e.status === 429) {
          setMfaError("Limite de envios excedido. Aguarde alguns minutos.");
        } else {
          setMfaError(e.detail || "Erro ao enviar código por e-mail.");
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
    <div className="min-h-screen bg-[#050B12] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8 flex flex-col items-center">
          <BrandLogo size="lg" className="mb-4" />
          <p className="text-sm text-[#87938F]">Acesse o painel do seu estúdio</p>
        </div>

        {/* Card */}
        <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
          {mfaRequired ? (
            <form onSubmit={handleVerifyMfa} className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-base font-semibold text-[#F0EADD]">
                  Autenticação de Dois Fatores
                </h3>
                <p className="text-xs text-[#87938F] mt-1">
                  Selecione o método e insira o código de segurança.
                </p>
              </div>

              {mfaMetodos.includes("totp") && mfaMetodos.includes("email") && (
                <div className="flex gap-2 p-1 bg-[#102128] border border-[#243337] rounded-[10px] mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMetodo("totp");
                      setMfaError(null);
                    }}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-semibold rounded-[8px] transition-all",
                      selectedMetodo === "totp"
                        ? "bg-[#2F9285] text-[#050B12]"
                        : "text-[#87938F] hover:text-[#F0EADD]"
                    )}
                  >
                    App Autenticador
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMetodo("email");
                      setMfaError(null);
                    }}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-semibold rounded-[8px] transition-all",
                      selectedMetodo === "email"
                        ? "bg-[#2F9285] text-[#050B12]"
                        : "text-[#87938F] hover:text-[#F0EADD]"
                    )}
                  >
                    Código por E-mail
                  </button>
                </div>
              )}

              {selectedMetodo === "totp" && (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="totp-code" className="block text-xs font-medium text-[#B8C2BF] mb-1.5">
                      Código do App (6 dígitos)
                    </label>
                    <input
                      id="totp-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="000000"
                      value={mfaCodigo}
                      onChange={(e) => setMfaCodigo(e.target.value.replace(/\D/g, ""))}
                      className="w-full h-11 px-3.5 rounded-[14px] bg-[#102128] border border-[#243337] text-[#F0EADD] placeholder-[#87938F] text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-[#2F9285]/40 focus:border-[#2F9285] transition-all"
                      required
                    />
                  </div>
                </div>
              )}

              {selectedMetodo === "email" && (
                <div className="space-y-3">
                  {!emailEnviado ? (
                    <div className="text-center py-2">
                      <p className="text-xs text-[#87938F] mb-3">
                        Enviaremos um código de verificação de uso único para o seu e-mail cadastrado.
                      </p>
                      <button
                        type="button"
                        onClick={handleSolicitarEmailOtp}
                        disabled={mfaSubmitting}
                        className="w-full h-10 rounded-[12px] bg-[#2F9285]/10 border border-[#2F9285]/30 hover:bg-[#2F9285] hover:text-[#050B12] text-[#2F9285] text-xs font-semibold transition-all flex items-center justify-center gap-2"
                      >
                        {mfaSubmitting && <Loader2 size={14} className="animate-spin" />}
                        Solicitar Código por E-mail
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="email-code" className="block text-xs font-medium text-[#B8C2BF] mb-1.5">
                          Código recebido por E-mail
                        </label>
                        <input
                          id="email-code"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          placeholder="000000"
                          value={mfaCodigo}
                          onChange={(e) => setMfaCodigo(e.target.value.replace(/\D/g, ""))}
                          className="w-full h-11 px-3.5 rounded-[14px] bg-[#102128] border border-[#243337] text-[#F0EADD] placeholder-[#87938F] text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-[#2F9285]/40 focus:border-[#2F9285] transition-all"
                          required
                        />
                      </div>
                      <div className="text-center">
                        <button
                          type="button"
                          onClick={handleSolicitarEmailOtp}
                          disabled={mfaSubmitting}
                          className="text-[11px] text-[#2F9285] hover:underline"
                        >
                          Reenviar código por e-mail
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {mfaError && (
                <div role="alert" className="p-3 rounded-[10px] bg-[#E35D5B]/10 border border-[#E35D5B]/30 text-xs text-[#E35D5B]">
                  {mfaError}
                </div>
              )}

              <div className="space-y-2 pt-2">
                {(selectedMetodo === "totp" || emailEnviado) && (
                  <button
                    type="submit"
                    disabled={mfaSubmitting || mfaCodigo.length < 6}
                    className="w-full h-11 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] disabled:opacity-60 disabled:cursor-not-allowed
                      text-[#050B12] font-semibold text-sm transition-all flex items-center justify-center gap-2
                      focus:outline-none focus:ring-2 focus:ring-[#2F9285]/50 focus:ring-offset-2 focus:ring-offset-[#0B171C]"
                  >
                    {mfaSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Verificando...
                      </>
                    ) : "Confirmar e Entrar"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleBackToCredentials}
                  className="w-full h-10 rounded-[12px] border border-[#243337] hover:bg-[#102128] text-[#87938F] hover:text-[#F0EADD] text-xs font-semibold transition-all"
                >
                  Voltar para o login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              {/* E-mail */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[#B8C2BF] mb-1.5">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  {...register("email")}
                  className={`w-full h-11 px-3.5 rounded-[14px] bg-[#102128] border text-[#F0EADD] placeholder-[#87938F] text-sm
                    focus:outline-none focus:ring-2 focus:ring-[#2F9285]/40 focus:border-[#2F9285] transition-all
                    ${errors.email ? "border-[#E35D5B]" : "border-[#243337]"}`}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                {errors.email && (
                  <p id="email-error" className="mt-1 text-xs text-[#E35D5B]">{errors.email.message}</p>
                )}
              </div>

              {/* Senha */}
              <div>
                <label htmlFor="senha" className="block text-sm font-medium text-[#B8C2BF] mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="senha"
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...register("senha")}
                    className={`w-full h-11 px-3.5 pr-11 rounded-[14px] bg-[#102128] border text-[#F0EADD] placeholder-[#87938F] text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#2F9285]/40 focus:border-[#2F9285] transition-all
                      ${errors.senha ? "border-[#E35D5B]" : "border-[#243337]"}`}
                    aria-invalid={!!errors.senha}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#87938F] hover:text-[#B8C2BF] transition-colors"
                    aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.senha && (
                  <p className="mt-1 text-xs text-[#E35D5B]">{errors.senha.message}</p>
                )}
              </div>

              {/* Erro da API */}
              {apiError && (
                <div role="alert" className="p-3 rounded-[10px] bg-[#E35D5B]/10 border border-[#E35D5B]/30 text-sm text-[#E35D5B]">
                  {apiError}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] disabled:opacity-60 disabled:cursor-not-allowed
                  text-[#050B12] font-semibold text-sm transition-all flex items-center justify-center gap-2
                  focus:outline-none focus:ring-2 focus:ring-[#2F9285]/50 focus:ring-offset-2 focus:ring-offset-[#0B171C]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Entrando...
                  </>
                ) : "Entrar"}
              </button>
            </form>
          )}

          {!mfaRequired && (
            <p className="mt-4 text-center text-xs text-[#87938F]">
              Não tem conta?{" "}
              <Link href="/cadastro" className="text-[#2F9285] font-semibold hover:underline">
                Criar conta grátis
              </Link>
            </p>
          )}
        </div>

        <p className="text-center text-xs text-[#87938F] mt-6">
          Ambiente local seguro — nenhum dado sai deste computador
        </p>
      </div>
    </div>
  );
}
