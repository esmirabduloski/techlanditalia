import { test, expect } from "./support/test";
import { FAKE_SUPABASE_URL } from "./support/fakeSupabase";
import { parent } from "./support/seed";

/**
 * Pagamento: dal catalogo al checkout Stripe e ritorno.
 * Stripe non viene mai contattato: la pagina di checkout è finta e il test
 * controlla che l'app ci arrivi con il prezzo giusto e la sessione dell'utente.
 */

const STRIPE_CHECKOUT = "https://checkout.stripe.com/c/pay/cs_test_e2e";

const products = [
  {
    id: "prod_python",
    name: "Python Base - 10 lezioni",
    description: "Pacchetto da 10 lezioni live",
    images: [],
    metadata: { course_slug: "python-base" },
    prices: [{ id: "price_python10", unit_amount: 24900, currency: "eur", recurring: null, type: "one_time" }],
  },
  {
    id: "prod_roblox",
    name: "Roblox Studio - abbonamento",
    description: "Lezioni settimanali",
    images: [],
    metadata: { course_slug: "roblox" },
    prices: [{ id: "price_roblox_month", unit_amount: 8900, currency: "eur", recurring: { interval: "month" }, type: "recurring" }],
  },
];

test.beforeEach(async ({ fake, page }) => {
  fake.addUser(parent);
  fake.seed("profiles", [{ id: parent.id, full_name: parent.fullName }]);
  fake.seed("courses", [
    { slug: "python-base", title: "Python Base", emoji: "🐍", age_range: "10-14 anni", is_visible: true },
    { slug: "roblox", title: "Roblox Studio", emoji: "🎮", age_range: "8-12 anni", is_visible: true },
  ]);
  fake.fn("stripe-get-products", () => ({ body: { products } }));
  fake.fn("stripe-create-checkout", (body) => {
    const { priceId } = body as { priceId: string };
    return priceId.startsWith("price_")
      ? { body: { url: `${STRIPE_CHECKOUT}#${priceId}` } }
      : { status: 400, body: { error: "Invalid priceId" } };
  });
  await page.route(`${STRIPE_CHECKOUT}**`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>Stripe Checkout (finto)</h1>" }),
  );
  await fake.signInBeforeLoad(page, parent);
});

test("il genitore sceglie un pacchetto e va al checkout Stripe con quel prezzo", async ({ page, fake }) => {
  await page.goto("/area-riservata/acquisti");

  await expect(page.getByText("2 corsi disponibili")).toBeVisible();
  // La card più interna che contiene sia il nome sia il bottone
  const python = page
    .locator("div")
    .filter({ hasText: "Python Base - 10 lezioni" })
    .filter({ has: page.getByRole("button", { name: "Acquista ora" }) })
    .last();
  await expect(python).toContainText("249,00 €");
  await expect(page.getByText("89,00 €")).toBeVisible();
  await expect(page.getByText("/mese")).toBeVisible();

  await python.getByRole("button", { name: "Acquista ora" }).click();

  await expect(page).toHaveURL(`${STRIPE_CHECKOUT}#price_python10`);
  await expect(page.getByRole("heading", { name: "Stripe Checkout (finto)" })).toBeVisible();

  const [call] = fake.callsTo("stripe-create-checkout");
  expect(call.body).toEqual({
    priceId: "price_python10",
    successUrl: expect.stringMatching(/\/area-riservata\/acquisti\?success=true$/),
    cancelUrl: expect.stringMatching(/\/area-riservata\/acquisti\?canceled=true$/),
  });
  // La funzione deve sapere chi paga (metadata user_id, email sul checkout)
  expect(call.authorization).toMatch(/^Bearer ey/);
  expect(call.authorization).not.toContain("chiave-finta-e2e");
});

test("al ritorno da Stripe il genitore vede la conferma del pagamento", async ({ page }) => {
  await page.goto("/area-riservata/acquisti?success=true");
  await expect(page.getByText("Pagamento completato!")).toBeVisible();
});

test("se annulla su Stripe vede che può riprovare", async ({ page }) => {
  await page.goto("/area-riservata/acquisti?canceled=true");
  await expect(page.getByText("Pagamento annullato")).toBeVisible();
  await expect(page.getByRole("button", { name: "Acquista ora" }).first()).toBeEnabled();
});

test("se il checkout non parte il genitore resta sulla pagina con un errore", async ({ page, fake }) => {
  fake.fn("stripe-create-checkout", () => ({ status: 500, body: { error: "Stripe non raggiungibile" } }));

  await page.goto("/area-riservata/acquisti");
  await page.getByRole("button", { name: "Acquista ora" }).first().click();

  await expect(page.getByText("Impossibile avviare il pagamento. Riprova.", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/area-riservata\/acquisti$/);
  await expect(page.getByRole("button", { name: "Acquista ora" }).first()).toBeEnabled();
});

test("il genitore con rate nel CRM vede pagato e da pagare", async ({ page, fake }) => {
  fake.rpc("get_my_crm_payments", () => [
    { id: "p1", amount_cents: 12000, list_amount_cents: null, discount_label: null, status: "paid", description: "Python Base", due_date: "2026-09-01", paid_at: "2026-09-01", method: "stripe", installment_number: 1, installment_total: 2 },
    { id: "p2", amount_cents: 12000, list_amount_cents: null, discount_label: null, status: "scheduled", description: "Python Base", due_date: "2099-11-01", paid_at: null, method: null, installment_number: 2, installment_total: 2 },
  ]);

  await page.goto("/area-riservata/acquisti");
  const card = page.locator("div").filter({ hasText: "I tuoi pagamenti" }).filter({ hasText: "Già pagato" }).last();
  await expect(card).toContainText(/Già pagato\s*120,00\s€/);
  await expect(card).toContainText(/Da pagare\s*120,00\s€/);
  await expect(card).toContainText("Prossima scadenza01/11/2099");
});

test("se i prodotti Stripe non arrivano il genitore vede un errore, non una pagina vuota", async ({ page, fake }) => {
  fake.fn("stripe-get-products", () => ({ status: 500, body: { error: "boom" } }));
  await page.goto("/area-riservata/acquisti");
  await expect(page.getByText("Impossibile caricare i prodotti. Riprova più tardi.", { exact: true })).toBeVisible();
});

// Il fake deve essere l'unico backend: nessuna richiesta parte verso il progetto vero.
test("nessuna chiamata esce verso Supabase reale", async ({ page }) => {
  const hosts = new Set<string>();
  page.on("request", (r) => hosts.add(new URL(r.url()).host));
  await page.goto("/area-riservata/acquisti");
  await expect(page.getByText("2 corsi disponibili")).toBeVisible();
  expect([...hosts].filter((h) => h.endsWith("supabase.co"))).toEqual([]);
  expect(hosts).toContain(new URL(FAKE_SUPABASE_URL).host);
});
