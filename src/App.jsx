import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { SiteHeader } from "./components/layout/SiteHeader";
import { SiteFooter } from "./components/layout/SiteFooter";
import { TacticalSideRail } from "./components/layout/TacticalSideRail";
import { loadGundamData, loadHomeData } from "./data/loadGundamData";
import { THEME_CONFIG } from "./data/themeConfig";
import {
  changePassword,
  createDefaultUserState,
  createUserAccount,
  getCurrentUser,
  hydrateAuthSession,
  loginUser,
  logoutUser,
  normalizePlatformState,
  requestPasswordReset,
  startSocialLogin,
  updateUserProfileRemote,
} from "./domain/auth";
import { changeDeckQuantity, normalizeDeck } from "./domain/deck";
import { canAddCardToMain, getCardCopyLimit } from "./domain/deckLegality.js";
import { createSavedDeck, deleteDeck, duplicateDeck, normalizeImportedColors, parseDeckList, updateSavedDeck } from "./domain/deckLibrary";
import { buildMetaWindows } from "./domain/meta";
import { compactDeckDesign } from "./services/deckDesigner/index.js";
import { createForgeImportFromResult } from "./services/deckDesigner/competitiveMeta.js";
import { parseRoute, routeFor } from "./domain/routes";
import { usePersistentState } from "./hooks/usePersistentState";
import { HomePage } from "./pages/HomePage";
import { InstitutionalPage } from "./pages/InstitutionalPage";
import { DEFAULT_FILTERS } from "./utils/cardFilters";
import { useLocale } from "./i18n/LocaleProvider";

const AccountSettingsPage = lazyNamed(() => import("./pages/AccountSettingsPage"), "AccountSettingsPage");
const AuthCallbackPage = lazyNamed(() => import("./pages/AuthCallbackPage"), "AuthCallbackPage");
const BuilderPage = lazyNamed(() => import("./pages/BuilderPage"), "BuilderPage");
const CardPage = lazyNamed(() => import("./pages/CardPage"), "CardPage");
const CardsPage = lazyNamed(() => import("./pages/CardsPage"), "CardsPage");
const CommunityPage = lazyNamed(() => import("./pages/CommunityPage"), "CommunityPage");
const DecksPage = lazyNamed(() => import("./pages/DecksPage"), "DecksPage");
const DeckViewPage = lazyNamed(() => import("./pages/DeckViewPage"), "DeckViewPage");
const EventDetailPage = lazyNamed(() => import("./pages/EventDetailPage"), "EventDetailPage");
const EventsPage = lazyNamed(() => import("./pages/EventsPage"), "EventsPage");
const FeedbackPage = lazyNamed(() => import("./pages/FeedbackPage"), "FeedbackPage");
const ImportExportPage = lazyNamed(() => import("./pages/ImportExportPage"), "ImportExportPage");
const LoginPage = lazyNamed(() => import("./pages/LoginPage"), "LoginPage");
const LogoutPage = lazyNamed(() => import("./pages/LogoutPage"), "LogoutPage");
const MetaPage = lazyNamed(() => import("./pages/MetaPage"), "MetaPage");
const PlayersPage = lazyNamed(() => import("./pages/PlayersPage"), "PlayersPage");
const PreviewsPage = lazyNamed(() => import("./pages/PreviewsPage"), "PreviewsPage");
const PricesPage = lazyNamed(() => import("./pages/PricesPage"), "PricesPage");
const ProfilePage = lazyNamed(() => import("./pages/ProfilePage"), "ProfilePage");
const RegisterPage = lazyNamed(() => import("./pages/RegisterPage"), "RegisterPage");
const SettingsPage = lazyNamed(() => import("./pages/SettingsPage"), "SettingsPage");
const ScheduleManagerPage = lazyNamed(() => import("./pages/ScheduleManagerPage"), "ScheduleManagerPage");
const SynergyMapPage = lazyNamed(() => import("./pages/SynergyMapPage"), "SynergyMapPage");
const SynergyPage = lazyNamed(() => import("./pages/SynergyPage"), "SynergyPage");
const VenuesPage = lazyNamed(() => import("./pages/VenuesPage"), "VenuesPage");

const REACT_STATE_KEY = "gundam-card-hub-react-state";
const LEGACY_STATE_KEY = "gundam-card-hub-state";
const THEME_STATE_KEY = "gundam-tactical-theme-id";
const META_SCOPE_STATE_KEY = "tcgtd-meta-scope-id";
const PRIVATE_VIEWS = new Set(["builder", "profile", "accountSettings", "scheduleManager"]);
const LIGHTWEIGHT_VIEWS = new Set(["home", "about", "legal", "terms", "privacy", "feedback", "login", "register", "logout", "authCallback"]);
const TACTICAL_VIEWS = new Set([
  "cards", "card", "synergy", "synergyMap", "decks", "builder", "deckView", "importExport",
  "meta", "prices", "community", "events", "eventDetail", "players", "venues", "scheduleManager", "previews",
  "profile", "accountSettings", "settings",
]);

