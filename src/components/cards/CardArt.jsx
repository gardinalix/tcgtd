import { useEffect, useState } from "react";

function resolveCardImageUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^(https?:|data:|blob:|\/)/i.test(value)) return value;
  return `/${value.replace(/^\.?\//, "")}`;
}

function getRemoteImageUrl(card) {
  return card?.remoteImageUrl || card?.printings?.find((printing) => printing.remoteImageUrl)?.remoteImageUrl || "";
}

export function CardArt({ card, className = "art-frame", compact = false }) {
  const imageUrl = resolveCardImageUrl(card?.imageUrl);
  const remoteImageUrl = resolveCardImageUrl(getRemoteImageUrl(card));
  const primaryImageUrl = imageUrl || remoteImageUrl;
  const [currentSrc, setCurrentSrc] = useState(primaryImageUrl);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrentSrc(primaryImageUrl);
    setFailed(false);
  }, [primaryImageUrl]);

  if (!currentSrc || failed) {
    return (
      <div className={`${className} art-frame--missing`.trim()}>
        <span>{card?.cardNumber || "No image"}</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <img
        src={currentSrc}
        alt={card.cardName || card.cardNumber}
        loading={compact ? "lazy" : "eager"}
        onError={() => {
          if (remoteImageUrl && currentSrc !== remoteImageUrl) {
            setCurrentSrc(remoteImageUrl);
            return;
          }
          setFailed(true);
        }}
      />
    </div>
  );
}
