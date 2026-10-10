"use client";

// Volet « Comptable IA » du carnet de comptes — port fidèle de la maquette « Waxo Admin » (lignes 360-386).
// Les calculs sont faits côté serveur (POST /api/admin/accountant) ; ce composant n'affiche que la conversation.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountantResponse } from "@/lib/accountant/types";

type Msg = { role: "u" | "a"; text: string; notes?: string[] };

const GREETING =
  "Bonjour, je suis votre comptable IA. Je lis vos ventes, vos prix d'achat et vos dépenses. Demandez-moi votre marge, la rentabilité de votre pub, ou dites-moi une dépense à noter.";
const CHIPS = ["Quelle est ma marge ce mois-ci ?", "Ma publicité est-elle rentable ?", "Quels produits me rapportent le plus ?", "Ajoute 15 000 F de pub Facebook aujourd'hui"];
const MAX_CHARS = 500;

/** Props facultatives : la page carnet peut transmettre le mois affiché (AAAA-MM) pour que « ce mois-ci » suive la sélection. */
export function AccountantPanel({ month }: { month?: string } = {}) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "a", text: GREETING }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim().slice(0, MAX_CHARS);
      if (!text || busyRef.current) return;
      busyRef.current = true;
      const next: Msg[] = [...msgs, { role: "u", text }];
      setMsgs(next);
      setInput("");
      setBusy(true);

      // Historique envoyé : 10 derniers tours sans la salutation, commençant par un message utilisateur.
      const history = next
        .slice(1)
        .slice(-10)
        .map((m) => ({ role: m.role === "u" ? ("user" as const) : ("assistant" as const), text: m.text.slice(0, MAX_CHARS) }));
      while (history.length && history[0].role !== "user") history.shift();

      let reply: Msg;
      try {
        const res = await fetch("/api/admin/accountant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: history, ...(month ? { month } : {}) }),
        });
        const data = (await res.json()) as AccountantResponse;
        if (data.ok) {
          reply = { role: "a", text: data.reply, notes: data.notes };
          if (data.changed) {
            router.refresh();
            window.dispatchEvent(new CustomEvent("waxo:ledger-changed"));
          }
        } else {
          reply = { role: "a", text: data.message };
        }
      } catch {
        reply = { role: "a", text: "Connexion impossible pour le moment. Vérifiez votre réseau et réessayez." };
      }
      busyRef.current = false;
      setBusy(false);
      setMsgs((cur) => [...cur, reply]);
    },
    [msgs, month, router],
  );

  const showChips = msgs.length === 1 && !busy;

  return (
    <aside
      aria-label="Comptable IA"
      className="min-[1180px]:max-w-[440px]"
      style={{
        flex: "1 1 340px",
        minWidth: 0,
        position: "sticky",
        top: 20,
        background: "#fff",
        borderRadius: 22,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "min(680px, calc(100vh - 40px))",
        border: "1px solid #E2DCCF",
      }}
    >
      <div style={{ background: "#141210", color: "#F4F1EA", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <span
          aria-hidden="true"
          className="font-display"
          style={{ width: 38, height: 38, flex: "none", borderRadius: "50%", background: "#FFC93C", color: "#141210", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 }}
        >
          w
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <strong style={{ fontSize: 15 }}>Comptable IA</strong>
          <span style={{ fontSize: 12, color: "#B9B1A4" }}>Analyse vos comptes, note vos dépenses</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        aria-live="polite"
        style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10, background: "#F4F1EA" }}
      >
        {msgs.map((m, i) => {
          const u = m.role === "u";
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: u ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  maxWidth: "90%",
                  background: u ? "#141210" : "#fff",
                  color: u ? "#F4F1EA" : "#141210",
                  borderRadius: u ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  padding: "10px 13px",
                  fontSize: 14,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                }}
              >
                {m.text}
              </div>
              {(m.notes ?? []).map((n, j) => (
                <span key={j} style={{ background: "#E5EFE7", color: "#1F6B4A", borderRadius: 10, padding: "6px 10px", fontSize: 12, fontWeight: 600 }}>
                  ✓ {n}
                </span>
              ))}
            </div>
          );
        })}
        {busy && (
          <div style={{ alignSelf: "flex-start", background: "#fff", borderRadius: "16px 16px 16px 4px", padding: "10px 14px", fontSize: 14, color: "#4A443C" }}>
            Le comptable calcule…
          </div>
        )}
        {showChips && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => void send(c)}
                className="cursor-pointer hover:!bg-[#FFF4D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141210]"
                style={{ border: "1px solid #D6CFC0", background: "#fff", borderRadius: 999, padding: "0 12px", minHeight: 44, fontSize: 12.5, textAlign: "left" }}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        style={{ padding: 10, borderTop: "1px solid #E2DCCF", display: "flex", gap: 8 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={MAX_CHARS}
          aria-label="Question au comptable"
          placeholder="Ex. J'ai payé 20 000 F de pub hier"
          autoComplete="off"
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141210]"
          style={{ flex: 1, minWidth: 0, border: "1px solid #E2DCCF", borderRadius: 999, padding: "11px 14px", fontSize: 14, background: "#FAF8F3" }}
        />
        <button
          type="submit"
          aria-label="Envoyer"
          disabled={busy}
          className="cursor-pointer hover:bg-[#2C2823] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141210] disabled:cursor-wait disabled:opacity-60"
          style={{ width: 44, height: 44, flex: "none", borderRadius: "50%", border: 0, background: "#141210", color: "#F4F1EA", fontSize: 17 }}
        >
          ↑
        </button>
      </form>
    </aside>
  );
}
