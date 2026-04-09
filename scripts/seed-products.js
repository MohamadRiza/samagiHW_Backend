const Product = require('../models/Product');

const seedProducts = () => {
  const sampleProducts = [
    {
      item_name: 'Cement Bag 50kg',
      short_form: 'CEM-50',
      buying_price: 1850,
      selling_price: 2100,
      stock_quantity: 150,
      discount_type: 'percent',
      discount_value: 5,
      category: 'Construction',
      min_stock_alert: 20
    },
    {
      item_name: 'Electrical Wire 2.5mm',
      short_form: 'WIRE-2.5',
      buying_price: 45,
      selling_price: 65,
      stock_quantity: 500,
      discount_type: 'amount',
      discount_value: 5,
      category: 'Electrical',
      min_stock_alert: 100
    },
    {
      item_name: 'PVC Pipe 1 Inch',
      short_form: 'PVC-1',
      buying_price: 320,
      selling_price: 420,
      stock_quantity: 220,
      discount_type: 'percent',
      discount_value: 10,
      category: 'Plumbing',
      min_stock_alert: 30
    },
    {
      item_name: 'Hammer Heavy Duty',
      short_form: 'HAM-HD',
      buying_price: 750,
      selling_price: 950,
      stock_quantity: 80,
      discount_type: 'amount',
      discount_value: 50,
      category: 'Tools',
      min_stock_alert: 10
    },
    {
      item_name: 'Paint Brush 4 Inch',
      short_form: 'PB-4',
      buying_price: 120,
      selling_price: 180,
      stock_quantity: 300,
      discount_type: 'percent',
      discount_value: 8,
      category: 'Painting',
      min_stock_alert: 50
    },
    {
      item_name: 'Wall Paint White 4L',
      short_form: 'WP-WHT',
      buying_price: 4200,
      selling_price: 4800,
      stock_quantity: 60,
      discount_type: 'amount',
      discount_value: 200,
      category: 'Painting',
      min_stock_alert: 10
    },
    {
      item_name: 'Steel Nail Pack 2 Inch',
      short_form: 'NAIL-2',
      buying_price: 90,
      selling_price: 140,
      stock_quantity: 600,
      discount_type: 'percent',
      discount_value: 5,
      category: 'Hardware',
      min_stock_alert: 100
    },
    {
      item_name: 'LED Bulb 12W',
      short_form: 'LED-12W',
      buying_price: 420,
      selling_price: 550,
      stock_quantity: 250,
      discount_type: 'amount',
      discount_value: 25,
      category: 'Electrical',
      min_stock_alert: 40
    },
    {
      item_name: 'Extension Cord 5m',
      short_form: 'EXT-5M',
      buying_price: 900,
      selling_price: 1200,
      stock_quantity: 90,
      discount_type: 'percent',
      discount_value: 7,
      category: 'Electrical',
      min_stock_alert: 15
    },
    {
      item_name: 'Water Tap Standard',
      short_form: 'TAP-STD',
      buying_price: 650,
      selling_price: 850,
      stock_quantity: 140,
      discount_type: 'amount',
      discount_value: 40,
      category: 'Plumbing',
      min_stock_alert: 20
    },
    {
      item_name: 'Tile Adhesive 20kg',
      short_form: 'TILE-20',
      buying_price: 1350,
      selling_price: 1650,
      stock_quantity: 110,
      discount_type: 'percent',
      discount_value: 6,
      category: 'Construction',
      min_stock_alert: 25
    },
    {
      item_name: 'Measuring Tape 5m',
      short_form: 'MT-5',
      buying_price: 300,
      selling_price: 450,
      stock_quantity: 75,
      discount_type: 'amount',
      discount_value: 30,
      category: 'Tools',
      min_stock_alert: 15
    },
    {
      item_name: 'Switch Socket Double',
      short_form: 'SW-DBL',
      buying_price: 520,
      selling_price: 680,
      stock_quantity: 180,
      discount_type: 'percent',
      discount_value: 9,
      category: 'Electrical',
      min_stock_alert: 30
    },
    {
      item_name: 'Sand Paper Sheet',
      short_form: 'SP-STD',
      buying_price: 25,
      selling_price: 40,
      stock_quantity: 700,
      discount_type: 'amount',
      discount_value: 2,
      category: 'Tools',
      min_stock_alert: 150
    },
    {
      item_name: 'Safety Gloves Pair',
      short_form: 'GLV-SF',
      buying_price: 180,
      selling_price: 260,
      stock_quantity: 160,
      discount_type: 'percent',
      discount_value: 12,
      category: 'Safety',
      min_stock_alert: 25
    }
  ];

  sampleProducts.forEach(p => {
    try {
      Product.create(p);
      console.log(`✅ Seeded: ${p.item_name}`);
    } catch (e) {
      console.log(`⚠️ Skip: ${p.item_name} (may already exist)`);
    }
  });

  console.log('🎉 Sample products seeded!');
};

seedProducts();