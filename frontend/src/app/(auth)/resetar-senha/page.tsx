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
