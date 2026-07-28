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
  assert.equal(translate("AI Deck Designer", "pt-BR"), "BRUXÃO DECK DESIGNER");
  assert.equal(translate("Tactical deck map", "pt-BR"), "Mapa tático do deck");
  assert.equal(translate("MISSION PARAMETERS", "pt-BR"), "PARÂMETROS DA MISSÃO");
  assert.equal(translate("FIT ALL", "pt-BR"), "ENQUADRAR TUDO");
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
});
