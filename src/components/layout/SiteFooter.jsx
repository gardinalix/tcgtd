import { useLocale } from "../../i18n/LocaleProvider";

const LINKS = [
  ["about", "About", "Sobre"],
  ["legal", "Legal / Copyright", "Legal / Copyright"],
  ["terms", "Terms of Use", "Termos de Uso"],
  ["privacy", "Privacy", "Privacidade"],
];

export function SiteFooter({ onViewChange }) {
  const { locale } = useLocale();
  const pt = locale === "pt-BR";
  return (
    <footer className="site-footer">
      <div className="site-footer__brand">
        <strong>TCG TACTICAL DATABASE</strong>
        <span>{pt ? "Projeto comunitário independente // Módulo inicial: Gundam Card Game" : "Independent community project // Initial module: Gundam Card Game"}</span>
      </div>
      <nav aria-label={pt ? "Links institucionais" : "Institutional links"}>
        {LINKS.map(([view, en, br]) => <button type="button" key={view} onClick={() => onViewChange(view)}>{pt ? br : en}</button>)}
      </nav>
      <div className="site-footer__legal">
        <p>TCG Tactical Database is an independent community-created project and is not affiliated with, endorsed by, sponsored by, or officially associated with Bandai Namco, Bandai, Sunrise, or any other publisher, manufacturer, studio, or intellectual property owner represented on this platform.</p>
        <p>All trademarks, logos, character names, card names, artwork, card images, game assets, and related intellectual property are the property of their respective owners. TCG Tactical Database does not claim ownership over third-party intellectual property displayed or referenced on this platform.</p>
        <p>© TCG Tactical Database. All rights reserved regarding the platform&apos;s original software, interface, data organization, analytics, methodologies, tools, documentation, and original content.</p>
      </div>
    </footer>
  );
}
