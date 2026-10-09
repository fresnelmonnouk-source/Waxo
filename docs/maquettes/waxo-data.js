// Wá xɔ — données de démonstration et stockage local partagés (boutique + back office)
export const CATS = [
  { id: 'maison', label: 'Maison', bg: '#F3E3A6' },
  { id: 'cuisine', label: 'Cuisine', bg: '#F2D9C4' },
  { id: 'beaute', label: 'Beauté', bg: '#F1DCD6' },
  { id: 'tech', label: 'Tech', bg: '#DCDDE8' },
  { id: 'bureau', label: 'Bureau', bg: '#EDE4CF' },
  { id: 'voyage', label: 'Voyage', bg: '#D7E3D2' }
];
export const catLabel = id => (CATS.find(c => c.id === id) || {}).label || '';
export const SHOP = { name: 'Wá xɔ', whatsapp: '+229 01 00 00 00 00', waNumber: '2290100000000', email: 'contact@waxo.bj', shipCotonou: 1000, shipOther: 2500, returnDays: 7 };
export const STATUS = {
  nouvelle: ['Reçue', '#FFF4D6', '#8A5A00'],
  preparation: ['En préparation', '#E8E4F5', '#4B3A8C'],
  livraison: ['En livraison', '#DDEBF7', '#1D4F7A'],
  livree: ['Livrée', '#E5EFE7', '#1F6B4A'],
  annulee: ['Annulée', '#F6E1DA', '#9A3412']
};
export const STATUS_FLOW = ['nouvelle', 'preparation', 'livraison', 'livree'];
export const PAY = { momo: 'MTN MoMo', moov: 'Moov Money', celtiis: 'Celtiis Cash', carte: 'Carte bancaire', cod: 'Paiement à la livraison' };
export const ZONES = { cotonou: 'Cotonou & Calavi', autre: 'Autres villes du Bénin' };

export const fmt = n => Math.round(n || 0).toLocaleString('fr-FR') + '\u00a0F';
export const fmtDate = (d, o) => new Date(d).toLocaleDateString('fr-FR', o || { day: 'numeric', month: 'long', year: 'numeric' });
export const digits = s => String(s || '').replace(/\D/g, '');
export const normPhone = s => { let d = digits(s); if (d.length === 13 && d.startsWith('229')) d = d.slice(3); return d; };
export const validPhone = s => /^01\d{8}$/.test(normPhone(s));
export const prettyPhone = s => normPhone(s).replace(/(\d{2})(?=\d)/g, '$1 ');
export const validEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());
export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const nextOrderId = orders => 'WX-' + (orders.reduce((m, o) => Math.max(m, parseInt(digits(o.id)) || 0), 10230) + 1);
export function ratingOf(p, reviews) {
  const own = reviews.filter(r => r.pid === p.id && !r.seed && !r.hidden);
  const n = (p.n0 || 0) + own.length;
  const sum = (p.r0 || 0) * (p.n0 || 0) + own.reduce((a, r) => a + r.rating, 0);
  return { avg: n ? sum / n : 0, n };
}

const K = 'waxo:v2:';
const clone = v => JSON.parse(JSON.stringify(v));
export function load(k, seed) {
  try { const v = localStorage.getItem(K + k); if (v !== null) return JSON.parse(v); } catch (e) {}
  return seed === undefined ? null : clone(seed);
}
export function save(k, v) {
  try { localStorage.setItem(K + k, JSON.stringify(v)); return true; } catch (e) { console.warn('Stockage local plein', e); return false; }
}
export function resetDemo() { Object.keys(localStorage).filter(k => k.startsWith(K)).forEach(k => localStorage.removeItem(k)); }
export const isOurKey = k => !!k && k.startsWith(K);
export function db() {
  return {
    products: load('products', SEED_PRODUCTS), reviews: load('reviews', SEED_REVIEWS), users: load('users', SEED_USERS),
    orders: load('orders', SEED_ORDERS), subs: load('subs', SEED_SUBS), messages: load('messages', SEED_MESSAGES),
    settings: settingsOf(load('settings', null)), kb: load('kb', SEED_KB), ledger: load('ledger', SEED_LEDGER), couriers: load('couriers', SEED_COURIERS)
  };
}

// Réglages de la boutique (modifiables dans le back office)
export const DEFAULT_SETTINGS = {
  shopName: 'Wá xɔ', whatsapp: '+229 01 00 00 00 00', email: 'contact@waxo.bj', hours: 'Du lundi au samedi, de 8 h à 19 h',
  shipCotonou: 1000, shipOther: 2500, freeShip: 15000, cutoff: 18,
  pay: { momo: true, moov: true, celtiis: true, carte: true, cod: true },
  autoDraft: true, aiSign: "L'équipe Wá xɔ"
};
export const settingsOf = v => ({ ...DEFAULT_SETTINGS, ...(v || {}), pay: { ...DEFAULT_SETTINGS.pay, ...((v && v.pay) || {}) } });

