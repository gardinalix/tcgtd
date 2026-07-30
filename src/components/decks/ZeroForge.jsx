import { useEffect, useMemo, useState } from "react";
import { CardArt } from "../cards/CardArt.jsx";
import { buildExBurstDeckText, downloadDeckText } from "../../domain/deckExport.js";
import {
  buildZeroForgeSaveReport,
  buildZeroForgeWorkspace,
  evaluateZeroForgeAddition,
} from "../../services/deckDesigner/zeroForgeEngine.js";
import { filterCards, uniqueValues } from "../../utils/cardFilters.js";
import { useLocale } from "../../i18n/LocaleProvider.jsx";

const STAGE_WIDTH = 1500;
const LANE_X = [78, 340, 602, 864];

export function ZeroForge({
  data,
  onClose,
  onSave,
  onOpenSavedDeck,
}) {
  const { t } = useLocale();
  const [main, setMain] = useState({});
  const [focusCardNumber, setFocusCardNumber] = useState("");
  const [deckName, setDeckName] = useState("ZERO Forge Deck");
  const [search, setSearch] = useState("");
  const [color, setColor] = useState("Any");
  const [type, setType] = useState("Any");
  const [cost, setCost] = useState("");
  const [signal, setSignal] = useState({
    tone: "neutral",
    text: "Select or drag the first card to establish the deck anchor.",
  });
  const [dragActive, setDragActive] = useState(false);
  const [savedDeckId, setSavedDeckId] = useState("");

  const cards = data.cards || [];
  const cardMap = useMemo(() => new Map(cards.map((card) => [card.cardNumber, card])), [cards]);
  const workspace = useMemo(
    () => buildZeroForgeWorkspace(data, main, focusCardNumber, { limit: 8 }),
    [data, focusCardNumber, main],
  );
  const visibleCards = useMemo(() => filterCards(cards, {
    search,
    color,
    type,
    cost,
    rarity: "Any",
    set: "Any",
    trait: "",
  })
    .sort((left, right) =>
      Number(Boolean(workspace.availability[right.cardNumber]?.allowed))
      - Number(Boolean(workspace.availability[left.cardNumber]?.allowed))
      || Number(right.recentTop8DecksUsing || 0) - Number(left.recentTop8DecksUsing || 0)
      || String(left.cardName).localeCompare(String(right.cardName)))
    .slice(0, 120), [cards, color, cost, search, type, workspace.availability]);
  const colors = useMemo(() => uniqueValues(cards, (card) => card.color), [cards]);
  const types = useMemo(() => uniqueValues(cards, (card) => card.cardType), [cards]);
  const focusedCard = cardMap.get(focusCardNumber) || workspace.rows[0]?.card || null;
  const layout = useMemo(
    () => buildForgeLayout(workspace.rows, workspace.suggestions),
    [workspace.rows, workspace.suggestions],
  );

  useEffect(() => {
    document.body.classList.add("zero-forge-active");
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("zero-forge-active");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  function addCard(cardNumber, origin = "catalog") {
    const card = cardMap.get(cardNumber);
    if (!card) return;
    const assessment = evaluateZeroForgeAddition(data, main, card);
    if (!assessment.allowed) {
      setSignal({ tone: "blocked", text: assessment.reason });
      return;
    }
    setFocusCardNumber(cardNumber);
    setMain(assessment.nextMain);
    setSavedDeckId("");
    setSignal({
      tone: "allowed",
      text: origin === "suggestion"
        ? `${card.cardName} accepted from the projected synergy line.`
        : `${card.cardName} added. The tactical map and projections were recalculated.`,
    });
  }

  function removeCard(cardNumber) {
    const current = Number(main[cardNumber] || 0);
    if (!current) return;
    const next = { ...main };
    if (current === 1) delete next[cardNumber];
    else next[cardNumber] = current - 1;
    setMain(next);
    setSavedDeckId("");
    if (!next[focusCardNumber]) setFocusCardNumber(Object.keys(next)[0] || "");
    setSignal({
      tone: "neutral",
      text: `${cardMap.get(cardNumber)?.cardName || cardNumber} removed. Suggestions were recalculated.`,
    });
  }

  function startDrag(event, cardNumber) {
    const assessment = workspace.availability[cardNumber];
    if (!assessment?.allowed) {
      event.preventDefault();
      setSignal({ tone: "blocked", text: assessment?.reason || "This card is currently locked." });
      return;
    }
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-zero-forge-card", cardNumber);
    event.dataTransfer.setData("text/plain", cardNumber);
  }

  function dropOnMap(event) {
    event.preventDefault();
    setDragActive(false);
    const cardNumber = event.dataTransfer.getData("application/x-zero-forge-card")
      || event.dataTransfer.getData("text/plain");
    addCard(cardNumber, "catalog");
  }

  function saveDraft() {
    if (!workspace.mainCount) {
      setSignal({ tone: "blocked", text: "Add at least one card before saving this draft." });
      return;
    }
    const report = buildZeroForgeSaveReport(data, main, { title: deckName, focusCardNumber });
    const saved = onSave?.(report);
    if (!saved?.id) {
      setSignal({ tone: "blocked", text: "The ZERO Forge draft could not be saved." });
      return;
    }
    setSavedDeckId(saved.id);
    setSignal({
      tone: "allowed",
      text: workspace.legal
        ? "Legal 50-card deck saved to My decks."
        : "Draft saved to My decks. You can continue here or finish it in the standard builder.",
    });
  }

  function resetForge() {
    if (workspace.mainCount && !window.confirm(t("Clear every card from this ZERO Forge draft?"))) return;
    setMain({});
    setFocusCardNumber("");
    setSavedDeckId("");
    setSignal({
      tone: "neutral",
      text: "Select or drag the first card to establish the deck anchor.",
    });
  }

  return (
    <section className="zero-forge" aria-label="ZERO Forge assisted deck construction">
      <header className="zero-forge__header">
        <div className="zero-forge__brand">
          <span>BRUXÃO // ADVANCED MILITARY HUD</span>
          <strong>ZERO FORGE</strong>
          <small>MAP-DRIVEN DECK CONSTRUCTION</small>
        </div>
        <label className="zero-forge__name">
          <span>DECK ID</span>
          <input value={deckName} onChange={(event) => setDeckName(event.target.value)} />
        </label>
        <div className="zero-forge__telemetry">
          <span><small>MAIN</small><strong>{workspace.mainCount}/{workspace.maxMain}</strong></span>
          <span><small>COLORS</small><strong>{workspace.colors.join(" / ") || "OPEN"}</strong></span>
          <span className={workspace.legal ? "is-legal" : workspace.structurallyLegal ? "is-building" : "is-blocked"}>
            <small>RULES</small>
            <strong>{workspace.legal ? "LEGAL" : workspace.structurallyLegal ? "BUILDING" : "BLOCKED"}</strong>
          </span>
        </div>
        <div className="zero-forge__actions">
          <button type="button" onClick={resetForge}>RESET</button>
          <button
            type="button"
            disabled={!workspace.mainCount}
            onClick={() => downloadDeckText(buildExBurstDeckText({ main }), deckName)}
          >
            EXPORT
          </button>
          <button type="button" className="is-primary" onClick={saveDraft}>SAVE DRAFT</button>
          {savedDeckId ? (
            <button
              type="button"
              className="is-confirmed"
              onClick={() => onOpenSavedDeck?.(savedDeckId)}
            >
              OPEN IN BUILDER
            </button>
          ) : null}
          <button type="button" className="zero-forge__close" onClick={onClose} aria-label="Close ZERO Forge">×</button>
        </div>
      </header>

      <div className="zero-forge__body">
        <aside className="zero-forge-library">
          <div className="zero-forge-panel-head">
            <span>01 / CARD ARMORY</span>
            <strong>SELECT · CLICK · DRAG</strong>
            <small>{visibleCards.length} candidates in current scan</small>
          </div>
          <input
            className="zero-forge-library__search"
            value={search}
            placeholder="Name, number, effect or trait..."
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="zero-forge-library__filters">
            <select value={color} onChange={(event) => setColor(event.target.value)} aria-label="Card color">
              <option value="Any">Any color</option>
              {colors.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Card type">
              <option value="Any">Any type</option>
              {types.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input value={cost} placeholder="Cost, e.g. <=2" onChange={(event) => setCost(event.target.value)} />
          </div>
          <div className="zero-forge-library__list">
            {visibleCards.map((card) => {
              const assessment = workspace.availability[card.cardNumber];
              const quantity = Number(main[card.cardNumber] || 0);
              const locked = !assessment?.allowed;
              return (
                <button
                  key={card.cardNumber}
                  type="button"
                  draggable={!locked}
                  className={`zero-forge-library-card ${locked ? "is-locked" : ""} ${focusCardNumber === card.cardNumber ? "is-focused" : ""}`.trim()}
                  onDragStart={(event) => startDrag(event, card.cardNumber)}
                  onClick={() => addCard(card.cardNumber)}
                  title={locked ? assessment?.reason : `Add ${card.cardName}`}
                >
                  <CardArt card={card} className="zero-forge-library-card__art" compact />
                  <span>
                    <small>{card.cardNumber} · COST {card.cost ?? "-"}</small>
                    <strong>{card.cardName}</strong>
                    <em>{card.color} · {card.cardType}</em>
                  </span>
                  <b>{locked ? "LOCK" : quantity ? `${quantity}/${assessment.maxCopies}` : "+"}</b>
                </button>
              );
            })}
          </div>
        </aside>

        <main
          className={`zero-forge-map ${dragActive ? "is-drop-active" : ""}`.trim()}
          onDragEnter={() => setDragActive(true)}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={dropOnMap}
        >
          <div className="zero-forge-map__topline">
            <span>02 / LIVE DECK MAP</span>
            <strong>{workspace.remaining ? `${workspace.remaining} slots remaining` : "Main deck allocation complete"}</strong>
            <div>
              <i className="is-deck" /> IN DECK
              <i className="is-ghost" /> PROJECTED · NOT ADDED
              <i className="is-link" /> PRINTED / OBSERVED LINK
            </div>
          </div>
          <div className="zero-forge-map__viewport">
            <div
              className="zero-forge-map__stage"
              style={{ width: STAGE_WIDTH, height: layout.height }}
            >
              <div className="zero-forge-map__grid" aria-hidden="true" />
              {layout.lanes.map((lane) => (
                <div
                  key={lane.id}
                  className="zero-forge-map__lane-label"
                  style={{ left: lane.x }}
                >
                  <span>{lane.label}</span>
                  <b>{lane.count}</b>
                </div>
              ))}
              <div className="zero-forge-map__projection-label">
                <span>TACTICAL PROJECTION</span>
                <small>Ghost cards are suggestions, not deck entries.</small>
              </div>

              <svg
                className="zero-forge-map__links"
                viewBox={`0 0 ${STAGE_WIDTH} ${layout.height}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {workspace.edges.map((edge) => {
                  const source = layout.positions.get(edge.source);
                  const target = layout.positions.get(edge.target);
                  if (!source || !target) return null;
                  return (
                    <line
                      key={edge.id}
                      x1={source.cx}
                      y1={source.cy}
                      x2={target.cx}
                      y2={target.cy}
                      className={`zero-forge-map__edge zero-forge-map__edge--${edge.kind} zero-forge-map__edge--${edge.strength}`}
                    />
                  );
                })}
                {workspace.suggestions.map((suggestion) => {
                  const source = layout.positions.get(suggestion.bestSourceCardNumber || focusCardNumber);
                  const target = layout.positions.get(`ghost:${suggestion.card.cardNumber}`);
                  if (!source || !target) return null;
                  return (
                    <line
                      key={`ghost-link:${suggestion.card.cardNumber}`}
                      x1={source.cx}
                      y1={source.cy}
                      x2={target.cx}
                      y2={target.cy}
                      className={`zero-forge-map__edge zero-forge-map__edge--ghost zero-forge-map__edge--${suggestion.strength}`}
                    />
                  );
                })}
              </svg>

              {!workspace.rows.length ? (
                <div className="zero-forge-map__empty">
                  <span>NO ANCHOR LOCKED</span>
                  <strong>DROP OR CLICK YOUR FIRST CARD</strong>
                  <p>The assistant will project legal synergy, competitive co-play, curve and role options around it.</p>
                </div>
              ) : null}

              {workspace.rows.map((row) => {
                const position = layout.positions.get(row.card.cardNumber);
                return (
                  <article
                    key={row.card.cardNumber}
                    className={`zero-forge-node ${focusCardNumber === row.card.cardNumber ? "is-focused" : ""}`.trim()}
                    style={{ left: position.x, top: position.y }}
                  >
                    <button type="button" onClick={() => setFocusCardNumber(row.card.cardNumber)}>
                      <CardArt card={row.card} className="zero-forge-node__art" compact />
                      <span>{row.card.cardNumber}</span>
                      <strong>{row.card.cardName}</strong>
                    </button>
                    <div>
                      <button type="button" onClick={() => removeCard(row.card.cardNumber)} aria-label={`Remove one ${row.card.cardName}`}>−</button>
                      <b>{row.quantity}x</b>
                      <button type="button" onClick={() => addCard(row.card.cardNumber)} aria-label={`Add one ${row.card.cardName}`}>+</button>
                    </div>
                  </article>
                );
              })}

              {workspace.suggestions.map((suggestion) => {
                const position = layout.positions.get(`ghost:${suggestion.card.cardNumber}`);
                return (
                  <button
                    key={suggestion.card.cardNumber}
                    type="button"
                    className={`zero-forge-ghost zero-forge-ghost--${suggestion.category}`}
                    style={{ left: position.x, top: position.y }}
                    onClick={() => addCard(suggestion.card.cardNumber, "suggestion")}
                  >
                    <CardArt card={suggestion.card} className="zero-forge-ghost__art" compact />
                    <span>
                      <small>#{suggestion.rank} · {suggestion.category}</small>
                      <strong>{suggestion.card.cardName}</strong>
                      <em>{suggestion.reasons[0] || "Curve / role support"}</em>
                    </span>
                    <b>+ ADD</b>
                  </button>
                );
              })}
            </div>
          </div>
          <div className={`zero-forge-map__signal is-${signal.tone}`} role="status" aria-live="polite">
            <i />
            <span>{t(signal.text)}</span>
          </div>
        </main>

        <aside className="zero-forge-intel">
          <div className="zero-forge-panel-head">
            <span>03 / BRUXÃO INTELLIGENCE</span>
            <strong>ASSISTED CONSTRUCTION</strong>
            <small>Every projection is checked against current deck rules.</small>
          </div>

          {focusedCard ? (
            <section className="zero-forge-focus">
              <CardArt card={focusedCard} className="zero-forge-focus__art" compact />
              <div>
                <small>ACTIVE ANCHOR</small>
                <strong>{focusedCard.cardName}</strong>
                <span>{focusedCard.cardNumber} · {focusedCard.color} · {focusedCard.cardType}</span>
                <p>{focusedCard.effectPreview || "No normalized effect preview available."}</p>
              </div>
            </section>
          ) : null}

          <section className="zero-forge-intel__section">
            <header><strong>CURVE VECTOR</strong><span>current / target</span></header>
            {workspace.curve.map((bucket) => (
              <div className="zero-forge-meter" key={bucket.id}>
                <span>{bucket.label}</span>
                <i><b style={{ width: `${Math.min(100, (bucket.count / Math.max(1, bucket.target)) * 100)}%` }} /></i>
                <strong>{bucket.count}/{bucket.target}</strong>
              </div>
            ))}
          </section>

          <section className="zero-forge-intel__section">
            <header><strong>ROLE COVERAGE</strong><span>signals / target</span></header>
            <div className="zero-forge-role-grid">
              {workspace.roles.map((role) => (
                <article key={role.id} className={role.need <= 0 ? "is-ready" : ""}>
                  <span>{role.label}</span>
                  <strong>{role.count}/{role.target}</strong>
                  <small>{role.need > 0 ? `${role.need} wanted` : "covered"}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="zero-forge-intel__section zero-forge-suggestion-stack">
            <header><strong>NEXT BEST LINES</strong><span>not yet added</span></header>
            {workspace.suggestions.slice(0, 5).map((suggestion) => (
              <button
                key={suggestion.card.cardNumber}
                type="button"
                onClick={() => addCard(suggestion.card.cardNumber, "suggestion")}
              >
                <span>0{suggestion.rank}</span>
                <div>
                  <strong>{suggestion.card.cardName}</strong>
                  <small>{suggestion.reasons.map((reason) => t(reason)).join(" · ")}</small>
                </div>
                <b>{Math.round(suggestion.score)}</b>
              </button>
            ))}
            {!workspace.suggestions.length ? <p>Add an anchor card to generate legal projections.</p> : null}
          </section>

          <section className="zero-forge-intel__section zero-forge-manifest">
            <header><strong>DECK MANIFEST</strong><span>{workspace.rows.length} unique</span></header>
            <div>
              {[...workspace.rows]
                .sort((left, right) =>
                  Number(left.card.cost || 0) - Number(right.card.cost || 0)
                  || String(left.card.cardName).localeCompare(String(right.card.cardName)))
                .map((row) => (
                  <button key={row.card.cardNumber} type="button" onClick={() => setFocusCardNumber(row.card.cardNumber)}>
                    <span>{row.quantity}x</span>
                    <strong>{row.card.cardName}</strong>
                    <small>C{row.card.cost ?? "-"}</small>
                  </button>
                ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function buildForgeLayout(rows, suggestions) {
  const buckets = [
    { id: "early", label: "COST 0–2", test: (cost) => cost <= 2, x: LANE_X[0] },
    { id: "three", label: "COST 3", test: (cost) => cost === 3, x: LANE_X[1] },
    { id: "four", label: "COST 4", test: (cost) => cost === 4, x: LANE_X[2] },
    { id: "late", label: "COST 5+", test: (cost) => cost >= 5, x: LANE_X[3] },
  ].map((lane) => ({
    ...lane,
    rows: rows
      .filter((row) => lane.test(Number(row.card.cost || 0)))
      .sort((left, right) =>
        String(left.card.cardType).localeCompare(String(right.card.cardType))
        || String(left.card.cardName).localeCompare(String(right.card.cardName))),
  }));
  const maxRows = Math.max(1, ...buckets.map((bucket) => Math.ceil(bucket.rows.length / 2)));
  const height = Math.max(820, 110 + maxRows * 174);
  const positions = new Map();

  for (const lane of buckets) {
    lane.rows.forEach((row, index) => {
      const x = lane.x + (index % 2) * 124;
      const y = 86 + Math.floor(index / 2) * 174;
      positions.set(row.card.cardNumber, { x, y, cx: x + 54, cy: y + 76 });
    });
  }
  suggestions.forEach((suggestion, index) => {
    const x = 1156 + (index % 2) * 162;
    const y = 86 + Math.floor(index / 2) * 168;
    positions.set(`ghost:${suggestion.card.cardNumber}`, { x, y, cx: x + 76, cy: y + 67 });
  });

  return {
    height,
    positions,
    lanes: buckets.map((lane) => ({
      id: lane.id,
      label: lane.label,
      x: lane.x,
      count: lane.rows.reduce((sum, row) => sum + row.quantity, 0),
    })),
  };
}
