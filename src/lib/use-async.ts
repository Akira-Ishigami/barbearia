"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  dados: T | undefined;
  carregando: boolean;
  erro: string | null;
  /** Refaz a consulta — use depois de gravar algo. */
  recarregar: () => void;
}

/**
 * Carrega dados assíncronos dentro de um client component.
 *
 * Existe porque as telas foram escritas lendo dados de forma síncrona (era
 * localStorage); com o banco de verdade a leitura virou assíncrona, e este
 * hook concentra o estado de carregando/erro num lugar só.
 *
 * O `carregando` só é ligado no callback de recarregar (nunca no corpo do
 * efeito), pra não cair no cascading render que o lint do React barra.
 */
export function useAsync<T>(
  consulta: () => Promise<T>,
  deps: unknown[],
  opcoes: { pular?: boolean } = {},
): AsyncState<T> {
  const pular = opcoes.pular ?? false;

  const [dados, setDados] = useState<T | undefined>(undefined);
  const [carregando, setCarregando] = useState(!pular);
  const [erro, setErro] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Guarda a consulta numa ref pra não reexecutar só porque a função foi
  // recriada no render — quem manda são as deps declaradas.
  const consultaRef = useRef(consulta);

  // Sem lista de dependências: sincroniza a cada render. Precisa vir antes do
  // efeito de busca, porque efeitos rodam na ordem em que são declarados.
  useEffect(() => {
    consultaRef.current = consulta;
  });

  useEffect(() => {
    if (pular) return;

    let cancelado = false;

    consultaRef
      .current()
      .then((resultado) => {
        if (cancelado) return;
        setDados(resultado);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (cancelado) return;
        setErro(e instanceof Error ? e.message : "Falha ao carregar.");
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, pular]);

  const recarregar = useCallback(() => {
    setCarregando(true);
    setTick((t) => t + 1);
  }, []);

  return { dados, carregando, erro, recarregar };
}
