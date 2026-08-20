/**
 * Where the money goes.
 *
 * A UPI address is public by design — it appears on the payment screen of
 * every buyer — so it lives in code rather than an environment variable.
 * No payee name is carried or displayed: the buyer's UPI app shows the
 * bank-verified name on its own, which is worth more than anything we
 * could claim.
 */
export const UPI = {
  /** The UPI ID payments go to. Empty = checkout not live. */
  vpa: "pagehaul@naviaxis",
};

export const upiLive = () => UPI.vpa.length > 0;
