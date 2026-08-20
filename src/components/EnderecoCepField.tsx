"use client";

import { useState } from "react";
import { buscarCep, formatCep, isValidCep, montarEndereco } from "@/lib/cep";

const INPUT =
  "w-full rounded-xl border border-line-strong bg-bone/[0.03] px-4 py-3 font-body text-sm text-bone outline-none transition-colors placeholder:text-muted focus:border-gold-bright";
const LABEL =
  "mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted";

/**
 * Endereço preenchido pelo CEP.
 *
 * Digite o CEP e rua/bairro/cidade vêm sozinhos; só o número fica com a
 * pessoa. Tudo continua editável na mão, porque CEP de rua nova às vezes
 * não está na base — e endereço errado é agendamento perdido.
 */
export function EnderecoCepField({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (endereco: string) => void;
}) {
  const [cep, setCep] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [achado, setAchado] = useState<{
    logradouro: string;
    bairro: string;
    cidade: string;
    uf: string;
  } | null>(null);

  async function handleCep(v: string) {
    const formatado = formatCep(v);
    setCep(formatado);
    setAviso(null);

    if (!isValidCep(formatado)) return;

    setBuscando(true);
    const encontrado = await buscarCep(formatado);
    setBuscando(false);

    if (!encontrado) {
      setAviso("CEP não encontrado. Você pode escrever o endereço na mão.");
      return;
    }

    setAchado(encontrado);
    onChange(montarEndereco(encontrado, numero, complemento));
  }

  function atualizarNumero(v: string) {
    setNumero(v);
    if (achado) onChange(montarEndereco(achado, v, complemento));
  }

  function atualizarComplemento(v: string) {
    setComplemento(v);
    if (achado) onChange(montarEndereco(achado, numero, v));
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[9rem_1fr_1fr]">
        <label className="block">
          <span className={LABEL}>CEP</span>
          <input
            value={cep}
            onChange={(e) => handleCep(e.target.value)}
            inputMode="numeric"
            maxLength={9}
            placeholder="00000-000"
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Número</span>
          <input
            value={numero}
            onChange={(e) => atualizarNumero(e.target.value)}
            placeholder="120"
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Complemento</span>
          <input
            value={complemento}
            onChange={(e) => atualizarComplemento(e.target.value)}
            placeholder="Sala 2 (opcional)"
            className={INPUT}
          />
        </label>
      </div>

      {buscando && (
        <p className="font-body text-xs text-muted">Buscando endereço…</p>
      )}
      {aviso && <p className="font-body text-xs text-warn">{aviso}</p>}

      <label className="block">
        <span className={LABEL}>Endereço completo</span>
        <input
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          required
          placeholder="Rua, número, bairro, cidade"
          className={INPUT}
        />
        <span className="mt-1.5 block font-body text-[11px] text-muted">
          É assim que aparece pro cliente na sua página. Dá pra ajustar.
        </span>
      </label>
    </div>
  );
}
