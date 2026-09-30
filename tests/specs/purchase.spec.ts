import { test, expect } from '../fixtures';
import { eur, expectedPrice } from '../support/pricing';

/**
 * Every test here creates its own event and its own user, so buying tickets
 * never changes the stock another test is looking at.
 */
test.describe('Buying tickets', () => {
  // Log in as a brand-new user before each test (the fixture does it through the API)
  test.beforeEach(async ({ freshUser }) => {
    expect(freshUser.id).toBeTruthy();
  });

  test('a user can buy tickets and sees them confirmed @smoke', async ({ page, testData, eventPage, confirmationPage, ordersPage }) => {
    const event = await testData.createEvent({ priceCents: 30000 });
    const expected = expectedPrice({ priceCents: 30000, quantity: 2 });

    await eventPage.goto(event.id);
    await eventPage.addTickets(1);
    await expect(eventPage.total).toHaveText(eur(expected.total));
    await eventPage.buy();

    await expect(confirmationPage.heading).toBeVisible();
    await expect(confirmationPage.quantity).toHaveText('2');
    await expect(confirmationPage.total).toHaveText(eur(expected.total)); // charged what was shown

    await confirmationPage.viewOrders.click();
    await expect(page).toHaveURL('/orders');
    await expect(ordersPage.order(event.name)).toContainText('Confirmed');
    await expect(ordersPage.order(event.name)).toContainText(`2 tickets · ${eur(expected.total)}`);
  });

  test('the price summary is correct for every quantity from 1 to 6 @regression', async ({ testData, eventPage }) => {
    const event = await testData.createEvent({ priceCents: 19950 }); // an odd price catches rounding mistakes
    await eventPage.goto(event.id);

    for (let quantity = 1; quantity <= 6; quantity++) {
      if (quantity > 1) await eventPage.addTicket.click();
      const p = expectedPrice({ priceCents: 19950, quantity });

      await expect(eventPage.ticketsLabel).toHaveText(`${quantity} × ${eur(19950)}`);
      await expect(eventPage.subtotal).toHaveText(eur(p.subtotal));
      await expect(eventPage.fee).toHaveText(eur(p.fees));
      await expect(eventPage.total).toHaveText(eur(p.total));
      await expect(eventPage.buyButton).toHaveText(`Buy ${quantity} ${quantity === 1 ? 'ticket' : 'tickets'}`);
    }
  });

  test.describe('quantity limits', () => {
    test('the stepper stays between 1 and 6 @regression', async ({ testData, eventPage }) => {
      const event = await testData.createEvent();
      await eventPage.goto(event.id);

      await expect(eventPage.quantity).toHaveValue('1');
      await expect(eventPage.removeTicket).toBeDisabled();

      await eventPage.addTickets(5);
      await expect(eventPage.quantity).toHaveValue('6');
      await expect(eventPage.addTicket).toBeDisabled();
    });

    // Typed values outside the range are corrected rather than rejected
    for (const [typed, expected] of [
      ['10', '6'],
      ['0', '1'],
      ['-3', '1'],
      ['2.7', '2'],
    ] as const) {
      test(`typing "${typed}" becomes ${expected} @regression`, async ({ testData, eventPage }) => {
          const event = await testData.createEvent();
        await eventPage.goto(event.id);

        await eventPage.typeQuantity(typed);
        await expect(eventPage.quantity).toHaveValue(expected);
      });
    }

    test('when only 3 tickets are left, you cannot pick more than 3 @regression', async ({ testData, eventPage }) => {
      const event = await testData.createEvent({ capacity: 50, sold: 47 });
      await eventPage.goto(event.id);

      await expect(eventPage.availability).toHaveText('Only 3 left');
      await eventPage.addTickets(2);
      await expect(eventPage.quantity).toHaveValue('3');
      await expect(eventPage.addTicket).toBeDisabled();
    });
  });

  test.describe('promo codes', () => {
    test('a valid code takes 10% off the tickets but not the booking fee @smoke', async ({ testData, eventPage, confirmationPage }) => {
      const event = await testData.createEvent({ priceCents: 40000 });
      const p = expectedPrice({ priceCents: 40000, quantity: 2, percentOff: 10 });

      await eventPage.goto(event.id);
      await eventPage.addTickets(1);
      await eventPage.applyPromo('gig10'); // lower case on purpose

      await expect(eventPage.promoMessage).toHaveText('GIG10 applied: 10% off tickets.');
      await expect(eventPage.discount).toHaveText(`−${eur(p.discount)}`);
      await expect(eventPage.fee).toHaveText(eur(p.fees));
      await expect(eventPage.total).toHaveText(eur(p.total));

      await eventPage.buy();
      await expect(confirmationPage.total).toHaveText(eur(p.total));
    });

    const badCodes = [
      { code: 'NOPE99', message: 'That code is not recognised' },
      { code: 'SUMMER25', message: 'That code has expired' },
    ];
    for (const { code, message } of badCodes) {
      test(`"${code}" is rejected with "${message}" and the price does not change @regression`, async ({ testData, eventPage }) => {
          const event = await testData.createEvent({ priceCents: 25000 });
        await eventPage.goto(event.id);
        const before = await eventPage.total.textContent();

        await eventPage.applyPromo(code);

        await expect(eventPage.promoMessage).toHaveText(message);
        await expect(eventPage.discount).toBeHidden();
        await expect(eventPage.total).toHaveText(before!);
      });
    }

    test('a failed code replaces a previously applied discount @regression', async ({ testData, eventPage }) => {
      const event = await testData.createEvent({ priceCents: 25000 });
      await eventPage.goto(event.id);

      await eventPage.applyPromo('STUDENT20');
      await expect(eventPage.discount).toBeVisible();

      await eventPage.applyPromo('NOPE99');
      await expect(eventPage.discount).toBeHidden();
      await expect(eventPage.total).toHaveText(eur(expectedPrice({ priceCents: 25000, quantity: 1 }).total));
    });
  });

  test('a sold-out event cannot be bought @regression', async ({ testData, eventPage }) => {
    const event = await testData.createEvent({ capacity: 20, sold: 20 });
    await eventPage.goto(event.id);

    await expect(eventPage.soldOutButton).toBeDisabled();
    await expect(eventPage.buyButton).toBeHidden();
    await expect(eventPage.quantity).toBeHidden();
  });

  test('if someone else buys the last tickets first, the user gets a clear message, not a crash @regression', async ({
    testData,
    eventPage,
  }) => {
    const event = await testData.createEvent({ capacity: 10, sold: 8 });
    await eventPage.goto(event.id);
    await eventPage.addTickets(1); // wants the last 2

    // While the page is open, another customer buys them
    await testData.buyAsSomeoneElse(event.id, 2);
    await eventPage.buy();

    await expect(eventPage.buyError).toHaveText('Sorry, those tickets just sold.');
    await expect(eventPage.soldOutButton).toBeDisabled();
  });

  test('buying reduces the number of tickets left @regression', async ({ testData, eventPage, confirmationPage }) => {
    const event = await testData.createEvent({ capacity: 30, sold: 20 });
    await eventPage.goto(event.id);
    await expect(eventPage.availability).toHaveText('Only 10 left');

    await eventPage.addTickets(3);
    await eventPage.buy();
    await expect(confirmationPage.heading).toBeVisible();

    await eventPage.goto(event.id);
    await expect(eventPage.availability).toHaveText('Only 6 left');
  });
});
