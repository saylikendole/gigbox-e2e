import type { APIRequestContext } from '@playwright/test';

export interface TestUser {
  id: string;
  name: string;
  email: string;
  password: string;
}

export interface TestEvent {
  id: string;
  name: string;
  priceCents: number;
  capacity: number;
  sold: number;
  startsAt: string;
}

export interface EventOverrides {
  name?: string;
  city?: string;
  category?: 'Concert' | 'Comedy' | 'Theatre' | 'Festival';
  priceCents?: number;
  capacity?: number;
  sold?: number;
  hoursAhead?: number;
}

/**
 * Creates test data through the app's test-only endpoints.
 * Tests set up exactly the state they need in milliseconds, instead of
 * clicking through the UI or relying on shared seed data that other tests change.
 */
export class TestData {
  constructor(private readonly request: APIRequestContext) {}

  async reset(): Promise<void> {
    const res = await this.request.post('/api/test/reset');
    if (res.status() !== 204) throw new Error(`Reset failed: ${res.status()}. Is ENABLE_TEST_ROUTES=true?`);
  }

  async createUser(): Promise<TestUser> {
    const res = await this.request.post('/api/test/users', { data: {} });
    if (res.status() !== 201) throw new Error(`Could not create user: ${res.status()}`);
    return res.json();
  }

  async createEvent(overrides: EventOverrides = {}): Promise<TestEvent> {
    const name = overrides.name ?? `QA Night ${Math.random().toString(36).slice(2, 8)}`;
    const res = await this.request.post('/api/test/events', { data: { ...overrides, name } });
    if (res.status() !== 201) throw new Error(`Could not create event: ${res.status()}`);
    return res.json();
  }

  /** Buys tickets as another user, straight through the API (for "someone else got there first" scenarios). */
  async buyAsSomeoneElse(eventId: string, quantity: number): Promise<void> {
    const user = await this.createUser();
    // This request context is separate from the browser, so logging in here doesn't affect the page's session
    const login = await this.request.post('/api/auth/login', { data: { email: user.email, password: user.password } });
    if (!login.ok()) throw new Error(`Background login failed: ${login.status()}`);
    const res = await this.request.post('/api/orders', { data: { eventId, quantity } });
    if (res.status() !== 201) throw new Error(`Background purchase failed: ${res.status()} ${await res.text()}`);
  }

  async getEvent(id: string): Promise<TestEvent & { remaining: number; soldOut: boolean }> {
    return (await this.request.get(`/api/events/${id}`)).json();
  }
}
