import type { Locator, Page } from '@playwright/test';

export class EventPage {
  readonly heading: Locator;
  readonly availability: Locator;
  readonly quantity: Locator;
  readonly addTicket: Locator;
  readonly removeTicket: Locator;
  readonly promoInput: Locator;
  readonly applyPromoButton: Locator;
  readonly promoMessage: Locator;
  readonly subtotal: Locator;
  readonly ticketsLabel: Locator;
  readonly fee: Locator;
  readonly discount: Locator;
  readonly total: Locator;
  readonly buyButton: Locator;
  readonly buyError: Locator;
  readonly soldOutButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.availability = page.locator('#availability');
    this.quantity = page.getByRole('spinbutton', { name: 'Tickets' });
    this.addTicket = page.getByRole('button', { name: 'Add one ticket' });
    this.removeTicket = page.getByRole('button', { name: 'Remove one ticket' });
    this.promoInput = page.getByLabel('Promo code');
    this.applyPromoButton = page.getByRole('button', { name: 'Apply' });
    this.promoMessage = page.locator('#promo-message');
    this.ticketsLabel = page.locator('#tickets-label');
    this.subtotal = page.getByTestId('tickets-subtotal');
    this.fee = page.getByTestId('booking-fee');
    this.discount = page.getByTestId('discount');
    this.total = page.getByTestId('order-total');
    this.buyButton = page.getByRole('button', { name: /^Buy \d+ tickets?$/ });
    this.buyError = page.locator('#buy-error');
    this.soldOutButton = page.getByRole('button', { name: 'Sold out' });
  }

  async goto(eventId: string) {
    await this.page.goto(`/event?id=${encodeURIComponent(eventId)}`);
    await this.heading.waitFor();
  }

  async addTickets(count: number) {
    for (let i = 0; i < count; i++) await this.addTicket.click();
  }

  async typeQuantity(value: string) {
    await this.quantity.fill(value);
    await this.quantity.blur(); // the app validates on change
  }

  async applyPromo(code: string) {
    await this.promoInput.fill(code);
    await this.applyPromoButton.click();
  }

  async buy() {
    await this.buyButton.click();
  }
}
