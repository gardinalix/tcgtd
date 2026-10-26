import { useLocale } from "../i18n/LocaleProvider";

export function InstitutionalPage({ kind, onNavigate }) {
  const { locale } = useLocale();
  const pt = locale === "pt-BR";
  const page = CONTENT[kind]?.[pt ? "pt" : "en"] || CONTENT.about[pt ? "pt" : "en"];
  return (
    <article className="institutional-page">
      <header>
        <small>TCG TACTICAL DATABASE // {page.eyebrow}</small>
        <h1>{page.title}</h1>
        <p>{page.intro}</p>
      </header>
      <div className="institutional-page__body">
        {page.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {(section.paragraphs || []).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.items?.length ? <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul> : null}
          </section>
        ))}
      </div>
      <footer>
        <span>{pt ? "Última revisão: 12 de agosto de 2026" : "Last reviewed: August 12, 2026"}</span>
        <div className="button-row">
          {["legal", "privacy"].includes(kind) ? <button type="button" onClick={() => onNavigate("feedback")}>{pt ? "ABRIR CANAL DE CONTATO" : "OPEN CONTACT CHANNEL"}</button> : null}
          <button type="button" onClick={() => onNavigate("home")}>{pt ? "VOLTAR AO COCKPIT" : "RETURN TO COCKPIT"}</button>
        </div>
      </footer>
    </article>
  );
}

