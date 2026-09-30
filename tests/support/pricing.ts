/**
 * An independent "oracle" for prices. The tests calculate what the total
 * SHOULD be using the business rules, rather than trusting whatever the UI shows.
 *
 * Rules: ticket subtotal = price × quantity; promo % applies to tickets only;
 * a flat €2.50 booking fee per ticket is never discounted.
 */
export const FEE_PER_TICKET_CENTS = 250;

export function expectedPrice({ priceCents, quantity, percentOff = 0 }: { priceCents: number; quantity: number; percentOff?: number }) {
  const subtotal = priceCents * quantity;
  const discount = Math.round((subtotal * percentOff) / 100);
  const fees = FEE_PER_TICKET_CENTS * quantity;
  return { subtotal, discount, fees, total: subtotal - discount + fees };
}

const formatter = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
/** 50950 → "€509.50" */
export const eur = (cents: number) => formatter.format(cents / 100);
