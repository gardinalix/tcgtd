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
                onClick={() => {
                  onSelect?.(card.displayId || card.cardNumber);
                }}
              >
                <td><CardArt card={card} className="art-frame art-frame--mini" compact /></td>
                <td>{card.displayCardNumber || card.cardNumber}</td>
                <td>{card.cardName}</td>
                <td>{card.color}</td>
                <td>{card.cardType}</td>
                <td>{card.rarity}</td>
                <td>{signal.label}</td>
                <td><PriceTag card={card} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