const CONTENT = {
  about: {
    pt: {
      eyebrow: "SOBRE",
      title: "Inteligência tática para jogadores de TCG.",
      intro: "O TCG Tactical Database é uma ferramenta comunitária independente para organizar dados, pesquisar cartas e apoiar decisões competitivas.",
      sections: [
        { title: "A missão", paragraphs: ["Transformar fontes dispersas em uma experiência clara: banco de cartas, construção de decks, leitura de meta, resultados de torneios e a Forja Tática."] },
        { title: "Arquitetura multi-jogo", paragraphs: ["Gundam Card Game é o primeiro módulo suportado. A marca, a navegação e os serviços centrais foram separados do módulo para permitir outros Trading Card Games no futuro."] },
        { title: "Como trabalhamos", paragraphs: ["Análises e estatísticas são produzidas pelo projeto a partir dos dados disponíveis. Quando uma conclusão for inferência ou heurística, a interface deve identificá-la como tal."] },
      ],
    },
    en: {
      eyebrow: "ABOUT",
      title: "Tactical intelligence for TCG players.",
      intro: "TCG Tactical Database is an independent community tool for organizing data, researching cards and supporting competitive decisions.",
      sections: [
        { title: "The mission", paragraphs: ["Turn scattered sources into a clear experience: card database, deck building, meta analysis, tournament results and the Tactical Forge."] },
        { title: "Multi-game architecture", paragraphs: ["Gundam Card Game is the first supported module. Brand, navigation and core services are separated from the module to allow other Trading Card Games in the future."] },
        { title: "How we work", paragraphs: ["Analyses and statistics are produced by the project from available data. When a conclusion is an inference or heuristic, the interface should identify it as such."] },
      ],
    },
  },
  legal: {
    pt: {
      eyebrow: "LEGAL / COPYRIGHT",
      title: "Projeto independente. Direitos preservados.",
      intro: "Esta página explica a separação entre a tecnologia criada pelo projeto e o conteúdo pertencente aos titulares de cada jogo suportado.",
      sections: [
        { title: "Não oficial", paragraphs: ["TCG Tactical Database is not an official product, service, or platform of any supported Trading Card Game publisher.", "O projeto não é afiliado, endossado ou patrocinado por editoras, fabricantes ou titulares de direitos de qualquer Trading Card Game."] },
        { title: "Propriedade intelectual de terceiros", paragraphs: ["All trademarks, logos, names, artwork, card images, game mechanics references, and intellectual property related to supported Trading Card Games belong to their respective owners.", "O uso no banco é informativo, organizacional e comunitário. Nenhuma exibição transfere propriedade ou sugere licença além do uso efetivamente autorizado."] },
        { title: "Conteúdo do projeto", paragraphs: ["Código, interface, modelos de dados, algoritmos, análises, estatísticas e metodologia próprios pertencem aos seus respectivos autores e mantenedores, salvo indicação diferente em repositório ou licença aplicável."] },
        { title: "Créditos e revisão de assets", paragraphs: ["Assets visuais são inventariados com origem, titular conhecido e estado de revisão. O alpha pode restringir ou remover itens quando a rastreabilidade não for suficiente."] },
        { title: "Aviso de marcas", paragraphs: ["Nomes de produtos, empresas, jogos, séries e personagens podem constituir marcas registradas ou não registradas de seus respectivos titulares. A referência serve apenas para identificar o conteúdo organizado pela plataforma."] },
        { title: "Contato para titulares de direitos", paragraphs: ["Titulares podem solicitar correção de atribuição, restrição ou remoção pelo canal de feedback do alpha. Selecione a categoria de direitos autorais, identifique o material ou URL e forneça um contato verificável para resposta."] },
        { title: "Procedimento de remoção", items: ["Identifique o titular ou representante autorizado.", "Informe o asset, página ou URL questionada.", "Descreva o direito envolvido e a medida solicitada.", "Forneça um meio verificável para resposta.", "O projeto registrará a solicitação, preservará evidências e restringirá o conteúdo quando a análise assim exigir."] },
      ],
    },
    en: {
      eyebrow: "LEGAL / COPYRIGHT",
      title: "Independent project. Rights preserved.",
      intro: "This page explains the separation between technology created by the project and content owned by each supported game's rights holders.",
      sections: [
        { title: "Unofficial", paragraphs: ["TCG Tactical Database is not an official product, service, or platform of any supported Trading Card Game publisher.", "The project is not affiliated with, endorsed by, or sponsored by any Trading Card Game publisher, manufacturer, or rights holder."] },
        { title: "Third-party intellectual property", paragraphs: ["All trademarks, logos, names, artwork, card images, game mechanics references, and intellectual property related to supported Trading Card Games belong to their respective owners.", "Database use is informational, organizational and community-oriented. Display does not transfer ownership or imply a license beyond the use actually authorized."] },
        { title: "Project content", paragraphs: ["Original code, interface, data models, algorithms, analyses, statistics and methodology belong to their respective authors and maintainers unless a repository or applicable license states otherwise."] },
        { title: "Asset credits and review", paragraphs: ["Visual assets are inventoried with origin, known owner and review status. The alpha may restrict or remove items when traceability is insufficient."] },
        { title: "Trademark notice", paragraphs: ["Product, company, game, series and character names may be registered or unregistered trademarks of their respective owners. References are used only to identify content organized by the platform."] },
        { title: "Rights-holder contact", paragraphs: ["Rights holders may request attribution correction, restriction or removal through the alpha feedback channel. Select the copyright category, identify the material or URL and provide a verifiable reply contact."] },
        { title: "Takedown procedure", items: ["Identify the rights holder or authorized representative.", "Identify the asset, page or URL in question.", "Describe the relevant right and requested action.", "Provide a verifiable response channel.", "The project will log the notice, preserve evidence and restrict content when review requires it."] },
      ],
    },
  },
  terms: {
    pt: {
      eyebrow: "TERMOS DE USO",
      title: "Uso responsável do sistema.",
      intro: "Ao utilizar o TCG Tactical Database, você concorda com estas condições básicas da versão comunitária.",
      sections: [
        { title: "Finalidade", paragraphs: ["This database is created for informational, organizational, and community purposes only. O conteúdo não substitui regras, listas de restrição, rulings ou comunicados oficiais."] },
        { title: "Precisão e disponibilidade", paragraphs: ["Buscamos manter dados e fontes rastreáveis, mas não garantimos ausência de erros, disponibilidade contínua ou atualização instantânea. Confirme decisões de torneio em fontes oficiais."] },
        { title: "Conduta", items: ["Não tente contornar limites de acesso ou segurança.", "Não use a plataforma para abuso, fraude ou violação de direitos.", "Não apresente análises do projeto como material oficial de um publisher."] },
        { title: "Funcionalidades assistidas", paragraphs: ["Sugestões da Forja são apoio à decisão. O jogador continua responsável pela lista, legalidade no evento e uso das recomendações."] },
      ],
    },
    en: {
      eyebrow: "TERMS OF USE",
      title: "Responsible system use.",
      intro: "By using TCG Tactical Database you agree to these basic community-release conditions.",
      sections: [
        { title: "Purpose", paragraphs: ["This database is created for informational, organizational, and community purposes only. Content does not replace official rules, restriction lists, rulings or announcements."] },
        { title: "Accuracy and availability", paragraphs: ["We aim to keep data and sources traceable, but do not guarantee error-free data, continuous availability or instant updates. Confirm tournament decisions in official sources."] },
        { title: "Conduct", items: ["Do not attempt to bypass access or security limits.", "Do not use the platform for abuse, fraud or rights infringement.", "Do not present project analyses as official publisher material."] },
        { title: "Assisted features", paragraphs: ["Forge suggestions support decisions. The player remains responsible for the list, event legality and use of recommendations."] },
      ],
    },
  },
  privacy: {
    pt: {
      eyebrow: "PRIVACIDADE",
      title: "Dados mínimos, finalidade clara.",
      intro: "Esta política descreve o comportamento do Alpha 01, incluindo conta, métricas de audiência e integrações externas.",
      sections: [
        { title: "Dados locais", paragraphs: ["Preferências de idioma, tema e decks locais podem ser armazenados no navegador. Limpar os dados do site pode remover esse conteúdo quando ele ainda não estiver sincronizado a uma conta."] },
        { title: "Conta", paragraphs: ["Quando a autenticação da plataforma estiver ativa, o sistema pode receber um identificador estável, e-mail e nome fornecidos pelo provedor para criar e manter a sessão. Senhas do provedor não são recebidas pelo aplicativo."] },
        { title: "Feedback do alpha", paragraphs: ["Relatórios enviados pelo canal do alpha armazenam categoria, mensagem, página, idioma, data e, quando fornecido, e-mail para retorno. Usuários autenticados podem ter o identificador da plataforma associado ao relatório. Não armazenamos o endereço IP no banco de feedback."] },
        { title: "Audiência e desempenho", paragraphs: ["Usamos o Cloudflare Web Analytics para medir, de forma agregada, visitas, páginas acessadas, origem aproximada do tráfego, país, tipo de dispositivo, navegador e desempenho de carregamento. Essa integração não usa cookies, armazenamento local ou identificadores persistentes para acompanhar uma pessoa entre visitas."] },
        { title: "Ofertas de parceiros", paragraphs: ["Quando uma oferta externa é aberta, registramos de forma agregada o parceiro, a origem da oferta, o identificador público da carta/impressão, a página de saída, o domínio de destino e a data. Não registramos identificadores de conta, endereço IP, conteúdo do destino ou histórico de compras. O site parceiro possui suas próprias práticas de privacidade, cookies e condições comerciais.", "Uma oferta marcada como parceira pode gerar comissão para o projeto. Essa relação é informada na própria oferta e nunca altera o preço, a ordem do radar ou a análise exibida."] },
        { title: "Forja remota", paragraphs: ["Ao solicitar análise assistida, mensagem, composição do deck e métricas estruturadas necessárias são enviadas ao serviço configurado. O endpoint do projeto solicita processamento sem armazenamento pelo provedor quando essa opção está disponível."] },
        { title: "Terceiros e pagamentos", paragraphs: ["A Cloudflare processa as métricas agregadas de audiência e desempenho descritas acima. Não há cobrança implementada nesta versão. Patreon ou outro provedor só será integrado após atualização desta política, definição da base legal e publicação de um canal de contato."] },
      ],
    },
    en: {
      eyebrow: "PRIVACY",
      title: "Minimum data, clear purpose.",
      intro: "This policy describes Alpha 01, including accounts, audience measurement and external integrations.",
      sections: [
        { title: "Local data", paragraphs: ["Language, theme and local deck preferences may be stored in the browser. Clearing site data may remove this content while it is not synchronized to an account."] },
        { title: "Account", paragraphs: ["When platform authentication is active, the system may receive a stable identifier, email and name supplied by the provider to create and maintain the session. Provider passwords are never received by the application."] },
        { title: "Alpha feedback", paragraphs: ["Reports sent through the alpha channel store category, message, page, language, date and, when supplied, a reply e-mail. Authenticated users may have their platform identifier associated with the report. We do not store the IP address in the feedback database."] },
        { title: "Audience and performance", paragraphs: ["We use Cloudflare Web Analytics to measure aggregate visits, viewed pages, approximate traffic source, country, device type, browser and loading performance. This integration does not use cookies, local storage or persistent identifiers to follow a person between visits."] },
        { title: "Partner offers", paragraphs: ["When an external offer is opened, we record the partner, offer source, public card/printing identifier, exit page, destination domain and date in aggregate form. We do not record account identifiers, IP address, destination content, or purchase history. The partner site has its own privacy practices, cookies and commercial terms.", "An offer marked as a partner offer may generate a commission for the project. That relationship is disclosed in the offer itself and never changes the displayed price, radar order, or analysis."] },
        { title: "Remote Forge", paragraphs: ["When assisted analysis is requested, the message, deck composition and required structured metrics are sent to the configured service. The project endpoint requests processing without provider storage when that option is available."] },
        { title: "Third parties and payments", paragraphs: ["Cloudflare processes the aggregate audience and performance metrics described above. No billing is implemented in this release. Patreon or another provider will only be integrated after this policy is updated, a legal basis is defined and a contact channel is published."] },
      ],
    },
  },
};
