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