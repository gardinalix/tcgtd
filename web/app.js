(function () {
  const DATA = window.GUNDAM_DECK_BUILDER_DATA;
  if (!DATA) {
    throw new Error("Gundam web data was not loaded.");
  }

  const STORAGE_KEY = "gundam-card-hub-state";
  const HASH_VIEW_KEY = "view";
  const HASH_DECK_KEY = "deck";

  const CLASSIFICATIONS = [
    { value: "not-classified", labelPt: "Não classificada", labelEn: "Not classified", tone: "muted" },
    { value: "staple", labelPt: "Staple", labelEn: "Staple", tone: "gold" },
    { value: "meta-relevant", labelPt: "Meta relevante", labelEn: "Meta relevant", tone: "blue" },
    { value: "sideboard-meta-call", labelPt: "Side/meta call", labelEn: "Side/meta call", tone: "purple" },
    { value: "useful-low-cost", labelPt: "Low cost útil", labelEn: "Useful low cost", tone: "green" },
    { value: "bulk", labelPt: "Bulk", labelEn: "Bulk", tone: "muted" },
    { value: "collectible", labelPt: "Colecionável", labelEn: "Collectible", tone: "gold" },
    { value: "store-promo", labelPt: "Promo de loja", labelEn: "Store promo", tone: "red" },
    { value: "event-promo", labelPt: "Promo de evento", labelEn: "Event promo", tone: "red" },
    { value: "alt-art", labelPt: "Alt Art", labelEn: "Alt Art", tone: "purple" },
    { value: "keep-playset", labelPt: "Manter playset", labelEn: "Keep playset", tone: "green" },
    { value: "sell-trade", labelPt: "Vender/trocar", labelEn: "Sell/trade", tone: "red" },
    { value: "hold-value", labelPt: "Aguardar valorização", labelEn: "Hold value", tone: "gold" },
  ];

  const STATUS_OPTIONS = [
    { value: "", labelPt: "Sem status", labelEn: "No status" },
    { value: "binder", labelPt: "Binder", labelEn: "Binder" },
    { value: "deck", labelPt: "Deck", labelEn: "Deck" },
    { value: "sale", labelPt: "Venda", labelEn: "Sale" },
    { value: "trade", labelPt: "Trade", labelEn: "Trade" },
    { value: "bulk", labelPt: "Bulk", labelEn: "Bulk" },
  ];

  const EVAL_OPTIONS = [
    { value: "", labelPt: "Não avaliada", labelEn: "Not rated" },
    { value: "high", labelPt: "Alta", labelEn: "High" },
    { value: "medium", labelPt: "Média", labelEn: "Medium" },
    { value: "low", labelPt: "Baixa", labelEn: "Low" },
  ];

  const SOURCE_OPTIONS = [
    { value: "Any", labelPt: "Qualquer", labelEn: "Any" },
    { value: "booster", labelPt: "Booster", labelEn: "Booster" },
    { value: "store", labelPt: "Store", labelEn: "Store" },
    { value: "winner", labelPt: "Winner", labelEn: "Winner" },
    { value: "participant", labelPt: "Participant", labelEn: "Participant" },
    { value: "event", labelPt: "Event", labelEn: "Event" },
  ];

  const SORT_OPTIONS = [
    { value: "recent-meta", labelPt: "Meta recente", labelEn: "Recent meta" },
    { value: "overall-meta", labelPt: "Meta geral", labelEn: "Overall meta" },
    { value: "price-high", labelPt: "Maior preço", labelEn: "Highest price" },
    { value: "price-low", labelPt: "Menor preço", labelEn: "Lowest price" },
    { value: "cost", labelPt: "Custo", labelEn: "Cost" },
    { value: "level", labelPt: "Nível", labelEn: "Level" },
    { value: "number", labelPt: "Código", labelEn: "Number" },
    { value: "alpha", labelPt: "Nome", labelEn: "Name" },
    { value: "advisor", labelPt: "Advisor", labelEn: "Advisor" },
  ];

  const BOOL_OPTIONS = [
    { value: "Any", labelPt: "Qualquer", labelEn: "Any" },
    { value: "yes", labelPt: "Sim", labelEn: "Yes" },
    { value: "no", labelPt: "Não", labelEn: "No" },
  ];

  const THEME_CONFIG = {
    "wing-zero": {
      label: "WING ZERO",
      enabled: true,
      title: "Wing Zero",
      stateLabel: "Zero Mode",
      mode: "ZERO SYSTEM / ANALYSIS MODE",
      unitId: "XXXG-00W0",
      pilot: "Heero Yuy",
      pilotCandidates: ["Heero Yuy"],
      operation: "Zero System",
      description: "Advanced neural interface connected. Analyzing combat, collection, price, and meta variables to generate tactical predictions.",
      standby: "ZERO SYSTEM :: standby",
      processing: "ZERO SYSTEM :: analyzing tactical data...",
      applied: "ZERO SYSTEM :: optimized result",
      selected: "ZERO SYSTEM :: unit identified",
      reset: "ZERO SYSTEM :: parameters reset",
      faction: { id: "oz-zero", label: "OZ + ZERO SYSTEM", logo: "/assets/factions/oz-zero.svg" },
    },
    epyon: {
      label: "EPYON",
      enabled: true,
      title: "Epyon",
      stateLabel: "Epyon Mode",
      mode: "EPYON SYSTEM / COMBAT MODE",
      unitId: "OZ-13MS",
      pilot: "Zechs Merquise",
      pilotCandidates: ["Zechs Merquise", "Milliardo Peacecraft"],
      operation: "Combat prediction",
      description: "Aggressive system at maximum pressure. Prioritizing combat reads, immediate threats, and real-time tactical advantage.",
      standby: "EPYON SYSTEM :: awaiting combat",
      processing: "EPYON SYSTEM :: combat pressure rising...",
      applied: "EPYON SYSTEM :: target locked",
      selected: "EPYON SYSTEM :: unit marked",
      reset: "EPYON SYSTEM :: system reset",
      faction: { id: "oz-dark", label: "OZ DARK MODE", logo: "/assets/factions/oz-dark.svg" },
    },
    unicorn: {
      label: "UNICORN",
      enabled: true,
      title: "Unicorn",
      stateLabel: "NT-D Mode",
      mode: "UNICORN / PSYCHO-FRAME MODE",
      unitId: "RX-0",
      pilot: "Banagher Links",
      pilotCandidates: ["Banagher Links"],
      operation: "Psycho-frame analysis",
      description: "Psycho-frame active. Cross-reading collection, synergy, and market signals with luminous priority analysis.",
      standby: "UNICORN :: psycho-frame on standby",
      processing: "UNICORN :: expanding analysis field...",
      applied: "UNICORN :: possibility confirmed",
      selected: "UNICORN :: resonance identified",
      reset: "UNICORN :: reading reset",
      faction: { id: "vist-londo", label: "VIST / LONDO BELL", logo: "/assets/factions/vist-londo.svg" },
    },
    barbatos: {
      label: "BARBATOS",
      enabled: true,
      title: "Barbatos",
      stateLabel: "Alaya-Vijnana",
      mode: "BARBATOS / IRON-BLOODED MODE",
      unitId: "ASW-G-08",
      pilot: "Mikazuki Augus",
      pilotCandidates: ["Mikazuki Augus"],
      operation: "Close-range assessment",
      description: "Direct, brutal, efficient interface. Reducing glow and focusing on cost, immediate impact, and field decisions.",
      standby: "BARBATOS :: engine idle",
      processing: "BARBATOS :: analyzing direct impact...",
      applied: "BARBATOS :: attack route set",
      selected: "BARBATOS :: target marked",
      reset: "BARBATOS :: parameters recalibrated",
      faction: { id: "tekkadan", label: "TEKKADAN", logo: "/assets/factions/tekkadan.svg" },
    },
    kshatriya: {
      label: "KSHATRIYA",
      enabled: true,
      title: "Kshatriya",
      stateLabel: "Quad Wing",
      mode: "KSHATRIYA / FUNNEL CONTROL MODE",
      unitId: "NZ-666",
      pilot: "Marida Cruz",
      pilotCandidates: ["Marida Cruz"],
      operation: "Funnel perimeter",
      description: "Massive perimeter-read presence. Monitoring multiple meta, collection, and price vectors simultaneously.",
      standby: "KSHATRIYA :: funnels in orbit",
      processing: "KSHATRIYA :: perimeter scan...",
      applied: "KSHATRIYA :: field controlled",
      selected: "KSHATRIYA :: vector isolated",
      reset: "KSHATRIYA :: perimeter reset",
      faction: { id: "neo-zeon", label: "NEO ZEON / SLEEVES", logo: "/assets/factions/neo-zeon.svg" },
    },
    gquuuuuux: {
      label: "GQUUUUUUX",
      enabled: true,
      title: "GQuuuuuuX",
      stateLabel: "Omega Psycho Link",
      mode: "GQUUUUUUX / MAVERICK MODE",
      unitId: "gMS-Ω",
      pilot: "Amate Yuzuriha",
      pilotCandidates: ["Amate Yuzuriha", "Machu"],
      operation: "Clan battle analysis",
      description: "GQuuuuuuX signal synchronized. Cross-reading irregular piloting, field pressure, and aggression routes for advantage analysis.",
      standby: "GQUUUUUUX :: channel synchronized",
      processing: "GQUUUUUUX :: recalculating trajectory...",
      applied: "GQUUUUUUX :: attack line validated",
      selected: "GQUUUUUUX :: pilot synchronized",
      reset: "GQUUUUUUX :: channel reset",
      faction: { id: "prototype", label: "EXPERIMENTAL / PROTOTYPE", logo: "/assets/factions/prototype.svg" },
    },
    aile: {
      label: "AILE STRIKE",
      enabled: true,
      title: "Aile Strike",
      stateLabel: "Seed Mode",
      mode: "AILE STRIKE / SEED MODE",
      unitId: "GAT-X105",
      pilot: "Kira Yamato",
      pilotCandidates: ["Kira Yamato"],
      operation: "High-mobility assessment",
      description: "Aile pack synchronized. Prioritizing mobility, consistent pressure, and attack-line reads for tactical decisions.",
      standby: "AILE STRIKE :: pack active",
      processing: "AILE STRIKE :: recalculating vector...",
      applied: "AILE STRIKE :: route confirmed",
      selected: "AILE STRIKE :: pilot synchronized",
      reset: "AILE STRIKE :: parameters reset",
      faction: { id: "omni", label: "OMNI ENFORCER", logo: "/assets/factions/omni.svg" },
    },
  };

  const I18N = {
    "pt-BR": {
      brand: { eyebrow: "TCG", title: "Tactical Database" },
      header: { searchLabel: "Busca global" },
      nav: {
        cards: "Cartas",
        builder: "Decks",
        collection: "Coleção",
        classification: "Classificação",
        prices: "Preços",
        importExport: "Importar/Exportar",
      },
      placeholder: {
        globalSearch: "Nome, código, set, texto, trait...",
        cardSearch: "Ex: blocker, draw, Amuro...",
      },
      text: {
        cardsFound: "cartas encontradas",
        cardsAvailable: "cartas disponíveis",
        noMatches: "Nenhuma carta bate com os filtros atuais.",
        noCard: "Selecione uma carta para ver detalhes.",
        noText: "Nenhum texto registrado.",
        noPrice: "Sem preço",
        copied: "Copiado para a área de transferência.",
        imported: "Coleção importada.",
        downloaded: "Arquivo exportado.",
        filtered: "Cartas filtradas",
        all: "Todas",
        any: "Qualquer",
        none: "Nenhum",
        unknown: "Desconhecido",
        resource: "Resource",
        main: "Main",
        yes: "Sim",
        no: "Não",
      },
      button: {
        resetFilters: "Limpar filtros",
        loadCore: "Core",
        loadSupport: "Core + suporte",
        loadShell: "Substituir shell",
        copyShare: "Copiar link",
        copyMsa: "Copiar MSA",
        copyZumbo: "Copiar ZumboSim/TTS",
        downloadJson: "Baixar JSON",
        clearDeck: "Limpar deck",
        importCsv: "Importar CSV",
        exportCollection: "Coleção CSV",
        exportFiltered: "Cartas filtradas CSV",
        exportPlayset: "Manter playset CSV",
        exportSell: "Vender/trocar CSV",
        copyPlainList: "Copiar lista 4xGD01-086",
      },
    },
    en: {
      brand: { eyebrow: "TCG", title: "Tactical Database" },
      header: { searchLabel: "Global search" },
      nav: {
        cards: "Cards",
        builder: "Decks",
        collection: "Collection",
        classification: "Classification",
        prices: "Prices",
        importExport: "Import/Export",
      },
      placeholder: {
        globalSearch: "Name, number, set, text, trait...",
        cardSearch: "Ex: blocker, draw, Amuro...",
      },
      text: {
        cardsFound: "cards found",
        cardsAvailable: "cards available",
        noMatches: "No cards match the current filters.",
        noCard: "Select a card to see details.",
        noText: "No text recorded.",
        noPrice: "No price",
        copied: "Copied to clipboard.",
        imported: "Collection imported.",
        downloaded: "File exported.",
        filtered: "Filtered cards",
        all: "All",
        any: "Any",
        none: "None",
        unknown: "Unknown",
        resource: "Resource",
        main: "Main",
        yes: "Yes",
        no: "No",
      },
      button: {
        resetFilters: "Reset filters",
        loadCore: "Core",
        loadSupport: "Core + support",
        loadShell: "Replace shell",
        copyShare: "Copy link",
        copyMsa: "Copy MSA",
        copyZumbo: "Copy ZumboSim/TTS",
        downloadJson: "Download JSON",
        clearDeck: "Clear deck",
        importCsv: "Import CSV",
        exportCollection: "Collection CSV",
        exportFiltered: "Filtered cards CSV",
        exportPlayset: "Keep playset CSV",
        exportSell: "Sell/trade CSV",
        copyPlainList: "Copy 4xGD01-086 list",
      },
    },
  };

  const RULES = DATA.rules || {};
  const MAIN_CARDS = (DATA.cards || []).map((card) => sanitizeCard(card, "main"));
  const RESOURCE_CARDS = (DATA.resourceCards || []).map((card) => sanitizeCard(card, "resource"));
  const LIBRARY_CARDS = MAIN_CARDS.concat(RESOURCE_CARDS);
  const ARCHETYPES = (DATA.archetypes || []).map(sanitizeArchetype);
  const TEMPLATES = (DATA.templates || []).map(sanitizeTemplateRow);
  const PREVIEWS = (DATA.previews || []).map(sanitizePreview);
  const RESTRICTIONS = new Map((RULES.currentRestrictions || []).map((row) => [normalize(row.cardNumber).toUpperCase(), row]));

  const mainByNumber = new Map(MAIN_CARDS.map((card) => [card.cardNumber, card]));
  const resourceByNumber = new Map(RESOURCE_CARDS.map((card) => [card.cardNumber, card]));
  const libraryByNumber = new Map(LIBRARY_CARDS.map((card) => [card.cardNumber, card]));
  const templateRowsByArchetype = groupBy(TEMPLATES, (row) => row.archetype);

  const state = normalizeState(createInitialState());
  const elements = cacheElements();

  initialize();

  function initialize() {
    populateControls();
    syncControls();
    attachEvents();
    applyTranslations();
    renderAll();
  }

  function cacheElements() {
    return {
      root: document.documentElement,
      body: document.body,
      viewPanels: Array.from(document.querySelectorAll("[data-view-panel]")),
      viewButtons: Array.from(document.querySelectorAll("[data-view-button]")),
      themeWingZeroBtn: document.getElementById("theme-wing-zero-btn"),
      themeEpyonBtn: document.getElementById("theme-epyon-btn"),
      cockpitThemeSelect: document.getElementById("cockpit-theme-select"),
      cockpitStatus: document.getElementById("cockpit-status"),
      commandFeedback: document.getElementById("command-feedback"),
      globalSearch: document.getElementById("global-search-input"),
      filterPanel: document.getElementById("card-filter-panel"),

      heroFeature: document.getElementById("hero-feature"),
      dashboardCards: document.getElementById("dashboard-cards"),
      dashboardColors: document.getElementById("dashboard-colors"),
      dashboardRarities: document.getElementById("dashboard-rarities"),
      dashboardSets: document.getElementById("dashboard-sets"),
      dashboardLatest: document.getElementById("dashboard-latest"),
      dashboardRatingCard: document.getElementById("dashboard-rating-card"),
      dashboardFoundCount: document.getElementById("dashboard-found-count"),
      dashboardClassificationQuick: document.getElementById("dashboard-classification-quick"),
      dashboardCollectionRadar: document.getElementById("dashboard-collection-radar"),
      dashboardSystemFeed: document.getElementById("dashboard-system-feed"),
      cockpitFilterColor: document.getElementById("cockpit-filter-color"),
      cockpitFilterType: document.getElementById("cockpit-filter-type"),
      cockpitFilterRarity: document.getElementById("cockpit-filter-rarity"),
      cockpitFilterCost: document.getElementById("cockpit-filter-cost"),
      cockpitFilterTrait: document.getElementById("cockpit-filter-trait"),
      cockpitModeSubtitle: document.getElementById("cockpit-mode-subtitle"),
      cockpitModeName: document.getElementById("cockpit-mode-name"),
      cockpitModeState: document.getElementById("cockpit-mode-state"),
      cockpitModeCopy: document.getElementById("cockpit-mode-copy"),
      factionCore: document.querySelector("[data-faction-core]"),
      cockpitFactionLogo: document.getElementById("cockpit-faction-logo"),
      cockpitUnitId: document.getElementById("cockpit-unit-id"),
      cockpitPilot: document.getElementById("cockpit-pilot"),
      cockpitOperation: document.getElementById("cockpit-operation"),
      cockpitDialLabel: document.getElementById("cockpit-dial-label"),
      topbarPilotLabel: document.getElementById("topbar-pilot-label"),

      browseSearch: document.getElementById("browse-search-input"),
      filterCode: document.getElementById("filter-code"),
      browsePool: document.getElementById("browse-pool"),
      filterSet: document.getElementById("filter-set"),
      browseColor: document.getElementById("browse-color"),
      browseType: document.getElementById("browse-type"),
      filterRarity: document.getElementById("filter-rarity"),
      filterCost: document.getElementById("filter-cost"),
      filterLevel: document.getElementById("filter-level"),
      filterTrait: document.getElementById("filter-trait"),
      filterStatus: document.getElementById("filter-status"),
      filterClassification: document.getElementById("filter-classification"),
      filterPlayset: document.getElementById("filter-playset"),
      filterVanilla: document.getElementById("filter-vanilla"),
      filterPromo: document.getElementById("filter-promo"),
      filterSource: document.getElementById("filter-source"),
      filterAltArt: document.getElementById("filter-alt-art"),
      browseTag: document.getElementById("browse-tag"),
      browseSort: document.getElementById("browse-sort"),
      resetFiltersBtn: document.getElementById("reset-filters-btn"),
      browseResultsCount: document.getElementById("browse-results-count"),
      browseResultsCaption: document.getElementById("browse-results-caption"),
      browseResultsMeta: document.getElementById("browse-results-meta"),
      browseCardGrid: document.getElementById("browse-card-grid"),
      browsePagination: document.getElementById("browse-pagination"),
      cardDetail: document.getElementById("card-detail"),

      primaryColor: document.getElementById("input-primary-color"),
      secondaryColor: document.getElementById("input-secondary-color"),
      archetypeKeyword: document.getElementById("input-archetype-keyword"),
      traitKeyword: document.getElementById("input-trait-keyword"),
      synergyTag: document.getElementById("input-synergy-tag"),
      preferredType: document.getElementById("input-preferred-type"),
      metaWeight: document.getElementById("input-meta-weight"),
      synergyWeight: document.getElementById("input-synergy-weight"),
      metaWeightValue: document.getElementById("meta-weight-value"),
      synergyWeightValue: document.getElementById("synergy-weight-value"),
      templateArchetype: document.getElementById("template-archetype-select"),
      templatePreview: document.getElementById("template-preview"),
      ruleList: document.getElementById("rule-list"),
      deckName: document.getElementById("deck-name"),
      libraryMode: document.getElementById("library-mode"),
      searchInput: document.getElementById("search-input"),
      filterColor: document.getElementById("filter-color"),
      filterType: document.getElementById("filter-type"),
      filterTag: document.getElementById("filter-tag"),
      sortMode: document.getElementById("sort-mode"),
      archetypeSuggestions: document.getElementById("archetype-suggestions"),
      resultsCount: document.getElementById("results-count"),
      resultsCaption: document.getElementById("results-caption"),
      resultsMeta: document.getElementById("results-meta"),
      cardGrid: document.getElementById("card-grid"),
      deckPreview: document.getElementById("deck-preview"),
      deckSummary: document.getElementById("deck-summary"),
      deckIssues: document.getElementById("deck-issues"),
      mainDeckCount: document.getElementById("main-deck-count"),
      resourceDeckCount: document.getElementById("resource-deck-count"),
      mainDeckList: document.getElementById("main-deck-list"),
      resourceDeckList: document.getElementById("resource-deck-list"),

      collectionSummary: document.getElementById("collection-summary"),
      collectionTable: document.getElementById("collection-table"),
      classificationSummary: document.getElementById("classification-summary"),
      classificationTable: document.getElementById("classification-table"),
      pricesSummary: document.getElementById("prices-summary"),
      pricesTable: document.getElementById("prices-table"),

      importCsvInput: document.getElementById("import-csv-input"),
      importCsvText: document.getElementById("import-csv-text"),
      exportPreview: document.getElementById("export-preview"),
      toast: document.getElementById("toast"),
    };
  }

  function createInitialState() {
    const defaultLanguage = detectDefaultLanguage();
    const stored = loadStateFromStorage();
    const hash = decodeHashState();
    const defaults = DATA.defaults || {};
    const base = {
      deckName: getDefaultDeckName(defaultLanguage),
      ui: {
        view: "home",
        language: defaultLanguage,
        selectedCardNumber: LIBRARY_CARDS[0] ? LIBRARY_CARDS[0].cardNumber : "",
        theme: "wing-zero",
      },
      inputs: {
        primaryColor: defaults.primary_color || "Blue",
        secondaryColor: defaults.secondary_color || "Any",
        archetypeKeyword: defaults.archetype_keyword || "",
        traitKeyword: defaults.trait_keyword || "",
        synergyTag: defaults.synergy_tag || "Any",
        preferredType: defaults.preferred_card_type || "Any",
        metaWeight: Number(defaults.meta_weight || 60),
        synergyWeight: Number(defaults.synergy_weight || 40),
        templateArchetype: defaults.template_archetype || "Any",
      },
      filters: {
        browseSearch: "",
        browseCode: "",
        browsePool: "all",
        browseSet: "Any",
        browsePackageCode: "Any",
        browseColor: "Any",
        browseType: "Any",
        browseRarity: "Any",
        browseCost: "",
        browseLevel: "",
        browseTrait: "",
        browseStatus: "Any",
        browseClassification: "Any",
        browsePlayset: "Any",
        browseVanilla: "Any",
        browsePromo: "Any",
        browseSource: "Any",
        browseAltArt: "Any",
        browseMetaSignal: "Any",
        browseTag: "Any",
        browseSort: "recent-meta",
        browseViewMode: "grid",
        browsePage: 1,
        browsePageSize: 30,
        builderLibraryMode: "main",
        builderViewMode: "grid",
        builderSearch: "",
        builderColor: "Any",
        builderType: "Any",
        builderTag: "Any",
        builderSort: "advisor",
        deckViewMode: "compact",
      },
      table: {
        sort: "cardNumber",
        dir: "asc",
      },
      deck: {
        main: {},
        resource: {},
      },
      collection: {},
      ratings: {},
    };

    const merged = mergeDeep(base, stored || {});
    if (hash) {
      if (hash.view) {
        merged.ui.view = hash.view;
      }
      if (hash.deckName) {
        merged.deckName = hash.deckName;
      }
      if (hash.main || hash.resource) {
        merged.deck = {
          main: hash.main || {},
          resource: hash.resource || {},
        };
      }
    }
    return merged;
  }

  function normalizeState(input) {
    const output = mergeDeep({}, input || {});
    const viewSet = new Set(["home", "cards", "builder", "collection", "classification", "prices", "importExport"]);
    output.ui = output.ui || {};
    output.filters = output.filters || {};
    output.inputs = output.inputs || {};
    output.table = output.table || {};
    output.deck = output.deck || {};
    output.collection = output.collection || {};
    output.ratings = output.ratings || {};

    output.ui.language = "en";
    output.ui.view = viewSet.has(output.ui.view) ? output.ui.view : "home";
    output.ui.theme = isThemeEnabled(output.ui.theme) ? output.ui.theme : "wing-zero";
    output.ui.selectedCardNumber = libraryByNumber.has(output.ui.selectedCardNumber) ? output.ui.selectedCardNumber : LIBRARY_CARDS[0] ? LIBRARY_CARDS[0].cardNumber : "";
    output.deckName = output.deckName || getDefaultDeckName(output.ui.language);

    output.inputs.primaryColor = output.inputs.primaryColor || "Blue";
    output.inputs.secondaryColor = output.inputs.secondaryColor || "Any";
    output.inputs.synergyTag = output.inputs.synergyTag || "Any";
    output.inputs.preferredType = output.inputs.preferredType || "Any";
    output.inputs.templateArchetype = output.inputs.templateArchetype || "Any";
    output.inputs.metaWeight = clamp(Number(output.inputs.metaWeight || 60), 0, 100);
    output.inputs.synergyWeight = clamp(Number(output.inputs.synergyWeight || 40), 0, 100);

    output.filters.browsePool = ["all", "main", "resource"].includes(output.filters.browsePool) ? output.filters.browsePool : "all";
    output.filters.browsePackageCode = output.filters.browsePackageCode || "Any";
    output.filters.browseViewMode = ["grid", "table"].includes(output.filters.browseViewMode) ? output.filters.browseViewMode : "grid";
    output.filters.builderLibraryMode = output.filters.builderLibraryMode === "resource" ? "resource" : "main";
    output.filters.builderViewMode = ["grid", "list"].includes(output.filters.builderViewMode) ? output.filters.builderViewMode : "grid";
    output.filters.deckViewMode = ["compact", "visual"].includes(output.filters.deckViewMode) ? output.filters.deckViewMode : "compact";
    output.filters.browsePage = Math.max(1, Number(output.filters.browsePage || 1));
    output.filters.browsePageSize = Math.max(12, Number(output.filters.browsePageSize || 30));
    output.table.sort = output.table.sort || "cardNumber";
    output.table.dir = output.table.dir === "desc" ? "desc" : "asc";

    output.deck.main = compactSection(output.deck.main || {});
    output.deck.resource = compactSection(output.deck.resource || {});
    Object.keys(output.collection).forEach((cardNumber) => {
      if (!libraryByNumber.has(cardNumber)) {
        return;
      }
      output.collection[cardNumber] = normalizeCollectionRecord(output.collection[cardNumber]);
    });
    return output;
  }

  function populateControls() {
    const colors = uniqueValues(LIBRARY_CARDS, (card) => card.color);
    const types = uniqueValues(LIBRARY_CARDS, (card) => card.cardType);
    const rarities = uniqueValues(LIBRARY_CARDS, (card) => card.rarity);
    const sets = uniqueValues(LIBRARY_CARDS.flatMap((card) => card.packageCodes || []), (value) => value);
    const tags = uniqueValues(LIBRARY_CARDS.flatMap((card) => card.synergyTags || []), (value) => value);

    fillSelect(elements.browsePool, [
      { value: "all", label: label("text.all") },
      { value: "main", label: label("text.main") },
      { value: "resource", label: label("text.resource") },
    ]);
    fillSelect(elements.filterSet, optionList(["Any"].concat(sets)));
    fillSelect(elements.browseColor, optionList(["Any"].concat(colors)));
    fillSelect(elements.browseType, optionList(["Any"].concat(types)));
    fillSelect(elements.filterRarity, optionList(["Any"].concat(rarities)));
    fillSelect(elements.cockpitFilterColor, optionList(["Any"].concat(colors)));
    fillSelect(elements.cockpitFilterType, optionList(["Any"].concat(types)));
    fillSelect(elements.cockpitFilterRarity, optionList(["Any"].concat(rarities)));
    fillSelect(elements.filterStatus, translatedOptions([{ value: "Any", labelPt: "Qualquer", labelEn: "Any" }].concat(STATUS_OPTIONS)));
    fillSelect(elements.filterClassification, translatedOptions([{ value: "Any", labelPt: "Qualquer", labelEn: "Any" }].concat(CLASSIFICATIONS)));
    fillSelect(elements.filterPlayset, translatedOptions(BOOL_OPTIONS));
    fillSelect(elements.filterVanilla, translatedOptions(BOOL_OPTIONS));
    fillSelect(elements.filterPromo, translatedOptions(BOOL_OPTIONS));
    fillSelect(elements.filterSource, translatedOptions(SOURCE_OPTIONS));
    fillSelect(elements.filterAltArt, translatedOptions(BOOL_OPTIONS));
    fillSelect(elements.browseTag, optionList(["Any"].concat(tags)));
    fillSelect(elements.browseSort, translatedOptions(SORT_OPTIONS));

    fillSelect(elements.primaryColor, optionList(["Any"].concat(colors)));
    fillSelect(elements.secondaryColor, optionList(["Any"].concat(colors)));
    fillSelect(elements.synergyTag, optionList(["Any"].concat(tags)));
    fillSelect(elements.preferredType, optionList(["Any"].concat(types.filter((type) => type !== "RESOURCE"))));
    fillSelect(elements.templateArchetype, optionList(["Any"].concat(ARCHETYPES.map((row) => row.archetype))));
    fillSelect(elements.libraryMode, [
      { value: "main", label: label("text.main") },
      { value: "resource", label: label("text.resource") },
    ]);
    fillSelect(elements.filterColor, optionList(["Any"].concat(colors)));
    fillSelect(elements.filterType, optionList(["Any"].concat(types)));
    fillSelect(elements.filterTag, optionList(["Any"].concat(tags)));
    fillSelect(elements.sortMode, translatedOptions(SORT_OPTIONS));
  }

  function syncControls() {
    setValue(elements.globalSearch, state.filters.browseSearch);
    setValue(elements.browseSearch, state.filters.browseSearch);
    setValue(elements.filterCode, state.filters.browseCode);
    setValue(elements.browsePool, state.filters.browsePool);
    setValue(elements.filterSet, state.filters.browseSet);
    setValue(elements.browseColor, state.filters.browseColor);
    setValue(elements.browseType, state.filters.browseType);
    setValue(elements.filterRarity, state.filters.browseRarity);
    setValue(elements.cockpitFilterColor, state.filters.browseColor);
    setValue(elements.cockpitFilterType, state.filters.browseType);
    setValue(elements.cockpitFilterRarity, state.filters.browseRarity);
    setValue(elements.cockpitFilterCost, state.filters.browseCost);
    setValue(elements.cockpitFilterTrait, state.filters.browseTrait);
    setValue(elements.filterCost, state.filters.browseCost);
    setValue(elements.filterLevel, state.filters.browseLevel);
    setValue(elements.filterTrait, state.filters.browseTrait);
    setValue(elements.filterStatus, state.filters.browseStatus);
    setValue(elements.filterClassification, state.filters.browseClassification);
    setValue(elements.filterPlayset, state.filters.browsePlayset);
    setValue(elements.filterVanilla, state.filters.browseVanilla);
    setValue(elements.filterPromo, state.filters.browsePromo);
    setValue(elements.filterSource, state.filters.browseSource);
    setValue(elements.filterAltArt, state.filters.browseAltArt);
    setValue(elements.browseTag, state.filters.browseTag);
    setValue(elements.browseSort, state.filters.browseSort);
    setValue(elements.cockpitThemeSelect, state.ui.theme);

    setValue(elements.primaryColor, state.inputs.primaryColor);
    setValue(elements.secondaryColor, state.inputs.secondaryColor);
    setValue(elements.archetypeKeyword, state.inputs.archetypeKeyword);
    setValue(elements.traitKeyword, state.inputs.traitKeyword);
    setValue(elements.synergyTag, state.inputs.synergyTag);
    setValue(elements.preferredType, state.inputs.preferredType);
    setValue(elements.metaWeight, state.inputs.metaWeight);
    setValue(elements.synergyWeight, state.inputs.synergyWeight);
    setValue(elements.templateArchetype, state.inputs.templateArchetype);
    setValue(elements.deckName, state.deckName);
    setValue(elements.libraryMode, state.filters.builderLibraryMode);
    setValue(elements.searchInput, state.filters.builderSearch);
    setValue(elements.filterColor, state.filters.builderColor);
    setValue(elements.filterType, state.filters.builderType);
    setValue(elements.filterTag, state.filters.builderTag);
    setValue(elements.sortMode, state.filters.builderSort);
  }

  function attachEvents() {
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("change", handleDocumentChange);
    document.addEventListener("input", handleDocumentInput);

    bind(elements.globalSearch, "input", (event) => {
      state.filters.browseSearch = event.target.value;
      state.filters.browsePage = 1;
      state.ui.view = "cards";
      syncControls();
      persistState();
      tacticalPulse("processing");
      renderAll();
    });
    bind(elements.importCsvInput, "change", async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }
      elements.importCsvText.value = await file.text();
    });
  }

  function handleDocumentClick(event) {
    const templateFocus = event.target.closest("[data-template-focus]");
    if (templateFocus) {
      state.inputs.templateArchetype = templateFocus.dataset.templateFocus;
      state.inputs.archetypeKeyword = templateFocus.dataset.templateFocus;
      state.ui.view = "builder";
      persistState();
      renderAll();
      return;
    }

    const cardSelect = event.target.closest("[data-card-select]");
    if (cardSelect) {
      selectCard(cardSelect.dataset.cardSelect);
      return;
    }

    const previewLink = event.target.closest("[data-preview-link]");
    if (previewLink) {
      const url = previewLink.dataset.previewLink;
      if (url && window.open) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return;
    }

    const themeSelect = event.target.closest("[data-theme-select]");
    if (themeSelect) {
      setTheme(themeSelect.dataset.themeSelect);
      return;
    }

    const viewTarget = event.target.closest("[data-view-target]");
    if (viewTarget) {
      setView(viewTarget.dataset.viewTarget);
      return;
    }

    const mobileFilters = event.target.closest("[data-mobile-filters]");
    if (mobileFilters && elements.filterPanel) {
      elements.filterPanel.classList.toggle("is-open");
      return;
    }

    const layoutButton = event.target.closest("[data-layout-scope]");
    if (layoutButton) {
      setLayoutMode(layoutButton.dataset.layoutScope, layoutButton.dataset.layoutMode);
      return;
    }

    const addCard = event.target.closest("[data-add-card]");
    if (addCard) {
      addCardToDeck(addCard.dataset.section || "main", addCard.dataset.addCard);
      return;
    }

    const deckDelta = event.target.closest("[data-deck-delta]");
    if (deckDelta) {
      changeDeckQuantity(deckDelta.dataset.section, deckDelta.dataset.cardNumber, Number(deckDelta.dataset.deckDelta));
      return;
    }

    const tableSort = event.target.closest("[data-table-sort]");
    if (tableSort) {
      setTableSort(tableSort.dataset.tableSort);
      return;
    }

    const pageButton = event.target.closest("[data-page]");
    if (pageButton) {
      state.filters.browsePage = Number(pageButton.dataset.page);
      persistState();
      renderCardsView();
      return;
    }

    const shortcut = event.target.closest("[data-filter-shortcut]");
    if (shortcut) {
      applyFilterShortcut(shortcut.dataset.filterShortcut);
      return;
    }

    const packageFilter = event.target.closest("[data-package-filter]");
    if (packageFilter) {
      applyPackageFilter(packageFilter.dataset.packageFilter);
      return;
    }

    const resetBrowse = event.target.closest("[data-reset-browse-filters]");
    if (resetBrowse) {
      resetBrowseFilters();
      return;
    }

    if (event.target.id === "reset-filters-btn") {
      resetBrowseFilters();
      return;
    }

    if (event.target.id === "load-core-btn") {
      applyTemplate("core", false);
      return;
    }
    if (event.target.id === "load-support-btn") {
      applyTemplate("support", false);
      return;
    }
    if (event.target.id === "load-shell-btn") {
      applyTemplate("tech", true);
      return;
    }
    if (event.target.id === "copy-share-link-btn") {
      copyShareLink();
      return;
    }
    if (event.target.id === "copy-msa-text-btn") {
      copyText(buildMsaText());
      return;
    }
    if (event.target.id === "copy-egman-url-btn") {
      copyText(buildEgmanUrl() || buildPlainDeckList("main"));
      return;
    }
    if (event.target.id === "download-json-btn") {
      downloadText(`${slugify(state.deckName)}.json`, JSON.stringify(buildSimulatorJson(), null, 2), "application/json");
      return;
    }
    if (event.target.id === "clear-deck-btn") {
      state.deck = { main: {}, resource: {} };
      persistState();
      renderAll();
      return;
    }
    if (event.target.id === "import-csv-btn") {
      importCollectionCsv(elements.importCsvText.value || "");
      return;
    }
    if (event.target.id === "export-collection-csv-btn") {
      exportCollectionCsv("collection", getCardsWithCollectionData());
      return;
    }
    if (event.target.id === "export-filtered-csv-btn") {
      exportCollectionCsv("filtered-cards", getFilteredCards());
      return;
    }
    if (event.target.id === "export-playset-csv-btn") {
      exportCollectionCsv("keep-playset", LIBRARY_CARDS.filter((card) => getCollection(card.cardNumber).keepPlayset));
      return;
    }
    if (event.target.id === "export-sell-csv-btn") {
      exportCollectionCsv("sell-trade", LIBRARY_CARDS.filter((card) => getCollection(card.cardNumber).sellTrade || ["sale", "trade"].includes(getCollection(card.cardNumber).status)));
      return;
    }
    if (event.target.id === "copy-plain-list-btn") {
      const text = buildPlainDeckList("main") || buildPlainCollectionList(getCardsWithCollectionData());
      elements.exportPreview.value = text;
      copyText(text);
      return;
    }

    const ratingButton = event.target.closest("[data-rating-value]");
    if (ratingButton) {
      rateCard(ratingButton.dataset.ratingKey, Number(ratingButton.dataset.ratingValue));
      return;
    }

    if (event.target.closest("[data-random-rating-card]")) {
      state.ui.ratingCardKey = pickRandomRatingKey(state.ui.ratingCardKey);
      persistState();
      renderDashboard();
      return;
    }
  }

  function handleDocumentInput(event) {
    const target = event.target;
    if (!target) {
      return;
    }

    const browseMap = {
      "browse-search-input": "browseSearch",
      "filter-code": "browseCode",
      "filter-cost": "browseCost",
      "filter-level": "browseLevel",
      "filter-trait": "browseTrait",
      "cockpit-filter-cost": "browseCost",
      "cockpit-filter-trait": "browseTrait",
    };
    if (browseMap[target.id]) {
      state.filters[browseMap[target.id]] = target.value;
      if (target.id === "browse-search-input") {
        setValue(elements.globalSearch, target.value);
      }
      state.filters.browsePage = 1;
      persistState();
      tacticalPulse("processing");
      syncControls();
      renderDashboard();
      renderCardsView();
      return;
    }

    if (target.id === "cockpit-theme-select") {
      setTheme(target.value);
      return;
    }

    const builderMap = {
      "input-archetype-keyword": ["inputs", "archetypeKeyword"],
      "input-trait-keyword": ["inputs", "traitKeyword"],
      "input-meta-weight": ["inputs", "metaWeight"],
      "input-synergy-weight": ["inputs", "synergyWeight"],
      "deck-name": ["deckName"],
      "search-input": ["filters", "builderSearch"],
    };
    if (builderMap[target.id]) {
      assignStatePath(builderMap[target.id], target.type === "range" ? Number(target.value) : target.value);
      persistState();
      tacticalPulse("processing");
      renderBuilderView();
      return;
    }

    const collectionField = target.closest("[data-collection-field]");
    if (collectionField) {
      updateCollectionFromInput(collectionField, false);
    }
  }

  function handleDocumentChange(event) {
    const target = event.target;
    if (!target) {
      return;
    }

    const browseMap = {
      "browse-pool": "browsePool",
      "filter-set": "browseSet",
      "browse-color": "browseColor",
      "browse-type": "browseType",
      "filter-rarity": "browseRarity",
      "cockpit-filter-color": "browseColor",
      "cockpit-filter-type": "browseType",
      "cockpit-filter-rarity": "browseRarity",
      "filter-status": "browseStatus",
      "filter-classification": "browseClassification",
      "filter-playset": "browsePlayset",
      "filter-vanilla": "browseVanilla",
      "filter-promo": "browsePromo",
      "filter-source": "browseSource",
      "filter-alt-art": "browseAltArt",
      "browse-tag": "browseTag",
      "browse-sort": "browseSort",
    };
    if (browseMap[target.id]) {
      state.filters[browseMap[target.id]] = target.value;
      state.filters.browsePage = 1;
      persistState();
      tacticalPulse("applied");
      syncControls();
      renderDashboard();
      renderCardsView();
      return;
    }

    const builderMap = {
      "input-primary-color": ["inputs", "primaryColor"],
      "input-secondary-color": ["inputs", "secondaryColor"],
      "input-synergy-tag": ["inputs", "synergyTag"],
      "input-preferred-type": ["inputs", "preferredType"],
      "template-archetype-select": ["inputs", "templateArchetype"],
      "library-mode": ["filters", "builderLibraryMode"],
      "filter-color": ["filters", "builderColor"],
      "filter-type": ["filters", "builderType"],
      "filter-tag": ["filters", "builderTag"],
      "sort-mode": ["filters", "builderSort"],
    };
    if (builderMap[target.id]) {
      assignStatePath(builderMap[target.id], target.value);
      persistState();
      tacticalPulse("applied");
      renderBuilderView();
      return;
    }

    const collectionField = target.closest("[data-collection-field]");
    if (collectionField) {
      updateCollectionFromInput(collectionField, true);
    }
  }

  function renderAll() {
    applyTheme();
    applyTranslations();
    syncControls();
    renderNavigation();
    renderCurrentView();
  }

  function renderCurrentView() {
    if (state.ui.view === "home") {
      renderDashboard();
    } else if (state.ui.view === "cards") {
      renderCardsView();
    } else if (state.ui.view === "builder") {
      renderBuilderView();
    } else if (state.ui.view === "collection") {
      renderCollectionView();
    } else if (state.ui.view === "classification") {
      renderClassificationView();
    } else if (state.ui.view === "prices") {
      renderPricesView();
    } else if (state.ui.view === "importExport") {
      renderImportExportView();
    }
  }

  function renderNavigation() {
    if (elements.body) {
      elements.body.dataset.view = state.ui.view;
    }
    elements.viewPanels.forEach((panel) => {
      panel.hidden = panel.dataset.viewPanel !== state.ui.view;
    });
    elements.viewButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.viewButton === state.ui.view);
    });
    if (elements.themeWingZeroBtn) {
      elements.themeWingZeroBtn.classList.toggle("is-active", state.ui.theme === "wing-zero");
    }
    if (elements.themeEpyonBtn) {
      elements.themeEpyonBtn.classList.toggle("is-active", state.ui.theme === "epyon");
    }
    document.querySelectorAll("[data-theme-select]").forEach((button) => {
      const theme = button.dataset.themeSelect;
      const enabled = isThemeEnabled(theme);
      button.classList.toggle("is-active", theme === state.ui.theme);
      button.classList.toggle("is-disabled", !enabled);
      button.disabled = !enabled;
      button.setAttribute("aria-disabled", enabled ? "false" : "true");
      if (!enabled) {
        button.title = "Image not yet available for this cockpit.";
      } else {
        button.removeAttribute("title");
      }
    });
    syncLayoutButtons("browse", state.filters.browseViewMode);
    syncLayoutButtons("builder", state.filters.builderViewMode);
    syncLayoutButtons("deck", state.filters.deckViewMode);
  }

  function renderDashboard() {
    const tacticalCards = getFilteredCards();
    const signals = countMetaSignals(LIBRARY_CARDS);
    const keepPlayset = LIBRARY_CARDS.filter((card) => getCollection(card.cardNumber).keepPlayset).length;
    const sellTrade = LIBRARY_CARDS.filter((card) => getCollection(card.cardNumber).sellTrade || ["sale", "trade"].includes(getCollection(card.cardNumber).status)).length;
    const unclassified = LIBRARY_CARDS.filter((card) => getCollection(card.cardNumber).classification === "not-classified").length;
    const topCard = getThemePilotCard();

    if (elements.dashboardFoundCount) {
      elements.dashboardFoundCount.textContent = String(tacticalCards.length);
    }

    elements.dashboardCards.innerHTML = renderPackageBreakdownPanel(tacticalCards);

    elements.heroFeature.innerHTML = topCard
      ? `
        <article class="feature-card cockpit-feature-card" data-card-select="${escapeAttribute(topCard.cardNumber)}">
          <span class="cockpit-feature-card__halo" aria-hidden="true"></span>
          <div class="cockpit-feature-card__art">${artFrameMarkup(topCard, "art-frame art-frame--detail")}</div>
          <div class="cockpit-feature-card__body">
            <span class="eyebrow">Synchronized pilot</span>
            <h2>${escapeHtml(topCard.cardName)}</h2>
            <p>${escapeHtml(topCard.displayCardNumber || topCard.cardNumber)} / ${escapeHtml(topCard.color)} / ${escapeHtml(topCard.cardType)}</p>
            <div class="badge-row">
              ${badgeMarkup("Theme " + (THEME_CONFIG[state.ui.theme]?.gundamName || "active"), "blue")}
              ${priceBadgeMarkup(topCard)}
            </div>
          </div>
        </article>
      `
      : emptyState("No cards loaded.");

    elements.dashboardColors.innerHTML = renderLatestSetPanel();
    elements.dashboardRarities.innerHTML = renderMetaSignalPanel();
    elements.dashboardSets.innerHTML = renderMarketWatchPanel();
    elements.dashboardLatest.innerHTML = getDashboardLatestEntries().slice(0, 10).map(renderMiniCard).join("");
    elements.dashboardRatingCard.innerHTML = renderRatingSpotlight();
    if (elements.dashboardClassificationQuick) {
      elements.dashboardClassificationQuick.innerHTML = renderClassificationQuickPanel(signals, keepPlayset, sellTrade, unclassified);
    }
    if (elements.dashboardCollectionRadar) {
      elements.dashboardCollectionRadar.innerHTML = renderCollectionRadarPanel();
    }
  }

  function renderLatestSetPanel() {
    const latestSetCode = getLatestBoosterSetCode();
    const latestCards = latestSetCode ? LIBRARY_CARDS.filter((card) => (card.packageCodes || []).includes(latestSetCode)) : [];
    const previews = PREVIEWS.filter((preview) => preview.previewStatus === "preview_only");
    const priced = latestCards.filter((card) => Number.isFinite(card.marketPriceUsd)).length;
    const keep = latestCards.filter((card) => getMetaSignal(card).value === "keep").length;
    const sample = latestCards.find((card) => card.imageUrl) || getDashboardLatestEntries().find((card) => card.imageUrl);

    return `
      <div class="action-panel action-panel--media">
        <div class="action-panel__lead">
          <strong>${escapeHtml(latestSetCode || "No set")}</strong>
          <span>${latestCards.length} cards in latest booster</span>
          <small>Newest booster in the database.</small>
        </div>
        ${sample ? `<div class="action-panel__thumb">${artFrameMarkup(sample, "art-frame art-frame--mini")}</div>` : ""}
        <div class="compact-metrics">
          ${compactMetric("Previews", previews.length)}
          ${compactMetric("Priced", priced)}
          ${compactMetric("KEEP", keep)}
        </div>
        <button type="button" data-filter-shortcut="latest-set">View ${escapeHtml(latestSetCode || "latest set")}</button>
      </div>
    `;
  }

  function renderMetaSignalPanel() {
    const counts = countMetaSignals(LIBRARY_CARDS);
    return `
      <div class="action-panel">
        <div class="signal-stack">
          ${signalSummaryRow("keep", "KEEP", counts.keep)}
          ${signalSummaryRow("watch", "WATCH", counts.watch)}
          ${signalSummaryRow("bulk", "BULK", counts.bulk)}
        </div>
        <div class="signal-wave" aria-hidden="true">
          <span style="height:32%"></span><span style="height:54%"></span><span style="height:44%"></span><span style="height:72%"></span><span style="height:58%"></span><span style="height:86%"></span><span style="height:66%"></span>
        </div>
        <div class="button-row">
          <button type="button" data-filter-shortcut="keep">View KEEP</button>
          <button type="button" class="button-secondary" data-filter-shortcut="watch">View WATCH</button>
          <button type="button" class="button-secondary" data-filter-shortcut="bulk">View BULK</button>
        </div>
      </div>
    `;
  }

  function renderMarketWatchPanel() {
    const priced = LIBRARY_CARDS.filter((card) => Number.isFinite(card.marketPriceUsd));
    const missing = LIBRARY_CARDS.length - priced.length;
    const top = priced.slice().sort((left, right) => Number(right.marketPriceUsd || 0) - Number(left.marketPriceUsd || 0))[0];

    return `
      <div class="action-panel">
        <span class="price-radar-viz" aria-hidden="true"></span>
        <div class="action-panel__lead">
          <strong>${top ? escapeHtml(formatBrl(top.marketPriceBrlX5)) : "-"}</strong>
          <span>${top ? escapeHtml(`${top.cardNumber} ${top.cardName}`) : "No prices loaded"}</span>
        </div>
        <div class="compact-metrics">
          ${compactMetric("Priced", priced.length)}
          ${compactMetric("Missing price", missing)}
          ${compactMetric("USD", top && Number.isFinite(top.marketPriceUsd) ? formatUsd(top.marketPriceUsd) : "-")}
        </div>
        <div class="button-row">
          <button type="button" data-filter-shortcut="price-high">Top prices</button>
          <button type="button" class="button-secondary" data-view-target="prices">Open prices</button>
        </div>
      </div>
    `;
  }

  function compactMetric(labelText, value) {
    return `
      <span class="compact-metric">
        <small>${escapeHtml(labelText)}</small>
        <strong>${escapeHtml(String(value))}</strong>
      </span>
    `;
  }

  function signalSummaryRow(signal, labelText, count) {
    return `
      <button type="button" class="signal-summary signal-summary--${escapeAttribute(signal)}" data-filter-shortcut="${escapeAttribute(signal)}">
        <span>${escapeHtml(labelText)}</span>
        <strong>${count}</strong>
      </button>
    `;
  }

  function countMetaSignals(cards) {
    return cards.reduce(
      (counts, card) => {
        const signal = getMetaSignal(card).value;
        counts[signal] = (counts[signal] || 0) + 1;
        return counts;
      },
      { keep: 0, watch: 0, bulk: 0 },
    );
  }

  function renderClassificationQuickPanel(signals, keepPlayset, sellTrade, unclassified) {
    const classificationCount = (value) =>
      LIBRARY_CARDS.filter((card) => getCollection(card.cardNumber).classification === value).length;
    const staple = LIBRARY_CARDS.filter((card) => {
      const record = getCollection(card.cardNumber);
      return record.classification === "staple" || Number(card.recentMetaScore || 0) >= 35;
    }).length;
    const lowCostUseful = LIBRARY_CARDS.filter((card) => {
      const record = getCollection(card.cardNumber);
      return record.classification === "useful-low-cost" || record.lowCost || (numericValue(card.cost) <= 2 && card.librarySection !== "resource");
    }).length;
    const rows = [
      ["STAPLE", staple],
      ["META RELEVANT", classificationCount("meta-relevant") || signals.keep],
      ["SIDEBOARD / META CALL", classificationCount("sideboard-meta-call")],
      ["USEFUL LOW COST", lowCostUseful],
      ["BULK", classificationCount("bulk") || signals.bulk],
      ["COLLECTIBLE", classificationCount("collectible")],
      ["KEEP PLAYSET", keepPlayset],
      ["SELL / TRADE", sellTrade],
      ["NOT CLASSIFIED", unclassified],
    ];
    return `
      <div class="cockpit-list">
        ${rows.map(([name, count]) => cockpitListRow(name, count)).join("")}
      </div>
    `;
  }

  function renderCollectionRadarPanel() {
    const rows = getCardsWithCollectionData();
    const totalQuantity = rows.reduce((sum, card) => sum + Number(getCollection(card.cardNumber).quantity || 0), 0);
    const statusCounts = rows.reduce(
      (counts, card) => {
        const record = getCollection(card.cardNumber);
        const status = record.status || "sem-status";
        counts[status] = (counts[status] || 0) + Number(record.quantity || 0);
        return counts;
      },
      {},
    );
    return `
      <div class="collection-radar">
        <span class="collection-radar__dial" aria-hidden="true"></span>
        <div>
          <strong>${formatNumber(totalQuantity)}</strong>
          <span>cards</span>
        </div>
      </div>
      <div class="cockpit-list">
        ${cockpitListRow("Binder", statusCounts.binder || 0)}
        ${cockpitListRow("Deck", statusCounts.deck || 0)}
        ${cockpitListRow("Sell / trade", Number(statusCounts.sale || 0) + Number(statusCounts.trade || 0))}
        ${cockpitListRow("Bulk", statusCounts.bulk || 0)}
      </div>
    `;
  }

  function cockpitListRow(name, count) {
    return `
      <span class="cockpit-list-row">
        <small>${escapeHtml(name)}</small>
        <strong>${escapeHtml(String(count))}</strong>
      </span>
    `;
  }

  function renderCardsView() {
    const cards = getFilteredCards();
    const selectedExists = cards.some((card) => card.cardNumber === state.ui.selectedCardNumber);
    if (!selectedExists && cards[0]) {
      state.ui.selectedCardNumber = cards[0].cardNumber;
    }

    elements.browseResultsCount.textContent = String(cards.length);
    elements.browseResultsCaption.textContent = label("text.cardsFound");
    elements.browseResultsMeta.textContent = cards.length ? `Avg meta ${formatNumber(average(cards, (card) => card.recentMetaScore))}` : "";
    elements.browseCardGrid.classList.toggle("card-grid--list", state.filters.browseViewMode === "table");
    syncLayoutButtons("browse", state.filters.browseViewMode);

    if (!cards.length) {
      elements.browseCardGrid.innerHTML = emptyState(label("text.noMatches"));
      elements.browsePagination.innerHTML = "";
    } else if (state.filters.browseViewMode === "table") {
      renderBrowseTable(cards);
    } else {
      elements.browseCardGrid.innerHTML = cards.map((card) => renderCardGridItem(card, "browse")).join("");
      elements.browsePagination.innerHTML = "";
    }

    renderCardDetail();
  }

  function renderBrowseTable(cards) {
    const sortedCards = sortTableCards(cards);
    const pageCount = Math.max(1, Math.ceil(sortedCards.length / state.filters.browsePageSize));
    state.filters.browsePage = clamp(state.filters.browsePage, 1, pageCount);
    const start = (state.filters.browsePage - 1) * state.filters.browsePageSize;
    const pageCards = sortedCards.slice(start, start + state.filters.browsePageSize);

    elements.browseCardGrid.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              ${tableHeader("image", "Image", false)}
              ${tableHeader("cardNumber", "Number")}
              ${tableHeader("cardName", "Name")}
              ${tableHeader("metaSignal", "Meta Signal")}
              ${tableHeader("price", "Price")}
              ${tableHeader("color", "Color")}
              ${tableHeader("cardType", "Type")}
              ${tableHeader("rarity", "Rarity")}
              ${tableHeader("set", "Set")}
              ${tableHeader("quantity", "Qty")}
              ${tableHeader("classification", "Classification")}
              ${tableHeader("playset", "Playset?")}
              ${tableHeader("notes", "Notes", false)}
              ${tableHeader("actions", "Actions", false)}
            </tr>
          </thead>
          <tbody>${pageCards.map(renderTableRow).join("")}</tbody>
        </table>
      </div>
    `;
    elements.browsePagination.innerHTML = renderPagination(pageCount);
  }

  function renderTableRow(card) {
    const record = getCollection(card.cardNumber);
    return `
      <tr>
        <td>${artFrameMarkup(card, "art-frame art-frame--mini")}</td>
        <td><strong>${escapeHtml(card.cardNumber)}</strong></td>
        <td>${escapeHtml(card.cardName)}</td>
        <td>${metaSignalMarkup(card)}</td>
        <td>${priceCellMarkup(card)}</td>
        <td>${colorMarkup(card.color)} ${escapeHtml(card.color || "-")}</td>
        <td>${escapeHtml(card.cardType || "-")}</td>
        <td>${escapeHtml(card.rarity || "-")}</td>
        <td>${escapeHtml((card.packageCodes || [])[0] || "-")}</td>
        <td>${Number(record.quantity || 0)}</td>
        <td>${classificationBadgeMarkup(record.classification)}</td>
        <td>${record.keepPlayset ? label("text.yes") : label("text.no")}</td>
        <td>${escapeHtml(record.notes || "")}</td>
        <td>
          <button type="button" data-card-select="${escapeAttribute(card.cardNumber)}">Details</button>
        </td>
      </tr>
    `;
  }

  function renderCardDetail() {
    const card = libraryByNumber.get(state.ui.selectedCardNumber);
    if (!card) {
      elements.cardDetail.innerHTML = emptyState(label("text.noCard"));
      return;
    }
    const record = getCollection(card.cardNumber);
    const related = getRelatedPrintings(card).slice(0, 6);

    elements.cardDetail.innerHTML = `
      <article class="detail-card" data-card-number="${escapeAttribute(card.cardNumber)}">
        <div class="detail-card__art">${artFrameMarkup(card, "art-frame art-frame--detail")}</div>
        <div class="detail-card__header">
          <span class="eyebrow">Tactical report</span>
          <span class="card-number">${escapeHtml(card.cardNumber)}</span>
          <h3>${escapeHtml(card.cardName)}</h3>
          <div class="badge-row">
            ${badgeMarkup(card.color || "-", colorTone(card.color))}
            ${badgeMarkup(card.cardType || "-")}
            ${badgeMarkup(card.rarity || "-")}
            ${priceBadgeMarkup(card)}
          </div>
        </div>
        <p class="detail-card__effect">${escapeHtml(card.effectPreview || label("text.noText"))}</p>
        <div class="tactical-bars">
          ${tacticalBar("Meta", card.recentMetaScore, 60)}
          ${tacticalBar("Market", Number(card.marketPriceUsd || 0), 50)}
          ${tacticalBar("Low cost", Math.max(0, 6 - numericValue(card.cost)), 6)}
        </div>
        <div class="detail-stats">
          ${detailStat("Set", (card.packageCodes || []).join(", ") || "-")}
          ${detailStat("Cost", card.cost || "-")}
          ${detailStat("Level", card.level || "-")}
          ${detailStat("AP/HP", `${card.ap || "-"} / ${card.hp || "-"}`)}
          ${detailStat("BRL x5 price", formatBrl(card.marketPriceBrlX5))}
          ${detailStat("USD price", formatUsd(card.marketPriceUsd))}
        </div>
        ${detailGroup("Traits", card.traits)}
        ${detailGroup("Links", card.linkTargets)}
        ${detailGroup("Keywords / synergy", card.synergyTags)}
        ${detailGroup("Related versions/promos", related.map((item) => `${item.cardNumber} ${item.rarity || ""}`))}
        ${renderClassificationEditor(card, record)}
      </article>
    `;
  }

  function tacticalBar(labelText, value, max) {
    const pct = Math.max(0, Math.min(100, Math.round((Number(value || 0) / Number(max || 1)) * 100)));
    return `
      <div class="tactical-bar">
        <span>${escapeHtml(labelText)}</span>
        <strong>${pct}%</strong>
        <i style="width:${pct}%"></i>
      </div>
    `;
  }

  function renderClassificationEditor(card, record) {
    return `
      <section class="classification-editor">
        <div class="panel-head">
          <h3>Evaluation</h3>
          <p>Your fields, saved locally. The official database remains intact.</p>
        </div>
        <label>
          <span>Owned quantity</span>
          <input type="number" min="0" step="1" value="${Number(record.quantity || 0)}" data-collection-field="quantity" />
        </label>
        <label>
          <span>Status</span>
          <select data-collection-field="status">${translatedOptions(STATUS_OPTIONS).map((option) => optionMarkup(option, record.status)).join("")}</select>
        </label>
        <label>
          <span>Personal classification</span>
          <select data-collection-field="classification">${translatedOptions(CLASSIFICATIONS).map((option) => optionMarkup(option, record.classification)).join("")}</select>
        </label>
        <div class="checkbox-grid">
          ${checkMarkup("keepPlayset", "Keep playset", record.keepPlayset)}
          ${checkMarkup("sellTrade", "Sell/trade", record.sellTrade)}
          ${checkMarkup("lowCost", "Low cost", record.lowCost)}
        </div>
        <label>
          <span>Competitive</span>
          <select data-collection-field="competitive">${translatedOptions(EVAL_OPTIONS).map((option) => optionMarkup(option, record.competitive)).join("")}</select>
        </label>
        <label>
          <span>Collectible</span>
          <select data-collection-field="collectible">${translatedOptions(EVAL_OPTIONS).map((option) => optionMarkup(option, record.collectible)).join("")}</select>
        </label>
        <label>
          <span>Player notes</span>
          <textarea data-collection-field="notes">${escapeHtml(record.notes || "")}</textarea>
        </label>
        <label>
          <span>Strategic comment</span>
          <textarea data-collection-field="strategicComment">${escapeHtml(record.strategicComment || "")}</textarea>
        </label>
      </section>
    `;
  }

  function renderBuilderView() {
    syncLayoutButtons("builder", state.filters.builderViewMode);
    syncLayoutButtons("deck", state.filters.deckViewMode);
    elements.metaWeightValue.textContent = `${state.inputs.metaWeight}%`;
    elements.synergyWeightValue.textContent = `${state.inputs.synergyWeight}%`;

    const cards = getVisibleBuilderCards();
    elements.resultsCount.textContent = String(cards.length);
    elements.resultsCaption.textContent = label("text.cardsAvailable");
    elements.resultsMeta.textContent = cards.length ? `Avg advisor ${formatNumber(average(cards, (card) => scoreCard(card).advisorScore))}` : "";
    elements.cardGrid.classList.toggle("card-grid--list", state.filters.builderViewMode === "list");
    elements.cardGrid.innerHTML = cards.length ? cards.slice(0, 120).map((card) => renderCardGridItem(card, "builder")).join("") : emptyState(label("text.noMatches"));

    renderArchetypeSuggestions();
    renderTemplatePreview();
    renderRuleList();
    renderDeckConsole();
  }

  function renderArchetypeSuggestions() {
    const suggestions = getRankedArchetypes().slice(0, 6);
    elements.archetypeSuggestions.innerHTML = suggestions.length
      ? suggestions
          .map(
            (row) => `
          <article class="suggestion-card">
            <strong>${escapeHtml(row.archetype)}</strong>
            <small>${escapeHtml(row.commonColorCombination || "")} / ${escapeHtml(row.templateConfidence || "")}</small>
            <div class="badge-row">
              ${badgeMarkup(`Top 8 rec. ${row.recentTop8Decks || 0}`, "blue")}
              ${badgeMarkup(`Wins ${row.recentWins || 0}`, "gold")}
            </div>
            <button type="button" data-template-focus="${escapeAttribute(row.archetype)}" data-view-target="builder">Use as base</button>
          </article>
        `,
          )
          .join("")
      : emptyState("No suggestions.");
  }

  function renderTemplatePreview() {
    const rows = getTemplateRows(state.inputs.templateArchetype).slice(0, 18);
    elements.templatePreview.innerHTML = rows.length
      ? rows
          .map((row) => {
            const card = mainByNumber.get(row.cardNumber);
            return `
              <div class="stat-item">
                <span>${escapeHtml(row.recommendedQuantity || 1)}x ${escapeHtml(row.cardName)}</span>
                <strong>${escapeHtml(row.roleClass || "")}</strong>
                ${card ? `<small>${escapeHtml(card.cardNumber)} / ${escapeHtml(card.color)}</small>` : ""}
              </div>
            `;
          })
          .join("")
      : emptyState("Choose an archetype to preview the shell.");
  }

  function renderRuleList() {
    const rules = [
      `Main deck: ${RULES.mainDeckSize || 50} cards`,
      `Resource deck: ${RULES.resourceDeckSize || 10} cards`,
      `Colors: up to ${RULES.maxColors || 2}`,
      `Default limit: ${RULES.defaultCopyLimit || 4} copies`,
    ];
    elements.ruleList.innerHTML = rules.map((item) => `<div class="rule-item"><strong>${escapeHtml(item)}</strong></div>`).join("");
  }

  function renderDeckConsole() {
    const legality = getDeckLegality();
    elements.deckPreview.innerHTML = renderDeckPreview();
    elements.deckSummary.innerHTML = [
      dashboardCard("Main", `${sumSection("main")} / ${RULES.mainDeckSize || 50}`, legality.mainStatusLabel),
      dashboardCard("Resource", `${sumSection("resource")} / ${RULES.resourceDeckSize || 10}`, legality.resourceStatusLabel),
      dashboardCard("Colors", getDeckColors().join(" / ") || "-", "Main deck"),
    ].join("");
    elements.deckIssues.innerHTML = legality.issues.length ? legality.issues.map((issue) => `<div class="issue-item"><strong>${escapeHtml(issue)}</strong></div>`).join("") : `<div class="issue-item"><strong>No critical alerts.</strong></div>`;
    elements.mainDeckCount.textContent = `${sumSection("main")} / ${RULES.mainDeckSize || 50}`;
    elements.resourceDeckCount.textContent = `${sumSection("resource")} / ${RULES.resourceDeckSize || 10}`;
    elements.mainDeckList.innerHTML = renderDeckList("main", mainByNumber);
    elements.resourceDeckList.innerHTML = renderDeckList("resource", resourceByNumber);
  }

  function renderDeckPreview() {
    const rows = buildDeckRows("main", mainByNumber).slice(0, 4);
    if (!rows.length) {
      return emptyState("Start adding cards to see the preview.");
    }
    return `<div class="feature-card__arts">${rows.map((row) => artFrameMarkup(row.card, "art-frame")).join("")}</div>`;
  }

  function renderDeckList(section, library) {
    const rows = buildDeckRows(section, library);
    if (!rows.length) {
      return emptyState("No cards.");
    }
    return rows
      .map((row) => {
        const visual = state.filters.deckViewMode === "visual";
        return `
          <article class="deck-row ${visual ? "deck-row--visual" : ""}">
            ${visual ? artFrameMarkup(row.card, "art-frame art-frame--mini") : ""}
            <div>
              <strong>${row.qty}x ${escapeHtml(row.card.cardName)}</strong>
              <div class="card-meta-row"><span>${escapeHtml(row.card.cardNumber)}</span><span>${escapeHtml(row.card.color)}</span><span>${escapeHtml(row.card.cardType)}</span></div>
            </div>
            <div class="qty-stepper">
              <button type="button" data-section="${section}" data-card-number="${escapeAttribute(row.card.cardNumber)}" data-deck-delta="-1">-</button>
              <button type="button" data-section="${section}" data-card-number="${escapeAttribute(row.card.cardNumber)}" data-deck-delta="1">+</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderCollectionView() {
    const cards = getCardsWithCollectionData();
    const totalOwned = cards.reduce((sum, card) => sum + Number(getCollection(card.cardNumber).quantity || 0), 0);
    const binder = cards.filter((card) => getCollection(card.cardNumber).status === "binder").length;
    const deck = cards.filter((card) => getCollection(card.cardNumber).status === "deck").length;
    const sale = cards.filter((card) => ["sale", "trade"].includes(getCollection(card.cardNumber).status) || getCollection(card.cardNumber).sellTrade).length;
    elements.collectionSummary.innerHTML = [
      dashboardCard("Registered cards", cards.length, "Local"),
      dashboardCard("Total quantity", totalOwned, "Summing copies"),
      dashboardCard("Binder", binder, "Status"),
      dashboardCard("Deck", deck, "Status"),
      dashboardCard("Sale/trade", sale, "Status"),
    ].join("");
    elements.collectionTable.innerHTML = cards.length ? genericCollectionTable(cards) : emptyState("You have not imported or classified cards yet.");
  }

  function renderClassificationView() {
    const counts = CLASSIFICATIONS.map((classification) => ({
      ...classification,
      count: LIBRARY_CARDS.filter((card) => getCollection(card.cardNumber).classification === classification.value).length,
    }));
    elements.classificationSummary.innerHTML = counts
      .map((row) => `<article class="dashboard-card"><span>${escapeHtml(classificationLabel(row.value))}</span><strong>${row.count}</strong><small>${row.value}</small></article>`)
      .join("");
    const unclassified = LIBRARY_CARDS.filter((card) => getCollection(card.cardNumber).classification === "not-classified").slice(0, 120);
    elements.classificationTable.innerHTML = unclassified.length ? genericCollectionTable(unclassified) : emptyState("No unclassified cards in the current records.");
  }

  function renderPricesView() {
    const priced = LIBRARY_CARDS.filter((card) => Number.isFinite(card.marketPriceUsd));
    const totalUsd = priced.reduce((sum, card) => sum + Number(card.marketPriceUsd || 0) * Number(getCollection(card.cardNumber).quantity || 0), 0);
    const highest = priced.slice().sort((left, right) => Number(right.marketPriceUsd || 0) - Number(left.marketPriceUsd || 0)).slice(0, 120);
    elements.pricesSummary.innerHTML = [
      dashboardCard("Priced cards", priced.length, "TCGplayer/Tcgcsv"),
      dashboardCard("Missing price", LIBRARY_CARDS.length - priced.length, "Not mapped yet"),
      dashboardCard("Collection value BRL x5", formatBrl(totalUsd * 5), "Primary estimate"),
      dashboardCard("Collection value USD", formatUsd(totalUsd), "Secondary reference"),
    ].join("");
    elements.pricesTable.innerHTML = highest.length ? priceTable(highest) : emptyState("No prices loaded in app-data.js.");
  }

  function renderImportExportView() {
    const preview = buildPlainDeckList("main") || buildPlainCollectionList(getCardsWithCollectionData()).slice(0, 4000);
    elements.exportPreview.value = preview;
  }

  function renderCardGridItem(card, context) {
    const section = card.librarySection === "resource" ? "resource" : "main";
    const listMode = context === "builder" ? state.filters.builderViewMode === "list" : false;
    const selected = state.ui.selectedCardNumber === card.cardNumber;
    const addSection = state.filters.builderLibraryMode === "resource" || section === "resource" ? "resource" : "main";
    const score = scoreCard(card);
    const actions =
      context === "builder"
        ? `<button type="button" data-add-card="${escapeAttribute(card.cardNumber)}" data-section="${addSection}">Add</button>`
        : `<button type="button" data-card-select="${escapeAttribute(card.cardNumber)}">Details</button>`;
    const editAction = `<button type="button" class="button-secondary" data-card-select="${escapeAttribute(card.cardNumber)}">Edit classification</button>`;

    return `
      <article class="library-card ${selected ? "is-selected" : ""} ${listMode ? "list-row" : ""}">
        <button class="library-card__art" type="button" data-card-select="${escapeAttribute(card.cardNumber)}" aria-label="Open ${escapeAttribute(card.cardName)}">
          ${artFrameMarkup(card, listMode ? "art-frame art-frame--mini" : "art-frame")}
        </button>
        <div class="library-card__body">
          <span class="card-number">${escapeHtml(card.cardNumber)}</span>
          <h3 class="card-title">${escapeHtml(card.cardName)}</h3>
          <div class="card-meta-row">
            <span>${colorMarkup(card.color)} ${escapeHtml(card.color || "-")}</span>
            <span>${escapeHtml(card.cardType || "-")}</span>
            <span>${escapeHtml(card.rarity || "-")}</span>
            <span>${escapeHtml((card.packageCodes || [])[0] || "-")}</span>
          </div>
          <div class="signal-strip">
            ${metaSignalMarkup(card)}
            ${marketReferenceMarkup(card)}
          </div>
          <p class="card-effect">${escapeHtml(card.effectPreview || label("text.noText"))}</p>
          <div class="badge-row">
            ${buildCardBadges(card).join("")}
            ${context === "builder" ? badgeMarkup(`Advisor ${formatNumber(score.advisorScore)}`, "blue") : ""}
          </div>
          <div class="card-actions">${actions}${editAction}</div>
        </div>
      </article>
    `;
  }

  function genericCollectionTable(cards) {
    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Image</th><th>Number</th><th>Name</th><th>Color</th><th>Type</th><th>Qty</th><th>Status</th><th>Classification</th><th>Playset?</th><th>Notes</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${cards
            .map((card) => {
              const record = getCollection(card.cardNumber);
              return `
                <tr>
                  <td>${artFrameMarkup(card, "art-frame art-frame--mini")}</td>
                  <td><strong>${escapeHtml(card.cardNumber)}</strong></td>
                  <td>${escapeHtml(card.cardName)}</td>
                  <td>${escapeHtml(card.color || "-")}</td>
                  <td>${escapeHtml(card.cardType || "-")}</td>
                  <td>${Number(record.quantity || 0)}</td>
                  <td>${escapeHtml(statusLabel(record.status))}</td>
                  <td>${classificationBadgeMarkup(record.classification)}</td>
                  <td>${record.keepPlayset ? label("text.yes") : label("text.no")}</td>
                  <td>${escapeHtml(record.notes || "")}</td>
                  <td><button type="button" data-card-select="${escapeAttribute(card.cardNumber)}" data-view-target="cards">Edit</button></td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  function priceTable(cards) {
    return `
      <table class="data-table">
        <thead>
          <tr><th>Image</th><th>Number</th><th>Name</th><th>Set</th><th>BRL x5</th><th>USD</th><th>Low</th><th>Mid</th><th>Status</th><th>Link</th></tr>
        </thead>
        <tbody>
          ${cards
            .map(
              (card) => `
              <tr>
                <td>${artFrameMarkup(card, "art-frame art-frame--mini")}</td>
                <td><strong>${escapeHtml(card.cardNumber)}</strong></td>
                <td>${escapeHtml(card.cardName)}</td>
                <td>${escapeHtml((card.packageCodes || [])[0] || "-")}</td>
                <td>${formatBrl(card.marketPriceBrlX5)}</td>
                <td>${formatUsd(card.marketPriceUsd)}</td>
                <td>${formatUsd(card.lowPriceUsd)}</td>
                <td>${formatUsd(card.midPriceUsd)}</td>
                <td>${escapeHtml(card.priceStatus || "-")}</td>
                <td>${card.tcgplayerUrl ? `<a href="${escapeAttribute(card.tcgplayerUrl)}" target="_blank" rel="noreferrer">TCGplayer</a>` : "-"}</td>
              </tr>
            `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderRatingSpotlight() {
    if (!state.ui.ratingCardKey || !findRatingSubject(state.ui.ratingCardKey)) {
      state.ui.ratingCardKey = pickRandomRatingKey();
    }
    const subject = findRatingSubject(state.ui.ratingCardKey);
    if (!subject) {
      return emptyState("No cards available for rating.");
    }
    const rating = Number(state.ratings[state.ui.ratingCardKey] || 0);
    const metaLine = subject.isPreview
      ? `${subject.productName || subject.productCode || "Official preview"}`
      : `${subject.cardNumber} / ${subject.color || "-"} / ${subject.cardType || "-"}`;
    const detailAction = subject.isPreview
      ? `<button type="button" data-preview-link="${escapeAttribute(subject.sourceUrl || "")}">Open official source</button>`
      : `<button type="button" data-card-select="${escapeAttribute(subject.cardNumber)}">View details</button>`;

    return `
      <article class="rating-card">
        <div class="rating-card__art">${artFrameMarkup(subject, "art-frame art-frame--detail")}</div>
        <div class="rating-card__body">
          <span class="eyebrow">${subject.isPreview ? "Official preview" : "Random card"}</span>
          <h3>${escapeHtml(subject.cardName)}</h3>
          <p>${escapeHtml(metaLine)}</p>
          ${subject.isPreview ? badgeMarkup(subject.previewStatus === "preview_only" ? "Pre-release" : "Mapped preview", "purple") : metaSignalMarkup(subject)}
          <div class="star-rating" role="group" aria-label="Star rating">
            ${[1, 2, 3, 4, 5]
              .map(
                (value) => `
                  <button
                    type="button"
                    class="${value <= rating ? "is-active" : ""}"
                    data-rating-key="${escapeAttribute(state.ui.ratingCardKey)}"
                    data-rating-value="${value}"
                    aria-label="${value} stars"
                  >★</button>
                `,
              )
              .join("")}
          </div>
          <small class="muted">${rating ? `Your rating: ${rating}/5` : "Choose a rating from 1 to 5 stars."}</small>
          <div class="card-actions">
            ${detailAction}
            <button type="button" class="button-secondary" data-random-rating-card>Another card</button>
          </div>
        </div>
      </article>
    `;
  }

  function rateCard(key, value) {
    if (!findRatingSubject(key)) {
      return;
    }
    state.ratings[key] = clamp(value, 1, 5);
    persistState();
    renderDashboard();
  }

  function getFilteredCards() {
    const pool = state.filters.browsePool;
    const source = pool === "main" ? MAIN_CARDS : pool === "resource" ? RESOURCE_CARDS : LIBRARY_CARDS;
    const search = parseCardSearch(state.filters.browseSearch);
    return source
      .filter((card) => matchesBrowseFilters(card, search))
      .sort((left, right) => compareCards(left, right, state.filters.browseSort));
  }

  function matchesBrowseFilters(card, search) {
    const record = getCollection(card.cardNumber);
    if (!matchesCardSearch(card, search)) return false;
    if (state.filters.browseCode && !normalize(card.cardNumber).includes(normalize(state.filters.browseCode))) return false;
    if (state.filters.browseSet !== "Any" && !(card.packageCodes || []).includes(state.filters.browseSet)) return false;
    if (state.filters.browsePackageCode && state.filters.browsePackageCode !== "Any" && packageCodeForCard(card) !== state.filters.browsePackageCode) return false;
    if (state.filters.browseColor !== "Any" && card.color !== state.filters.browseColor) return false;
    if (state.filters.browseType !== "Any" && card.cardType !== state.filters.browseType) return false;
    if (state.filters.browseRarity !== "Any" && card.rarity !== state.filters.browseRarity) return false;
    if (state.filters.browseCost && !compareNumericFilter(card.cost, state.filters.browseCost)) return false;
    if (state.filters.browseLevel && !compareNumericFilter(card.level, state.filters.browseLevel)) return false;
    if (state.filters.browseTrait && !matchesLoose(card.keywordBlob, state.filters.browseTrait)) return false;
    if (state.filters.browseStatus !== "Any" && record.status !== state.filters.browseStatus) return false;
    if (state.filters.browseClassification !== "Any" && record.classification !== state.filters.browseClassification) return false;
    if (state.filters.browseMetaSignal && state.filters.browseMetaSignal !== "Any" && getMetaSignal(card).value !== state.filters.browseMetaSignal) return false;
    if (!matchesBoolFilter(record.keepPlayset, state.filters.browsePlayset)) return false;
    if (!matchesBoolFilter(card.isVanilla, state.filters.browseVanilla)) return false;
    if (!matchesBoolFilter(card.isPromo, state.filters.browsePromo)) return false;
    if (state.filters.browseSource !== "Any" && !(card.sourceChannels || []).includes(state.filters.browseSource)) return false;
    if (!matchesBoolFilter(card.isAltArt, state.filters.browseAltArt)) return false;
    if (state.filters.browseTag !== "Any" && !(card.synergyTags || []).includes(state.filters.browseTag)) return false;
    return true;
  }

  function getVisibleBuilderCards() {
    const source = state.filters.builderLibraryMode === "resource" ? RESOURCE_CARDS : MAIN_CARDS;
    const search = parseCardSearch(state.filters.builderSearch);
    return source
      .filter((card) => {
        if (!matchesCardSearch(card, search)) return false;
        if (state.filters.builderColor !== "Any" && card.color !== state.filters.builderColor) return false;
        if (state.filters.builderType !== "Any" && card.cardType !== state.filters.builderType) return false;
        if (state.filters.builderTag !== "Any" && !(card.synergyTags || []).includes(state.filters.builderTag)) return false;
        return true;
      })
      .sort((left, right) => compareCards(left, right, state.filters.builderSort));
  }

  function parseCardSearch(input) {
    const raw = String(input || "").trim();
    if (!raw) {
      return { terms: [], fields: [] };
    }
    const tokens = raw.match(/"[^"]+"|\S+/g) || [];
    return tokens.reduce(
      (query, token) => {
        const clean = token.replace(/^"|"$/g, "");
        const fieldMatch = clean.match(/^([a-zA-Z_]+)(:|<=|>=|=|<|>)(.+)$/);
        if (fieldMatch) {
          query.fields.push({ field: normalize(fieldMatch[1]), op: fieldMatch[2], value: fieldMatch[3] });
        } else {
          query.terms.push(normalize(clean));
        }
        return query;
      },
      { terms: [], fields: [] },
    );
  }

  function matchesCardSearch(card, query) {
    return (
      query.terms.every((term) => card.searchBlob.includes(term)) &&
      query.fields.every((filter) => {
        const text = getSearchField(card, filter.field);
        if (["cost", "level", "ap", "hp", "price"].includes(filter.field)) {
          return compareNumericFilter(text, `${filter.op}${filter.value}`);
        }
        return normalize(text).includes(normalize(filter.value));
      })
    );
  }

  function getSearchField(card, field) {
    const fields = {
      name: card.cardName,
      nome: card.cardName,
      number: card.cardNumber,
      code: card.cardNumber,
      codigo: card.cardNumber,
      set: (card.packageCodes || []).join(" "),
      color: card.color,
      cor: card.color,
      type: card.cardType,
      tipo: card.cardType,
      rarity: card.rarity,
      raridade: card.rarity,
      cost: card.cost,
      custo: card.cost,
      level: card.level,
      nivel: card.level,
      trait: (card.traits || []).join(" "),
      link: (card.linkTargets || []).join(" "),
      keyword: card.keywordBlob,
      text: card.effectPreview,
      texto: card.effectPreview,
      price: card.marketPriceUsd,
    };
    return fields[field] ?? card.searchBlob;
  }

  function compareCards(left, right, sortMode) {
    const leftScore = scoreCard(left);
    const rightScore = scoreCard(right);
    switch (sortMode) {
      case "recent-meta":
        return Number(right.recentMetaScore || 0) - Number(left.recentMetaScore || 0) || compareText(left.cardName, right.cardName);
      case "overall-meta":
        return Number(right.overallMetaScore || 0) - Number(left.overallMetaScore || 0) || compareText(left.cardName, right.cardName);
      case "price-high":
        return comparePrice(left, right, "desc") || compareText(left.cardName, right.cardName);
      case "price-low":
        return comparePrice(left, right, "asc") || compareText(left.cardName, right.cardName);
      case "cost":
        return numericValue(left.cost) - numericValue(right.cost) || compareText(left.cardName, right.cardName);
      case "level":
        return numericValue(left.level) - numericValue(right.level) || compareText(left.cardName, right.cardName);
      case "number":
        return compareText(left.cardNumber, right.cardNumber);
      case "alpha":
        return compareText(left.cardName, right.cardName);
      case "advisor":
      default:
        return rightScore.advisorScore - leftScore.advisorScore || compareText(left.cardName, right.cardName);
    }
  }

  function scoreCard(card) {
    const metaBlend = Number(card.recentMetaScore || 0) * 0.7 + Number(card.overallMetaScore || 0) * 0.3;
    let synergy = 0;
    if (state.inputs.primaryColor !== "Any" && card.color === state.inputs.primaryColor) synergy += 25;
    if (state.inputs.secondaryColor !== "Any" && card.color === state.inputs.secondaryColor) synergy += 15;
    if (state.inputs.preferredType !== "Any" && card.cardType === state.inputs.preferredType) synergy += 15;
    if (state.inputs.synergyTag !== "Any" && (card.synergyTags || []).includes(state.inputs.synergyTag)) synergy += 18;
    if (state.inputs.traitKeyword && matchesLoose((card.traits || []).join(" "), state.inputs.traitKeyword)) synergy += 16;
    if (state.inputs.archetypeKeyword && matchesLoose(card.searchBlob, state.inputs.archetypeKeyword)) synergy += 16;
    const advisorScore = metaBlend * (state.inputs.metaWeight / 100) + synergy * (state.inputs.synergyWeight / 100);
    return { metaBlend, synergy, advisorScore: round(advisorScore, 1) };
  }

  function getRankedArchetypes() {
    const query = normalize([state.inputs.archetypeKeyword, state.inputs.traitKeyword].join(" "));
    return ARCHETYPES.map((row) => {
      let score = Number(row.recentMetaScore || 0) * 0.75 + Number(row.overallMetaScore || 0) * 0.25;
      if (state.inputs.primaryColor !== "Any" && normalize(row.commonColorCombination).includes(normalize(state.inputs.primaryColor))) score += 10;
      if (state.inputs.secondaryColor !== "Any" && normalize(row.commonColorCombination).includes(normalize(state.inputs.secondaryColor))) score += 7;
      if (query && normalize(row.searchText).includes(query)) score += 12;
      return { ...row, advisorScore: round(score, 1) };
    }).sort((left, right) => right.advisorScore - left.advisorScore || compareText(left.archetype, right.archetype));
  }

  function getTemplateRows(archetype) {
    if (!archetype || archetype === "Any") {
      return [];
    }
    return (templateRowsByArchetype.get(archetype) || []).slice().sort((left, right) => roleRank(left.roleClass) - roleRank(right.roleClass) || Number(right.inclusionRate || 0) - Number(left.inclusionRate || 0));
  }

  function applyTemplate(maxRole, replaceMain) {
    const rows = getTemplateRows(state.inputs.templateArchetype);
    if (!rows.length) {
      showToast("Escolha um shell primeiro.");
      return;
    }
    if (replaceMain) {
      state.deck.main = {};
    }
    const maxRank = roleRank(maxRole);
    rows.forEach((row) => {
      if (roleRank(row.roleClass) > maxRank || !mainByNumber.has(row.cardNumber)) {
        return;
      }
      state.deck.main[row.cardNumber] = Math.min(4, Number(row.recommendedQuantity || 1));
    });
    persistState();
    renderAll();
  }

  function addCardToDeck(section, cardNumber) {
    const library = section === "resource" ? resourceByNumber : mainByNumber;
    if (!library.has(cardNumber)) {
      return;
    }
    changeDeckQuantity(section, cardNumber, 1);
  }

  function changeDeckQuantity(section, cardNumber, delta) {
    const library = section === "resource" ? resourceByNumber : mainByNumber;
    const card = library.get(cardNumber);
    if (!card) {
      return;
    }
    const current = Number(state.deck[section][cardNumber] || 0);
    const max = section === "resource" ? 99 : Number(card.copyLimit || RULES.defaultCopyLimit || 4);
    const next = clamp(current + Number(delta), 0, max);
    if (next > 0) {
      state.deck[section][cardNumber] = next;
    } else {
      delete state.deck[section][cardNumber];
    }
    persistState();
    renderAll();
  }

  function getDeckLegality() {
    const issues = [];
    const mainSize = RULES.mainDeckSize || 50;
    const resourceSize = RULES.resourceDeckSize || 10;
    const mainCount = sumSection("main");
    const resourceCount = sumSection("resource");
    const colors = getDeckColors();
    if (mainCount !== mainSize) issues.push(`Main deck must have ${mainSize} cards. Current: ${mainCount}.`);
    if (resourceCount !== resourceSize) issues.push(`Resource deck must have ${resourceSize} cards. Current: ${resourceCount}.`);
    if (colors.length > (RULES.maxColors || 2)) issues.push(`Main deck uses ${colors.length} colors. Current limit: ${RULES.maxColors || 2}.`);
    buildDeckRows("main", mainByNumber).forEach((row) => {
      const restriction = RESTRICTIONS.get(row.card.cardNumber);
      const limit = restriction ? Number(restriction.maxCopies || row.card.copyLimit || 4) : Number(row.card.copyLimit || RULES.defaultCopyLimit || 4);
      if (row.qty > limit) {
        issues.push(`${row.card.cardName} exceeds the limit of ${limit}.`);
      }
    });
    return {
      issues,
      mainStatusLabel: mainCount === mainSize ? "OK" : "Adjust",
      resourceStatusLabel: resourceCount === resourceSize ? "OK" : "Adjust",
    };
  }

  function getDeckColors() {
    const colors = new Set();
    buildDeckRows("main", mainByNumber).forEach((row) => {
      if (row.card.color && !["Neutral", "-"].includes(row.card.color)) {
        colors.add(row.card.color);
      }
    });
    return Array.from(colors).sort(compareText);
  }

  function buildMsaText() {
    return [
      state.deckName || getDefaultDeckName(state.ui.language),
      "",
      `Main Deck (${sumSection("main")})`,
      ...buildDeckRows("main", mainByNumber).map((row) => `${row.qty} ${row.card.cardName} [${row.card.cardNumber}]`),
      "",
      `Resource Deck (${sumSection("resource")})`,
      ...buildDeckRows("resource", resourceByNumber).map((row) => `${row.qty} ${row.card.cardName} [${row.card.cardNumber}]`),
    ].join("\n");
  }

  function buildPlainDeckList(section) {
    const library = section === "resource" ? resourceByNumber : mainByNumber;
    return buildDeckRows(section, library).map((row) => `${row.qty}x${row.card.cardNumber}`).join("\n");
  }

  function buildEgmanUrl() {
    const rows = buildDeckRows("main", mainByNumber);
    if (!rows.length) {
      return "";
    }
    const deckParam = rows.map((row) => `${row.card.cardNumber}:${row.qty}`).join(",");
    return `https://deckbuilder.egmanevents.com/?deck=${encodeURIComponent(deckParam)}&type=gundam`;
  }

  function buildSimulatorJson() {
    return {
      deckName: state.deckName || getDefaultDeckName(state.ui.language),
      generatedAt: new Date().toISOString(),
      legality: getDeckLegality(),
      mainDeck: buildDeckRows("main", mainByNumber).map(deckRowPayload),
      resourceDeck: buildDeckRows("resource", resourceByNumber).map(deckRowPayload),
      egmanUrl: buildEgmanUrl(),
    };
  }

  function deckRowPayload(row) {
    return {
      cardNumber: row.card.cardNumber,
      cardName: row.card.cardName,
      quantity: row.qty,
      color: row.card.color,
      cardType: row.card.cardType,
      imageUrl: row.card.imageUrl,
    };
  }

  function buildDeckRows(section, library) {
    return Object.entries(state.deck[section] || {})
      .filter(([, qty]) => Number(qty) > 0)
      .map(([cardNumber, qty]) => ({ card: library.get(cardNumber), qty: Number(qty) }))
      .filter((row) => row.card)
      .sort((left, right) => compareText(left.card.cardNumber, right.card.cardNumber));
  }

  function sumSection(section) {
    return Object.values(state.deck[section] || {}).reduce((sum, qty) => sum + Number(qty || 0), 0);
  }

  function updateCollectionFromInput(input, shouldRender) {
    const container = input.closest("[data-card-number]");
    if (!container) {
      return;
    }
    const record = ensureCollection(container.dataset.cardNumber);
    const field = input.dataset.collectionField;
    if (input.type === "checkbox") {
      record[field] = input.checked;
    } else if (input.type === "number") {
      record[field] = Math.max(0, Number(input.value || 0));
    } else {
      record[field] = input.value;
    }
    state.collection[container.dataset.cardNumber] = normalizeCollectionRecord(record);
    persistState();
    if (shouldRender) {
      renderAll();
    }
  }

  function getCollection(cardNumber) {
    return normalizeCollectionRecord(state.collection[cardNumber] || {});
  }

  function ensureCollection(cardNumber) {
    if (!state.collection[cardNumber]) {
      state.collection[cardNumber] = normalizeCollectionRecord({});
    }
    return state.collection[cardNumber];
  }

  function normalizeCollectionRecord(record) {
    return {
      quantity: Math.max(0, Number(record.quantity || 0)),
      status: record.status || "",
      classification: record.classification || "not-classified",
      keepPlayset: Boolean(record.keepPlayset),
      sellTrade: Boolean(record.sellTrade),
      lowCost: Boolean(record.lowCost),
      competitive: record.competitive || "",
      collectible: record.collectible || "",
      notes: String(record.notes || ""),
      strategicComment: String(record.strategicComment || ""),
    };
  }

  function getCardsWithCollectionData() {
    return LIBRARY_CARDS.filter((card) => {
      const record = getCollection(card.cardNumber);
      return record.quantity || record.status || record.classification !== "not-classified" || record.keepPlayset || record.sellTrade || record.lowCost || record.notes || record.strategicComment;
    }).sort((left, right) => compareText(left.cardNumber, right.cardNumber));
  }

  function importCollectionCsv(text) {
    const rows = parseCsv(text);
    if (!rows.length) {
      showToast("CSV is empty or invalid.");
      return;
    }
    rows.forEach((row) => {
      const cardNumber = normalizeUpper(row.cardNumber || row.cardnumber || row.card_number || row.number || row.code || row.codigo || row.código);
      if (!libraryByNumber.has(cardNumber)) {
        return;
      }
      const record = ensureCollection(cardNumber);
      record.quantity = Number(row.quantity || row.qty || row.qtd || record.quantity || 0);
      record.status = row.status || record.status;
      record.classification = row.classification || row.classificacao || row.classificação || record.classification;
      record.notes = row.notes || row.observacoes || row.observações || record.notes;
      record.keepPlayset = parseBool(row.keepPlayset || row.keepplayset || row.keep_playset || row.playset) || record.keepPlayset;
      record.sellTrade = parseBool(row.sellTrade || row.selltrade || row.sell_trade || row.vender_trocar) || record.sellTrade;
      state.collection[cardNumber] = normalizeCollectionRecord(record);
    });
    persistState();
    showToast(label("text.imported"));
    renderAll();
  }

  function exportCollectionCsv(filename, cards) {
    const rows = cards.map((card) => {
      const record = getCollection(card.cardNumber);
      return {
        cardNumber: card.cardNumber,
        cardName: card.cardName,
        color: card.color,
        cardType: card.cardType,
        rarity: card.rarity,
        set: (card.packageCodes || []).join("|"),
        quantity: record.quantity,
        status: record.status,
        classification: record.classification,
        keepPlayset: record.keepPlayset,
        sellTrade: record.sellTrade,
        lowCost: record.lowCost,
        marketPriceUsd: card.marketPriceUsd ?? "",
        marketPriceBrlX5: card.marketPriceBrlX5 ?? "",
        notes: record.notes,
      };
    });
    const csv = toCsv(rows);
    elements.exportPreview.value = csv.slice(0, 12000);
    downloadText(`${filename}.csv`, csv, "text/csv;charset=utf-8");
  }

  function buildPlainCollectionList(cards) {
    return cards
      .map((card) => {
        const qty = Number(getCollection(card.cardNumber).quantity || 0);
        return qty > 0 ? `${qty}x${card.cardNumber}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  function setView(view) {
    const views = new Set(["home", "cards", "builder", "collection", "classification", "prices", "importExport"]);
    if (!views.has(view)) {
      return;
    }
    state.ui.view = view;
    tacticalPulse("applied");
    persistState();
    renderAll();
  }

  function setTheme(theme) {
    if (!isThemeEnabled(theme)) {
      return;
    }
    state.ui.theme = theme;
    tacticalPulse("applied");
    persistState();
    renderAll();
  }

  function applyTheme() {
    const config = THEME_CONFIG[state.ui.theme] || THEME_CONFIG["wing-zero"];
    if (elements.body) {
      elements.body.dataset.theme = state.ui.theme;
      Object.keys(THEME_CONFIG).forEach((theme) => elements.body.classList.remove(`theme-${theme}`));
      elements.body.classList.add(`theme-${state.ui.theme}`);
    }
    setText(elements.cockpitModeSubtitle, config.mode);
    setText(elements.cockpitModeName, config.title);
    setText(elements.cockpitModeState, config.stateLabel);
    setText(elements.cockpitModeCopy, config.description);
    applyFactionEmblem(config);
    setText(elements.cockpitUnitId, config.unitId);
    setText(elements.cockpitPilot, config.pilot);
    setText(elements.cockpitOperation, config.operation);
    setText(elements.cockpitDialLabel, config.label);
    setValue(elements.cockpitThemeSelect, state.ui.theme);
    setText(elements.topbarPilotLabel, `PILOT: ${config.pilot || "YUY"}`.toUpperCase());
    if (elements.cockpitStatus) {
      elements.cockpitStatus.innerHTML = `
        <span class="status-dot"></span>
        <strong>SYSTEM ACTIVE</strong>
        <small>${escapeHtml(config.mode)}</small>
      `;
    }
    if (elements.commandFeedback && !elements.commandFeedback.dataset.locked) {
      elements.commandFeedback.textContent = config.standby;
    }
  }

  function isThemeEnabled(theme) {
    const config = THEME_CONFIG[theme];
    return Boolean(config && config.enabled !== false);
  }

  function applyFactionEmblem(config) {
    const faction = config.faction || { id: "zero", label: "ZERO SYSTEM", logo: "/assets/factions/oz-zero.svg" };
    if (elements.factionCore) {
      elements.factionCore.dataset.faction = faction.id || "zero";
      elements.factionCore.setAttribute("aria-label", faction.label || config.label || "Faction emblem");
    }
    if (elements.cockpitFactionLogo) {
      elements.cockpitFactionLogo.src = faction.logo || "/assets/factions/oz-zero.svg";
      elements.cockpitFactionLogo.alt = faction.label || config.label || "Faction emblem";
    }
  }

  function setText(element, text) {
    if (element) {
      element.textContent = text || "";
    }
  }

  function tacticalPulse(kind) {
    const config = THEME_CONFIG[state.ui.theme] || THEME_CONFIG["wing-zero"];
    const message = config[kind] || config.applied;
    if (elements.body) {
      elements.body.classList.add("is-processing");
      clearTimeout(tacticalPulse.bodyTimer);
      tacticalPulse.bodyTimer = setTimeout(() => elements.body.classList.remove("is-processing"), 260);
    }
    if (elements.commandFeedback) {
      elements.commandFeedback.dataset.locked = "true";
      elements.commandFeedback.textContent = message;
      elements.commandFeedback.classList.add("is-active");
      clearTimeout(tacticalPulse.feedbackTimer);
      tacticalPulse.feedbackTimer = setTimeout(() => {
        elements.commandFeedback.textContent = config.standby;
        elements.commandFeedback.classList.remove("is-active");
        delete elements.commandFeedback.dataset.locked;
      }, 1200);
    }
  }

  function setLayoutMode(scope, mode) {
    if (scope === "browse" && ["grid", "table"].includes(mode)) {
      state.filters.browseViewMode = mode;
    }
    if (scope === "builder" && ["grid", "list"].includes(mode)) {
      state.filters.builderViewMode = mode;
    }
    if (scope === "deck" && ["compact", "visual"].includes(mode)) {
      state.filters.deckViewMode = mode;
    }
    persistState();
    renderAll();
  }

  function selectCard(cardNumber) {
    if (!libraryByNumber.has(cardNumber)) {
      return;
    }
    state.ui.selectedCardNumber = cardNumber;
    state.ui.view = "cards";
    tacticalPulse("selected");
    persistState();
    renderAll();
  }

  function setTableSort(sort) {
    if (state.table.sort === sort) {
      state.table.dir = state.table.dir === "asc" ? "desc" : "asc";
    } else {
      state.table.sort = sort;
      state.table.dir = "asc";
    }
    persistState();
    renderCardsView();
  }

  function applyFilterShortcut(kind) {
    resetBrowseFilters(false);
    if (kind === "unclassified") {
      state.filters.browseClassification = "not-classified";
    }
    if (kind === "competitive") {
      state.filters.browseSort = "recent-meta";
      state.filters.browseTag = "Any";
      state.filters.browsePool = "main";
    }
    if (kind === "latest-set") {
      state.filters.browseSet = getLatestBoosterSetCode() || "Any";
      state.filters.browseSort = "number";
    }
    if (["keep", "watch", "bulk"].includes(kind)) {
      state.filters.browseMetaSignal = kind;
      state.filters.browseSort = kind === "bulk" ? "alpha" : "recent-meta";
    }
    if (kind === "price-high") {
      state.filters.browseSort = "price-high";
    }
    state.ui.view = "cards";
    persistState();
    renderAll();
  }

  function applyPackageFilter(packageCode) {
    const code = normalizeUpper(packageCode);
    if (!code) {
      return;
    }
    resetBrowseFilters(false);
    if (code === "RESOURCE") {
      state.filters.browsePool = "resource";
    } else if (LIBRARY_CARDS.some((card) => (card.packageCodes || []).includes(code))) {
      state.filters.browseSet = code;
    } else {
      state.filters.browsePackageCode = code;
    }
    state.filters.browseSort = "number";
    state.filters.browsePage = 1;
    state.ui.view = "cards";
    tacticalPulse("applied");
    persistState();
    renderAll();
  }

  function resetBrowseFilters(shouldRender = true) {
    Object.assign(state.filters, {
      browseSearch: "",
      browseCode: "",
      browsePool: "all",
      browseSet: "Any",
      browsePackageCode: "Any",
      browseColor: "Any",
      browseType: "Any",
      browseRarity: "Any",
      browseCost: "",
      browseLevel: "",
      browseTrait: "",
      browseStatus: "Any",
      browseClassification: "Any",
      browsePlayset: "Any",
      browseVanilla: "Any",
      browsePromo: "Any",
      browseSource: "Any",
      browseAltArt: "Any",
      browseMetaSignal: "Any",
      browseTag: "Any",
      browseSort: "recent-meta",
      browsePage: 1,
    });
    if (shouldRender) {
      tacticalPulse("reset");
      persistState();
      renderAll();
    }
  }

  function syncLayoutButtons(scope, mode) {
    document.querySelectorAll(`[data-layout-scope="${scope}"]`).forEach((button) => {
      button.classList.toggle("is-active", button.dataset.layoutMode === mode);
    });
  }

  function assignStatePath(path, value) {
    if (path.length === 1) {
      state[path[0]] = value;
      return;
    }
    state[path[0]][path[1]] = value;
  }

  function sortTableCards(cards) {
    const dir = state.table.dir === "desc" ? -1 : 1;
    return cards.slice().sort((left, right) => {
      const leftRecord = getCollection(left.cardNumber);
      const rightRecord = getCollection(right.cardNumber);
      const selectors = {
        cardNumber: [left.cardNumber, right.cardNumber],
        cardName: [left.cardName, right.cardName],
        color: [left.color, right.color],
        cardType: [left.cardType, right.cardType],
        rarity: [left.rarity, right.rarity],
        set: [(left.packageCodes || [])[0], (right.packageCodes || [])[0]],
        quantity: [leftRecord.quantity, rightRecord.quantity],
        classification: [leftRecord.classification, rightRecord.classification],
        playset: [Number(leftRecord.keepPlayset), Number(rightRecord.keepPlayset)],
        metaSignal: [metaSignalRank(getMetaSignal(left).value), metaSignalRank(getMetaSignal(right).value)],
        price: [priceSortValue(left), priceSortValue(right)],
      };
      const values = selectors[state.table.sort] || selectors.cardNumber;
      if (typeof values[0] === "number" || typeof values[1] === "number") {
        return (Number(values[0] || 0) - Number(values[1] || 0)) * dir;
      }
      return compareText(values[0], values[1]) * dir;
    });
  }

  function tableHeader(sort, labelText, sortable = true) {
    const marker = state.table.sort === sort ? (state.table.dir === "asc" ? " ▲" : " ▼") : "";
    return `<th ${sortable ? `data-table-sort="${escapeAttribute(sort)}"` : ""}>${escapeHtml(labelText)}${marker}</th>`;
  }

  function renderPagination(pageCount) {
    if (pageCount <= 1) {
      return "";
    }
    const current = state.filters.browsePage;
    const pages = new Set([1, pageCount, current - 1, current, current + 1]);
    return Array.from(pages)
      .filter((page) => page >= 1 && page <= pageCount)
      .sort((a, b) => a - b)
      .map((page) => `<button type="button" class="${page === current ? "is-active" : ""}" data-page="${page}">${page}</button>`)
      .join("");
  }

  function buildCardBadges(card) {
    const record = getCollection(card.cardNumber);
    const badges = [];
    if (card.isVanilla) badges.push(badgeMarkup("Vanilla"));
    if (card.isPromo) badges.push(badgeMarkup("Promo", "red"));
    if (card.isAltArt) badges.push(badgeMarkup("Alt Art", "purple"));
    if (Number(card.recentMetaScore || 0) >= 35) badges.push(badgeMarkup("Staple", "gold"));
    if (numericValue(card.cost) <= 2 && card.librarySection !== "resource") badges.push(badgeMarkup("Low cost", "green"));
    if (record.keepPlayset) badges.push(badgeMarkup("Keep playset", "green"));
    if (record.sellTrade || ["sale", "trade"].includes(record.status)) badges.push(badgeMarkup("Sell/trade", "red"));
    if (record.classification && record.classification !== "not-classified") badges.push(classificationBadgeMarkup(record.classification));
    return badges.slice(0, 7);
  }

  function getMetaSignal(card) {
    const record = getCollection(card.cardNumber);
    const classification = record.classification;
    const recentMeta = Number(card.recentMetaScore || 0);
    const overallMeta = Number(card.overallMetaScore || 0);
    const recentUse = Number(card.recentTop8DecksUsing || 0);
    const allUse = Number(card.allTop8DecksUsing || 0);
    const marketPrice = Number(card.marketPriceUsd || 0);

    if (["keep-playset", "staple", "meta-relevant"].includes(classification) || record.keepPlayset) {
      return { value: "keep", label: "KEEP", tone: "green", reason: "Marked as a collection priority." };
    }
    if (classification === "bulk") {
      return { value: "bulk", label: "BULK", tone: "muted", reason: "Marked as bulk in the collection." };
    }
    if (["sideboard-meta-call", "useful-low-cost", "collectible", "store-promo", "event-promo", "alt-art", "hold-value"].includes(classification)) {
      return { value: "watch", label: "WATCH", tone: "gold", reason: "Local classification calls for monitoring." };
    }

    if (recentMeta >= 15 || overallMeta >= 20 || recentUse >= 40 || allUse >= 120) {
      return { value: "keep", label: "KEEP", tone: "green", reason: "Strong presence in meta results." };
    }
    if (recentMeta >= 3 || overallMeta >= 5 || recentUse > 0 || allUse >= 8 || marketPrice >= 2) {
      return { value: "watch", label: "WATCH", tone: "gold", reason: "Moderate meta signal, spot usage, or relevant price." };
    }
    return { value: "bulk", label: "BULK", tone: "muted", reason: "No strong competitive/price signal in current data." };
  }

  function metaSignalMarkup(card) {
    const signal = getMetaSignal(card);
    return `
      <span class="meta-signal meta-signal--${escapeAttribute(signal.value)}" title="${escapeAttribute(signal.reason)}">
        <small>Meta Signal</small>
        <strong>${escapeHtml(signal.label)}</strong>
      </span>
    `;
  }

  function marketReferenceMarkup(card) {
    const content = `
      <span>Price</span>
      <strong>${Number.isFinite(card.marketPriceBrlX5) ? escapeHtml(formatBrl(card.marketPriceBrlX5)) : escapeHtml(label("text.noPrice"))}</strong>
      <small>${Number.isFinite(card.marketPriceUsd) ? escapeHtml(formatUsd(card.marketPriceUsd)) : "USD -"}</small>
    `;
    if (card.tcgplayerUrl) {
      return `<a class="market-reference" href="${escapeAttribute(card.tcgplayerUrl)}" target="_blank" rel="noreferrer">${content}</a>`;
    }
    return `<span class="market-reference">${content}</span>`;
  }

  function priceCellMarkup(card) {
    if (!Number.isFinite(card.marketPriceUsd)) {
      return `<span class="muted">${escapeHtml(label("text.noPrice"))}</span>`;
    }
    const content = `${escapeHtml(formatBrl(card.marketPriceBrlX5))}<br /><small>${escapeHtml(formatUsd(card.marketPriceUsd))}</small>`;
    return card.tcgplayerUrl
      ? `<a href="${escapeAttribute(card.tcgplayerUrl)}" target="_blank" rel="noreferrer">${content}</a>`
      : content;
  }

  function metaSignalRank(value) {
    return { keep: 0, watch: 1, bulk: 2 }[value] ?? 3;
  }

  function classificationBadgeMarkup(value) {
    const row = CLASSIFICATIONS.find((item) => item.value === value) || CLASSIFICATIONS[0];
    return badgeMarkup(classificationLabel(row.value), row.tone);
  }

  function priceBadgeMarkup(card) {
    if (!Number.isFinite(card.marketPriceUsd)) {
      return badgeMarkup(label("text.noPrice"));
    }
    return badgeMarkup(`${formatBrl(card.marketPriceBrlX5)} / ${formatUsd(card.marketPriceUsd)}`, "green");
  }

  function dashboardCard(title, value, detail) {
    return `
      <article class="dashboard-card">
        <span>${escapeHtml(title)}</span>
        <strong>${escapeHtml(String(value))}</strong>
        <small>${escapeHtml(detail || "")}</small>
      </article>
    `;
  }

  function statListMarkup(rows, total, limit) {
    return rows
      .slice(0, limit)
      .map((row) => {
        const pct = total ? Math.round((row.count / total) * 100) : 0;
        return `
          <div class="stat-item">
            <span>${escapeHtml(row.label || "-")}</span>
            <strong>${row.count}</strong>
            <div class="stat-bar"><span style="width:${pct}%"></span></div>
          </div>
        `;
      })
      .join("");
  }

  function renderMiniCard(card) {
    const isPreview = Boolean(card.isPreview);
    const meta = isPreview
      ? `${card.productCode || "Preview"} / ${card.previewStatus === "preview_only" ? "Pre-release" : "Mapped preview"}`
      : `${(card.packageCodes || [])[0] || "-"} / ${card.rarity || "-"}`;
    return `
      <button class="quick-card ${isPreview ? "quick-card--preview" : ""}" type="button" ${isPreview ? `data-preview-link="${escapeAttribute(card.sourceUrl || "")}"` : `data-card-select="${escapeAttribute(card.cardNumber)}"`}>
        ${artFrameMarkup(card, "art-frame art-frame--mini")}
        <span>${escapeHtml(card.cardNumber || card.productCode || "Preview")}</span>
        <strong>${escapeHtml(card.cardName)}</strong>
        <small>${escapeHtml(meta)}</small>
      </button>
    `;
  }

  function artFrameMarkup(card, className) {
    const image = card.imageUrl ? `<img src="${escapeAttribute(card.imageUrl)}" alt="${escapeAttribute(card.cardName)}" loading="lazy" />` : "";
    return `
      <span class="${escapeAttribute(className)}">
        ${image}
        ${image ? "" : `<span class="art-placeholder">${escapeHtml(card.cardName || card.cardNumber)}</span>`}
      </span>
    `;
  }

  function detailStat(title, value) {
    return `<div class="detail-stat"><span>${escapeHtml(title)}</span><strong>${escapeHtml(String(value || "-"))}</strong></div>`;
  }

  function detailGroup(title, values) {
    const list = (values || []).filter(Boolean);
    return `
      <div class="detail-group">
        <strong>${escapeHtml(title)}</strong>
        <div class="badge-row">${list.length ? list.map((value) => badgeMarkup(value)).join("") : badgeMarkup(label("text.none"))}</div>
      </div>
    `;
  }

  function badgeMarkup(text, tone) {
    const toneClass = tone && tone !== "muted" ? ` badge--${tone}` : "";
    return `<span class="badge${toneClass}">${escapeHtml(text || "-")}</span>`;
  }

  function checkMarkup(field, text, checked) {
    return `
      <label class="check-row">
        <input type="checkbox" ${checked ? "checked" : ""} data-collection-field="${escapeAttribute(field)}" />
        <span>${escapeHtml(text)}</span>
      </label>
    `;
  }

  function optionMarkup(option, value) {
    return `<option value="${escapeAttribute(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`;
  }

  function emptyState(text) {
    return `<div class="empty-state">${escapeHtml(text)}</div>`;
  }

  function colorMarkup(color) {
    return `<span class="color-dot color-dot--${escapeAttribute(normalize(color) || "neutral")}"></span>`;
  }

  function colorTone(color) {
    const value = normalize(color);
    return ["blue", "green", "red", "white", "purple"].includes(value) ? value : "muted";
  }

  function getSetCounts() {
    const counts = new Map();
    LIBRARY_CARDS.forEach((card) => {
      (card.packageCodes || []).forEach((code) => counts.set(code, (counts.get(code) || 0) + 1));
    });
    return Array.from(counts, ([labelText, count]) => ({ label: labelText, count })).sort((left, right) => compareSetCode(right.label, left.label));
  }

  function getDashboardLatestEntries() {
    const previewOnly = PREVIEWS.filter((preview) => preview.previewStatus === "preview_only")
      .sort((left, right) => compareDateish(right.productReleaseDate || right.sourceDate, left.productReleaseDate || left.sourceDate));
    const latestSetCode = getLatestBoosterSetCode();
    const latestSetCards = latestSetCode
      ? LIBRARY_CARDS.filter((card) => (card.packageCodes || []).includes(latestSetCode)).sort((left, right) => compareText(left.cardNumber, right.cardNumber))
      : sortNewestCards(LIBRARY_CARDS);
    return previewOnly.concat(latestSetCards);
  }

  function getLatestBoosterSetCode() {
    const codes = uniqueValues(
      LIBRARY_CARDS.flatMap((card) => card.packageCodes || []),
      (code) => code,
    ).filter((code) => /^GD\d+$/i.test(code));
    return codes.sort((left, right) => setRank(right) - setRank(left))[0] || "";
  }

  function sortNewestCards(cards) {
    return cards.slice().sort((left, right) => compareSetCode((right.packageCodes || [right.cardNumber])[0], (left.packageCodes || [left.cardNumber])[0]) || compareText(right.cardNumber, left.cardNumber));
  }

  function compareDateish(left, right) {
    const leftTime = parseDateish(left);
    const rightTime = parseDateish(right);
    return leftTime - rightTime || compareText(left, right);
  }

  function parseDateish(value) {
    const cleaned = String(value || "").replace(/,(\d{4})/, ", $1");
    const parsed = new Date(cleaned);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  function getRatingSubjects() {
    return MAIN_CARDS.concat(PREVIEWS.filter((preview) => preview.previewStatus === "preview_only"));
  }

  function ratingKey(subject) {
    return subject.isPreview ? `preview:${subject.previewId}` : `card:${subject.cardNumber}`;
  }

  function findRatingSubject(key) {
    if (!key) {
      return null;
    }
    if (key.startsWith("preview:")) {
      const previewId = key.slice("preview:".length);
      return PREVIEWS.find((preview) => preview.previewId === previewId) || null;
    }
    const cardNumber = key.replace(/^card:/, "");
    return libraryByNumber.get(cardNumber) || null;
  }

  function pickRandomRatingKey(exceptKey) {
    const subjects = getRatingSubjects();
    if (!subjects.length) {
      return "";
    }
    const filtered = subjects.filter((subject) => ratingKey(subject) !== exceptKey);
    const pool = filtered.length ? filtered : subjects;
    return ratingKey(pool[Math.floor(Math.random() * pool.length)]);
  }

  function compareSetCode(left, right) {
    const leftRank = setRank(left);
    const rightRank = setRank(right);
    return leftRank - rightRank || compareText(left, right);
  }

  function setRank(value) {
    const text = String(value || "");
    const match = text.match(/([A-Z]+)(\d+)/i);
    if (!match) return 0;
    const prefixRank = { GD: 900, ST: 700, EX: 600, RP: 500, PR: 400 }[match[1].toUpperCase()] || 100;
    return prefixRank + Number(match[2] || 0);
  }

  function getFeaturedCards(count) {
    return MAIN_CARDS.slice().sort((left, right) => Number(right.recentMetaScore || 0) - Number(left.recentMetaScore || 0) || compareText(left.cardName, right.cardName)).slice(0, count);
  }

  function getThemePilotCard() {
    const themeConfig = THEME_CONFIG[state.ui.theme] || THEME_CONFIG["wing-zero"];
    const pilotNames = themeConfig.pilotCandidates || [themeConfig.pilot].filter(Boolean);
    const matches = LIBRARY_CARDS.filter((card) => normalizeUpper(card.cardType) === "PILOT")
      .map((card) => ({ card, score: pilotThemeScore(card, pilotNames) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || compareSetCode(right.card.packageCodes?.[0], left.card.packageCodes?.[0]) || compareText(left.card.cardName, right.card.cardName));
    return withPreferredPilotPrinting(matches[0]?.card || getFeaturedCards(1)[0] || LIBRARY_CARDS[0]);
  }

  function pilotThemeScore(card, pilotNames) {
    const cardName = normalize(card.cardName);
    const matchedName = pilotNames.find((name) => cardName === normalize(name) || cardName.includes(normalize(name)));
    if (!matchedName) {
      return 0;
    }
    const rarity = normalizeUpper(card.rarity);
    const searchBlob = normalizeUpper(`${card.cardNumber} ${card.cardName} ${card.rarity} ${(card.packageLabels || []).join(" ")} ${card.whereToGetIt || ""}`);
    let score = cardName === normalize(matchedName) ? 1000 : 850;
    if (rarity === "SP") {
      score += 500;
    }
    if (rarity === "LR+" || rarity === "R+") {
      score += 220;
    }
    if (searchBlob.includes("ALT") || searchBlob.includes("ALTERNATE") || searchBlob.includes("PARALLEL")) {
      score += 420;
    }
    if (card.imageUrl) {
      score += 80;
    }
    score += bestPilotPrintingScore(card);
    score += Math.min(Number(card.recentMetaScore || 0), 50);
    return score;
  }

  function withPreferredPilotPrinting(card) {
    if (!card) {
      return card;
    }
    const printings = Array.isArray(card.printings) ? card.printings : [];
    const themeConfig = THEME_CONFIG[state.ui.theme] || {};
    const preferredPrinting = themeConfig.preferredPilotPrinting
      ? printings.find((printing) => normalizeUpper(printing.detailSearchId) === normalizeUpper(themeConfig.preferredPilotPrinting))
      : null;
    const bestPrinting = preferredPrinting || printings.slice().sort((left, right) => pilotPrintingScore(right) - pilotPrintingScore(left))[0];
    if (!bestPrinting) {
      return card;
    }
    return {
      ...card,
      imageUrl: bestPrinting.imageUrl || card.imageUrl,
      rarity: bestPrinting.rarity || card.rarity,
      detailUrl: bestPrinting.detailUrl || card.detailUrl,
      detailSearchId: bestPrinting.detailSearchId || card.detailSearchId,
      variantCode: bestPrinting.variantCode || card.variantCode,
      isParallelVariant: Boolean(bestPrinting.isParallelVariant),
      displayCardNumber: bestPrinting.detailSearchId || card.cardNumber,
    };
  }

  function bestPilotPrintingScore(card) {
    const printings = Array.isArray(card.printings) ? card.printings : [];
    return printings.reduce((best, printing) => Math.max(best, pilotPrintingScore(printing)), 0);
  }

  function pilotPrintingScore(printing) {
    if (!printing) {
      return 0;
    }
    const rarity = normalizeUpper(printing.rarity);
    const variantCode = normalizeUpper(printing.variantCode);
    const variantNumber = Number((variantCode.match(/\d+/) || [0])[0] || 0);
    let score = printing.imageUrl ? 100 : 0;
    if (printing.isParallelVariant) {
      score += 1000;
    }
    if (rarity.includes("+") || rarity === "SP" || rarity === "LR+") {
      score += 260;
    }
    score += Math.min(variantNumber, 30);
    return score;
  }

  function renderPackageBreakdownPanel(cards) {
    const rows = getPackageBreakdown(cards, 7);
    const total = cards.length;
    const colors = ["#00e5ff", "#4bb8ff", "#37ffbc", "#f5c400", "#ff5f7d", "#8f6dff", "#c8f7ff"];
    let cursor = 0;
    const stops = rows.map((row, index) => {
      const start = total ? (cursor / total) * 100 : 0;
      cursor += row.count;
      const end = total ? (cursor / total) * 100 : 100;
      return `${colors[index % colors.length]} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    }).join(", ") || "#13314a 0% 100%";
    const largest = rows[0];
    return `
      <section class="package-breakdown" aria-label="Product distribution">
        <div class="package-breakdown__donut" style="--package-donut: ${escapeAttribute(stops)}">
          <span>${escapeHtml(String(total))}</span>
          <small>units</small>
        </div>
        <div class="package-breakdown__body">
          <p class="package-breakdown__eyebrow">Data Filter Feed</p>
          <strong>${escapeHtml(formatNumber(total))} units found</strong>
          <span>${largest ? `${escapeHtml(largest.label)} holds ${escapeHtml(String(Math.round((largest.count / total) * 100)))}% of the active database.` : "No product detected."}</span>
          <div class="package-breakdown__legend">
            ${rows.map((row, index) => `
              <button type="button" class="package-breakdown__row" style="--row-color: ${colors[index % colors.length]}" data-package-filter="${escapeAttribute(row.label)}" title="Open ${escapeAttribute(row.label)} in Tactical DB">
                <i></i>
                <b>${escapeHtml(row.label)}</b>
                <em>${escapeHtml(String(row.count))}</em>
              </button>
            `).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function getPackageBreakdown(cards, limit) {
    const counts = new Map();
    cards.forEach((card) => {
      const code = packageCodeForCard(card);
      counts.set(code, (counts.get(code) || 0) + 1);
    });
    const rows = Array.from(counts, ([labelText, count]) => ({ label: labelText, count }))
      .sort((left, right) => right.count - left.count || compareSetCode(right.label, left.label));
    const visible = rows.slice(0, limit);
    const hidden = rows.slice(limit).reduce((sum, row) => sum + row.count, 0);
    if (hidden) {
      visible.push({ label: "OTHERS", count: hidden });
    }
    return visible;
  }

  function packageCodeForCard(card) {
    const packageCode = (card.packageCodes || []).find((code) => /^(GD|ST|EX|PR)\d+/i.test(code)) || (card.packageCodes || [])[0];
    if (packageCode) {
      return normalizeUpper(packageCode);
    }
    const cardPrefix = String(card.cardNumber || "").match(/^([A-Z]+\d+)/i);
    if (cardPrefix) {
      return normalizeUpper(cardPrefix[1]);
    }
    return normalizeUpper(card.cardType) === "RESOURCE" ? "RESOURCE" : "OTHERS";
  }

  function getRelatedPrintings(card) {
    const name = normalize(card.cardName);
    return LIBRARY_CARDS.filter((candidate) => normalize(candidate.cardName) === name && candidate.cardNumber !== card.cardNumber);
  }

  function matchesBoolFilter(value, filter) {
    if (!filter || filter === "Any") return true;
    return filter === "yes" ? Boolean(value) : !Boolean(value);
  }

  function compareNumericFilter(cardValue, query) {
    const text = String(query || "").trim();
    const range = text.match(/^(-?\d+(?:\.\d+)?)\s*(?:-|\.\.)\s*(-?\d+(?:\.\d+)?)$/);
    const actual = Number.parseFloat(cardValue);
    if (range && Number.isFinite(actual)) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      return actual >= Math.min(start, end) && actual <= Math.max(start, end);
    }
    const match = text.match(/^(<=|>=|=|<|>)?\s*(-?\d+(?:\.\d+)?)$/);
    if (!match || !Number.isFinite(actual)) {
      return normalize(String(cardValue)).includes(normalize(text));
    }
    const operator = match[1] || "=";
    const expected = Number(match[2]);
    if (operator === "<=") return actual <= expected;
    if (operator === ">=") return actual >= expected;
    if (operator === "<") return actual < expected;
    if (operator === ">") return actual > expected;
    return actual === expected;
  }

  function matchesLoose(haystack, needle) {
    return normalize(haystack).includes(normalize(needle));
  }

  function parseCsv(text) {
    const lines = String(text || "").split(/\r?\n/).filter((line) => line.trim());
    if (!lines.length) {
      return [];
    }
    const headers = splitCsvLine(lines[0]).map((header) => normalize(header).replace(/\s+/g, ""));
    return lines.slice(1).map((line) => {
      const values = splitCsvLine(line);
      return headers.reduce((row, header, index) => {
        row[header] = values[index] || "";
        return row;
      }, {});
    });
  }

  function splitCsvLine(line) {
    const output = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        output.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    output.push(current);
    return output.map((value) => value.trim());
  }

  function toCsv(rows) {
    if (!rows.length) {
      return "";
    }
    const headers = Object.keys(rows[0]);
    return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function applyTranslations() {
    document.documentElement.lang = "en";
    document.title = "TCG Tactical Database";
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const value = label(element.dataset.i18n);
      if (value) {
        element.textContent = value;
      }
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      const value = label(element.dataset.i18nPlaceholder);
      if (value) {
        element.setAttribute("placeholder", value);
      }
    });
  }

  function translatedOptions(options) {
    return options.map((option) => ({
      value: option.value,
      label: option.labelEn || option.labelPt || option.value,
    }));
  }

  function optionList(values) {
    return values.filter(Boolean).map((value) => ({ value, label: value === "Any" ? label("text.any") : value }));
  }

  function fillSelect(element, options) {
    if (!element) return;
    const current = element.value;
    element.innerHTML = options.map((option) => `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</option>`).join("");
    if (options.some((option) => option.value === current)) {
      element.value = current;
    }
  }

  function setValue(element, value) {
    if (element && element.value !== String(value ?? "")) {
      element.value = value ?? "";
    }
  }

  function bind(element, eventName, handler) {
    if (element) {
      element.addEventListener(eventName, handler);
    }
  }

  function label(path) {
    return resolvePath(I18N.en, path) ?? resolvePath(I18N["pt-BR"], path) ?? "";
  }

  function resolvePath(object, path) {
    return String(path || "").split(".").reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), object);
  }

  function classificationLabel(value) {
    const row = CLASSIFICATIONS.find((item) => item.value === value) || CLASSIFICATIONS[0];
    return row.labelEn || row.labelPt;
  }

  function statusLabel(value) {
    const row = STATUS_OPTIONS.find((item) => item.value === value) || STATUS_OPTIONS[0];
    return row.labelEn || row.labelPt;
  }

  function persistState() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        deckName: state.deckName,
        ui: state.ui,
        inputs: state.inputs,
        filters: state.filters,
        table: state.table,
        deck: state.deck,
        collection: state.collection,
        ratings: state.ratings,
      }),
    );
    persistHash();
  }

  function persistHash() {
    const params = new URLSearchParams();
    params.set(HASH_VIEW_KEY, state.ui.view);
    const payload = {
      deckName: state.deckName,
      main: compactSection(state.deck.main),
      resource: compactSection(state.deck.resource),
    };
    if (Object.keys(payload.main).length || Object.keys(payload.resource).length) {
      params.set(HASH_DECK_KEY, encodeBase64Url(JSON.stringify(payload)));
    }
    try {
      history.replaceState(null, "", `#${params.toString()}`);
    } catch {
      // File URLs can reject hash writes in some browser contexts.
    }
  }

  function loadStateFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function decodeHashState() {
    try {
      const params = new URLSearchParams(location.hash.replace(/^#/, ""));
      const view = params.get(HASH_VIEW_KEY);
      const deck = params.get(HASH_DECK_KEY);
      const payload = deck ? JSON.parse(decodeBase64Url(deck)) : {};
      return { view, ...payload };
    } catch {
      return null;
    }
  }

  function copyShareLink() {
    const payload = {
      deckName: state.deckName,
      main: compactSection(state.deck.main),
      resource: compactSection(state.deck.resource),
    };
    const params = new URLSearchParams();
    params.set(HASH_VIEW_KEY, "builder");
    params.set(HASH_DECK_KEY, encodeBase64Url(JSON.stringify(payload)));
    const base = location.origin && location.origin !== "null" ? `${location.origin}${location.pathname}` : location.href.split("#")[0];
    copyText(`${base}#${params.toString()}`);
  }

  async function copyText(text) {
    const value = String(text || "");
    if (!value) {
      showToast("Nada para copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    showToast(label("text.copied"));
  }

  function downloadText(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(label("text.downloaded"));
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      elements.toast.hidden = true;
    }, 2600);
  }

  function sanitizeCard(card, librarySection) {
    const cleaned = {
      ...card,
      librarySection,
      cardNumber: normalizeUpper(card.cardNumber),
      cardName: repairText(card.cardName),
      color: repairText(card.color || "Neutral"),
      cardType: normalizeUpper(card.cardType),
      level: repairText(card.level || "-"),
      cost: repairText(card.cost || "-"),
      rarity: repairText(card.rarity || "-"),
      ap: repairText(card.ap || "-"),
      hp: repairText(card.hp || "-"),
      effectPreview: repairText(card.effectPreview),
      whereToGetIt: repairText(card.whereToGetIt),
      sourceTitle: repairText(card.sourceTitle),
      traits: (card.traits || []).map(repairText),
      linkTargets: (card.linkTargets || []).map(repairText),
      synergyTags: (card.synergyTags || []).map(repairText),
      packageCodes: (card.packageCodes || []).map(repairText),
      packageLabels: (card.packageLabels || []).map(repairText),
      topArchetypes: card.topArchetypes || [],
      topColorPairs: card.topColorPairs || [],
      recentMetaScore: Number(card.recentMetaScore || 0),
      overallMetaScore: Number(card.overallMetaScore || 0),
      copyLimit: Number(card.copyLimit || RULES.defaultCopyLimit || 4),
      marketPriceUsd: parseOptionalNumber(card.marketPriceUsd),
      marketPriceBrlX5: parseOptionalNumber(card.marketPriceBrlX5),
      lowPriceUsd: parseOptionalNumber(card.lowPriceUsd),
      midPriceUsd: parseOptionalNumber(card.midPriceUsd),
      highPriceUsd: parseOptionalNumber(card.highPriceUsd),
    };
    const sourceBlob = normalize([cleaned.whereToGetIt, cleaned.sourceTitle, (cleaned.packageLabels || []).join(" ")].join(" "));
    cleaned.isVanilla = !normalize(cleaned.effectPreview) || ["-", "none"].includes(normalize(cleaned.effectPreview));
    cleaned.isPromo = /promo|promotion/.test(sourceBlob);
    cleaned.isAltArt = /\+/.test(cleaned.rarity || "") || /alt art|alternate|parallel/.test(sourceBlob);
    cleaned.sourceChannels = detectSourceChannels(cleaned, sourceBlob);
    cleaned.keywordBlob = normalize([cleaned.traits.join(" "), cleaned.linkTargets.join(" "), cleaned.synergyTags.join(" "), cleaned.effectPreview].join(" "));
    cleaned.searchBlob = normalize(
      [
        cleaned.cardNumber,
        cleaned.cardName,
        cleaned.color,
        cleaned.cardType,
        cleaned.rarity,
        cleaned.level,
        cleaned.cost,
        cleaned.effectPreview,
        cleaned.whereToGetIt,
        cleaned.sourceTitle,
        cleaned.traits.join(" "),
        cleaned.linkTargets.join(" "),
        cleaned.synergyTags.join(" "),
        cleaned.packageCodes.join(" "),
        cleaned.packageLabels.join(" "),
      ].join(" "),
    );
    return cleaned;
  }

  function sanitizePreview(preview) {
    const cardNumber = normalizeUpper(preview.cardNumberHint);
    const cardName = repairText(preview.cardNameHint || preview.sectionHeading || cardNumber || preview.productName || "Official preview");
    return {
      ...preview,
      isPreview: true,
      previewId: repairText(preview.previewId),
      classification: repairText(preview.classification),
      previewStatus: repairText(preview.previewStatus),
      sourceTitle: repairText(preview.sourceTitle),
      sourceDate: repairText(preview.sourceDate),
      sourceUrl: repairText(preview.sourceUrl),
      productCode: normalizeUpper(preview.productCode),
      productName: repairText(preview.productName),
      productReleaseDate: repairText(preview.productReleaseDate),
      cardNumber,
      cardName,
      imageUrl: repairText(preview.imageUrl),
      effectPreview: repairText(preview.contextText),
      searchBlob: normalize(
        [
          cardNumber,
          cardName,
          preview.productCode,
          preview.productName,
          preview.previewStatus,
          preview.sourceTitle,
          preview.contextText,
        ].join(" "),
      ),
    };
  }

  function detectSourceChannels(card, sourceBlob) {
    const channels = new Set();
    if ((card.packageCodes || []).some((code) => /^GD\d+/i.test(code)) || /booster/.test(sourceBlob)) channels.add("booster");
    if (/store|shop/.test(sourceBlob)) channels.add("store");
    if (/winner/.test(sourceBlob)) channels.add("winner");
    if (/participant/.test(sourceBlob)) channels.add("participant");
    if (/event|tournament|promo|promotion/.test(sourceBlob)) channels.add("event");
    return Array.from(channels);
  }

  function sanitizeArchetype(row) {
    return {
      ...row,
      archetype: repairText(row.archetype),
      commonColorCombination: repairText(row.commonColorCombination),
      templateConfidence: repairText(row.templateConfidence),
      templateScope: repairText(row.templateScope),
      searchText: repairText(row.searchText || ""),
    };
  }

  function sanitizeTemplateRow(row) {
    return {
      ...row,
      archetype: repairText(row.archetype),
      cardName: repairText(row.cardName),
      cardNumber: normalizeUpper(row.cardNumber),
      roleClass: repairText(row.roleClass || "core"),
      recommendedQuantity: Math.max(1, Math.min(4, Number(row.recommendedQuantity || 1))),
      inclusionRate: Number(row.inclusionRate || 0),
    };
  }

  function repairText(value) {
    const text = String(value || "");
    if (!/[ÃƒÃ‚Ã£Ã¢]/.test(text)) {
      return text;
    }
    try {
      return decodeURIComponent(escape(text));
    } catch {
      return text;
    }
  }

  function uniqueValues(list, selector) {
    return Array.from(new Set(list.map(selector).filter(Boolean))).sort(compareText);
  }

  function countBy(list, selector) {
    const counts = new Map();
    list.forEach((item) => {
      const key = selector(item) || "-";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts, ([labelText, count]) => ({ label: labelText, count })).sort((left, right) => right.count - left.count || compareText(left.label, right.label));
  }

  function groupBy(list, selector) {
    const map = new Map();
    list.forEach((item) => {
      const key = selector(item);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return map;
  }

  function roleRank(role) {
    return { core: 0, support: 1, tech: 2 }[normalize(role)] ?? 99;
  }

  function compactSection(section) {
    return Object.entries(section || {}).reduce((output, [cardNumber, qty]) => {
      if (Number(qty) > 0) {
        output[cardNumber] = Number(qty);
      }
      return output;
    }, {});
  }

  function mergeDeep(base, override) {
    const output = Array.isArray(base) ? base.slice() : { ...(base || {}) };
    if (!override || typeof override !== "object") {
      return output;
    }
    Object.entries(override).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value) && output[key] && typeof output[key] === "object" && !Array.isArray(output[key])) {
        output[key] = mergeDeep(output[key], value);
      } else {
        output[key] = value;
      }
    });
    return output;
  }

  function parseOptionalNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function numericValue(value) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : 999;
  }

  function priceSortValue(card) {
    return Number.isFinite(card.marketPriceUsd) ? Number(card.marketPriceUsd) : 999999;
  }

  function comparePrice(left, right, direction) {
    const leftHasPrice = Number.isFinite(left.marketPriceUsd);
    const rightHasPrice = Number.isFinite(right.marketPriceUsd);
    if (leftHasPrice && !rightHasPrice) return -1;
    if (!leftHasPrice && rightHasPrice) return 1;
    if (!leftHasPrice && !rightHasPrice) return 0;
    return direction === "desc"
      ? Number(right.marketPriceUsd) - Number(left.marketPriceUsd)
      : Number(left.marketPriceUsd) - Number(right.marketPriceUsd);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat(state.ui.language, { maximumFractionDigits: 1 }).format(Number(value || 0));
  }

  function formatUsd(value) {
    if (!Number.isFinite(value)) return "-";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
  }

  function formatBrl(value) {
    if (!Number.isFinite(value)) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
  }

  function average(list, selector) {
    if (!list.length) return 0;
    return list.reduce((sum, item) => sum + Number(selector(item) || 0), 0) / list.length;
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function normalizeUpper(value) {
    return String(value || "").trim().toUpperCase();
  }

  function parseBool(value) {
    return ["1", "true", "yes", "sim", "s"].includes(normalize(value));
  }

  function compareText(left, right) {
    return String(left || "").localeCompare(String(right || ""), "en");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value || 0)));
  }

  function round(value, digits) {
    const factor = 10 ** digits;
    return Math.round(Number(value || 0) * factor) / factor;
  }

  function slugify(value) {
    return normalize(value || "gundam-deck")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "gundam-deck";
  }

  function detectDefaultLanguage() {
    return "en";
  }

  function getDefaultDeckName(language) {
    return "Untitled Gundam Deck";
  }

  function encodeBase64Url(text) {
    return btoa(unescape(encodeURIComponent(text))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function decodeBase64Url(text) {
    const normalized = text.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    return decodeURIComponent(escape(atob(normalized + padding)));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }
})();
