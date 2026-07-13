export type SectionKey = "entradas" | "cartoes" | "contas" | "diaADia" | "dividas";

export type FinanceItem = {
  id: string;
  label: string;
  cents: number;
};

export type Preferences = {
  locale: string;
  currency: string;
};

export type FinanceData = {
  month: string;
  entradas: FinanceItem[];
  cartoes: FinanceItem[];
  contas: FinanceItem[];
  diaADia: FinanceItem[];
  dividas: FinanceItem[];
  caixaCents: number;
  reservaCents: number;
  sectionOrder: SectionKey[];
  preferences: Preferences;
};

export const SECTION_KEYS: SectionKey[] = ["entradas", "cartoes", "contas", "diaADia", "dividas"];

export const SECTION_META: Record<SectionKey, { title: string; helper: string; addLabel: string; accent: string; highlight?: boolean }> = {
  entradas: {
    title: "Entradas",
    helper: "Tudo que entra de dinheiro no mês.",
    addLabel: "Adicionar entrada",
    accent: "#3FE0A6",
  },
  cartoes: {
    title: "Cartões de crédito",
    helper: "A fatura de cada cartão neste mês.",
    addLabel: "Adicionar cartão",
    accent: "#6C8CFF",
  },
  contas: {
    title: "Contas e impostos",
    helper: "Contas fixas e boletos do mês.",
    addLabel: "Adicionar conta",
    accent: "#59C3D9",
  },
  diaADia: {
    title: "Gastos do dia a dia",
    helper: "Mercado, casa, transporte, alimentação. É a parte que revela sua sobra de verdade. Comece pelos principais.",
    addLabel: "Adicionar gasto",
    accent: "#FCC34D",
    highlight: true,
  },
  dividas: {
    title: "Dívidas",
    helper: "O valor total que você ainda deve em cada lugar.",
    addLabel: "Adicionar dívida",
    accent: "#FF7E8C",
  },
};

export const COLORS = {
  mint: "#3FE0A6",
  coral: "#FF7E8C",
  amber: "#FCC34D",
  periw: "#6C8CFF",
  teal: "#59C3D9",
  sky: "#5FB2FF",
  muted: "#93A4C4",
  text: "#EAF0FB",
};

export function detectLocale() {
  if (typeof navigator === "undefined") return "pt-BR";
  return navigator.language || "pt-BR";
}

export function defaultData(locale = "pt-BR"): FinanceData {
  return {
    month: "Junho 2026",
    entradas: [
      { id: "e1", label: "D3", cents: 1550124 },
      { id: "e2", label: "Everflux", cents: 751700 },
    ],
    cartoes: [
      { id: "c1", label: "Jaciara", cents: 206164 },
      { id: "c2", label: "Ever (Nubank)", cents: 481764 },
    ],
    contas: [
      { id: "b1", label: "Vivo Controle", cents: 4188 },
      { id: "b2", label: "IPTU", cents: 7765 },
      { id: "b3", label: "Saerp / abr", cents: 8295 },
      { id: "b4", label: "Saerp / mai", cents: 12339 },
    ],
    diaADia: [
      { id: "d1", label: "Mercado", cents: 0 },
      { id: "d2", label: "Moradia (aluguel / condomínio)", cents: 0 },
      { id: "d3", label: "Transporte / combustível", cents: 0 },
      { id: "d4", label: "Alimentação fora", cents: 0 },
      { id: "d5", label: "Outros", cents: 0 },
    ],
    dividas: [
      { id: "v1", label: "Nubank", cents: 1315000 },
      { id: "v2", label: "Caixa", cents: 600000 },
      { id: "v3", label: "Bradesco", cents: 300000 },
      { id: "v4", label: "Nubank (cartão Ever)", cents: 481764 },
    ],
    caixaCents: 0,
    reservaCents: 185000,
    sectionOrder: [...SECTION_KEYS],
    preferences: {
      locale,
      currency: "BRL",
    },
  };
}

export function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function sumCents(items: FinanceItem[]) {
  return items.reduce((total, item) => total + item.cents, 0);
}

export function formatMoney(cents: number, preferences: Preferences) {
  return new Intl.NumberFormat(preferences.locale || "pt-BR", {
    style: "currency",
    currency: preferences.currency || "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((cents || 0) / 100);
}

export function formatInputValue(cents: number, preferences: Preferences) {
  const parts = new Intl.NumberFormat(preferences.locale || "pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts((cents || 0) / 100);
  return parts.map((part) => part.value).join("");
}

export function parseMoneyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;
  return Number.parseInt(digits, 10);
}

export function normalizeFinanceData(input: unknown, locale = "pt-BR"): FinanceData {
  const base = defaultData(locale);
  if (!input || typeof input !== "object") return base;
  const raw = input as Partial<FinanceData> & Record<string, unknown>;
  const rawPreferences = raw.preferences && typeof raw.preferences === "object" ? (raw.preferences as Record<string, unknown>) : {};
  const normalizeItems = (key: SectionKey) => {
    const value = raw[key];
    if (!Array.isArray(value)) return base[key];
    return value.map((item, index) => {
      const rawItem = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const cents =
        typeof rawItem.cents === "number"
          ? Math.max(0, Math.round(rawItem.cents))
          : typeof rawItem.value === "string"
            ? parseMoneyInput(rawItem.value)
            : 0;
      return {
        id: typeof rawItem.id === "string" ? rawItem.id : `${key}-${index}`,
        label: typeof rawItem.label === "string" ? rawItem.label : "",
        cents,
      };
    });
  };

  const sectionOrder = Array.isArray(raw.sectionOrder)
    ? raw.sectionOrder.filter((key): key is SectionKey => SECTION_KEYS.includes(key as SectionKey))
    : base.sectionOrder;

  return {
    ...base,
    month: typeof raw.month === "string" ? raw.month : base.month,
    entradas: normalizeItems("entradas"),
    cartoes: normalizeItems("cartoes"),
    contas: normalizeItems("contas"),
    diaADia: normalizeItems("diaADia"),
    dividas: normalizeItems("dividas"),
    caixaCents:
      typeof raw.caixaCents === "number"
        ? Math.max(0, Math.round(raw.caixaCents))
        : typeof raw.caixa === "string"
          ? parseMoneyInput(raw.caixa)
          : base.caixaCents,
    reservaCents:
      typeof raw.reservaCents === "number"
        ? Math.max(0, Math.round(raw.reservaCents))
        : typeof raw.reserva === "string"
          ? parseMoneyInput(raw.reserva)
          : base.reservaCents,
    sectionOrder: [...sectionOrder, ...SECTION_KEYS.filter((key) => !sectionOrder.includes(key))],
    preferences: {
      locale: typeof rawPreferences.locale === "string" ? rawPreferences.locale : base.preferences.locale,
      currency: typeof rawPreferences.currency === "string" ? rawPreferences.currency : base.preferences.currency,
    },
  };
}

export function moveItem<T>(list: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}