// Prix d'achat unitaires (carnet de bord)
export const COST = { lampe: 4600, ventilo: 3100, diffuseur: 6200, raquette: 2100, boites: 3900, eplucheur: 800, agrumes: 2400, blender: 7400, brosse: 2000, miroir: 1800, pinceaux: 2900, tondeuse: 7800, chargeur: 2700, ecouteurs: 8600, cables: 900, batterie: 5600, carnet: 1300, support: 1100, tapis: 1500, surligneurs: 600, gourde: 3300, trousse: 2500, masque: 900, organiseurs: 3400 };
export const costOf = p => !p ? null : 'cost' in p ? p.cost : COST[p.id] != null ? COST[p.id] : null;
export const EXP = {
  stock: ['Achat de stock', '#E8E4F5', '#4B3A8C'], pub: ['Publicité', '#FFF4D6', '#8A5A00'], livraison: ['Livraison', '#DDEBF7', '#1D4F7A'],
  emballage: ['Emballage', '#EDE4CF', '#4A443C'], loyer: ['Loyer et charges', '#F1DCD6', '#9A3412'], salaire: ['Salaires', '#E5EFE7', '#1F6B4A'], autre: ['Autre', '#E2DCCF', '#4A443C']
};
const L = (id, date, cat, label, amount) => ({ id, date, cat, label, amount });
export const SEED_LEDGER = [
  L('l1', '2026-07-15', 'stock', 'Réassort : lampes, batteries, chargeurs', 380000),
  L('l2', '2026-07-20', 'loyer', 'Loyer du dépôt, juillet', 40000),
  L('l3', '2026-08-02', 'stock', 'Réassort cuisine et voyage', 290000),
  L('l4', '2026-08-05', 'loyer', 'Loyer du dépôt, août', 40000),
  L('l5', '2026-08-10', 'pub', 'Publicité Facebook et Instagram', 35000),
  L('l6', '2026-08-20', 'emballage', 'Sachets kraft et papier bulle', 14000),
  L('l7', '2026-08-31', 'livraison', 'Livreurs, août', 26000),
  L('l8', '2026-09-01', 'stock', 'Réassort beauté et bureau', 310000),
  L('l9', '2026-09-05', 'loyer', 'Loyer du dépôt, septembre', 40000),
  L('l10', '2026-09-08', 'pub', 'Publicité Facebook et Instagram', 45000),
  L('l11', '2026-09-15', 'pub', 'Statuts WhatsApp sponsorisés (influenceuse)', 20000),
  L('l12', '2026-09-22', 'autre', 'Hébergement du site et nom de domaine', 15000),
  L('l13', '2026-09-30', 'livraison', 'Livreurs, septembre', 34000),
  L('l14', '2026-10-01', 'stock', 'Nouveautés : blender, organiseurs, tapis', 265000),
  L('l15', '2026-10-03', 'pub', 'Publicité Facebook et Instagram', 30000),
  L('l16', '2026-10-05', 'loyer', 'Loyer du dépôt, octobre', 40000),
  L('l17', '2026-10-06', 'emballage', "Cartons d'expédition", 12000)
];

export const SEED_COURIERS = [
  { id: 'c1', name: 'Rachidi Alassane', phone: '0166112200', zone: 'cotonou', active: true },
  { id: 'c2', name: 'Eustache Hounkpè', phone: '0197445566', zone: 'cotonou', active: true },
  { id: 'c3', name: 'Transporteur interurbain', phone: '0161778899', zone: 'autre', active: true }
];

