"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Copy, Download, GripVertical, LogOut, Plus, RefreshCcw, Settings, Upload, X } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  COLORS,
  FinanceData,
  FinanceItem,
  Preferences,
  SECTION_META,
  SectionKey,
  defaultData,
  detectLocale,
  formatInputValue,
  formatMoney,
  moveItem,
  normalizeFinanceData,
  parseMoneyInput,
  sumCents,
  uid,
} from "@/lib/finance";

type DragState = { type: "section"; id: SectionKey } | { type: "item"; section: SectionKey; id: string } | null;

type ItemPreview = { section: SectionKey; items: FinanceItem[] } | null;

function useFlipLayout(containerRef: React.RefObject<HTMLElement | null>, selector: string) {
  const previousPositions = useRef(new Map<string, { left: number; top: number }>());
  const runningAnimations = useRef(new Map<string, Animation>());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const elements = Array.from(container.querySelectorAll<HTMLElement>(selector));
    const currentPositions = new Map<string, { left: number; top: number }>();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    elements.forEach((element) => {
      const id = element.dataset.flipId;
      if (!id) return;

      const current = { left: element.offsetLeft, top: element.offsetTop };
      const previous = previousPositions.current.get(id);
      currentPositions.set(id, current);

      const deltaX = previous ? previous.left - current.left : 0;
      const deltaY = previous ? previous.top - current.top : 0;
      if (reduceMotion || (!deltaX && !deltaY)) return;

      runningAnimations.current.get(id)?.cancel();
      const animation = element.animate(
        [{ transform: `translate(${deltaX}px, ${deltaY}px)` }, { transform: "translate(0, 0)" }],
        { duration: 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
      runningAnimations.current.set(id, animation);
      const removeFinishedAnimation = () => {
        if (runningAnimations.current.get(id) === animation) runningAnimations.current.delete(id);
      };
      animation.onfinish = removeFinishedAnimation;
      animation.oncancel = removeFinishedAnimation;
    });

    previousPositions.current = currentPositions;
  });

  useEffect(
    () => () => {
      runningAnimations.current.forEach((animation) => animation.cancel());
      runningAnimations.current.clear();
    },
    [],
  );
}

function MasonryItem({ flipId, children }: { flipId: string; children: React.ReactNode }) {
  const itemRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const item = itemRef.current;
    const content = contentRef.current;
    if (!item || !content) return;

    const measure = () => {
      item.style.gridRowEnd = `span ${Math.max(1, Math.ceil(content.getBoundingClientRect().height))}`;
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={itemRef} className="masonry-item" data-flip-id={flipId}>
      <div ref={contentRef} className="masonry-content">
        {children}
      </div>
    </div>
  );
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <main className="page-shell">
        <div className="app-card loading-card">Carregando...</div>
      </main>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="page-shell">
        <section className="auth-card">
          <h1>Meu raio-x financeiro</h1>
          <p>Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em `.env.local` para habilitar login e banco de dados.</p>
        </section>
      </main>
    );
  }

  return <main className="page-shell">{session ? <FinanceApp session={session} /> : <AuthPanel />}</main>;
}

function AuthPanel() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "signup") setMessage("Conta criada. Confirme o e-mail se o Supabase solicitar.");
  }

  return (
    <section className="auth-card">
      <div>
        <h1>Meu raio-x financeiro</h1>
        <p>Entre para salvar seus cenários, preferências e a ordem dos cards no Supabase.</p>
      </div>
      <div className="mode-tabs" role="tablist" aria-label="Autenticação">
        <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">
          Entrar
        </button>
        <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")} type="button">
          Criar conta
        </button>
      </div>
      <form onSubmit={submit} className="auth-form">
        <label>
          E-mail
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>
        {message && <p className="auth-message">{message}</p>}
        <button className="primary-btn" type="submit" disabled={busy}>
          {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
        </button>
      </form>
    </section>
  );
}

