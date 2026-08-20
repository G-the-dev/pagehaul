/**
 * Where the money goes.
 *
 * A UPI address is public by design — it appears on the payment screen of
 * every buyer — so it lives in code rather than an environment variable.
 * While `vpa` is empty the buy buttons say payments are opening shortly;
 * filling it in is what turns the UPI checkout on.
 */
export const UPI = {
  /** The UPI ID payments go to, e.g. "name@okhdfcbank". Empty = not live. */
  vpa: "",
  /** The payee name buyers see in their UPI app. */
  name: "pagehaul",
};

export const upiLive = () => UPI.vpa.length > 0;
