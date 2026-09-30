import { randomBytes, randomUUID } from 'node:crypto';

export type Category = 'Concert' | 'Comedy' | 'Theatre' | 'Festival';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // Demo app only. Never store plain-text passwords for real.
}

export interface GigEvent {
  id: string;
  name: string;
  artist: string;
  category: Category;
  city: string;
  venue: string;
  startsAt: string; // ISO 8601, UTC
  priceCents: number;
  capacity: number;
  sold: number;
}

export type OrderStatus = 'confirmed' | 'cancelled';

export interface Order {
  id: string;
  userId: string;
  eventId: string;
  quantity: number;
  unitPriceCents: number;
  feeCents: number;
  discountCents: number;
  totalCents: number;
  promoCode: string | null;
  status: OrderStatus;
  createdAt: string;
}

export interface Promo {
  code: string;
  percentOff: number;
  expiresAt: string;
}

/** Flat booking fee per ticket. All money is kept in whole cents to avoid floating-point rounding errors. */
export const FEE_PER_TICKET_CENTS = 250;
export const MAX_TICKETS_PER_ORDER = 6;
export const CANCELLATION_WINDOW_HOURS = 48;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Event dates are relative to "now" so the seeded data never goes stale. */
function at(daysAhead: number, hourUtc: number): string {
  const d = new Date(Date.now() + daysAhead * DAY);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

const seedUsers = (): User[] => [
  { id: 'u-maya', name: 'Maya Jensen', email: 'maya@gigbox.test', password: 'Gigbox#2026' },
  { id: 'u-omar', name: 'Omar Haddad', email: 'omar@gigbox.test', password: 'Gigbox#2026' },
];

const seedEvents = (): GigEvent[] => [
  { id: 'e-northern-lights', name: 'Northern Lights Tour', artist: 'Aurora Bay', category: 'Concert', city: 'Copenhagen', venue: 'Vega', startsAt: at(12, 19), priceCents: 42500, capacity: 1500, sold: 640 },
  { id: 'e-late-laughs', name: 'Late Laughs', artist: 'Sam Okoro', category: 'Comedy', city: 'Aarhus', venue: 'Train', startsAt: at(9, 20), priceCents: 19500, capacity: 400, sold: 397 },
  { id: 'e-hamlet', name: 'Hamlet (in English)', artist: 'Harbour Players', category: 'Theatre', city: 'Copenhagen', venue: 'Bådteatret', startsAt: at(20, 18), priceCents: 32000, capacity: 120, sold: 120 },
  { id: 'e-synth-summer', name: 'Synth Summer', artist: 'Various artists', category: 'Festival', city: 'Odense', venue: 'Tusindårsskoven', startsAt: at(45, 14), priceCents: 89900, capacity: 8000, sold: 2100 },
  { id: 'e-jazz-cellar', name: 'Jazz in the Cellar', artist: 'Lina Holm Trio', category: 'Concert', city: 'Copenhagen', venue: 'Jazzhus Montmartre', startsAt: at(5, 20), priceCents: 28000, capacity: 90, sold: 71 },
  { id: 'e-open-mic', name: 'Open Mic Night', artist: 'Local talent', category: 'Comedy', city: 'Copenhagen', venue: 'Bremen Teater', startsAt: at(3, 19), priceCents: 9500, capacity: 200, sold: 35 },
  { id: 'e-baltic-strings', name: 'Baltic Strings', artist: 'Malmö Chamber Orchestra', category: 'Concert', city: 'Malmö', venue: 'Malmö Live', startsAt: at(30, 19), priceCents: 36500, capacity: 1600, sold: 900 },
  { id: 'e-grand-illusion', name: 'The Grand Illusion', artist: 'Teatret Vestvolden', category: 'Theatre', city: 'Aarhus', venue: 'Aarhus Teater', startsAt: at(16, 19), priceCents: 27500, capacity: 700, sold: 210 },
];

const seedPromos = (): Promo[] => [
  { code: 'GIG10', percentOff: 10, expiresAt: at(365, 0) },
  { code: 'STUDENT20', percentOff: 20, expiresAt: at(365, 0) },
  { code: 'SUMMER25', percentOff: 25, expiresAt: at(-30, 0) },
];

export const db = {
  users: seedUsers(),
  events: seedEvents(),
  promos: seedPromos(),
  orders: [] as Order[],
  sessions: new Map<string, string>(), // session id -> user id
};

export function resetDb(): void {
  db.users = seedUsers();
  db.events = seedEvents();
  db.promos = seedPromos();
  db.orders = [];
  db.sessions.clear();
}

export const newId = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;
export const newSessionId = () => randomBytes(24).toString('hex');
export const remaining = (e: GigEvent) => e.capacity - e.sold;
export const hoursUntil = (iso: string) => (new Date(iso).getTime() - Date.now()) / HOUR;
