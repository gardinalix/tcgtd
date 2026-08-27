import assert from "node:assert/strict";
import test from "node:test";
import { getLigaGundamPartnerOffer } from "../src/domain/partnerOffers.js";
import { handlePartnerRedirect } from "../worker/index.js";

test("LigaGundam partner offer keeps the exact synchronized listing behind a first-party redirect", () => {
  const offer = getLigaGundamPartnerOffer({
    cardNumber: "GD01-100",
    displayId: "GD01-100",
    priceStatus: "ok",
    ligaGundamLowPriceBrl: 1.94,
    ligaGundamListingCount: 1,
    ligaGundamBestUrl: "https://www.ligagundam.com.br/?view=cards/card&num=GD01-100",
  });

  assert.equal(offer.status, "pilot");
  const redirect = new URL(offer.href, "https://tcgtd.test");
  assert.equal(redirect.pathname, "/go/ligagundam");
  assert.equal(redirect.searchParams.get("to"), "https://www.ligagundam.com.br/?view=cards/card&num=GD01-100");
  assert.equal(redirect.searchParams.get("card"), "GD01-100");
});

test("non-LigaGundam listings never become partner offers", () => {
  const offer = getLigaGundamPartnerOffer({
    cardNumber: "GD01-100",
    priceStatus: "ok",
    ligaGundamLowPriceBrl: 1.94,
    ligaGundamBestUrl: "https://example.invalid/card/GD01-100",
  });
  assert.equal(offer, null);
});

test("partner redirect logs aggregate click metadata and preserves the destination", async () => {
  const writes = [];
  const response = await handlePartnerRedirect(new Request(
    "https://tcgtd.test/go/ligagundam?to=https%3A%2F%2Fwww.ligagundam.com.br%2F%3Fview%3Dcards%2Fcard%26num%3DGD01-100&card=GD01-100&printing=GD01-100&from=%2Fcards",
    { headers: { "cf-connecting-ip": "test-partner-click" } },
  ), {
    DB: {
      prepare() {
        return {
          bind(...values) {
            return { run: async () => writes.push(values) };
          },
        };
      },
    },
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://www.ligagundam.com.br/?view=cards/card&num=GD01-100");
  assert.equal(writes.length, 1);
  assert.equal(writes[0][1], "ligagundam");
  assert.equal(writes[0][3], "GD01-100");
  assert.equal(writes[0][5], "/cards");
  assert.equal(writes[0][6], "www.ligagundam.com.br");
});

test("partner redirect rejects arbitrary outbound destinations", async () => {
  const response = await handlePartnerRedirect(new Request(
    "https://tcgtd.test/go/ligagundam?to=https%3A%2F%2Fevil.example%2Fcard",
  ));
  assert.equal(response.status, 400);
});

test("partner redirect applies only an approved server-side affiliate deeplink template", async () => {
  const response = await handlePartnerRedirect(new Request(
    "https://tcgtd.test/go/ligagundam?to=https%3A%2F%2Fwww.ligagundam.com.br%2F%3Fview%3Dcards%2Fcard%26num%3DGD01-100",
  ), {
    LIGAGUNDAM_AFFILIATE_DEEPLINK_TEMPLATE: "https://tracking.example/offer?destination={{destination}}",
  });
  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get("location"),
    "https://tracking.example/offer?destination=https%3A%2F%2Fwww.ligagundam.com.br%2F%3Fview%3Dcards%2Fcard%26num%3DGD01-100",
  );
});
