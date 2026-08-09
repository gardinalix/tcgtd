export const DEFAULT_GAME_ID = "gundam-card-game";

export const GAME_MODULES = Object.freeze({
  [DEFAULT_GAME_ID]: Object.freeze({
    id: DEFAULT_GAME_ID,
    name: "Gundam Card Game",
    shortName: "Gundam",
    status: "active",
    dataSource: "/app-data.json",
    homeSource: "/home-data.json",
    assetNamespace: "gundam",
  }),
});

export function getGameModule(gameId = DEFAULT_GAME_ID) {
  return GAME_MODULES[gameId] || GAME_MODULES[DEFAULT_GAME_ID];
}

export function listActiveGameModules() {
  return Object.values(GAME_MODULES).filter((game) => game.status === "active");
}