// Base de connaissances utilisée par les assistants (recherche RAG)
const K_ = (id, tag, title, text, keywords) => ({ id, tag, title, text, keywords });
export const SEED_KB = [
  K_('kb1', 'Livraison', 'Délais et frais de livraison', "Cotonou et Calavi : livraison le lendemain pour toute commande passée avant 18 h, du lundi au samedi, 1 000 F, offerte dès 15 000 F d'achat. Autres villes du Bénin (Porto-Novo, Parakou, Bohicon, Abomey, Ouidah, Natitingou…) : 48 à 72 h, 2 500 F, par transporteur interurbain. Pas de livraison hors du Bénin pour le moment.", 'livrer livreur délai quand combien jours ville parakou porto-novo bohicon abomey ouidah natitingou lokossa expédition envoi frais'),
  K_('kb2', 'Livraison', 'Le jour de la livraison', "Le client reçoit une confirmation WhatsApp avec le créneau. Le livreur appelle avant d'arriver. Si le client est absent, la livraison est reprogrammée le jour ouvré suivant sans frais. Après deux tentatives, la commande est annulée et remboursée.", 'absent créneau appel heure reporter reprogrammer tentative'),
  K_('kb3', 'Paiement', 'Moyens de paiement', "Paiements acceptés : MTN MoMo, Moov Money, Celtiis Cash, carte Visa ou Mastercard, et paiement à la livraison en espèces ou Mobile Money. Aucun membre de l'équipe ne demande jamais de code secret.", 'payer paiement momo moov celtiis carte visa mastercard espèces cash livraison code'),
  K_('kb4', 'Retours', 'Échange et remboursement', "7 jours après réception pour demander un échange ou un remboursement, pour un produit non utilisé, complet et dans son emballage d'origine. Produits d'hygiène descellés exclus sauf défaut. À Cotonou et Calavi le livreur reprend le produit. Remboursement sous 7 jours sur le moyen de paiement utilisé.", 'retour retourner rembourser remboursement échanger échange défaut cassé abîmé'),
  K_('kb5', 'Retours', 'Produit défectueux ou erreur', "Un défaut ou une erreur de produit est à signaler dans les 48 h avec une photo. Wá xɔ échange ou rembourse et prend en charge les frais de retour.", 'défectueux marche pas panne cassé erreur mauvais produit photo garantie'),
  K_('kb6', 'Compte', 'Commander sans compte', "On peut commander sans compte, tout est confirmé par WhatsApp. Un compte permet de suivre ses commandes et de publier un avis. En créant un compte avec le même numéro, les commandes passées s'y rattachent automatiquement.", 'compte inscription inscrire suivre commande avis connexion mot de passe'),
  K_('kb7', 'Boutique', 'Qui sommes-nous', "Wá xɔ (« venez acheter » en fon) est une boutique en ligne basée à Cotonou, sans magasin physique. Tout le stock est chez nous, à Cotonou : le stock affiché est réel. Service client par WhatsApp du lundi au samedi de 8 h à 19 h.", 'boutique magasin adresse passer récupérer retrait horaires contact whatsapp stock'),
  K_('kb8', 'Produit', 'Diffuseur : quelles huiles ?', "Le diffuseur fonctionne avec toutes les huiles essentielles pures ou parfums hydrosolubles : 3 à 5 gouttes pour 300 ml d'eau. Les huiles ne sont pas fournies. Ne pas utiliser d'huiles végétales épaisses.", 'diffuseur huile essentielle parfum gouttes eau'),
  K_('kb9', 'Produit', 'Compatibilité des chargeurs et batteries', "Le chargeur 20 W et la batterie externe sont compatibles avec iPhone, Samsung, Tecno, Infinix, Itel et la plupart des smartphones USB-C. Pour un iPhone ancien, il faut un câble Lightning (non fourni).", 'compatible iphone samsung tecno infinix itel câble lightning usb charge')
];
export const tokens = s => norm(s).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w)).map(w => w.slice(0, 6));
const STOP = new Set('les des une est sont pour par sur avec dans cet cette ces que qui quoi quel quelle quels quelles vous nous ils elles mon mes votre vos notre nos pas plus bonjour merci svp peut peux faire fait avez aussi tres bien est-ce comment combien'.split(' ').filter(w => !['combien'].includes(w)));
export function kbDocs(kb, products) {
  return [
    ...(kb || []).map(d => ({ ...d, kind: 'kb' })),
    ...(products || []).filter(p => p.active !== false).map(p => ({ id: 'p:' + p.id, pid: p.id, kind: 'produit', tag: 'Produit', title: p.name, keywords: p.word + ' ' + catLabel(p.cat),
      text: p.desc + ' Prix : ' + fmt(p.price) + (p.old ? ' au lieu de ' + fmt(p.old) : '') + '. ' + (p.stock > 0 ? 'En stock : ' + p.stock + '.' : 'Épuisé pour le moment.') }))
  ];
}
// BM25 simplifié sur des racines de 6 lettres
export function retrieve(q, docs, k) {
  const qt = [...new Set(tokens(q))]; if (!qt.length || !docs.length) return [];
  const toks = docs.map(d => tokens(d.title + ' ' + d.title + ' ' + (d.keywords || '') + ' ' + d.text));
  const N = docs.length, avg = toks.reduce((a, t) => a + t.length, 0) / N, df = {};
  qt.forEach(t => { df[t] = toks.filter(ts => ts.includes(t)).length; });
  return docs.map((d, i) => {
    const ts = toks[i]; let sc = 0;
    qt.forEach(t => { const f = ts.filter(x => x === t).length; if (!f) return; const idf = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5)); sc += idf * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * ts.length / avg)); });
    return { ...d, score: sc };
  }).filter(d => d.score > 0.4).sort((a, b) => b.score - a.score).slice(0, k || 4);
}

