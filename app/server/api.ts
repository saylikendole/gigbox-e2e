import { Router } from 'express';
import {
  CANCELLATION_WINDOW_HOURS,
  db,
  FEE_PER_TICKET_CENTS,
  hoursUntil,
  MAX_TICKETS_PER_ORDER,
  newId,
  newSessionId,
  remaining,
  type Category,
  type GigEvent,
  type Order,
} from './db.js';
import { ApiError, currentUser, readCookie, requireUser, SESSION_COOKIE } from './http.js';

export const api = Router();

const publicEvent = (e: GigEvent) => ({ ...e, remaining: remaining(e), soldOut: remaining(e) <= 0 });

/** Settings the web client needs to render forms and price summaries. */
api.get('/config', (_req, res) => {
  res.json({ maxTicketsPerOrder: MAX_TICKETS_PER_ORDER, feePerTicketCents: FEE_PER_TICKET_CENTS });
});

// ---- Auth -----------------------------------------------------------------

api.post('/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Email and password are required');
  }
  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || user.password !== password) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  const sid = newSessionId();
  db.sessions.set(sid, user.id);
  res.cookie(SESSION_COOKIE, sid, { httpOnly: true, sameSite: 'lax', path: '/' });
  res.json({ id: user.id, name: user.name, email: user.email });
});

api.post('/auth/logout', (req, res) => {
  const sid = readCookie(req, SESSION_COOKIE);
  if (sid) db.sessions.delete(sid);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.status(204).end();
});

api.get('/me', (req, res) => {
  const user = currentUser(req);
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Please log in');
  res.json({ id: user.id, name: user.name, email: user.email });
});

// ---- Events ---------------------------------------------------------------

api.get('/events', (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const city = String(req.query.city ?? '');
  const category = String(req.query.category ?? '');
  const events = db.events
    .filter((e) => new Date(e.startsAt).getTime() > Date.now())
    .filter((e) => !q || `${e.name} ${e.artist} ${e.venue}`.toLowerCase().includes(q))
    .filter((e) => !city || e.city === city)
    .filter((e) => !category || e.category === (category as Category))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map(publicEvent);
  res.json({ items: events });
});

api.get('/events/:id', (req, res) => {
  const event = db.events.find((e) => e.id === req.params.id);
  if (!event) throw new ApiError(404, 'NOT_FOUND', 'Event not found');
  res.json(publicEvent(event));
});

// ---- Promo codes ----------------------------------------------------------

function findPromo(code: string) {
  const promo = db.promos.find((p) => p.code === code.trim().toUpperCase());
  if (!promo) throw new ApiError(404, 'PROMO_NOT_FOUND', 'That code is not recognised');
  if (new Date(promo.expiresAt).getTime() < Date.now()) {
    throw new ApiError(422, 'PROMO_EXPIRED', 'That code has expired');
  }
  return promo;
}

api.post('/promo/validate', requireUser, (req, res) => {
  const promo = findPromo(String(req.body?.code ?? ''));
  res.json({ code: promo.code, percentOff: promo.percentOff });
});

// ---- Orders ---------------------------------------------------------------

/**
 * Prices are always calculated on the server. The client only sends
 * which event, how many tickets and an optional promo code.
 */
api.post('/orders', requireUser, (req, res) => {
  const { eventId, quantity, promoCode } = req.body ?? {};
  const event = db.events.find((e) => e.id === eventId);
  if (!event) throw new ApiError(404, 'NOT_FOUND', 'Event not found');
  if (new Date(event.startsAt).getTime() <= Date.now()) {
    throw new ApiError(422, 'EVENT_STARTED', 'This event has already started');
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Quantity must be a whole number of at least 1');
  }
  if (remaining(event) <= 0) throw new ApiError(409, 'SOLD_OUT', 'This event is sold out');
  if (quantity > remaining(event)) {
    throw new ApiError(409, 'NOT_ENOUGH_TICKETS', `Only ${remaining(event)} tickets left`);
  }

  const promo = promoCode ? findPromo(String(promoCode)) : null;
  const subtotal = event.priceCents * quantity;
  const discount = promo ? Math.round((subtotal * promo.percentOff) / 100) : 0; // fees are never discounted
  const fees = FEE_PER_TICKET_CENTS * quantity;

  const order: Order = {
    id: newId('o'),
    userId: req.user!.id,
    eventId: event.id,
    quantity,
    unitPriceCents: event.priceCents,
    feeCents: fees,
    discountCents: discount,
    totalCents: subtotal - discount + fees,
    promoCode: promo?.code ?? null,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };
  event.sold += quantity;
  db.orders.push(order);
  res.status(201).json(order);
});

const withEvent = (o: Order) => {
  const e = db.events.find((ev) => ev.id === o.eventId)!;
  return {
    ...o,
    event: { id: e.id, name: e.name, venue: e.venue, city: e.city, startsAt: e.startsAt },
    cancellable: o.status === 'confirmed' && hoursUntil(e.startsAt) > CANCELLATION_WINDOW_HOURS,
  };
};

api.get('/orders', requireUser, (req, res) => {
  const mine = db.orders
    .filter((o) => o.userId === req.user!.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(withEvent);
  res.json({ items: mine });
});

function findOwnOrder(id: string, userId: string): Order {
  const order = db.orders.find((o) => o.id === id);
  if (!order || order.userId !== userId) throw new ApiError(404, 'NOT_FOUND', 'Order not found');
  return order;
}

api.get('/orders/:id', requireUser, (req, res) => {
  res.json(withEvent(findOwnOrder(String(req.params.id), req.user!.id)));
});

api.post('/orders/:id/cancel', requireUser, (req, res) => {
  const order = findOwnOrder(String(req.params.id), req.user!.id);
  if (order.status === 'cancelled') throw new ApiError(409, 'ALREADY_CANCELLED', 'This order is already cancelled');
  const event = db.events.find((e) => e.id === order.eventId)!;
  if (hoursUntil(event.startsAt) <= CANCELLATION_WINDOW_HOURS) {
    throw new ApiError(
      422,
      'CANCELLATION_CLOSED',
      `Orders can be cancelled up to ${CANCELLATION_WINDOW_HOURS} hours before the event`,
    );
  }
  order.status = 'cancelled';
  event.sold -= order.quantity; // tickets go back on sale
  res.json(withEvent(order));
});
