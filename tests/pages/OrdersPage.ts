import type { Locator, Page } from '@playwright/test';

export class ConfirmationPage {
  readonly heading: Locator;
  readonly orderNumber: Locator;
  readonly quantity: Locator;
  readonly total: Locator;
  readonly viewOrders: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: "You're going!" });
    this.orderNumber = page.getByTestId('order-number');
    this.quantity = page.getByTestId('order-quantity');
    this.total = page.getByTestId('order-total');
    this.viewOrders = page.getByRole('link', { name: 'View my orders' });
  }
}

export class OrdersPage {
  readonly heading: Locator;
  readonly list: Locator;
  readonly emptyState: Locator;
  readonly toast: Locator;
  readonly dialog: Locator;
  readonly dialogText: Locator;
  readonly confirmCancel: Locator;
  readonly keepTickets: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'My orders' });
    this.list = page.getByRole('list', { name: 'Orders' });
    this.emptyState = page.getByText("You haven't bought any tickets yet.");
    this.toast = page.locator('#toast');
    this.dialog = page.getByRole('dialog', { name: 'Cancel this order?' });
    this.dialogText = this.dialog.locator('#cancel-text');
    this.confirmCancel = this.dialog.getByRole('button', { name: 'Yes, cancel order' });
    this.keepTickets = this.dialog.getByRole('button', { name: 'Keep my tickets' });
  }

  async goto() {
    await this.page.goto('/orders');
    await this.heading.waitFor();
  }

  order(eventName: string): Locator {
    return this.list.getByRole('listitem').filter({ has: this.page.getByRole('heading', { name: eventName, exact: true }) });
  }

  cancelButton(eventName: string): Locator {
    return this.order(eventName).getByRole('button', { name: `Cancel order for ${eventName}` });
  }

  async cancel(eventName: string) {
    await this.cancelButton(eventName).click();
    await this.confirmCancel.click();
  }
}
