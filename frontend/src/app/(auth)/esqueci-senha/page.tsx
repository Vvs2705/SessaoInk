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
