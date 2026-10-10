// Génère src/lib/demo/kb.json (base de connaissances de l'assistant, repli sans Supabase)
// depuis SEED_KB de docs/maquettes/waxo-data.js. Ajoute la version anglaise (champ `en`). Usage : node scripts/gen-demo-kb.mjs
import { writeFileSync } from 'node:fs';
const m = await import(new URL('../docs/maquettes/waxo-data.js', import.meta.url).href);

const EN = {
  kb1: { tag: 'Delivery', title: 'Delivery times and fees', text: "Cotonou and Calavi: next-day delivery for any order placed before 6 pm, Monday to Saturday, 1,000 F, free from 15,000 F. Other cities in Benin (Porto-Novo, Parakou, Bohicon, Abomey, Ouidah, Natitingou…): 48 to 72 hours, 2,500 F, by intercity carrier. No delivery outside Benin for now.", keywords: 'deliver delivery courier delay when how long days city parakou porto-novo bohicon abomey ouidah natitingou lokossa shipping fees' },
  kb2: { tag: 'Delivery', title: 'On delivery day', text: "The customer receives a WhatsApp confirmation with the time slot. The courier calls before arriving. If the customer is absent, the delivery is rescheduled to the next working day at no cost. After two attempts, the order is cancelled and refunded.", keywords: 'absent slot call time postpone reschedule attempt' },
  kb3: { tag: 'Payment', title: 'Payment methods', text: "Accepted payments: MTN MoMo, Moov Money, Celtiis Cash, Visa or Mastercard card, and cash on delivery in cash or Mobile Money. No member of the team ever asks for a secret code.", keywords: 'pay payment momo moov celtiis card visa mastercard cash delivery code' },
  kb4: { tag: 'Returns', title: 'Exchange and refund', text: "7 days after receipt to ask for an exchange or a refund, for an unused, complete product in its original packaging. Unsealed hygiene products are excluded unless defective. In Cotonou and Calavi the courier takes the product back. Refund within 7 days to the payment method used.", keywords: 'return refund exchange defect broken damaged' },
  kb5: { tag: 'Returns', title: 'Faulty product or mistake', text: "A defect or a wrong product must be reported within 48 hours with a photo. Wá xɔ exchanges or refunds and covers the return costs.", keywords: 'faulty defective not working breakdown broken mistake wrong product photo warranty' },
  kb6: { tag: 'Account', title: 'Ordering without an account', text: "You can order without an account, everything is confirmed on WhatsApp. An account lets you follow your orders and post a review. If you create an account with the same phone number, past orders are attached to it automatically.", keywords: 'account sign up register follow order review login password' },
  kb7: { tag: 'Shop', title: 'Who we are', text: "Wá xɔ (“come and buy” in Fon) is an online shop based in Cotonou, with no physical store. All the stock is with us, in Cotonou: the stock shown is real. Customer service on WhatsApp from Monday to Saturday, 8 am to 7 pm.", keywords: 'shop store address pick up collect pickup hours contact whatsapp stock' },
  kb8: { tag: 'Product', title: 'Diffuser: which oils?', text: "The diffuser works with any pure essential oil or water-soluble fragrance: 3 to 5 drops for 300 ml of water. Oils are not included. Do not use thick vegetable oils.", keywords: 'diffuser oil essential fragrance drops water' },
  kb9: { tag: 'Product', title: 'Charger and power bank compatibility', text: "The 20 W charger and the power bank are compatible with iPhone, Samsung, Tecno, Infinix, Itel and most USB-C smartphones. For an older iPhone you need a Lightning cable (not included).", keywords: 'compatible iphone samsung tecno infinix itel lightning cable usb charge charger' },
};

const kb = m.SEED_KB.map((d) => ({ id: d.id, tag: d.tag, title: d.title, text: d.text, keywords: d.keywords, en: EN[d.id] ?? null }));
writeFileSync(new URL('../src/lib/demo/kb.json', import.meta.url), JSON.stringify(kb, null, 1));
console.log('kb demo', kb.length, 'entrées,', kb.filter((d) => d.en).length, 'traduites');
