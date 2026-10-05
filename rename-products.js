// One-time script: renames the sample products in an existing store.db to English names.
const { db } = require('./db');
const map = {
  'Tamatar (Tomato)': 'Tomato', 'Aloo (Potato)': 'Potato', 'Pyaaz (Onion)': 'Onion', 'Gajar (Carrot)': 'Carrot',
  'Palak (Spinach)': 'Spinach', 'Methi (Fenugreek)': 'Fenugreek (Methi)', 'Hari Mirch (Green Chilli)': 'Green Chilli',
  'Shimla Mirch (Capsicum)': 'Capsicum', 'Baingan (Brinjal)': 'Brinjal (Eggplant)', 'Bhindi (Okra)': 'Okra (Bhindi)',
  'Lauki (Bottle Gourd)': 'Bottle Gourd', 'Phool Gobhi (Cauliflower)': 'Cauliflower', 'Nimbu (Lemon)': 'Lemon',
  'Kela (Banana)': 'Banana', 'Seb (Apple)': 'Apple', 'Dhaniya (Coriander)': 'Coriander'
};
let n = 0;
for (const [from, to] of Object.entries(map)) n += Number(db.prepare('UPDATE products SET name = ? WHERE name = ?').run(to, from).changes);
console.log(`Renamed ${n} product(s) to English.`);
