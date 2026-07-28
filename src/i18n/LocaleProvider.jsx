import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  setRuntimeLocale,
  translate,
} from "./translations";

const LOCALE_STORAGE_KEY = "gundam-tactical-locale";
const LocaleContext = createContext(null);
const originalText = new WeakMap();
const originalAttributes = new WeakMap();
const TRANSLATED_ATTRIBUTES = ["aria-label", "placeholder", "title"];

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(readInitialLocale);
  setRuntimeLocale(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Language selection still works when browser storage is unavailable.
    }
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    setLocale(nextLocale) {
      if (SUPPORTED_LOCALES.includes(nextLocale)) setLocaleState(nextLocale);
    },
    t(value) {
      return translate(value, locale);
    },
  }), [locale]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
      <DocumentLocaleBridge locale={locale} />
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider.");
  return context;
}

function DocumentLocaleBridge({ locale }) {
  useLayoutEffect(() => {
    const root = document.getElementById("root");
    if (!root) return undefined;

    let frameId = 0;
    const apply = () => {
      frameId = 0;
      localizeTree(root, locale);
    };
    const schedule = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(apply);
    };

    apply();
    const observer = new MutationObserver(schedule);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATED_ATTRIBUTES,
    });
    return () => {
      observer.disconnect();
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [locale]);

  return null;
}

function localizeTree(root, locale) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (shouldTranslateNode(node)) localizeTextNode(node, locale);
    node = walker.nextNode();
  }

  root.querySelectorAll(TRANSLATED_ATTRIBUTES.map((attribute) => `[${attribute}]`).join(",")).forEach((element) => {
    if (element.closest("[data-no-translate]")) return;
    localizeAttributes(element, locale);
  });
}

function shouldTranslateNode(node) {
  const parent = node.parentElement;
  if (!parent || !node.nodeValue?.trim()) return false;
  if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(parent.tagName)) return false;
  return !parent.closest("[data-no-translate]");
}

function localizeTextNode(node, locale) {
  const knownSource = originalText.get(node);
  const knownTranslation = knownSource ? translate(knownSource, "pt-BR") : "";
  if (!knownSource || (node.nodeValue !== knownSource && node.nodeValue !== knownTranslation)) {
    originalText.set(node, node.nodeValue);
  }
  const source = originalText.get(node);
  const next = locale === "pt-BR" ? translate(source, locale) : source;
  if (node.nodeValue !== next) node.nodeValue = next;
}

function localizeAttributes(element, locale) {
  const known = originalAttributes.get(element) || {};
  for (const attribute of TRANSLATED_ATTRIBUTES) {
    if (!element.hasAttribute(attribute)) continue;
    const current = element.getAttribute(attribute);
    const knownTranslation = known[attribute] ? translate(known[attribute], "pt-BR") : "";
    if (!known[attribute] || (current !== known[attribute] && current !== knownTranslation)) {
      known[attribute] = current;
    }
    const next = locale === "pt-BR" ? translate(known[attribute], locale) : known[attribute];
    if (current !== next) element.setAttribute(attribute, next);
  }
  originalAttributes.set(element, known);
}

function readInitialLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (SUPPORTED_LOCALES.includes(stored)) return stored;
  } catch {
    // PT-BR remains the deterministic default.
  }
  return DEFAULT_LOCALE;
}
