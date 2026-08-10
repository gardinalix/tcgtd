import { useMemo, useState } from "react";
import {
  TacticalDataPanel,
  TacticalPageHeader,
  TacticalPageShell,
  TacticalSummaryCard,
  TacticalSummaryStrip,
} from "../components/tactical/TacticalPageShell";
import { DeckDesigner } from "../components/decks/DeckDesigner";
import { publicDecksFromMeta } from "../domain/deckLibrary";
import { fetchExBurstProfileDecks } from "../domain/exburstImport";

export function DecksPage({
  data,
  user,
  decks,
  onCreateDeck,
  onDuplicateDeck,
  onDeleteDeck,
  onOpenDeck,
  onEditDeck,
  onImportExternalDecks,
  onSaveRecommendation,
  initialForgeImport,
  onForgeImportConsumed,
  initialDesignerCriteria,
  onDesignerCriteriaConsumed,
}) {
  const [workspace, setWorkspace] = useState("designer");
  const [scope, setScope] = useState("mine");
  const [showExBurstImport, setShowExBurstImport] = useState(false);
  const [exBurstProfile, setExBurstProfile] = useState("");
  const [exBurstStatus, setExBurstStatus] = useState("Scan an ExBurst profile to import public Gundam decks.");
  const [exBurstBusy, setExBurstBusy] = useState(false);
  const [exBurstUser, setExBurstUser] = useState(null);
  const [exBurstDecks, setExBurstDecks] = useState([]);
  const [selectedExBurstDecks, setSelectedExBurstDecks] = useState({});
  const publicDecks = useMemo(() => publicDecksFromMeta(data), [data]);
  const visibleDecks = scope === "public" ? publicDecks : decks;
  const selectedImportDecks = exBurstDecks.filter((deck) => selectedExBurstDecks[deck.id]);

  async function scanExBurstProfile() {
    if (!exBurstProfile.trim()) {
      setExBurstStatus("Paste an ExBurst profile URL, user id, or username first.");
      return;
    }
    setExBurstBusy(true);
    setExBurstStatus("Contacting ExBurst public deck archive...");
    try {
      const payload = await fetchExBurstProfileDecks(exBurstProfile.trim(), { limit: 75 });
      const decks = payload.decks || [];
      setExBurstUser(payload.user || null);
      setExBurstDecks(decks);
      setSelectedExBurstDecks(Object.fromEntries(decks.map((deck) => [deck.id, true])));
      setExBurstStatus(decks.length ? `${decks.length} public deck(s) detected for ${payload.user?.username || "this profile"}.` : "No public Gundam decks were found for this profile.");
    } catch (error) {
      setExBurstDecks([]);
      setSelectedExBurstDecks({});
      setExBurstStatus(error.message || "Could not scan ExBurst profile.");
    } finally {
      setExBurstBusy(false);
    }
  }

  function toggleExBurstDeck(deckId) {
    setSelectedExBurstDecks((current) => ({ ...current, [deckId]: !current[deckId] }));
  }

  function importSelectedExBurstDecks() {
    if (!user) {
      setExBurstStatus("Login first so imported decks can be saved to your cockpit profile.");
      return;
    }
    if (!selectedImportDecks.length) {
      setExBurstStatus("Select at least one ExBurst deck to import.");
      return;
    }
    const result = onImportExternalDecks?.(selectedImportDecks);
    setScope("mine");
    setExBurstStatus(`${result?.imported || selectedImportDecks.length} ExBurst deck(s) imported into My decks.`);
  }

  return (
    <TacticalPageShell className={`decks-terminal-page ${workspace === "designer" ? "is-designer-mode" : "is-library-mode"}`}>
      {workspace === "designer" ? (
        <nav className="deck-designer-routebar" aria-label="Deck workspace">
          <div>
            <span className="eyebrow">SUBSYSTEM 02 // STRATEGIC OPTIMIZATION</span>
            <strong>TACTICAL FORGE</strong>
          </div>
          <span className="deck-designer-routebar__status"><i /> SYSTEM STANDBY</span>
          <div className="deck-designer-routebar__modes">
            <button type="button" className="is-active" onClick={() => setWorkspace("designer")}>Deck Designer</button>
            <button type="button" onClick={() => setWorkspace("library")}>Deck library</button>
          </div>
        </nav>
      ) : (
        <>
          <TacticalPageHeader
            eyebrow="SUBSYSTEM 02 // LOADOUT LOGISTICS"
            title="Loadout Operations"
            subtitle="Saved decks, competitive references and pilot-authored loadouts connected to the same optimization system."
            actions={(
              <div className="button-row">
                <button type="button" onClick={() => setWorkspace("designer")}>Deck Designer</button>
                <button type="button" className="is-active" onClick={() => setWorkspace("library")}>Deck library</button>
                <button type="button" className={scope === "mine" ? "is-active" : ""} onClick={() => setScope("mine")}>My decks</button>
                <button type="button" className={scope === "public" ? "is-active" : ""} onClick={() => setScope("public")}>Public / meta</button>
                <button type="button" onClick={onCreateDeck} disabled={!user}>New deck</button>
                <button type="button" className={showExBurstImport ? "is-active" : ""} onClick={() => setShowExBurstImport((current) => !current)}>Import ExBurst</button>
              </div>
            )}
          />
          <TacticalSummaryStrip>
            <>
              <TacticalSummaryCard label="Visible decklists" value={visibleDecks.length} detail={scope === "mine" ? "Owned by this pilot." : "Public/meta records."} tone="blue" />
              <TacticalSummaryCard label="Local decks" value={decks.length} />
              <TacticalSummaryCard label="Public decks" value={publicDecks.length} />
              <TacticalSummaryCard label="Mode" value={scope === "mine" ? "Private ops" : "Meta archive"} />
            </>
          </TacticalSummaryStrip>
        </>
      )}

      {workspace === "designer" ? (
        <DeckDesigner
          data={data}
          onSaveRecommendation={onSaveRecommendation}
          onEditDeck={onEditDeck}
          initialForgeImport={initialForgeImport}
          onForgeImportConsumed={onForgeImportConsumed}
          initialCriteria={initialDesignerCriteria}
          onInitialCriteriaConsumed={onDesignerCriteriaConsumed}
        />
      ) : null}

      {workspace === "library" && showExBurstImport ? (
        <TacticalDataPanel title="ExBurst profile import" subtitle="Imports public Gundam decklists from your ExBurst profile into saved cockpit decks. Private ExBurst decks still need export/paste.">
          <div className="exburst-importer">
            <div className="exburst-importer__form">
              <label>
                <span>Profile URL / user id / username</span>
                <input
                  value={exBurstProfile}
                  onChange={(event) => setExBurstProfile(event.target.value)}
                  placeholder="https://exburst.dev/profile/30300/decks"
                />
              </label>
              <button type="button" onClick={scanExBurstProfile} disabled={exBurstBusy}>{exBurstBusy ? "Scanning..." : "Scan profile"}</button>
              <button type="button" onClick={importSelectedExBurstDecks} disabled={!selectedImportDecks.length || !user}>Import selected</button>
            </div>
            <p className="exburst-importer__status">{exBurstStatus}</p>
            {exBurstUser ? (
              <div className="exburst-importer__pilot">
                <strong>{exBurstUser.username}</strong>
                <span>{exBurstUser.profileUrl}</span>
              </div>
            ) : null}
            {exBurstDecks.length ? (
              <div className="exburst-importer__results">
                {exBurstDecks.map((deck) => (
                  <article key={deck.id} className={`exburst-importer__row ${selectedExBurstDecks[deck.id] ? "is-selected" : ""}`.trim()}>
                    <label>
                      <input type="checkbox" checked={!!selectedExBurstDecks[deck.id]} onChange={() => toggleExBurstDeck(deck.id)} />
                      <span>
                        <strong>{deck.name}</strong>
                        <em>{deck.colors?.join(" / ") || "Unknown colors"} · {deck.modifiedDate ? new Date(deck.modifiedDate).toLocaleDateString() : "No date"}</em>
                      </span>
                    </label>
                    <a href={deck.sourceUrl} target="_blank" rel="noreferrer">Open ExBurst</a>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </TacticalDataPanel>
      ) : null}

      {workspace === "library" ? <TacticalDataPanel title={`${visibleDecks.length} decklists detected`} subtitle={scope === "mine" ? "Local account decks stored in this browser." : "Competitive decklists normalized from meta sources."}>
        <div className="react-data-grid">
          {visibleDecks.map((deck) => (
            <article key={deck.id} className="react-data-card">
              <span className="eyebrow">{deck.visibility || deck.sourceName || "public"}</span>
              <h3>{deck.name}</h3>
              <p>{deck.archetype || deck.format || "No archetype tagged yet."}</p>
              <dl>
                <dt>Author</dt><dd>{deck.author || user?.publicName || "Local user"}</dd>
                <dt>Colors</dt><dd>{(deck.colors || []).join(" / ") || deck.colorCombination || "-"}</dd>
                <dt>Event</dt><dd>{deck.event || "-"}</dd>
                <dt>Result</dt><dd>{deck.result || "-"}</dd>
                {deck.sourceName ? <><dt>Source</dt><dd>{deck.sourceName}</dd></> : null}
              </dl>
              <div className="button-row">
                <button type="button" onClick={() => onOpenDeck(deck.id)}>Open</button>
                {scope === "mine" ? <button type="button" onClick={() => onEditDeck(deck.id)}>Edit</button> : null}
                {scope === "mine" ? <button type="button" onClick={() => onDuplicateDeck(deck.id)}>Duplicate</button> : null}
                {scope === "mine" ? <button type="button" onClick={() => onDeleteDeck(deck.id)}>Delete</button> : null}
                {deck.sourceUrl ? <a href={deck.sourceUrl} target="_blank" rel="noreferrer">Source</a> : null}
              </div>
            </article>
          ))}
        </div>
      </TacticalDataPanel> : null}
    </TacticalPageShell>
  );
}
