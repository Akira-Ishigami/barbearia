"use client";

import { useState } from "react";
import { CATEGORIA_OUTROS } from "@/lib/types";

export function CategoriaField({
  presets,
  value,
  onChange,
}: {
  presets: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  // Tracked separately from `value` so picking "Outros" doesn't snap back to
  // the first preset the moment the custom text field is still empty.
  const [customMode, setCustomMode] = useState(
    () => value !== "" && !presets.includes(value),
  );

  function handleSelect(v: string) {
    if (v === CATEGORIA_OUTROS) {
      setCustomMode(true);
      onChange("");
    } else {
      setCustomMode(false);
      onChange(v);
    }
  }

  const selectValue = customMode ? CATEGORIA_OUTROS : value || presets[0];

  return (
    <label className="block">
      <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
        Categoria
      </span>
      <select
        value={selectValue}
        onChange={(e) => handleSelect(e.target.value)}
        className="w-full rounded-xl border border-line-strong bg-white/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
      >
        {presets.map((p) => (
          <option key={p} value={p} className="bg-ink-elev">
            {p}
          </option>
        ))}
        <option value={CATEGORIA_OUTROS} className="bg-ink-elev">
          {CATEGORIA_OUTROS}
        </option>
      </select>
      {customMode && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nome da categoria"
          autoFocus
          className="mt-2 w-full rounded-xl border border-line-strong bg-white/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
        />
      )}
    </label>
  );
}
