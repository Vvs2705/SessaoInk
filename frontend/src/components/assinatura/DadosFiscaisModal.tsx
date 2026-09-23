"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Loader2, X } from "lucide-react";

import { api, ApiError } from "@/lib/api/client";
import { isDocumentoValido, maskDocumento, unmaskDocumento } from "@/lib/documento";

/** Só o que o modal lê/escreve — o shape completo do estúdio mora na página. */
export interface DadosFiscais {
  documento: string | null;
  razao_social: string | null;
  endereco_cep: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
}

const INPUT_CLASS =
  "w-full bg-ink-night border border-mist-line rounded-[10px] px-3 py-2.5 text-sm text-porcelain-ink focus:outline-none focus:border-teal-ink/50 transition-colors";

const VAZIO: DadosFiscais = {
  documento: null,
  razao_social: null,
  endereco_cep: null,
  endereco_logradouro: null,
  endereco_numero: null,
  endereco_complemento: null,
  endereco_bairro: null,
  endereco_cidade: null,
  endereco_uf: null,
};

// Complemento é o único opcional — os demais são exigidos pela NFS-e.
const OBRIGATORIOS = [
  "endereco_cep",
  "endereco_logradouro",
  "endereco_numero",
  "endereco_bairro",
  "endereco_cidade",
  "endereco_uf",
  "razao_social",
] as const;

export default function DadosFiscaisModal({
  aberto,
  onFechar,
  estudio,
  onSalvo,
}: {
  aberto: boolean;
  onFechar: () => void;
  estudio?: Partial<DadosFiscais> | null;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState<DadosFiscais>(VAZIO);
  const [erro, setErro] = useState<string | null>(null);

  // Repopula a cada abertura para não exibir rascunho de uma tentativa anterior.
  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    setForm({ ...VAZIO, ...(estudio ?? {}) });
    // Só na abertura: um refetch do estúdio não deve apagar o que o usuário digitou.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const salvar = useMutation({
    mutationFn: () =>
      api.patch<unknown>("/api/v1/estudio/", {
        ...form,
        documento: unmaskDocumento(form.documento ?? ""),
      }),
    onSuccess: () => onSalvo(),
    onError: (e: unknown) =>
      setErro(e instanceof ApiError ? e.detail : "Não foi possível salvar os dados fiscais."),
  });

  if (!aberto) return null;

  const set = (campo: keyof DadosFiscais, valor: string) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  const documento = form.documento ?? "";
  const documentoInvalido = documento.length > 0 && !isDocumentoValido(documento);
  const faltaCampo = OBRIGATORIOS.some((c) => !(form[c] ?? "").trim());
  const podeSalvar = !documentoInvalido && documento.length > 0 && !faltaCampo;

  const campo = (
    label: string,
    nome: keyof DadosFiscais,
    placeholder: string,
    extra?: { maxLength?: number; uppercase?: boolean }
  ) => (
    <div>
      <label className="text-xs font-medium text-text-subtle mb-1.5 block">{label}</label>
      <input
        value={form[nome] ?? ""}
        onChange={(e) =>
          set(nome, extra?.uppercase ? e.target.value.toUpperCase() : e.target.value)
        }
        maxLength={extra?.maxLength}
        className={INPUT_CLASS}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-ink-bg border border-mist-line w-full max-w-md rounded-[18px] shadow-popover overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-mist-line">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-copper-needle" />
            <h2 className="text-porcelain-ink font-bold text-sm">Dados para a nota fiscal</h2>
          </div>
          <button onClick={onFechar} className="text-text-subtle hover:text-porcelain-ink">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-text-subtle leading-relaxed">
            Precisamos do seu CPF/CNPJ e endereço para emitir a NFS-e da assinatura. É
            rápido e só pedimos uma vez.
          </p>

          <div>
            <label className="text-xs font-medium text-text-subtle mb-1.5 block">
              CPF ou CNPJ
            </label>
            <input
              value={maskDocumento(documento)}
              onChange={(e) => set("documento", maskDocumento(e.target.value))}
              className={INPUT_CLASS}
              placeholder="000.000.000-00"
              inputMode="text"
            />
            {documentoInvalido && (
              <p className="text-[10px] text-error-red mt-1">CPF/CNPJ inválido.</p>
            )}
          </div>

          {campo("Razão social / Nome completo", "razao_social", "Estúdio Exemplo LTDA")}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {campo("CEP", "endereco_cep", "00000-000")}
            {campo("Bairro", "endereco_bairro", "Centro")}
          </div>

          {campo("Rua / Logradouro", "endereco_logradouro", "Rua Exemplo")}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {campo("Número", "endereco_numero", "123")}
            {campo("Complemento", "endereco_complemento", "Sala 2 (opcional)")}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {campo("Cidade", "endereco_cidade", "São Paulo")}
            {campo("UF", "endereco_uf", "SP", { maxLength: 2, uppercase: true })}
          </div>

          {erro && (
            <div className="p-3 bg-error-red/10 border border-error-red/25 text-error-red text-xs rounded-[10px]">
              {erro}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onFechar}
              className="flex-1 h-10 rounded-[12px] border border-mist-line hover:bg-surface-raised text-porcelain-ink font-semibold text-sm transition-all"
            >
              Agora não
            </button>
            <button
              type="button"
              disabled={!podeSalvar || salvar.isPending}
              onClick={() => salvar.mutate()}
              className="flex-1 h-10 rounded-[12px] bg-teal-ink hover:bg-teal-ink/90 disabled:opacity-60 disabled:cursor-not-allowed text-ink-night font-semibold text-sm transition-all flex items-center justify-center gap-2"
            >
              {salvar.isPending && <Loader2 size={14} className="animate-spin" />}
              Salvar e continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