const P = (id, name, cat, price, old, stock, sold, added, r0, n0, bg, word, desc) => ({ id, name, cat, price, old, stock, sold, added, r0, n0, bg, word, desc, active: true, img: null });
export const SEED_PRODUCTS = [
  P('lampe', 'Lampe LED rechargeable', 'maison', 8900, null, 5, 412, '2026-04-12', 4.7, 188, '#F3E3A6', 'lampe', "Jusqu'à 10 h d'autonomie, 3 intensités. Idéale pendant les coupures de courant. Se recharge en USB-C."),
  P('ventilo', 'Mini ventilateur USB', 'maison', 6000, null, 12, 236, '2026-05-02', 4.4, 77, '#D3E4E6', 'air', "Silencieux, 3 vitesses, batterie de 6 h. Se pose sur un bureau ou se tient à la main."),
  P('diffuseur', "Diffuseur d'huiles essentielles", 'maison', 11500, null, 6, 41, '2026-09-24', 4.6, 21, '#E2DAE8', 'parfum', "Brume fine et lumière douce, réservoir de 300 ml, arrêt automatique. Parfume une chambre ou un salon pendant 8 h."),
  P('raquette', 'Raquette anti-moustiques rechargeable', 'maison', 4500, null, 28, 351, '2026-03-20', 4.6, 163, '#DDE6C8', 'raquette', "Grille à trois couches, lampe LED intégrée, recharge USB. Des soirées tranquilles sans produit chimique."),
  P('boites', 'Set de 3 boîtes hermétiques', 'cuisine', 7500, null, 18, 274, '2026-04-28', 4.8, 121, '#F2D9C4', 'boîtes', "Verre borosilicate et couvercles à clips. Passent au micro-ondes et au congélateur. 400, 700 et 1 000 ml."),
  P('eplucheur', 'Éplucheur multifonction', 'cuisine', 2000, null, 35, 189, '2026-06-03', 4.3, 59, '#E3E8C9', 'éplucher', "3 lames : épluche, râpe en julienne, découpe. Inox, manche antidérapant. Passe au lave-vaisselle."),
  P('agrumes', 'Bouteille presse-agrumes', 'cuisine', 4900, null, 3, 102, '2026-07-15', 4.5, 47, '#EDE7B4', 'citron', "Pressez une orange ou un citron directement dans la bouteille. 500 ml, sans BPA. Se démonte pour le lavage."),
  P('blender', 'Blender portable USB', 'cuisine', 12500, 15000, 9, 38, '2026-09-30', 4.7, 18, '#F0D3C9', 'smoothie', "Gobelet de 400 ml, 6 lames inox, recharge USB-C. Un jus de fruits frais au bureau ou en déplacement."),
  P('brosse', 'Brosse nettoyante visage', 'beaute', 4500, 5500, 9, 167, '2026-05-18', 4.5, 88, '#F1DCD6', 'peau', "Silicone doux, étanche, rechargeable. Nettoie en profondeur sans irriter. 2 modes de vibration."),
  P('miroir', 'Miroir LED de poche', 'beaute', 3900, null, 11, 84, '2026-06-21', 4.4, 38, '#F0E1CF', 'miroir', "Double face dont une grossissante x3, éclairage LED rechargeable. Tient dans un sac à main."),
  P('pinceaux', 'Set de 10 pinceaux de maquillage', 'beaute', 6500, null, 15, 52, '2026-09-18', 4.8, 26, '#EBD5E0', 'pinceaux', "Poils synthétiques doux, manches en bois et trousse de rangement. Pour le teint, les yeux et les sourcils."),
  P('tondeuse', 'Tondeuse barbe rechargeable', 'beaute', 13900, null, 7, 133, '2026-02-10', 4.6, 92, '#D8DCE0', 'barbe', "5 sabots de 1 à 10 mm, lames inox, 90 minutes d'autonomie. Étanche, se rince sous l'eau."),
  P('chargeur', 'Chargeur rapide 20 W USB-C', 'tech', 5900, null, 31, 389, '2026-03-02', 4.6, 142, '#DCDDE8', 'charge', "Recharge un smartphone à 50 % en 30 minutes. Compatible iPhone, Samsung, Tecno, Infinix. Câble inclus."),
  P('ecouteurs', 'Écouteurs sans fil', 'tech', 14900, 18500, 4, 211, '2026-04-05', 4.5, 96, '#E6D3DE', 'son', "Bluetooth 5.3, 24 h d'écoute avec le boîtier. Micro pour les appels. Résistants à la sueur."),
  P('cables', 'Organisateur de câbles (x10)', 'tech', 2500, null, 40, 156, '2026-06-12', 4.6, 63, '#E9E2D3', 'câbles', "Attaches en silicone réutilisables pour ranger chargeurs et câbles. Un bureau net en deux minutes."),
  P('batterie', 'Batterie externe 10 000 mAh', 'tech', 9900, null, 14, 298, '2026-01-20', 4.7, 131, '#D5E0DA', 'énergie', "Recharge un smartphone 2 à 3 fois. Deux ports USB et un port USB-C, indicateur de niveau. Format poche."),
  P('carnet', 'Carnet A5 pointillé', 'bureau', 3000, null, 26, 92, '2026-07-01', 4.9, 41, '#EDE4CF', 'notes', "160 pages en papier 100 g, couverture rigide, élastique et marque-page. Pour les listes, les cours, les idées."),
  P('support', 'Support téléphone pliable', 'bureau', 2900, null, 22, 205, '2026-05-09', 4.5, 112, '#DCE3EA', 'support', "Aluminium, angle réglable, compatible tablettes. Pour les appels vidéo, les recettes, les séries."),
  P('tapis', 'Tapis de souris ergonomique', 'bureau', 3500, null, 17, 23, '2026-09-27', 4.6, 9, '#D9E2D0', 'souris', "Repose-poignet en mousse à mémoire de forme, base antidérapante. Moins de fatigue après une longue journée."),
  P('surligneurs', 'Lot de 6 surligneurs pastel', 'bureau', 1500, null, 48, 118, '2026-08-19', 4.7, 34, '#F2E6C2', 'pastel', "Pointe biseautée, encre qui ne traverse pas le papier. Six couleurs douces pour les cours et les réunions."),
  P('gourde', 'Gourde isotherme 750 ml', 'voyage', 6500, 8000, 23, 445, '2026-02-25', 4.8, 214, '#D7E3D2', 'gourde', "Acier inoxydable double paroi. Garde l'eau fraîche 24 h et le thé chaud 12 h. Bouchon étanche, ne coule pas dans le sac."),
  P('trousse', 'Trousse de toilette pliable', 'voyage', 5500, null, 14, 74, '2026-06-30', 4.7, 54, '#D9DFCF', 'trousse', "Crochet pour l'accrocher, 4 compartiments, tissu imperméable. Se plie à plat dans la valise."),
  P('masque', 'Masque de sommeil 3D', 'voyage', 2500, null, 19, 131, '2026-07-22', 4.6, 73, '#D6D9E6', 'dodo', "Bloque la lumière sans appuyer sur les yeux. Mousse légère, sangle réglable."),
  P('organiseurs', 'Organiseurs de valise (x6)', 'voyage', 7000, null, 10, 12, '2026-10-04', 4.8, 7, '#E4DCCB', 'valise', "Six pochettes de tailles différentes, tissu léger et fermetures solides. Une valise rangée, on retrouve tout.")
];

