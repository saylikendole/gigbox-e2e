import { Router } from 'express';
import { db, newId, resetDb, type Category, type GigEvent } from './db.js';
import { ApiError } from './http.js';

/**
 * Test-data endpoints. Mounted only when ENABLE_TEST_ROUTES=true.
 * They let tests create exactly the data they need (a sold-out show, an event
 * tomorrow, a fresh user) without clicking through the UI to get there.
 */
export const testRoutes = Router();

testRoutes.post('/reset', (_req, res) => {
  resetDb();
  res.status(204).end();
});

testRoutes.post('/users', (req, res) => {
  const suffix = newId('x').slice(2);
  const user = {
    id: newId('u'),
    name: String(req.body?.name ?? `Test User ${suffix}`),
    email: String(req.body?.email ?? `user.${suffix}@gigbox.test`),
    password: 'Test#Pass2026',
  };
  db.users.push(user);
  res.status(201).json({ id: user.id, name: user.name, email: user.email, password: user.password });
});

testRoutes.post('/events', (req, res) => {
  const b = req.body ?? {};
  const hoursAhead = Number(b.hoursAhead ?? 24 * 14);
  if (!Number.isFinite(hoursAhead)) throw new ApiError(400, 'VALIDATION_ERROR', 'hoursAhead must be a number');
  const suffix = newId('x').slice(2);
  const event: GigEvent = {
    id: newId('e'),
    name: String(b.name ?? `Test Event ${suffix}`),
    artist: String(b.artist ?? 'Test Artist'),
    category: (b.category ?? 'Concert') as Category,
    city: String(b.city ?? 'Copenhagen'),
    venue: String(b.venue ?? 'Test Venue'),
    startsAt: new Date(Date.now() + hoursAhead * 3_600_000).toISOString(),
    priceCents: Number(b.priceCents ?? 20000),
    capacity: Number(b.capacity ?? 100),
    sold: Number(b.sold ?? 0),
  };
  db.events.push(event);
  res.status(201).json(event);
});
