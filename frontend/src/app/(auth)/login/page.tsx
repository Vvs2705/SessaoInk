"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") ?? "/";
  const [showPass, setShowPass] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setApiError(null);
    try {
      await api.post("/api/v1/auth/login", { email: data.email, senha: data.senha });
      router.push(from);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        setApiError(e.detail === "Email ou senha incorretos"
          ? "E-mail ou senha incorretos. Verifique e tente novamente."
          : e.detail);
      } else {
        setApiError("Erro de conexão. Verifique se o servidor está rodando.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#050B12] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8 flex flex-col items-center">
          <img
            src="/logo-wide.png"
            alt="SessãoInk"
            className="h-16 w-auto object-contain mb-4"
          />
          <p className="text-sm text-[#87938F]">Acesse o painel do seu estúdio</p>
        </div>

        {/* Card */}
        <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
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
        </div>

        <p className="text-center text-xs text-[#87938F] mt-6">
          Ambiente local seguro — nenhum dado sai deste computador
        </p>
      </div>
    </div>
  );
}
