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
      <div className="w-full max-w-md rounded-[2rem] border border-mist-line bg-ink-bg p-6 shadow-popover sm:p-8">
        <Link
          href="/login"
          className="mb-6 inline-flex items-center gap-2 text-sm text-text-subtle hover:text-porcelain-ink"
        >
          <ArrowLeft size={16} />
          Voltar ao login
        </Link>

        <div className="mb-6 grid h-12 w-12 place-items-center rounded-lg bg-teal-ink/10 text-teal-ink">
          <Mail size={23} />
        </div>

        <h1 className="text-2xl font-bold text-porcelain-ink">Recuperar senha</h1>
        <p className="mt-2 text-sm leading-6 text-text-subtle">
          Informe seu e-mail. Se existir uma conta vinculada, enviaremos um link seguro para redefinir sua senha.
        </p>

        {enviado ? (
          <div className="mt-6 rounded-lg border border-teal-ink/25 bg-teal-ink/10 p-4 text-sm leading-6 text-smoke-text">
            Pronto. Verifique sua caixa de entrada e siga as instruções para criar uma nova senha.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-subtle"
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
                className="h-12 w-full rounded-lg border border-mist-line bg-surface-raised px-4 text-base text-porcelain-ink outline-none transition focus:border-teal-ink focus:ring-2 focus:ring-teal-ink/20"
                placeholder="voce@email.com"
              />
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-ink px-4 font-bold text-ink-night transition hover:bg-ink-gold disabled:cursor-not-allowed disabled:opacity-60"
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