const R = (id, pid, author, rating, text, date, uid) => ({ id, pid, uid: uid || null, author, rating, text, date, verified: true, seed: true, hidden: false });
export const SEED_REVIEWS = [
  R('r1', 'lampe', 'Nadège K.', 5, "Elle a tenu toute une soirée de coupure sans faiblir. Je l'utilise aussi pour lire le soir.", '2026-09-29'),
  R('r2', 'lampe', 'Hermann Q.', 4, "Très bonne lumière. La recharge complète prend environ 4 h, à prévoir.", '2026-09-02'),
  R('r3', 'ventilo', 'Aïcha Y.', 4, "Pratique au bureau quand la clim est en panne. Pas très puissant en vitesse 1.", '2026-08-30'),
  R('r4', 'ventilo', 'Brice L.', 5, "Silencieux, je dors avec. La batterie tient la nuit en vitesse 2.", '2026-07-14'),
  R('r5', 'diffuseur', 'Carine M.', 5, "Joli objet, la lumière est douce. Je le mets 2 h avant de dormir.", '2026-10-03'),
  R('r6', 'diffuseur', 'Romaric H.', 4, "Bon diffuseur. Les huiles ne sont pas fournies, il faut les acheter à part.", '2026-09-28'),
  R('r7', 'raquette', 'Gildas T.', 5, "Redoutable. Mes enfants dorment enfin tranquilles.", '2026-09-15'),
  R('r8', 'raquette', 'Jocelyne D.', 4, "Efficace, la lampe attire bien les moustiques. Le bouton demande un peu de force.", '2026-08-11'),
  R('r9', 'boites', 'Carine M.', 5, "Le verre est épais et les couvercles ferment vraiment bien. Rien n'a coulé dans mon sac.", '2026-09-20'),
  R('r10', 'boites', 'Fabrice K.', 5, "Parfait pour emporter mon déjeuner. Ça passe au micro-ondes sans souci.", '2026-08-25'),
  R('r11', 'eplucheur', 'Ornella S.', 4, "La lame julienne est top pour les carottes. Un peu petit pour l'igname.", '2026-09-09'),
  R('r12', 'eplucheur', 'Koffi A.', 4, "Bon rapport qualité-prix, ça coupe bien.", '2026-07-30'),
  R('r13', 'agrumes', 'Bénédicte A.', 5, "Je fais mon jus de citron le matin directement dans la bouteille. Facile à laver.", '2026-09-26'),
  R('r14', 'agrumes', 'Ulrich Z.', 4, "Pratique, il faut juste bien serrer le bouchon.", '2026-08-17'),
  R('r15', 'blender', 'Mariam S.', 5, "Smoothie mangue-banane en 30 secondes. La batterie tient plusieurs utilisations.", '2026-10-05'),
  R('r16', 'blender', 'Sènan T.', 4, "Très pratique. Il faut couper les fruits en petits morceaux.", '2026-10-02'),
  R('r17', 'brosse', 'Fifamè G.', 5, "Ma peau est plus nette après deux semaines. Douce, même sur peau sensible.", '2026-09-18'),
  R('r18', 'brosse', 'Grâce A.', 4, "Bien, mais j'aurais aimé un troisième mode plus doux.", '2026-08-04'),
  R('r19', 'miroir', 'Aïcha Y.', 4, "Tient dans mon sac, la lumière aide beaucoup pour retoucher le maquillage.", '2026-09-07'),
  R('r20', 'miroir', 'Carine M.', 4, "Petit et pratique. Le côté grossissant est très utile.", '2026-07-21'),
  R('r21', 'pinceaux', 'Ornella S.', 5, "Les poils sont très doux et ne se perdent pas. La trousse est jolie.", '2026-10-01'),
  R('r22', 'pinceaux', 'Nadège K.', 5, "Super qualité pour le prix. Le pinceau à fond de teint est parfait.", '2026-09-25'),
  R('r23', 'tondeuse', 'Romaric H.', 5, "Coupe nette, les sabots tiennent bien. Je l'utilise tous les deux jours.", '2026-09-12'),
  R('r24', 'tondeuse', 'Brice L.', 4, "Bonne autonomie. Le cordon de charge est un peu court.", '2026-08-02'),
  R('r25', 'chargeur', 'Hermann Q.', 5, "Mon Tecno se recharge deux fois plus vite qu'avec l'ancien chargeur.", '2026-09-30'),
  R('r26', 'chargeur', 'Abdou B.', 4, "Fonctionne bien avec mon iPhone. Le câble fourni est un peu court.", '2026-09-03'),
  R('r27', 'ecouteurs', 'Gildas T.', 4, "Bon son, bonne autonomie. Le micro est correct pour les appels.", '2026-09-22'),
  R('r28', 'ecouteurs', 'Fabrice K.', 5, "Légers et confortables, je les garde toute la journée.", '2026-08-28'),
  R('r29', 'cables', 'Fabrice K.', 5, "Mon bureau est enfin rangé. Les attaches sont solides.", '2026-09-11'),
  R('r30', 'cables', 'Jocelyne D.', 4, "Simple et efficace, j'en ai mis dans mon sac aussi.", '2026-08-14'),
  R('r31', 'batterie', 'Koffi A.', 5, "Indispensable pendant les délestages. Elle recharge mon téléphone presque 3 fois.", '2026-10-04'),
  R('r32', 'batterie', 'Sènan T.', 4, "Bonne batterie, un peu lourde pour une poche de chemise.", '2026-09-16'),
  R('r33', 'carnet', 'Bénédicte A.', 5, "Papier épais, l'encre ne traverse pas. Je l'adore.", '2026-09-27'),
  R('r34', 'carnet', 'Abdou B.', 5, "Parfait pour mes cours. La couverture rigide protège bien.", '2026-09-01'),
  R('r35', 'support', 'Mariam S.', 5, "Je regarde mes recettes dessus en cuisinant. Très stable.", '2026-09-19'),
  R('r36', 'support', 'Ulrich Z.', 4, "Solide et pliable. L'angle se règle facilement.", '2026-08-08'),
  R('r37', 'tapis', 'Fabrice K.', 5, "Mon poignet ne me fait plus mal le soir.", '2026-10-03'),
  R('r38', 'tapis', 'Carine M.', 4, "Confortable, il ne glisse pas sur le bureau.", '2026-09-30'),
  R('r39', 'surligneurs', 'Ornella S.', 5, "Les couleurs sont douces et ne bavent pas.", '2026-09-14'),
  R('r40', 'surligneurs', 'Grâce A.', 4, "Bons surligneurs, la pointe permet de souligner fin ou large.", '2026-08-21'),
  R('r41', 'gourde', 'Koffi A.', 5, "L'eau reste fraîche toute la journée, même dans la voiture.", '2026-10-01'),
  R('r42', 'gourde', 'Fifamè G.', 5, "Elle ne coule pas dans mon sac. Très bonne qualité.", '2026-09-13'),
  R('r43', 'trousse', 'Hermann Q.', 5, "Le crochet est très pratique à l'hôtel. Tout est bien rangé.", '2026-09-06'),
  R('r44', 'trousse', 'Aïcha Y.', 4, "Bonne taille, tissu facile à nettoyer.", '2026-08-19'),
  R('r45', 'masque', 'Afi H.', 5, "Il ne touche pas les yeux, je dors beaucoup mieux.", '2026-09-15', 'u_afi'),
  R('r46', 'masque', 'Brice L.', 4, "Bloque bien la lumière. La sangle pourrait être plus large.", '2026-08-09'),
  R('r47', 'organiseurs', 'Grâce A.', 5, "Ma valise n'a jamais été aussi bien rangée.", '2026-10-06'),
  R('r48', 'organiseurs', 'Romaric H.', 5, "Tissu léger mais solide, fermetures de bonne qualité.", '2026-10-05')
];