function FinanceApp({ session }: { session: Session }) {
  const userId = session.user.id;
  const [data, setData] = useState<FinanceData>(() => defaultData(detectLocale()));
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [exportText, setExportText] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sectionPreview, setSectionPreview] = useState<SectionKey[] | null>(null);
  const [itemPreview, setItemPreview] = useState<ItemPreview>(null);
  const dragState = useRef<DragState>(null);
  const sectionPreviewRef = useRef<SectionKey[] | null>(null);
  const itemPreviewRef = useRef<ItemPreview>(null);
  const hoverTargetRef = useRef<string | null>(null);
  const sectionGridRef = useRef<HTMLElement>(null);

  useFlipLayout(sectionGridRef, ".masonry-item[data-flip-id]");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: row, error } = await supabase.from("finance_states").select("data").eq("user_id", userId).maybeSingle();
      if (!active) return;
      if (error) setStatusMsg(error.message);
      setData(normalizeFinanceData(row?.data, detectLocale()));
      setLoaded(true);
    }
    load();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!loaded) return;
    setSaving(true);
    const timer = window.setTimeout(async () => {
      const { error } = await supabase
        .from("finance_states")
        .upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      setSaving(false);
      if (error) {
        setStatusMsg(error.message);
        return;
      }
      setSavedAt(Date.now());
    }, 600);
    return () => window.clearTimeout(timer);
  }, [data, loaded, userId]);

  const preferences = data.preferences;
  const totals = useMemo(() => {
    const entradas = sumCents(data.entradas);
    const cartoes = sumCents(data.cartoes);
    const contas = sumCents(data.contas);
    const diaADia = sumCents(data.diaADia);
    const saida = cartoes + contas + diaADia;
    const sobra = entradas - saida;
    const dividas = sumCents(data.dividas);
    return { entradas, cartoes, contas, diaADia, saida, sobra, dividas };
  }, [data]);

  const updateData = useCallback((recipe: (current: FinanceData) => FinanceData) => {
    setData((current) => normalizeFinanceData(recipe(current), current.preferences.locale));
  }, []);

  function updateItem(section: SectionKey, id: string, patch: Partial<FinanceItem>) {
    updateData((current) => ({
      ...current,
      [section]: current[section].map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  function addItem(section: SectionKey) {
    updateData((current) => ({
      ...current,
      [section]: [...current[section], { id: uid(section), label: "", cents: 0 }],
    }));
  }

  function removeItem(section: SectionKey, id: string) {
    updateData((current) => ({ ...current, [section]: current[section].filter((item) => item.id !== id) }));
  }

  function clearDragPreview() {
    dragState.current = null;
    sectionPreviewRef.current = null;
    itemPreviewRef.current = null;
    hoverTargetRef.current = null;
    setSectionPreview(null);
    setItemPreview(null);
  }

  function beginSectionDrag(event: React.DragEvent<HTMLElement>, section: SectionKey) {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", section);
    const preview = [...data.sectionOrder];
    dragState.current = { type: "section", id: section };
    hoverTargetRef.current = null;
    sectionPreviewRef.current = preview;
    setSectionPreview(preview);
  }

  function previewSection(target: SectionKey) {
    const currentDrag = dragState.current;
    if (!currentDrag || currentDrag.type !== "section") return;
    const hoverTarget = `section:${target}`;
    if (hoverTargetRef.current === hoverTarget) return;
    hoverTargetRef.current = hoverTarget;
    if (currentDrag.id === target) return;
    const order = sectionPreviewRef.current ?? data.sectionOrder;
    const next = moveItem(order, order.indexOf(currentDrag.id), order.indexOf(target));
    sectionPreviewRef.current = next;
    setSectionPreview(next);
  }

  function commitSectionDrag() {
    const currentDrag = dragState.current;
    const next = sectionPreviewRef.current;
    if (currentDrag?.type === "section" && next) {
      updateData((current) => ({ ...current, sectionOrder: next }));
    }
    clearDragPreview();
  }

  function beginItemDrag(event: React.DragEvent<HTMLDivElement>, section: SectionKey, id: string) {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    const preview = { section, items: [...data[section]] };
    dragState.current = { type: "item", section, id };
    hoverTargetRef.current = null;
    itemPreviewRef.current = preview;
    setItemPreview(preview);
  }

  function previewItem(section: SectionKey, targetId: string) {
    const currentDrag = dragState.current;
    if (!currentDrag || currentDrag.type !== "item" || currentDrag.section !== section) return;
    const hoverTarget = `item:${section}:${targetId}`;
    if (hoverTargetRef.current === hoverTarget) return;
    hoverTargetRef.current = hoverTarget;
    if (currentDrag.id === targetId) return;
    const current = itemPreviewRef.current;
    const items = current?.section === section ? current.items : data[section];
    const next = {
      section,
      items: moveItem(
        items,
        items.findIndex((item) => item.id === currentDrag.id),
        items.findIndex((item) => item.id === targetId),
      ),
    };
    itemPreviewRef.current = next;
    setItemPreview(next);
  }

  function commitItemDrag(section: SectionKey) {
    const currentDrag = dragState.current;
    const next = itemPreviewRef.current;
    if (currentDrag?.type === "item" && next?.section === section) {
      updateData((current) => ({ ...current, [section]: next.items }));
    }
    clearDragPreview();
  }

  function exportJSON() {
    const json = JSON.stringify(data, null, 2);
    setExportText(json);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `raio-x-financeiro-${data.month.trim().replace(/\s+/g, "-").toLowerCase() || "cenario"}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    setStatusMsg("Cenário exportado. O JSON também está disponível abaixo para copiar.");
  }

  async function copyExport() {
    if (!exportText) return;
    await navigator.clipboard.writeText(exportText);
    setStatusMsg("JSON copiado.");
  }

  function importJSON(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        setData(normalizeFinanceData(JSON.parse(String(loadEvent.target?.result || "{}")), preferences.locale));
        setExportText(null);
        setStatusMsg("Cenário importado com sucesso.");
      } catch {
        setStatusMsg("Não consegui ler esse arquivo. Confira se é um JSON exportado por este app.");
      }
    };
    reader.readAsText(file);
  }

  const positivo = totals.sobra > 0;
  const meses = positivo && totals.dividas > 0 ? Math.ceil(totals.dividas / totals.sobra) : null;
  const target = useMemo(() => {
    if (!meses) return null;
    const dt = new Date();
    dt.setMonth(dt.getMonth() + meses);
    return dt.toLocaleDateString(preferences.locale, { month: "long", year: "numeric" });
  }, [meses, preferences.locale]);
  const base = positivo ? totals.entradas : totals.saida;
  const segs = [
    { label: "Cartões", val: totals.cartoes, color: COLORS.periw },
    { label: "Contas", val: totals.contas, color: COLORS.teal },
    { label: "Dia a dia", val: totals.diaADia, color: COLORS.amber },
    ...(positivo ? [{ label: "Sobra", val: totals.sobra, color: COLORS.mint }] : []),
  ];
  const dividasMap = data.dividas
    .map((item) => ({ label: item.label, val: item.cents }))
    .filter((item) => item.val > 0)
    .sort((a, b) => b.val - a.val);
  const maxDiv = dividasMap[0]?.val || 0;

  if (!loaded) {
    return <div className="app-card loading-card">Carregando seu raio-x...</div>;
  }

  return (
    <div className="app-card">
      <header className="header">
        <div>
          <h1>Meu raio-x financeiro</h1>
          <p>Preencha os valores e o resumo se atualiza sozinho. Tudo fica salvo no Supabase.</p>
        </div>
        <div className="header-actions">
          <input
            value={data.month}
            onChange={(event) => updateData((current) => ({ ...current, month: event.target.value }))}
            className="month-input"
            aria-label="Mês de referência"
          />
          <button className="topbtn" onClick={() => document.getElementById("rxf-import")?.click()} title="Subir um JSON salvo">
            <Upload size={14} /> Importar
          </button>
          <button className="topbtn" onClick={exportJSON} title="Baixar o cenário atual em JSON">
            <Download size={14} /> Exportar
          </button>
          <button className="topbtn" onClick={() => setData(defaultData(preferences.locale))} title="Voltar ao exemplo de Junho">
            <RefreshCcw size={14} /> Reiniciar
          </button>
          <button className="topbtn" onClick={() => setSettingsOpen((open) => !open)} title="Preferências">
            <Settings size={14} /> Ajustes
          </button>
          <button className="iconbtn" onClick={() => supabase.auth.signOut()} aria-label="Sair">
            <LogOut size={14} />
          </button>
          <input type="file" id="rxf-import" accept="application/json,.json" hidden onChange={importJSON} />
        </div>
      </header>

      {settingsOpen && (
        <SettingsPanel
          preferences={preferences}
          onChange={(next) => updateData((current) => ({ ...current, preferences: next }))}
        />
      )}

      {statusMsg && (
        <Notice onClose={() => setStatusMsg(null)}>
          <span>{statusMsg}</span>
        </Notice>
      )}

      {exportText && (
        <section className="export-box">
          <div className="export-head">
            <strong>JSON do seu cenário</strong>
            <div className="cluster">
              <button className="topbtn" onClick={copyExport}>
                <Copy size={14} /> Copiar
              </button>
              <button className="iconbtn" onClick={() => setExportText(null)} aria-label="Fechar">
                <X size={14} />
              </button>
            </div>
          </div>
          <textarea readOnly value={exportText} onFocus={(event) => event.target.select()} />
        </section>
      )}

      {totals.diaADia === 0 && (
        <Notice tone="warning">
          <span className="hint-icon">!</span>
          <span>
            Você ainda não preencheu os <strong>gastos do dia a dia</strong>. Sua sobra real provavelmente é menor do que aparece aqui.
          </span>
        </Notice>
      )}

      <section className="summaryGrid">
        <Stat
          big
          label="Sobra real do mês"
          value={formatMoney(totals.sobra, preferences)}
          color={positivo ? COLORS.mint : COLORS.coral}
          sub={positivo ? "O que sobra depois de tudo que sai. É isso que pode atacar as dívidas." : "Está saindo mais do que entra. Primeiro passo é fechar essa conta."}
        />
        <Stat
          label="Dívida total"
          value={formatMoney(totals.dividas, preferences)}
          color={COLORS.coral}
          sub={`Caixa hoje: ${formatMoney(data.caixaCents, preferences)} · Reserva desejada: ${formatMoney(data.reservaCents, preferences)}`}
        />
      </section>
      <section className="miniGrid">
        <Stat label="Entra no mês" value={formatMoney(totals.entradas, preferences)} color={COLORS.mint} />
        <Stat
          label="Sai no mês"
          value={formatMoney(totals.saida, preferences)}
          color={COLORS.amber}
          sub={`Cartões ${formatMoney(totals.cartoes, preferences)} · Contas ${formatMoney(totals.contas, preferences)} · Dia a dia ${formatMoney(totals.diaADia, preferences)}`}
        />
      </section>

      <section className="panel">
        <h3>Para onde vai o que entra</h3>
        {base > 0 ? (
          <>
            <div className="allocation-bar">
              {segs.map((seg) =>
                seg.val > 0 ? <div key={seg.label} title={`${seg.label}: ${formatMoney(seg.val, preferences)}`} style={{ width: `${(seg.val / base) * 100}%`, background: seg.color }} /> : null,
              )}
            </div>
            <div className="legend">
              {segs.map((seg) =>
                seg.val > 0 ? (
                  <span key={seg.label}>
                    <i style={{ background: seg.color }} />
                    {seg.label} <strong>{Math.round((seg.val / base) * 100)}%</strong>
                  </span>
                ) : null,
              )}
            </div>
            {!positivo && <p className="danger-text">Suas saídas estão acima do que entra. Déficit de {formatMoney(Math.abs(totals.sobra), preferences)}.</p>}
          </>
        ) : (
          <p className="muted-text">Comece preenchendo suas entradas e saídas abaixo.</p>
        )}
      </section>

      <section className={positivo ? "panel plan positive" : "panel plan"}>
        <h3>Seu plano para zerar as dívidas</h3>
        {positivo && totals.dividas > 0 ? (
          <p>
            Mantendo essa sobra de <strong>{formatMoney(totals.sobra, preferences)}/mês</strong>, você zera <strong>{formatMoney(totals.dividas, preferences)}</strong> em cerca de{" "}
            <strong>
              {meses} {meses === 1 ? "mês" : "meses"}
            </strong>
            {target ? `, por volta de ${target}.` : "."}
            <span>Conta otimista: assume que toda a sobra vai para as dívidas.</span>
          </p>
        ) : totals.dividas === 0 ? (
          <p className="muted-text">Sem dívidas cadastradas. Adicione na seção de dívidas, se houver.</p>
        ) : (
          <p>Com a conta no vermelho, atacar as dívidas vem depois. O foco agora é reduzir gastos ou aumentar entradas até sobrar algo todo mês.</p>
        )}
      </section>

      <section ref={sectionGridRef} className="section-grid">
        {(sectionPreview ?? data.sectionOrder).map((section) => {
          const visibleItems = itemPreview?.section === section ? itemPreview.items : data[section];
          return (
          <MasonryItem key={section} flipId={`section-${section}`}>
          <SectionCard
            section={section}
            items={visibleItems}
            preferences={preferences}
            total={sumCents(data[section])}
            isDragging={dragState.current?.type === "section" && dragState.current.id === section}
            draggedItemId={dragState.current?.type === "item" && dragState.current.section === section ? dragState.current.id : null}
            onAdd={() => addItem(section)}
            onUpdate={(id, patch) => updateItem(section, id, patch)}
            onRemove={(id) => removeItem(section, id)}
            onDragStart={(event) => beginSectionDrag(event, section)}
            onDragEnterSection={() => previewSection(section)}
            onDropSection={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (dragState.current?.type === "item") {
                commitItemDrag(section);
              } else {
                previewSection(section);
                commitSectionDrag();
              }
            }}
            onDragEnd={clearDragPreview}
            onItemDragStart={(event, id) => beginItemDrag(event, section, id)}
            onItemDragEnter={(id) => previewItem(section, id)}
            onDropItem={(event, id) => {
              event.preventDefault();
              event.stopPropagation();
              if (dragState.current?.type === "section") {
                previewSection(section);
                commitSectionDrag();
              } else {
                previewItem(section, id);
                commitItemDrag(section);
              }
            }}
            onItemDragEnd={clearDragPreview}
          >
            {section === "dividas" && (
              <>
                {dividasMap.length > 0 && (
                  <div className="debt-map">
                    <span>Mapa das dívidas (da maior para a menor)</span>
                    {dividasMap.map((debt) => (
                      <div className="debt-row" key={`${debt.label}-${debt.val}`}>
                        <small>{debt.label}</small>
                        <div>
                          <i style={{ width: `${maxDiv ? (debt.val / maxDiv) * 100 : 0}%` }} />
                        </div>
                        <strong>{formatMoney(debt.val, preferences)}</strong>
                      </div>
                    ))}
                  </div>
                )}
                <p className="debt-warning">
                  Atenção: se uma fatura também estiver cadastrada como dívida, deixe em um lugar só para não contar duas vezes.
                </p>
              </>
            )}
          </SectionCard>
          </MasonryItem>
          );
        })}

        <MasonryItem flipId="section-cash">
        <section className="panel cash-panel">
          <h3>
            <i style={{ background: COLORS.sky }} /> Caixa e reserva
          </h3>
          <MoneyField
            label="Quanto você tem hoje (caixa)"
            cents={data.caixaCents}
            preferences={preferences}
            onChange={(cents) => updateData((current) => ({ ...current, caixaCents: cents }))}
          />
          <MoneyField
            label="Reserva que você quer ter"
            cents={data.reservaCents}
            preferences={preferences}
            onChange={(cents) => updateData((current) => ({ ...current, reservaCents: cents }))}
          />
          <p>
            {data.caixaCents >= data.reservaCents && data.reservaCents > 0
              ? "Sua reserva já está coberta. Daqui pra frente, a sobra pode ir inteira para as dívidas."
              : `Faltam ${formatMoney(Math.max(data.reservaCents - data.caixaCents, 0), preferences)} para completar sua reserva.`}
          </p>
        </section>
        </MasonryItem>
      </section>

      <footer>
        <span>{saving ? "Salvando..." : savedAt ? "Salvo automaticamente no Supabase." : "As alterações são salvas sozinhas."}</span>
        <span>Referência: {data.month}</span>
      </footer>
    </div>
  );
}

function SettingsPanel({ preferences, onChange }: { preferences: Preferences; onChange: (preferences: Preferences) => void }) {
  return (
    <section className="settings-panel">
      <label>
        Idioma/localidade
        <select value={preferences.locale} onChange={(event) => onChange({ ...preferences, locale: event.target.value })}>
          <option value="pt-BR">Português (Brasil)</option>
          <option value="en-US">English (United States)</option>
          <option value="es-ES">Español (España)</option>
          <option value="de-DE">Deutsch (Deutschland)</option>
        </select>
      </label>
      <label>
        Moeda
        <select value={preferences.currency} onChange={(event) => onChange({ ...preferences, currency: event.target.value })}>
          <option value="BRL">BRL</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </label>
    </section>
  );
}

function Notice({ children, onClose, tone }: { children: React.ReactNode; onClose?: () => void; tone?: "warning" }) {
  return (
    <div className={tone === "warning" ? "notice warning" : "notice"}>
      <div>{children}</div>
      {onClose && (
        <button className="iconbtn" onClick={onClose} aria-label="Fechar aviso">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function Stat({ label, value, color, sub, big }: { label: string; value: string; color: string; sub?: string; big?: boolean }) {
  return (
    <div className={big ? "stat big" : "stat"}>
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function SectionCard({
  section,
  items,
  preferences,
  total,
  isDragging,
  draggedItemId,
  onAdd,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnterSection,
  onDropSection,
  onDragEnd,
  onItemDragStart,
  onItemDragEnter,
  onDropItem,
  onItemDragEnd,
  children,
}: {
  section: SectionKey;
  items: FinanceItem[];
  preferences: Preferences;
  total: number;
  isDragging: boolean;
  draggedItemId: string | null;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<FinanceItem>) => void;
  onRemove: (id: string) => void;
  onDragStart: (event: React.DragEvent<HTMLElement>) => void;
  onDragEnterSection: () => void;
  onDropSection: (event: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onItemDragStart: (event: React.DragEvent<HTMLDivElement>, id: string) => void;
  onItemDragEnter: (id: string) => void;
  onDropItem: (event: React.DragEvent<HTMLDivElement>, id: string) => void;
  onItemDragEnd: () => void;
  children?: React.ReactNode;
}) {
  const meta = SECTION_META[section];
  const rowsRef = useRef<HTMLDivElement>(null);
  useFlipLayout(rowsRef, ".line-item[data-flip-id]");

  const cardClassName = ["section-card", meta.highlight ? "highlight" : "", isDragging ? "is-dragging" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <section
      className={cardClassName}
      style={{ "--accent": meta.accent } as React.CSSProperties}
      draggable
      aria-grabbed={isDragging}
      onDragStart={onDragStart}
      onDragEnter={onDragEnterSection}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={onDropSection}
      onDragEnd={onDragEnd}
    >
      <div className="section-head">
        <h3>
          <button className="drag-handle" type="button" aria-label="Arrastar seção">
            <GripVertical size={16} />
          </button>
          <i />
          {meta.title}
        </h3>
        <strong>{formatMoney(total, preferences)}</strong>
      </div>
      <p>{meta.helper}</p>
      <div ref={rowsRef} className="rows">
        {items.map((item) => (
          <LineItem
            key={item.id}
            item={item}
            accent={meta.accent}
            preferences={preferences}
            isDragging={draggedItemId === item.id}
            onLabel={(label) => onUpdate(item.id, { label })}
            onValue={(cents) => onUpdate(item.id, { cents })}
            onRemove={() => onRemove(item.id)}
            onDragStart={(event) => onItemDragStart(event, item.id)}
            onDragEnter={() => onItemDragEnter(item.id)}
            onDrop={(event) => onDropItem(event, item.id)}
            onDragEnd={onItemDragEnd}
          />
        ))}
      </div>
      <button className="addbtn" onClick={onAdd} style={{ borderColor: `${meta.accent}55`, color: meta.accent }}>
        <Plus size={14} /> {meta.addLabel}
      </button>
      {children}
    </section>
  );
}

function LineItem({
  item,
  accent,
  preferences,
  isDragging,
  onLabel,
  onValue,
  onRemove,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
}: {
  item: FinanceItem;
  accent: string;
  preferences: Preferences;
  isDragging: boolean;
  onLabel: (value: string) => void;
  onValue: (value: number) => void;
  onRemove: () => void;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter: () => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      className={isDragging ? "line-item is-dragging" : "line-item"}
      data-flip-id={`item-${item.id}`}
      draggable
      aria-grabbed={isDragging}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={onDrop}
      onDragEnd={(event) => {
        event.stopPropagation();
        onDragEnd();
      }}
    >
      <button className="row-drag" type="button" aria-label="Arrastar linha">
        <GripVertical size={14} />
      </button>
      <span style={{ background: accent }} />
      <input className="lbl" value={item.label} placeholder="Descrição" onChange={(event) => onLabel(event.target.value)} />
      <div className="valwrap">
        <small>{preferences.currency}</small>
        <input className="val" value={formatInputValue(item.cents, preferences)} inputMode="decimal" placeholder="0,00" onChange={(event) => onValue(parseMoneyInput(event.target.value))} />
      </div>
      <button className="iconbtn" onClick={onRemove} aria-label="Remover linha">
        <X size={14} />
      </button>
    </div>
  );
}

function MoneyField({
  label,
  cents,
  preferences,
  onChange,
}: {
  label: string;
  cents: number;
  preferences: Preferences;
  onChange: (cents: number) => void;
}) {
  return (
    <div className="money-field">
      <span>{label}</span>
      <div className="valwrap">
        <small>{preferences.currency}</small>
        <input className="val" value={formatInputValue(cents, preferences)} inputMode="decimal" placeholder="0,00" onChange={(event) => onChange(parseMoneyInput(event.target.value))} />
      </div>
    </div>
  );
}
