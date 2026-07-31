export function getDeckLegalityPresentation(legality) {
  if (legality?.legal === true) {
    return {
      className: "is-legal",
      label: "LEGAL",
      detail: "This deck passes the current rules check.",
    };
  }

  if (legality?.legal === false) {
    return {
      className: "is-illegal",
      label: "ILLEGAL",
      detail: (legality.issues || []).filter(Boolean).join(" ")
        || "This deck has a conflict with the current rules.",
    };
  }

  return {
    className: "is-unverified",
    label: "NOT CHECKED",
    detail: "No current-rules validation result is available for this deck.",
  };
}
