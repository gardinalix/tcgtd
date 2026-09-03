import { getMetaSignal } from "../../domain/cards";
import { CardArt } from "./CardArt";
import { PriceTag } from "./PriceTag";

export function CardTable({ cards, onSelect }) {
  return (
    <div className="table-wrap">
      <table className="data-table react-card-table">
        <thead>
          <tr>
            <th>Image</th>
            <th>Number</th>
            <th>Name</th>
            <th>Color</th>
            <th>Type</th>
            <th>Rarity</th>
            <th>Meta Signal</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => {
            const signal = getMetaSignal(card);
            return (
              <tr
                key={card.displayId || card.cardNumber}
                tabIndex={0}
                role="button"
                onClick={() => {
                  onSelect?.(card.displayId || card.cardNumber);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect?.(card.displayId || card.cardNumber);
                  }
                }}
              >
                <td data-label="Image"><CardArt card={card} className="art-frame art-frame--mini" compact /></td>
                <td data-label="Number">{card.displayCardNumber || card.cardNumber}</td>
                <td data-label="Name">{card.cardName}</td>
                <td data-label="Color">{card.color}</td>
                <td data-label="Type">{card.cardType}</td>
                <td data-label="Rarity">{card.rarity}</td>
                <td data-label="Meta signal">{signal.label}</td>
                <td data-label="Price"><PriceTag card={card} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
