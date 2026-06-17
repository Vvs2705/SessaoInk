"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Check, X as XIcon } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";
import { BrandLogo } from "@/components/BrandLogo";

// Regras de senha — espelham exatamente o backend (app/core/password_policy.py).
const REGRAS_SENHA = [
  { id: "len", label: "8+ caracteres", test: (s: string) => s.length >= 8 },
  { id: "lower", label: "letra minúscula", test: (s: string) => /[a-z]/.test(s) },
  { id: "upper", label: "letra maiúscula", test: (s: string) => /[A-Z]/.test(s) },
  { id: "num", label: "número", test: (s: string) => /\d/.test(s) },
  {
    id: "special",
    label: "caractere especial",
    test: (s: string) => /[!@#$%^&*()\-_=+[\]{};:,.<>?/|\\"'`~]/.test(s),
  },
];

const senhaForte = (s: string) => REGRAS_SENHA.every((r) => r.test(s));

const cadastroSchema = z.object({
  nome_estudio: z.string().min(2, "Informe o nome do estúdio").max(200),
  nome: z.string().min(2, "Informe seu nome").max(200),
  email: z.string().email("E-mail inválido"),
  senha: z
    .string()
    .max(200)
    .refine(senhaForte, {
      message:
        "A senha precisa de 8+ caracteres com maiúscula, minúscula, número e caractere especial.",
    }),
  // Honeypot anti-bot: deve permanecer vazio
  website: z.string().optional(),
});

type CadastroForm = z.infer<typeof cadastroSchema>;

const inputCls =
  "w-full h-11 px-3.5 rounded-[14px] bg-[#102128] border border-[#243337] text-[#F0EADD] placeholder-[#87938F] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F9285]/40 focus:border-[#2F9285] transition-all";

export default function CadastroPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CadastroForm>({ resolver: zodResolver(cadastroSchema), mode: "onChange" });

  const senhaAtual = watch("senha") ?? "";

  const onSubmit = async (data: CadastroForm) => {
    setApiError(null);
    try {
      await api.post("/api/v1/auth/registrar", {
        nome_estudio: data.nome_estudio,
        nome: data.nome,
        email: data.email,
        senha: data.senha,
        website: data.website ?? "",
      });
      router.push("/");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        const detail = e.detail as unknown;
        let msg = "Não foi possível criar a conta. Tente novamente.";
        if (typeof detail === "string") msg = detail;
        else if (Array.isArray(detail))
          msg = detail.map((x: { msg?: string }) => x.msg || "").join(", ");
        setApiError(msg);
      } else {
        setApiError("Erro de conexão. Tente novamente em instantes.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#050B12] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <BrandLogo size="lg" className="mb-4" />
          <h1 className="text-lg font-bold text-[#F0EADD]">Crie a conta do seu estúdio</h1>
          <p className="text-sm text-[#87938F] mt-1">
            14 dias grátis no plano Profissional — sem cartão.
          </p>
        </div>

        <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <label htmlFor="nome_estudio" className="block text-xs font-semibold text-[#87938F] mb-1.5">
                Nome do estúdio
              </label>
              <input id="nome_estudio" type="text" autoComplete="organization"
                placeholder="Ex.: Estúdio do João" className={inputCls} {...register("nome_estudio")} />
              {errors.nome_estudio && (
                <p className="mt-1 text-xs text-[#E35D5B]">{errors.nome_estudio.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="nome" className="block text-xs font-semibold text-[#87938F] mb-1.5">
                Seu nome
              </label>
              <input id="nome" type="text" autoComplete="name"
                placeholder="Como devemos te chamar" className={inputCls} {...register("nome")} />
              {errors.nome && <p className="mt-1 text-xs text-[#E35D5B]">{errors.nome.message}</p>}
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-[#87938F] mb-1.5">
                E-mail
              </label>
              <input id="email" type="email" autoComplete="email"
                placeholder="voce@email.com" className={inputCls} {...register("email")} />
              {errors.email && <p className="mt-1 text-xs text-[#E35D5B]">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="senha" className="block text-xs font-semibold text-[#87938F] mb-1.5">
                Senha
              </label>
              <div className="relative">
                <input id="senha" type={showPass ? "text" : "password"} autoComplete="new-password"
                  placeholder="Crie uma senha forte" className={`${inputCls} pr-11`} {...register("senha")} />
                <button type="button" onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#87938F] hover:text-[#F0EADD]">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {/* Checklist ao vivo dos requisitos (some quando todos cumpridos) */}
              {senhaAtual.length > 0 && !senhaForte(senhaAtual) && (
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {REGRAS_SENHA.map((r) => {
                    const ok = r.test(senhaAtual);
                    return (
                      <li
                        key={r.id}
                        className={`flex items-center gap-1 text-[11px] ${ok ? "text-[#2F9285]" : "text-[#87938F]"}`}
                      >
                        {ok ? <Check size={12} /> : <XIcon size={12} />}
                        {r.label}
                      </li>
                    );
                  })}
                </ul>
              )}
              {errors.senha && senhaAtual.length === 0 && (
                <p className="mt-1 text-xs text-[#E35D5B]">{errors.senha.message}</p>
              )}
            </div>

            {/* Honeypot: oculto para humanos, preenchido só por bots */}
            <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
              className="hidden" {...register("website")} />

            {apiError && (
              <div role="alert" className="p-3 rounded-[10px] bg-[#E35D5B]/10 border border-[#E35D5B]/30 text-sm text-[#E35D5B]">
                {apiError}
              </div>
            )}

            <button type="submit" disabled={isSubmitting}
              className="w-full h-11 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] disabled:opacity-60 disabled:cursor-not-allowed text-[#050B12] font-semibold text-sm transition-all flex items-center justify-center gap-2">
              {isSubmitting ? (<><Loader2 size={16} className="animate-spin" /> Criando...</>) : "Criar conta grátis"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-[#87938F]">
            Já tem conta?{" "}
            <Link href="/login" className="text-[#2F9285] font-semibold hover:underline">
              Entrar
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] text-[#87938F] leading-relaxed">
          Ao criar a conta você concorda com os Termos de Uso e a Política de Privacidade.
        </p>
      </div>
    </div>
  );
}