export const SEED_USERS = [
  { id: 'u_admin', role: 'admin', first: 'Équipe', last: 'Wá xɔ', phone: '0100000000', email: 'admin@waxo.bj', pass: 'admin1234', address: '', news: false, created: '2026-01-05' },
  { id: 'u_afi', role: 'client', first: 'Afi', last: 'Houngbédji', phone: '0197112233', email: 'afi@exemple.bj', pass: 'demo1234', address: 'Fidjrossè, après la pharmacie, portail bleu', news: true, created: '2026-09-12' },
  { id: 'u_koffi', role: 'client', first: 'Koffi', last: 'Agossou', phone: '0196554433', email: 'koffi.a@exemple.bj', pass: 'demo1234', address: 'Akpakpa, rue du marché Dantokpa', news: true, created: '2026-08-30' },
  { id: 'u_mariam', role: 'client', first: 'Mariam', last: 'Soulé', phone: '0194887766', email: 'mariam.s@exemple.bj', pass: 'demo1234', address: 'Calavi, Zopah, près de l\'église', news: false, created: '2026-09-27' },
  { id: 'u_rodrigue', role: 'client', first: 'Rodrigue', last: 'Dossou', phone: '0161223344', email: 'rodrigue.d@exemple.bj', pass: 'demo1234', address: 'Porto-Novo, Ouando', news: false, created: '2026-10-02' }
];

