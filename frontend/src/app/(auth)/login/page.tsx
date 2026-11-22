"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { LoginArt } from "@/components/auth/LoginArt";
import { BrandLogo } from "@/components/BrandLogo";
import { api, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

// Classes compartilhadas dos campos e botões (só tokens semânticos).
const labelCls = "mb-1.5 block text-sm font-medium text-foreground";
const inputCls =
  "h-12 w-full rounded-md border border-border bg-secondary px-4 text-base text-foreground outline-none transition placeholder:text-text-subtle focus:border-primary focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-destructive";
const primaryBtn =
  "flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60";
const linkCls = "font-medium text-primary underline-offset-4 hover:underline";

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

  // a11y/CRO: foco vai para o campo de código sempre que ele passa a ser
  // visível (entrada no passo MFA, troca de método ou e-mail recém-enviado),
  // poupando o usuário de buscar o input manualmente.
  const mfaCodigoInputRef = useRef<HTMLInputElement>(null);
  const mfaInputVisivel =
    selectedMetodo === "totp" || (selectedMetodo === "email" && emailEnviado);

  useEffect(() => {
    if (mfaRequired && mfaInputVisivel) {
      mfaCodigoInputRef.current?.focus();
    }
  }, [mfaRequired, mfaInputVisivel]);

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
      // Timeout de 20s: se a API demorar demais, o usuário recebe um erro
      // acionável em vez do botão preso em "Entrando…".
      const res = (await api.post(
        "/api/v1/auth/login",
        {
          email: data.email,
          senha: data.senha,
        },
        { signal: AbortSignal.timeout(20000) },
      )) as LoginApiResponse;

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
      } else if (
        error instanceof DOMException &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        setApiError(
          "O servidor demorou para responder. Verifique sua conexão e tente novamente.",
        );
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
      // Reenvio: o input já está visível, então o efeito de foco não re-dispara.
      // Movemos o foco manualmente para o usuário digitar o novo código de imediato.
      mfaCodigoInputRef.current?.focus();
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
    <div className="grid min-h-app bg-ink-night lg:grid-cols-[minmax(0,1.1fr)_minmax(26rem,0.9fr)]">
      <LoginArt variant="panel" />

      <section className="flex min-h-app flex-col justify-center px-5 py-8 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-sm space-y-6">
          <BrandLogo layout="wide" size="md" scaling={false} />

          <LoginArt variant="compact" />

          <header className="space-y-2">
            <h1 className="text-3xl leading-tight text-foreground">
              {mfaRequired ? "Confirme que é você" : "Entre no seu estúdio"}
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {mfaRequired
                ? "Escolha o método e informe o código de segurança."
                : "Veja a agenda de hoje e o que está esperando por você."}
            </p>
          </header>

          {mfaRequired ? (
            <form onSubmit={handleVerifyMfa} className="space-y-4">
              {mfaMetodos.includes("totp") && mfaMetodos.includes("email") && (
                <div
                  role="group"
                  aria-label="Método de verificação"
                  className="flex rounded-md border border-border bg-ink-bg p-1"
                >
                  <button
                    type="button"
                    aria-pressed={selectedMetodo === "totp"}
                    onClick={() => {
                      setSelectedMetodo("totp");
                      setMfaError(null);
                    }}
                    className={cn(
                      "min-h-10 flex-1 rounded-sm px-2 text-sm font-medium transition-colors",
                      selectedMetodo === "totp"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    App autenticador
                  </button>

                  <button
                    type="button"
                    aria-pressed={selectedMetodo === "email"}
                    onClick={() => {
                      setSelectedMetodo("email");
                      setMfaError(null);
                    }}
                    className={cn(
                      "min-h-10 flex-1 rounded-sm px-2 text-sm font-medium transition-colors",
                      selectedMetodo === "email"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Código por e-mail
                  </button>
                </div>
              )}

              {selectedMetodo === "totp" && (
                <div>
                  <label htmlFor="mfa-totp" className={labelCls}>
                    Código do app
                  </label>
                  <input
                    id="mfa-totp"
                    ref={mfaCodigoInputRef}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={mfaCodigo}
                    onChange={(event) =>
                      setMfaCodigo(event.target.value.replace(/\D/g, ""))
                    }
                    className={cn(inputCls, "text-center font-mono tracking-[0.5em]")}
                    required
                  />
                </div>
              )}

              {selectedMetodo === "email" && (
                <div className="space-y-4">
                  {!emailEnviado ? (
                    <div className="rounded-md border border-border bg-ink-bg p-4">
                      <p className="text-sm leading-6 text-muted-foreground">
                        Enviaremos um código de uso único para o e-mail
                        cadastrado.
                      </p>

                      <button
                        type="button"
                        onClick={handleSolicitarEmailOtp}
                        disabled={mfaSubmitting}
                        aria-busy={mfaSubmitting}
                        className={cn(primaryBtn, "mt-4 h-11")}
                      >
                        {mfaSubmitting && (
                          <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                        )}
                        Solicitar código
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="mfa-email" className={labelCls}>
                        Código recebido por e-mail
                      </label>
                      <input
                        id="mfa-email"
                        ref={mfaCodigoInputRef}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={mfaCodigo}
                        onChange={(event) =>
                          setMfaCodigo(event.target.value.replace(/\D/g, ""))
                        }
                        className={cn(
                          inputCls,
                          "text-center font-mono tracking-[0.5em]",
                        )}
                        required
                      />

                      <button
                        type="button"
                        onClick={handleSolicitarEmailOtp}
                        disabled={mfaSubmitting}
                        aria-busy={mfaSubmitting}
                        className={cn(linkCls, "mt-3 inline-block text-sm disabled:opacity-60")}
                      >
                        Reenviar código por e-mail
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div aria-live="assertive" role="status">
                {mfaError && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {mfaError}
                  </p>
                )}
              </div>

              {(selectedMetodo === "totp" || emailEnviado) && (
                <button
                  type="submit"
                  disabled={mfaSubmitting}
                  aria-busy={mfaSubmitting}
                  className={primaryBtn}
                >
                  {mfaSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
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
                className="h-11 w-full rounded-md border border-border text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Voltar para o login
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
             
            >
              <div>
                <label htmlFor="email" className={labelCls}>
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? "email-erro" : undefined}
                  {...register("email")}
                  className={inputCls}
                  placeholder="voce@email.com"
                />
                {errors.email && (
                  <p id="email-erro" className="mt-1.5 text-sm text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="senha" className={labelCls}>
                  Senha
                </label>

                <div className="relative">
                  <input
                    id="senha"
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    aria-invalid={errors.senha ? true : undefined}
                    aria-describedby={errors.senha ? "senha-erro" : undefined}
                    {...register("senha")}
                    className={cn(inputCls, "pr-12")}
                    placeholder="Sua senha"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPass((value) => !value)}
                    aria-pressed={showPass}
                    className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPass ? (
                      <EyeOff size={19} aria-hidden="true" />
                    ) : (
                      <Eye size={19} aria-hidden="true" />
                    )}
                  </button>
                </div>

                {errors.senha && (
                  <p id="senha-erro" className="mt-1.5 text-sm text-destructive">
                    {errors.senha.message}
                  </p>
                )}
              </div>

              <div aria-live="assertive" role="status">
                {apiError && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {apiError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className={primaryBtn}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </button>

              <p className="text-center text-sm">
                <Link href="/esqueci-senha" className={linkCls}>
                  Esqueci a senha
                </Link>
              </p>
            </form>
          )}

          {!mfaRequired && (
            <p className="border-t border-border pt-5 text-center text-sm text-muted-foreground">
              Ainda não tem conta?{" "}
              <Link href="/cadastro" className={linkCls}>
                Criar conta grátis
              </Link>
            </p>
          )}

          <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <Link href="/politica-de-privacidade" className="hover:text-foreground">
              Privacidade
            </Link>
            <Link href="/termos-de-uso" className="hover:text-foreground">
              Termos de uso
            </Link>
            {!mfaRequired && (
              <Link href="/precos" className="hover:text-foreground">
                Planos
              </Link>
            )}
          </footer>
        </div>
      </section>
    </div>
  );
}