export function App() {
  const { locale } = useLocale();
  const [data, setData] = useState(null);
  const [bootReady, setBootReady] = useState(false);
  const [dataScope, setDataScope] = useState("boot");
  const initialRoute = parseRoute();
  const [view, setViewState] = useState(initialRoute.view);
  const [routeId, setRouteId] = useState(initialRoute.id);
  const [themeId, setThemeId] = useState(getInitialThemeId);
  const [selectedMetaId, setSelectedMetaId] = useState(getInitialMetaScopeId);
  const [pendingForgeImport, setPendingForgeImport] = useState(null);
  const [pendingForgePreset, setPendingForgePreset] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [userState, setUserState] = usePersistentState(REACT_STATE_KEY, createInitialUserState(), normalizeUserState);

  const theme = THEME_CONFIG[themeId] || THEME_CONFIG["wing-zero"];
  const metaWindows = useMemo(
    () => !data ? [] : (data.metaWindows?.length ? data.metaWindows : buildMetaWindows(data)),
    [data],
  );
  const selectedMetaWindow = metaWindows.find((window) => window.id === selectedMetaId) || metaWindows[0];
  const currentUser = getCurrentUser(userState);
  const activeDeck = userState.decks.find((deck) => deck.id === userState.activeDeckId) || userState.decks[0] || createSavedDeck(currentUser?.id || "local-user");

  useEffect(() => {
    let isMounted = true;
    const initialNeedsFullData = !LIGHTWEIGHT_VIEWS.has(initialRoute.view);
    const loader = initialNeedsFullData ? loadGundamData : loadHomeData;
    loader().then((payload) => {
      if (isMounted) {
        setData(payload);
        setDataScope(initialNeedsFullData ? "full" : "home");
        setBootReady(true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!bootReady || dataScope !== "home" || LIGHTWEIGHT_VIEWS.has(view)) return undefined;
    let isMounted = true;
    loadGundamData().then((payload) => {
      if (!isMounted) return;
      setData(payload);
      setDataScope("full");
    });
    return () => {
      isMounted = false;
    };
  }, [bootReady, dataScope, view]);

  useEffect(() => {
    let isMounted = true;
    hydrateAuthSession(userState).then((nextState) => {
      if (isMounted) setUserState(nextState);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme.id;
    document.body.dataset.view = view;
    applyThemeVariables(theme);
    writeThemeStorage(theme.id);
  }, [theme.id, view]);

  useEffect(() => {
    if (!metaWindows.length) return;
    if (!metaWindows.some((window) => window.id === selectedMetaId)) {
      setSelectedMetaId(metaWindows[0].id);
      return;
    }
    writeMetaScopeStorage(selectedMetaId);
  }, [metaWindows, selectedMetaId]);

  useEffect(() => {
    function syncRoute() {
      const next = parseRoute();
      setViewState(next.view);
      setRouteId(next.id);
    }
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  const mergedFilters = useMemo(() => filters, [filters]);

  function setFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function setDeck(nextDeck) {
    setUserState((current) => updateSavedDeck(current, current.activeDeckId || activeDeck.id, (deck) => normalizeDeck(typeof nextDeck === "function" ? nextDeck(deck) : nextDeck)));
  }

  function setGlobalSearch(value) {
    setFilters((current) => ({ ...current, search: value }));
    if (value && view === "home") {
      setView("cards");
    }
  }

  function setView(nextView, id = "") {
    const nextRoute = routeFor(nextView, id);
    window.history.pushState({}, "", nextRoute);
    setViewState(nextView);
    setRouteId(id);
  }

  function handlePlatformSignIn() {
    if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      setView("login");
      return;
    }
    window.location.href = `/signin-with-chatgpt?return_to=${encodeURIComponent(routeFor(view, routeId))}`;
  }

  async function handleLogin(form) {
    const nextState = await loginUser(userState, form);
    setUserState(nextState);
    setView("profile");
  }

  async function handleCreateAccount(form) {
    const nextState = await createUserAccount(userState, form);
    setUserState(nextState);
    setView("profile");
  }

  async function handleLogout() {
    const hostedPlatformSession = currentUser?.provider === "chatgpt"
      && !["localhost", "127.0.0.1"].includes(window.location.hostname);
    const nextState = await logoutUser(userState);
    setUserState(nextState);
    if (hostedPlatformSession) {
      window.location.href = "/signout-with-chatgpt?return_to=/";
    }
  }

  async function handleRefreshSession() {
    const nextState = await hydrateAuthSession(userState);
    setUserState(nextState);
  }

  async function handleUpdateProfile(userId, patch) {
    const nextState = await updateUserProfileRemote(userState, userId, patch);
    setUserState(nextState);
  }

  function createDeck() {
    const ownerId = currentUser?.id || "local-user";
    const deck = createSavedDeck(ownerId, { name: "New tactical deck" });
    setUserState((current) => ({ ...current, decks: [deck, ...current.decks], activeDeckId: deck.id }));
    setView("builder");
  }

  function saveDesignedDeck(report) {
    const ownerId = currentUser?.id || "local-user";
    const firstCompetitiveSource = (report.sources || []).find((source) => source.classification === "competitive_result")
      || report.sources?.[0];
    const deck = createSavedDeck(ownerId, {
      name: report.sourceDeck
        ? `${report.title || report.criteria?.archetype || "Competitive deck"} · ${report.sourceDeck.playerName} ${report.sourceDeck.placingLabel || ""}`.trim()
        : report.title || `${report.criteria?.archetype || "AI"} recommendation`,
      visibility: "private",
      archetype: report.criteria?.archetype || "",
      colors: report.criteria?.colors || [],
      format: report.importedDeck
        ? "MSA import / analyzed"
        : report.assemblyMode === "zero_forge"
          ? "ZERO Forge / Current"
          : "AI Designer / Current",
      notes: [
        report.strategy,
        ...(report.limitations || []).map((limitation) => `Limitation: ${limitation}`),
      ].filter(Boolean).join("\n"),
      sourceName: report.importedDeck
        ? "MSA pasted decklist · Deck Designer analysis"
        : report.assemblyMode === "zero_forge"
          ? "ZERO Forge · pilot-authored assisted deck"
          : report.sourceDeck?.sourceName || "AI Deck Designer · normalized evidence",
      sourceUrl: report.sourceDeck?.deckUrl || firstCompetitiveSource?.url || "",
      externalId: report.importedDeck
        ? `msa-import:${report.generatedAt || new Date().toISOString()}`
        : report.assemblyMode === "zero_forge"
          ? `zero-forge:${report.generatedAt || new Date().toISOString()}`
          : report.sourceDeck?.deckId
            ? `designer-source:${report.sourceDeck.deckId}`
              : `designer:${report.generatedAt || new Date().toISOString()}`,
      selectedMetaId: report.selectedMetaId || report.criteria?.selectedMetaId || "current",
      sourceTournamentDeckId: report.sourceTournamentDeckId || report.sourceMetadata?.sourceTournamentDeckId || "",
      sourceMetadata: report.sourceMetadata || null,
      parentDeckId: report.sourceTournamentDeckId || "",
      lastCompetitiveScore: report.lastCompetitiveScore,
      changeHistory: report.changeHistory || [],
      banlistVersion: report.banlistVersion || report.legality?.rulesEffectiveDate || "",
      designerReport: compactDeckDesign(report),
      main: report.main || {},
      resource: report.resource || {},
    });
    setUserState((current) => ({
      ...current,
      decks: [deck, ...(current.decks || [])],
      activeDeckId: deck.id,
    }));
    return deck;
  }

  function importExternalDecks(externalDecks = []) {
    const ownerId = currentUser?.id || "local-user";
    const importedDecks = externalDecks
      .map((externalDeck) => {
        const parsed = parseDeckList([
          externalDeck.decklistContent || "",
          externalDeck.sideDeckContent ? `RESOURCE\n${externalDeck.sideDeckContent}` : "",
        ].filter(Boolean).join("\n"));
        const deck = createSavedDeck(ownerId, {
          name: externalDeck.name || "Imported ExBurst deck",
          visibility: "private",
          archetype: externalDeck.archetype || externalDeck.superArchetype || "",
          colors: normalizeImportedColors(externalDeck.colors),
          format: "ExBurst import",
          notes: [
            "Imported from ExBurst profile.",
            externalDeck.owner?.username ? `Owner: ${externalDeck.owner.username}.` : "",
            externalDeck.modifiedDate ? `ExBurst modified: ${externalDeck.modifiedDate}.` : "",
          ].filter(Boolean).join(" "),
          sourceName: "ExBurst",
          sourceUrl: externalDeck.sourceUrl || "",
          externalId: externalDeck.id ? `exburst:${externalDeck.id}` : "",
          main: parsed.main,
          resource: parsed.resource,
        });
        return { ...deck, id: `deck-exburst-${externalDeck.id || Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
      })
      .filter((deck) => Object.keys(deck.main || {}).length);

    if (!importedDecks.length) return { imported: 0 };

    setUserState((current) => ({
      ...current,
      decks: [...importedDecks, ...current.decks],
      activeDeckId: importedDecks[0].id,
      auditLogs: [
        ...(current.auditLogs || []),
        {
          id: `audit-${Date.now().toString(36)}`,
          type: "decks.import.exburst",
          createdAt: new Date().toISOString(),
          message: `${importedDecks.length} ExBurst deck(s) imported.`,
        },
      ],
    }));
    return { imported: importedDecks.length };
  }

  function editDeck(deckId) {
    setUserState((current) => ({ ...current, activeDeckId: deckId }));
    setView("builder");
  }

  function sendTournamentDeckToForge(result, selectedMetaId = "current") {
    const draft = createForgeImportFromResult(data, result, selectedMetaId);
    if (!Object.keys(draft.main || {}).length) return;
    setPendingForgeImport(draft);
    setView("decks");
  }

  function openArchetypeInForge(signal) {
    setPendingForgePreset({
      key: `${signal.selectedMetaId || "current"}:${signal.archetype}:${Date.now()}`,
      archetype: signal.archetype || "",
      colors: String(signal.commonColorCombination || "")
        .split(/[+/]/)
        .map((value) => value.trim())
        .filter(Boolean),
      selectedMetaId: signal.selectedMetaId || "current",
      metaLabel: signal.metaLabel || "Current field",
    });
    setView("decks");
  }

  function addCardToActiveDeck(card) {
    const max = getCardCopyLimit(card, data.rules);
    const cardMap = new Map((data.cards || []).map((item) => [item.cardNumber, item]));
    setDeck((current) =>
      canAddCardToMain(current.main, card, cardMap, data.rules)
        ? changeDeckQuantity(current, "main", card.cardNumber, 1, max)
        : current);
  }

  if (!data || !bootReady) {
    return <TacticalBootScreen theme={theme} />;
  }

  const isPrivateView = PRIVATE_VIEWS.has(view);
  const shouldGatePrivate = isPrivateView && !currentUser;
  const routeLoading = !LIGHTWEIGHT_VIEWS.has(view) && dataScope !== "full";
  const hasTacticalRail = TACTICAL_VIEWS.has(view) && !shouldGatePrivate;

  return (
    <div className={`app-shell react-shell ${hasTacticalRail ? "has-tactical-rail" : ""}`} data-locale={locale}>
      <SiteHeader
        view={view}
        theme={theme}
        themeOptions={Object.values(THEME_CONFIG)}
        onThemeChange={setThemeId}
        user={currentUser}
        data={data}
        metaWindows={metaWindows}
        selectedMetaId={selectedMetaWindow?.id || selectedMetaId}
        onMetaChange={setSelectedMetaId}
        onViewChange={setView}
        onSignIn={handlePlatformSignIn}
        search={filters.search}
        onSearchChange={setGlobalSearch}
      />
      {hasTacticalRail ? (
        <TacticalSideRail
          view={view}
          activeFormat={selectedMetaWindow?.shortLabel || data.activeFormat || "CURRENT"}
          onViewChange={setView}
        />
      ) : null}
      <main>
        <Suspense fallback={<div className="route-loading">ACQUIRING SUBSYSTEM…</div>}>
        {routeLoading ? <div className="route-loading">LOADING TACTICAL DATA…</div> : null}
        {["about", "legal", "terms", "privacy"].includes(view) ? <InstitutionalPage kind={view} onNavigate={setView} /> : null}
        {view === "feedback" ? <FeedbackPage user={currentUser} onNavigate={setView} /> : null}
        {view === "login" ? <LoginPage onLogin={handleLogin} onSocialLogin={startSocialLogin} onRegister={() => setView("register")} onPlatformLogin={handlePlatformSignIn} /> : null}
        {view === "register" ? <RegisterPage onCreateAccount={handleCreateAccount} onSocialLogin={startSocialLogin} onLogin={() => setView("login")} onPlatformLogin={handlePlatformSignIn} /> : null}
        {view === "logout" ? <LogoutPage onLogout={handleLogout} onDone={() => setView("home")} /> : null}
        {view === "authCallback" ? <AuthCallbackPage onRefreshSession={handleRefreshSession} onDone={() => setView("profile")} /> : null}
        {!routeLoading ? <>
        {shouldGatePrivate ? <LoginPage message="Login required for this cockpit section." onLogin={handleLogin} onSocialLogin={startSocialLogin} onRegister={() => setView("register")} onPlatformLogin={handlePlatformSignIn} /> : null}
        {!shouldGatePrivate && view === "home" ? (
          <HomePage
            data={data}
            theme={theme}
            selectedMetaId={selectedMetaWindow?.id || selectedMetaId}
            filters={mergedFilters}
            setFilter={setFilter}
            resetFilters={() => setFilters({ ...DEFAULT_FILTERS })}
            setView={setView}
          />
        ) : null}
        {!shouldGatePrivate && view === "cards" ? (
          <CardsPage
            data={data}
            filters={mergedFilters}
            setFilter={setFilter}
            onOpenCard={(cardNumber) => setView("card", cardNumber)}
            onOpenSynergy={(cardNumber) => setView("synergy", cardNumber)}
            onOpenSynergyMap={(cardNumber) => setView("synergyMap", cardNumber)}
          />
        ) : null}
        {!shouldGatePrivate && view === "card" ? (
          <CardPage
            data={data}
            cardId={routeId}
            onBack={() => setView("cards")}
            onOpenCard={(cardNumber) => setView("card", cardNumber)}
            onOpenSynergy={(cardNumber) => setView("synergy", cardNumber)}
            onOpenSynergyMap={(cardNumber) => setView("synergyMap", cardNumber)}
          />
        ) : null}
        {!shouldGatePrivate && view === "synergy" ? (
          <SynergyPage
            data={data}
            cardId={routeId}
            onBack={() => setView("card", routeId)}
            onOpenCard={(cardNumber) => setView("card", cardNumber)}
            onOpenMap={(cardNumber) => setView("synergyMap", cardNumber)}
            onAddToDeck={currentUser ? addCardToActiveDeck : undefined}
          />
        ) : null}
        {!shouldGatePrivate && view === "synergyMap" ? (
          <SynergyMapPage
            data={data}
            cardId={routeId}
            onBack={() => setView("card", routeId)}
            onOpenCard={(cardNumber) => setView("card", cardNumber)}
            onOpenSynergy={(cardNumber) => setView("synergy", cardNumber)}
          />
        ) : null}
        {!shouldGatePrivate && view === "decks" ? (
          <DecksPage
            data={data}
            user={currentUser}
            decks={userState.decks}
            onCreateDeck={createDeck}
            onDuplicateDeck={(deckId) => setUserState((current) => duplicateDeck(current, deckId, currentUser?.id || "local-user"))}
            onDeleteDeck={(deckId) => setUserState((current) => deleteDeck(current, deckId))}
            onOpenDeck={(deckId) => setView("deckView", deckId)}
            onEditDeck={editDeck}
            onImportExternalDecks={importExternalDecks}
            onSaveRecommendation={saveDesignedDeck}
            initialForgeImport={pendingForgeImport}
            onForgeImportConsumed={() => setPendingForgeImport(null)}
            initialDesignerCriteria={pendingForgePreset}
            onDesignerCriteriaConsumed={() => setPendingForgePreset(null)}
            selectedMetaId={selectedMetaWindow?.id || selectedMetaId}
            onMetaChange={setSelectedMetaId}
          />
        ) : null}
        {!shouldGatePrivate && view === "builder" ? (
          <BuilderPage
            data={data}
            deck={activeDeck}
            setDeck={setDeck}
            onOpenSynergy={(cardNumber) => setView("synergy", cardNumber)}
          />
        ) : null}
        {!shouldGatePrivate && view === "deckView" ? (
          <DeckViewPage
            data={data}
            deckId={routeId}
            decks={userState.decks}
            onEditDeck={editDeck}
            onSendToForge={sendTournamentDeckToForge}
          />
        ) : null}
        {!shouldGatePrivate && view === "prices" ? <PricesPage data={data} /> : null}
        {!shouldGatePrivate && view === "meta" ? <MetaPage data={data} selectedMetaId={selectedMetaWindow?.id || selectedMetaId} onMetaChange={setSelectedMetaId} onOpenForge={openArchetypeInForge} /> : null}
        {!shouldGatePrivate && view === "community" ? (
          <CommunityPage
            data={data}
            onNavigate={setView}
            onOpenEvent={(eventId) => setView("eventDetail", eventId)}
          />
        ) : null}
        {!shouldGatePrivate && view === "events" ? (
          <EventsPage
            data={data}
            onNavigate={setView}
            onOpenEvent={(eventId) => setView("eventDetail", eventId)}
          />
        ) : null}
        {!shouldGatePrivate && view === "players" ? <PlayersPage data={data} onNavigate={setView} /> : null}
        {!shouldGatePrivate && view === "venues" ? <VenuesPage data={data} onNavigate={setView} /> : null}
        {!shouldGatePrivate && view === "scheduleManager" ? <ScheduleManagerPage onNavigate={setView} /> : null}
        {!shouldGatePrivate && view === "eventDetail" ? (
          <EventDetailPage
            data={data}
            eventId={routeId}
            onBack={() => setView("events")}
            onOpenDeck={(deckId) => setView("deckView", deckId)}
            onSendToForge={sendTournamentDeckToForge}
          />
        ) : null}
        {!shouldGatePrivate && view === "previews" ? <PreviewsPage data={data} /> : null}
        {!shouldGatePrivate && view === "profile" ? (
          <ProfilePage
            user={currentUser}
            decks={userState.decks}
            onLogout={async () => {
              await handleLogout();
              setView("home");
            }}
            onAccountSettings={() => setView("accountSettings")}
            onLogin={() => setView("login")}
          />
        ) : null}
        {!shouldGatePrivate && view === "accountSettings" ? (
          <AccountSettingsPage
            user={currentUser}
            onUpdateProfile={handleUpdateProfile}
            onChangePassword={changePassword}
            onRequestPasswordReset={requestPasswordReset}
            onLogout={async () => {
              await handleLogout();
              setView("home");
            }}
          />
        ) : null}
        {!shouldGatePrivate && view === "settings" ? <SettingsPage theme={theme} data={data} /> : null}
        {!shouldGatePrivate && view === "importExport" ? <ImportExportPage data={data} deck={activeDeck} /> : null}
        </> : null}
        </Suspense>
      </main>
      <SiteFooter onViewChange={setView} />
    </div>
  );
}

function lazyNamed(loader, name) {
  return lazy(() => loader().then((module) => ({ default: module[name] })));
}

function createInitialUserState() {
  const legacy = readJsonStorage(LEGACY_STATE_KEY);
  return createDefaultUserState(legacy);
}

function normalizeUserState(value = {}) {
  if (!Array.isArray(value.decks) && value.deck) {
    value = createDefaultUserState(value);
  }
  return normalizePlatformState(value);
}

function readJsonStorage(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function buildIncomingMessage(data) {
  if (!data) return { cards: [], packageCode: "", packageLabel: "" };
  const cardMap = new Map([...(data.cards || []), ...(data.resourceCards || [])].map((card) => [normalizePackageCode(card.cardNumber), card]));
  const previewSignals = (data.previews || [])
    .filter(isPostGd04Signal)
    .filter((preview) => preview.imageUrl || preview.cardNumberHint || preview.cardNameHint)
    .sort((left, right) => previewSortValue(right) - previewSortValue(left));
  const latestCards = previewSignals
    .map((preview) => buildIncomingPreviewCard(preview, cardMap))
    .filter(Boolean)
    .filter(dedupeBy((card) => card.displayId || card.previewId || card.cardNumber))
    .slice(0, 5);
  const packageCode = latestCards[0]?.packageCodes?.[0] || normalizePackageCode(previewSignals[0]?.productCode);
  const packageLabel = latestCards[0]?.packageLabels?.[0] || previewSignals[0]?.productName || packageCode;
  return { cards: latestCards, packageCode, packageLabel, previewCount: previewSignals.length, generatedAt: data.generatedAt };
}

function normalizePackageCode(value) {
  return String(value || "").trim().toUpperCase();
}

const GD04_RELEASE_TIME = parseLooseDate("April 24, 2026");

function isPostGd04Signal(item) {
  const code = normalizePackageCode(item?.productCode || item?.packageCode || item?.cardNumberHint);
  const releaseTime = parseLooseDate(item?.releaseDate || item?.productReleaseDate);
  if (Number.isFinite(releaseTime) && releaseTime > GD04_RELEASE_TIME) return true;

  const codeMatch = code.match(/^([A-Z]+)(\d+)/);
  if (!codeMatch) return false;
  const [, prefix, numberText] = codeMatch;
  const number = Number(numberText || 0);
  if (prefix === "GD") return number > 4;
  if (prefix === "ST") return number >= 10;
  return ["EB", "SC", "PC", "EVX"].includes(prefix);
}

function parseLooseDate(value) {
  const text = String(value || "").replace(/,/g, ", ").replace(/\s+/g, " ").trim();
  const match = text.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (!match) return Number.NaN;
  return new Date(`${match[1]} ${match[2]}, ${match[3]}`).getTime();
}

function previewSortValue(preview) {
  const sourceTime = parseLooseDate(preview.sourceDate);
  const releaseTime = parseLooseDate(preview.productReleaseDate);
  if (Number.isFinite(sourceTime)) return sourceTime;
  if (Number.isFinite(releaseTime)) return releaseTime;
  return 0;
}

function buildIncomingPreviewCard(preview, cardMap) {
  const cardNumber = normalizePackageCode(preview.cardNumberHint);
  const matchedCard = cardNumber ? cardMap.get(cardNumber) : null;
  if (matchedCard) {
    return {
      ...matchedCard,
      displayId: preview.previewId || matchedCard.cardNumber,
      previewId: preview.previewId,
      imageUrl: preview.imageUrl || matchedCard.imageUrl,
      packageCodes: [normalizePackageCode(preview.productCode), ...(matchedCard.packageCodes || [])].filter(Boolean),
      packageLabels: [preview.productName, ...(matchedCard.packageLabels || [])].filter(Boolean),
    };
  }

  const productCode = normalizePackageCode(preview.productCode);
  return {
    displayId: preview.previewId || cardNumber || productCode || preview.imageUrl,
    previewId: preview.previewId,
    cardNumber: cardNumber || productCode || "PREVIEW",
    cardName: preview.cardNameHint || preview.sectionHeading || preview.sourceTitle || "Official preview",
    cardType: "OFFICIAL PREVIEW",
    rarity: preview.previewStatus === "preview_only" ? "Preview" : "Linked",
    color: productCode || "Preview Radar",
    imageUrl: preview.imageUrl,
    remoteImageUrl: preview.imageUrl,
    packageCodes: [productCode].filter(Boolean),
    packageLabels: [preview.productName || productCode].filter(Boolean),
    whereToGetIt: preview.sourceTitle || preview.productName || "",
  };
}

function dedupeBy(selector) {
  const seen = new Set();
  return (item) => {
    const key = selector(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  };
}

function IncomingMessageOverlay({ message, onClose, onOpenCards }) {
  const featured = message.cards.slice(0, 3);
  const packageCode = message.packageCode || featured[0]?.packageCodes?.[0] || "DB";

  return (
    <div className="incoming-message-overlay" role="dialog" aria-modal="true" aria-label="Incoming card database transmission">
      <button type="button" className="incoming-message-overlay__backdrop" aria-label="Close incoming transmission" onClick={onClose} />
      <article className="incoming-message-overlay__panel">
        <div className="incoming-message-overlay__scan" aria-hidden="true" />
        <div className="incoming-message-overlay__topbar">
          <span className="eyebrow">Incoming Message</span>
          <span className="incoming-message-overlay__signal" data-no-translate>
            {packageCode} / {String(message.cards.length).padStart(2, "0")} SYNC
          </span>
          <button type="button" className="incoming-message-overlay__close" aria-label="Close incoming transmission" onClick={onClose}>Close</button>
        </div>

        <div className="incoming-message-overlay__body">
          <section className="incoming-message-overlay__header">
          <h2>New card data synchronized</h2>
          <p>
            Latest preview signal: <strong>{message.packageLabel || message.packageCode || "Unknown package"}</strong>
            {message.previewCount ? ` / ${message.previewCount} future official preview signal(s)` : ""}
          </p>
            <div className="incoming-message-overlay__list">
              {message.cards.map((card, index) => (
                <span key={`list-${card.displayId || card.previewId || card.cardNumber}`}>
                  <i data-no-translate>{String(index + 1).padStart(2, "0")}</i>
                  <b>{card.cardNumber}</b>
                  <strong>{card.cardName}</strong>
                  <em>{card.cardType} / {card.rarity}</em>
                </span>
              ))}
            </div>
          </section>

          <div className="incoming-message-overlay__cards">
            <div className="incoming-message-overlay__card-grid">
              {featured.map((card, index) => (
                <div key={card.displayId || card.previewId || card.cardNumber} className={`incoming-message-overlay__card incoming-message-overlay__card--${index + 1}`}>
                  <img src={card.imageUrl || card.remoteImageUrl} alt="" className="art-frame incoming-message-overlay__art" />
                  <span>{card.cardNumber}</span>
                  <strong>{card.cardName}</strong>
                  <em>{card.rarity || "Unknown rarity"} / {card.color || "No color"}</em>
                </div>
              ))}
            </div>
            <div className="incoming-message-overlay__rail" aria-hidden="true">
              <i />
              <span data-no-translate>{String(featured.length).padStart(2, "0")} / {String(message.cards.length).padStart(2, "0")}</span>
            </div>
          </div>
        </div>

        <div className="incoming-message-overlay__actions">
          <button type="button" className="incoming-message-overlay__secondary" onClick={onClose}>Continue to cockpit</button>
          <button type="button" className="incoming-message-overlay__primary" onClick={onOpenCards}>Open preview radar</button>
        </div>
      </article>
    </div>
  );
}

function getInitialThemeId() {
  try {
    const stored = localStorage.getItem(THEME_STATE_KEY);
    if (stored && THEME_CONFIG[stored]) return stored;
  } catch {
    // Keep boot resilient if storage is blocked.
  }
  return document.body.dataset.theme && THEME_CONFIG[document.body.dataset.theme]
    ? document.body.dataset.theme
    : "wing-zero";
}

function writeThemeStorage(themeId) {
  try {
    localStorage.setItem(THEME_STATE_KEY, themeId);
  } catch {
    // Non-critical: the cockpit still works without persistent storage.
  }
}

function getInitialMetaScopeId() {
  try {
    return localStorage.getItem(META_SCOPE_STATE_KEY) || "current";
  } catch {
    return "current";
  }
}

function writeMetaScopeStorage(metaScopeId) {
  try {
    localStorage.setItem(META_SCOPE_STATE_KEY, metaScopeId);
  } catch {
    // Non-critical: the default current field remains available.
  }
}

function applyThemeVariables(theme) {
  const palette = theme.palette || {};
  const primary = palette.primary || "#00e5ff";
  const secondary = palette.secondary || "#69caff";
  const accentRgb = palette.accentRgb || "0, 229, 255";
  const canvas = palette.canvas || "#01040b";
  const background = palette.background || "#030815";
  const panel = palette.panel || "rgba(2, 14, 31, 0.88)";
  const glow = palette.glow || `rgba(${accentRgb}, 0.38)`;
  const variables = {
    "--hud-primary": primary,
    "--hud-secondary": secondary,
    "--hud-accent-rgb": accentRgb,
    "--hud-cyan": primary,
    "--hud-violet": secondary,
    "--hud-bg": background,
    "--hud-bg-deep": canvas,
    "--hud-canvas": canvas,
    "--hud-panel": panel,
    "--hud-glow": glow,
    "--hud-border": `rgba(${accentRgb}, 0.42)`,
    "--hud-border-hot": `rgba(${accentRgb}, 0.84)`,
    "--hud-line": `rgba(${accentRgb}, 0.2)`,
    "--hud-line-hot": `rgba(${accentRgb}, 0.72)`,
    "--hud-dim": `rgba(${accentRgb}, 0.24)`,
    "--system-canvas": canvas,
    "--system-plane": panel,
    "--system-plane-strong": panel,
    "--system-focus": primary,
    "--system-line": `rgba(${accentRgb}, 0.18)`,
    "--system-line-strong": `rgba(${accentRgb}, 0.5)`,
    "--launch-cyan": primary,
    "--launch-cyan-soft": `rgba(${accentRgb}, 0.14)`,
    "--launch-violet": secondary,
    "--launch-ink": canvas,
    "--launch-panel": panel,
    "--launch-border": `rgba(${accentRgb}, 0.24)`,
    "--gundam-wallpaper": `url("${theme.gundamImage}")`,
    "--cockpit-space-extension": `url("${theme.backdropImage || theme.gundamImage}")`,
    "--subpage-gundam-bg": `url("${theme.gundamImage}")`,
    "--subpage-gundam-position": theme.backgroundPosition || "76% 12%",
    "--subpage-gundam-size": theme.backgroundSize || "min(1180px, 96vw) auto",
  };

  for (const [name, value] of Object.entries(variables)) {
    document.body.style.setProperty(name, value);
  }
}

function TacticalBootScreen({ theme }) {
  return (
    <section className="tactical-boot-screen" aria-live="polite" aria-busy="true">
      <div className="tactical-boot-screen__grid" aria-hidden="true" />
      <div className="tactical-boot-screen__core">
        <span className="tactical-boot-screen__ring tactical-boot-screen__ring--outer" />
        <span className="tactical-boot-screen__ring tactical-boot-screen__ring--inner" />
        <span className="tactical-boot-screen__pulse" />
        <span className="tcgtd-insignia" aria-hidden="true"><img src="/assets/brand/tcgtd-orbital-mark-v2.png" alt="" /></span>
      </div>
      <div className="tactical-boot-screen__copy">
        <span>TCG TACTICAL NETWORK // ONLINE</span>
        <h1>Synchronizing tactical database</h1>
        <p>Loading cards, market signals, deck telemetry, and meta feeds.</p>
        <div className="tactical-boot-screen__bar"><i /></div>
        <ul>
          <li>Card archive link established</li>
          <li>Meta signal buffer warming</li>
          <li>Active game module restored</li>
        </ul>
      </div>
    </section>
  );
}