const it = (pid, name, price, qty) => ({ pid, name, price, qty });
const O = (id, date, uid, name, phone, address, zone, pay, items, ship, status) => { const sub = items.reduce((a, i) => a + i.price * i.qty, 0); return { id, date, uid, name, phone, address, zone, pay, items, sub, ship, total: sub + ship, status }; };
export const SEED_ORDERS = [
  O('WX-10262', '2026-10-08T09:41:00', null, 'Ulrich Zinsou', '0167001122', 'Cadjèhoun, derrière la station', 'cotonou', 'cod', [it('ventilo', 'Mini ventilateur USB', 6000, 1)], 1000, 'nouvelle'),
  O('WX-10261', '2026-10-08T08:15:00', 'u_koffi', 'Koffi Agossou', '0196554433', 'Akpakpa, rue du marché Dantokpa', 'cotonou', 'momo', [it('blender', 'Blender portable USB', 12500, 1), it('gourde', 'Gourde isotherme 750 ml', 6500, 1)], 0, 'nouvelle'),
  O('WX-10260', '2026-10-07T17:22:00', null, 'Grâce Adjovi', '0195332211', 'Gbégamey, immeuble jaune, 2e étage', 'cotonou', 'momo', [it('boites', 'Set de 3 boîtes hermétiques', 7500, 1), it('eplucheur', 'Éplucheur multifonction', 2000, 1)], 1000, 'preparation'),
  { ...O('WX-10258', '2026-10-06T19:05:00', 'u_afi', 'Afi Houngbédji', '0197112233', 'Fidjrossè, après la pharmacie, portail bleu', 'cotonou', 'cod', [it('lampe', 'Lampe LED rechargeable', 8900, 1), it('cables', 'Organisateur de câbles (x10)', 2500, 1)], 1000, 'livraison'), courier: 'c1' },
  O('WX-10255', '2026-10-03T11:30:00', 'u_rodrigue', 'Rodrigue Dossou', '0161223344', 'Porto-Novo, Ouando', 'autre', 'celtiis', [it('batterie', 'Batterie externe 10 000 mAh', 9900, 1), it('support', 'Support téléphone pliable', 2900, 1)], 2500, 'livree'),
  O('WX-10252', '2026-10-01T14:10:00', null, 'Sènan Tossou', '0166445566', 'Agla, carrefour Hlazounto', 'cotonou', 'cod', [it('raquette', 'Raquette anti-moustiques rechargeable', 4500, 2)], 1000, 'livree'),
  O('WX-10249', '2026-09-28T10:02:00', 'u_mariam', 'Mariam Soulé', '0194887766', 'Calavi, Zopah, près de l\'église', 'cotonou', 'moov', [it('pinceaux', 'Set de 10 pinceaux de maquillage', 6500, 1), it('brosse', 'Brosse nettoyante visage', 4500, 1), it('miroir', 'Miroir LED de poche', 3900, 1)], 1000, 'livree'),
  O('WX-10244', '2026-09-21T16:48:00', 'u_koffi', 'Koffi Agossou', '0196554433', 'Akpakpa, rue du marché Dantokpa', 'cotonou', 'carte', [it('ecouteurs', 'Écouteurs sans fil', 14900, 1), it('chargeur', 'Chargeur rapide 20 W USB-C', 5900, 1)], 0, 'livree'),
  O('WX-10231', '2026-09-12T12:20:00', 'u_afi', 'Afi Houngbédji', '0197112233', 'Fidjrossè, après la pharmacie, portail bleu', 'cotonou', 'momo', [it('gourde', 'Gourde isotherme 750 ml', 6500, 1), it('masque', 'Masque de sommeil 3D', 2500, 1)], 1000, 'livree'),
  ...history()
];
function history() {
  let a = 229; const r = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const NAMES = ['Nadège Kpossou', 'Hermann Quenum', 'Aïcha Yessoufou', 'Brice Lawson', 'Carine Mensah', 'Romaric Hounsa', 'Gildas Tchibozo', 'Jocelyne Dossa', 'Fabrice Kiki', 'Ornella Sossa', 'Bénédicte Ahouansou', 'Fifamè Gbaguidi', 'Abdou Bio', 'Mariette Akpovi', 'Désiré Houessou', 'Laure Agbodjan', 'Prince Ahyi', 'Yasmine Chabi'];
  const QU = ['Cadjèhoun', 'Fidjrossè', 'Akpakpa', 'Gbégamey', 'Agla', 'Haie Vive', 'Zogbo', 'Calavi, Kpota', 'Godomey', 'Vèdoko', 'Sainte-Rita', 'Cocotomey'], VI = ['Porto-Novo', 'Parakou', 'Bohicon', 'Abomey', 'Ouidah', 'Lokossa'];
  const P = SEED_PRODUCTS, W = P.reduce((s, p) => s + p.sold, 0), pick = () => { let x = r() * W; for (const p of P) { x -= p.sold; if (x <= 0) return p; } return P[0]; };
  const end = +new Date('2026-10-05T12:00:00'), list = [];
  for (let i = 0; i < 110; i++) {
    const d = new Date(end - Math.floor(Math.pow(r(), 1.25) * 86) * 864e5); d.setHours(8 + Math.floor(r() * 13), Math.floor(r() * 60));
    const n = r() < 0.6 ? 1 : r() < 0.75 ? 2 : 3, items = [];
    for (let j = 0; j < n; j++) { const p = pick(); if (!items.some(x => x.pid === p.id)) items.push(it(p.id, p.name, p.price, r() < 0.85 ? 1 : 2)); }
    const zone = r() < 0.84 ? 'cotonou' : 'autre', sub = items.reduce((s, x) => s + x.price * x.qty, 0), x = r();
    const pay = x < 0.38 ? 'momo' : x < 0.52 ? 'moov' : x < 0.6 ? 'celtiis' : x < 0.68 ? 'carte' : 'cod';
    const nm = NAMES[Math.floor(r() * NAMES.length)], ph = '01' + (r() < 0.5 ? '9' : '6') + String(Math.floor(r() * 1e7)).padStart(7, '0');
    const addr = zone === 'cotonou' ? QU[Math.floor(r() * QU.length)] : VI[Math.floor(r() * VI.length)] + ', centre-ville';
    list.push({ ...O('', d.toISOString(), null, nm, ph, addr, zone, pay, items, zone === 'autre' ? 2500 : sub >= 15000 ? 0 : 1000, r() < 0.06 ? 'annulee' : 'livree'), courier: zone === 'autre' ? 'c3' : r() < 0.55 ? 'c1' : 'c2' });
  }
  return list.sort((a, b) => new Date(b.date) - new Date(a.date)).map((o, i) => ({ ...o, id: 'WX-' + (10230 - i) }));
}

export const SEED_SUBS = [
  { id: 's1', channel: 'email', value: 'afi@exemple.bj', date: '2026-09-12' },
  { id: 's2', channel: 'whatsapp', value: '0196554433', date: '2026-09-21' },
  { id: 's3', channel: 'email', value: 'nadege.k@exemple.bj', date: '2026-09-25' },
  { id: 's4', channel: 'whatsapp', value: '0167889900', date: '2026-10-02' },
  { id: 's5', channel: 'email', value: 'b.lokossou@exemple.bj', date: '2026-10-06' }
];

export const SEED_MESSAGES = [
  { id: 'm1', name: 'Hermann Quenum', contact: '0162334455', subject: 'Livraison', orderId: '', text: 'Bonjour, livrez-vous à Parakou ? Si oui, en combien de jours ?', date: '2026-10-07T10:12:00', done: false },
  { id: 'm2', name: 'Carine Mensah', contact: 'carine.m@exemple.bj', subject: 'Produit', orderId: '', text: "Le diffuseur fonctionne-t-il avec n'importe quelle huile essentielle ?", date: '2026-10-06T16:40:00', done: true }
];

// Photos d'illustration : à renseigner (id produit -> URL directe d'image)
export const STOCK_IMG = {};
