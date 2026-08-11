import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_LOCALE,
  getLocaleTag,
  setRuntimeLocale,
  translate,
} from "../src/i18n/translations.js";

test("PT-BR is the default interface language", () => {
  assert.equal(DEFAULT_LOCALE, "pt-BR");
  assert.equal(getLocaleTag(DEFAULT_LOCALE), "pt-BR");
  assert.equal(translate("Cards", "pt-BR"), "Cartas");
  assert.equal(translate("Overview", "pt-BR"), "Visão geral");
  assert.deepEqual(
    [...translate("Overview", "pt-BR")].map((character) => character.codePointAt(0)),
    [86, 105, 115, 227, 111, 32, 103, 101, 114, 97, 108],
  );
  assert.equal(translate("AI Deck Designer", "pt-BR"), "TACTICAL DECK SYSTEM");
  assert.equal(translate("Tactical deck map", "pt-BR"), "Mapa tático do deck");
  assert.equal(translate("MISSION PARAMETERS", "pt-BR"), "PARÂMETROS DA MISSÃO");
  assert.equal(translate("FIT ALL", "pt-BR"), "ENQUADRAR TUDO");
  assert.equal(translate("RESET LAYOUT", "pt-BR"), "REFAZER DISTRIBUIÇÃO");
  assert.equal(translate("DRAW INTELLIGENCE", "pt-BR"), "INTELIGÊNCIA DE COMPRA");
});

test("English mode preserves source interface copy", () => {
  setRuntimeLocale("en");
  assert.equal(translate("Deck builder"), "Deck builder");
  assert.equal(translate("12 cards", "en"), "12 cards");
  setRuntimeLocale(DEFAULT_LOCALE);
});

test("dynamic deck telemetry is localized without changing values", () => {
  assert.equal(translate("12 cards", "pt-BR"), "12 cartas");
  assert.equal(translate("4 links", "pt-BR"), "4 conexões");
  assert.equal(translate("Cost 4", "pt-BR"), "Custo 4");
  assert.equal(translate("3 exact matches", "pt-BR"), "3 correspondências exatas");
  assert.equal(translate("CO-PLAY · 12 LISTS", "pt-BR"), "CO-PLAY · 12 LISTAS");
  assert.match(
    translate("Low synergy (deck context only): Same color. No direct mechanical bridge was detected.", "pt-BR"),
    /Baixa sinergia \(apenas contexto do deck\)/,
  );
  assert.equal(
    translate("DRAW 2 · PRIORITY HITS", "pt-BR"),
    "COMPRA 2 · MELHORES HITS",
  );
});

test("ZERO Forge hover inspection is fully localized", () => {
  assert.equal(translate("DECK COMPOSITION", "pt-BR"), "COMPOSIÇÃO DO DECK");
  assert.equal(translate("UNITS", "pt-BR"), "UNIDADES");
  assert.equal(translate("PILOTS", "pt-BR"), "PILOTOS");
  assert.equal(translate("COMMANDS", "pt-BR"), "COMANDOS");
  assert.equal(translate("BASES", "pt-BR"), "BASES");
  assert.equal(translate("LIVE CARD INSPECTION", "pt-BR"), "INSPEÇÃO DE CARTA AO VIVO");
  assert.equal(translate("LOCKED BY RULES", "pt-BR"), "BLOQUEADA PELAS REGRAS");
  assert.equal(translate("PRINTED LINK / PAIR", "pt-BR"), "LINK / PAIR IMPRESSO");
  assert.equal(translate("SYSTEM PROJECTION · #3", "pt-BR"), "PROJEÇÃO DO SISTEMA · #3");
  assert.equal(translate("IN DECK · LEGAL", "pt-BR"), "NO DECK · VÁLIDA");
  assert.equal(
    translate("Main deck full · 3/4 copies", "pt-BR"),
    "Deck principal cheio · 3/4 cópias",
  );
  assert.equal(
    translate("This is a projected card and has not been added to the deck.", "pt-BR"),
    "Esta é uma carta projetada e ainda não foi adicionada ao deck.",
  );
});

test("ZERO Forge MSA transfer is fully localized", () => {
  assert.equal(translate("IMPORT MSA", "pt-BR"), "IMPORTAR MSA");
  assert.equal(
    translate("Import an MSA deck into the map", "pt-BR"),
    "Importe um deck do MSA para o mapa",
  );
  assert.equal(
    translate("MSA import loaded: 50 recognized cards across 18 card numbers.", "pt-BR"),
    "Importação MSA carregada: 50 cartas reconhecidas em 18 números de carta.",
  );
  assert.equal(
    translate("2 line(s) could not be read and will be ignored.", "pt-BR"),
    "2 linha(s) não puderam ser lidas e serão ignoradas.",
  );
});

test("the tactical debrief fully localizes generated analysis sentences", () => {
  const examples = [
    [
      "Theoretical: 8 cards with Blocker signals provide a meaningful defensive layer.",
      "Teórico: 8 cartas com sinal de Blocker oferecem uma camada defensiva relevante.",
    ],
    [
      "Evidence risk: the relevant competitive sample is small, so flex slots are less stable.",
      "Risco da evidência: a amostra competitiva relevante é pequena, portanto os espaços flexíveis são menos estáveis.",
    ],
    [
      "Theory: 8 Blocker-tagged slots can absorb early attacks.",
      "Teoria: 8 espaços com sinal de Blocker podem absorver ataques iniciais.",
    ],
    [
      "Theory based on 4 draw/search-tagged slots; opponent-level event data is unavailable.",
      "Teoria baseada em 4 espaços com sinais de compra/busca; não há dados de eventos por oponente disponíveis.",
    ],
    [
      "High synergy: Direct LINK/PAIR bridge detected through Heero Yuy. Same color identity: white.",
      "Alta sinergia: Conexão direta de LINK/PAIR detectada por Heero Yuy. Mesma identidade de cor: branco.",
    ],
    [
      "High synergy: Printed text targets G Team · UNIT · Lv.6 or higher. Suggested by textual/heuristic analysis.",
      "Alta sinergia: O texto impresso seleciona G Team · UNIT · Lv.6 ou superior. Sugerida pela análise textual/heurística.",
    ],
  ];

  for (const [source, expected] of examples) {
    assert.equal(translate(source, "pt-BR"), expected);
  }
  assert.equal(translate("Likely stable", "pt-BR"), "Provavelmente estável");
  assert.equal(translate("Potentially fragile", "pt-BR"), "Potencialmente frágil");
  assert.equal(translate("user provided decklist", "pt-BR"), "decklist fornecida pelo usuário");
  assert.equal(
    translate("Legality check: failed under the official rules effective for the current snapshot.", "pt-BR"),
    "Validação de legalidade: reprovada conforme as regras oficiais vigentes para o snapshot atual.",
  );
  assert.equal(
    translate("No competitive list matched the filters. The result uses official card data and theoretical synergy only.", "pt-BR"),
    "Nenhuma lista competitiva correspondeu aos filtros. O resultado usa apenas dados oficiais das cartas e sinergia teórica.",
  );
});
