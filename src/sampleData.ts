import { SavedReceipt } from './types';

export const INITIAL_SAMPLE_RECEIPTS: SavedReceipt[] = [
  {
    id: 'sample-pnp-01',
    vendor_name: 'Pick n Pay - Waterfront',
    invoice_date: '2026-09-18',
    month_year: '2026-09',
    category: 'Food & Groceries',
    currency: 'ZAR',
    subtotal: 477.17,
    tax: 71.58,
    total_amount: 548.75,
    notes: 'Weekly pantry & fresh produce restock',
    created_at: '2026-09-18T10:30:00.000Z',
    line_items: [
      { description: 'Clover Full Cream Fresh Milk 2L', quantity: 2, unit_price: 36.99, total_price: 73.98 },
      { description: 'Albany Superior White Sliced Bread 700g', quantity: 1, unit_price: 18.49, total_price: 18.49 },
      { description: 'Free Range Large Eggs 18pk', quantity: 1, unit_price: 64.99, total_price: 64.99 },
      { description: 'Bananas 1kg', quantity: 1.4, unit_price: 24.99, total_price: 34.99 },
      { description: 'Skinless Chicken Breast Fillets 1kg', quantity: 1, unit_price: 94.99, total_price: 94.99 },
      { description: 'Golden Delight Basmati Rice 2kg', quantity: 1, unit_price: 79.99, total_price: 79.99 },
      { description: 'Avocados Prepack 4pk', quantity: 1, unit_price: 49.99, total_price: 49.99 },
      { description: 'Jacobs Kronung Instant Coffee 200g', quantity: 1, unit_price: 129.99, total_price: 129.99 },
      { description: 'Recyclable Carrier Bags', quantity: 2, unit_price: 0.67, total_price: 1.35 }
    ]
  },
  {
    id: 'sample-eskom-01',
    vendor_name: 'Eskom Prepaid Electricity',
    invoice_date: '2026-09-05',
    month_year: '2026-09',
    category: 'Electricity & Utilities',
    currency: 'ZAR',
    subtotal: 739.13,
    tax: 110.87,
    total_amount: 850.00,
    notes: 'Meter #04128954128 - 286.4 kWh Units',
    created_at: '2026-09-05T08:15:00.000Z',
    line_items: [
      { description: 'Domestic Prepaid Electricity Units (286.4 kWh)', quantity: 1, unit_price: 850.00, total_price: 850.00 }
    ]
  },
  {
    id: 'sample-woolies-01',
    vendor_name: 'Woolworths Food',
    invoice_date: '2026-09-12',
    month_year: '2026-09',
    category: 'Food & Groceries',
    currency: 'ZAR',
    subtotal: 358.52,
    tax: 53.78,
    total_amount: 412.30,
    notes: 'Fresh bakery & organic vegetables',
    created_at: '2026-09-12T14:20:00.000Z',
    line_items: [
      { description: 'Organic Baby Spinach 200g', quantity: 2, unit_price: 29.99, total_price: 59.98 },
      { description: 'Greek Style Double Cream Yoghurt 1kg', quantity: 1, unit_price: 54.99, total_price: 54.99 },
      { description: 'Artisan Sourdough Loaf', quantity: 1, unit_price: 38.99, total_price: 38.99 },
      { description: 'Atlantic Salmon Portions 300g', quantity: 1, unit_price: 189.99, total_price: 189.99 },
      { description: 'Fairtrade Sparkling Mineral Water 6x500ml', quantity: 1, unit_price: 64.99, total_price: 64.99 },
      { description: 'Woolies Reusable Tote', quantity: 1, unit_price: 3.36, total_price: 3.36 }
    ]
  },
  {
    id: 'sample-engen-01',
    vendor_name: 'Engen QuickShop & Fuel',
    invoice_date: '2026-09-08',
    month_year: '2026-09',
    category: 'Transport',
    currency: 'ZAR',
    subtotal: 626.09,
    tax: 93.91,
    total_amount: 720.00,
    notes: 'Unleaded 95 Petrol (32.14 Litres)',
    created_at: '2026-09-08T17:45:00.000Z',
    line_items: [
      { description: 'Unleaded 95 Petrol (32.14L @ R22.40/L)', quantity: 32.14, unit_price: 22.40, total_price: 720.00 }
    ]
  },
  {
    id: 'sample-pnp-aug-01',
    vendor_name: 'Pick n Pay - Waterfront',
    invoice_date: '2026-08-22',
    month_year: '2026-08',
    category: 'Food & Groceries',
    currency: 'ZAR',
    subtotal: 595.83,
    tax: 89.37,
    total_amount: 685.20,
    notes: 'Month-end grocery restock',
    created_at: '2026-08-22T11:10:00.000Z',
    line_items: [
      { description: 'Clover Full Cream Fresh Milk 2L', quantity: 2, unit_price: 35.99, total_price: 71.98 },
      { description: 'Lean Minced Beef 1kg', quantity: 1, unit_price: 109.99, total_price: 109.99 },
      { description: 'Snowflake Cake Wheat Flour 2.5kg', quantity: 1, unit_price: 44.99, total_price: 44.99 },
      { description: 'Canola Cooking Oil 2L', quantity: 1, unit_price: 84.99, total_price: 84.99 },
      { description: 'Potatoes 2kg Bag', quantity: 1, unit_price: 39.99, total_price: 39.99 },
      { description: 'Baby Soft Toilet Tissue 18pk', quantity: 1, unit_price: 149.99, total_price: 149.99 },
      { description: 'Omo Auto Washing Powder 2kg', quantity: 1, unit_price: 99.99, total_price: 99.99 },
      { description: 'Sunlight Dishwashing Liquid 750ml', quantity: 2, unit_price: 41.64, total_price: 83.28 }
    ]
  },
  {
    id: 'sample-eskom-aug-01',
    vendor_name: 'Eskom Prepaid Electricity',
    invoice_date: '2026-08-04',
    month_year: '2026-08',
    category: 'Electricity & Utilities',
    currency: 'ZAR',
    subtotal: 695.65,
    tax: 104.35,
    total_amount: 800.00,
    notes: 'Meter #04128954128',
    created_at: '2026-08-04T09:00:00.000Z',
    line_items: [
      { description: 'Prepaid Electricity Units (270.2 kWh)', quantity: 1, unit_price: 800.00, total_price: 800.00 }
    ]
  },
  {
    id: 'sample-builders-aug-01',
    vendor_name: 'Builders Warehouse',
    invoice_date: '2026-08-15',
    month_year: '2026-08',
    category: 'Home Maintenance',
    currency: 'ZAR',
    subtotal: 391.74,
    tax: 58.76,
    total_amount: 450.50,
    notes: 'Garden hose fittings and LED globes',
    created_at: '2026-08-15T13:30:00.000Z',
    line_items: [
      { description: 'Gardena Premium Hose Connector 1/2"', quantity: 2, unit_price: 125.00, total_price: 250.00 },
      { description: 'Eurolux LED Warm White E27 4pk', quantity: 1, unit_price: 145.50, total_price: 145.50 },
      { description: 'Heavy Duty Cable Ties 100pk', quantity: 1, unit_price: 55.00, total_price: 55.00 }
    ]
  },
  // --- July 2026 Receipts ---
  {
    id: 'sample-checkers-jul-01',
    vendor_name: 'Checkers Hyper',
    invoice_date: '2026-07-25',
    month_year: '2026-07',
    category: 'Food & Groceries',
    currency: 'ZAR',
    subtotal: 782.61,
    tax: 117.39,
    total_amount: 900.00,
    notes: 'Mid-winter family groceries',
    created_at: '2026-07-25T11:40:00.000Z',
    line_items: [
      { description: 'Clover Full Cream Fresh Milk 2L', quantity: 3, unit_price: 35.99, total_price: 107.97 },
      { description: 'Free Range Large Eggs 18pk', quantity: 2, unit_price: 62.99, total_price: 125.98 },
      { description: 'A-Grade Beef Rump Steak 800g', quantity: 1, unit_price: 149.99, total_price: 149.99 },
      { description: 'Golden Cloud Cake Flour 2.5kg', quantity: 1, unit_price: 42.99, total_price: 42.99 },
      { description: 'Cheddar Cheese Block 800g', quantity: 1, unit_price: 119.99, total_price: 119.99 },
      { description: 'Assorted Fresh Vegetables 2kg', quantity: 1, unit_price: 74.99, total_price: 74.99 },
      { description: 'Sunflower Cooking Oil 2L', quantity: 1, unit_price: 78.09, total_price: 78.09 },
      { description: 'Nescafe Gold Coffee 200g', quantity: 1, unit_price: 159.00, total_price: 159.00 },
      { description: 'Recyclable Carrier Bags', quantity: 3, unit_price: 1.33, total_price: 4.00 }
    ]
  },
  {
    id: 'sample-eskom-jul-01',
    vendor_name: 'Eskom Prepaid Electricity',
    invoice_date: '2026-07-06',
    month_year: '2026-07',
    category: 'Electricity & Utilities',
    currency: 'ZAR',
    subtotal: 826.09,
    tax: 123.91,
    total_amount: 950.00,
    notes: 'Winter heating electricity token',
    created_at: '2026-07-06T09:15:00.000Z',
    line_items: [
      { description: 'Domestic Prepaid Electricity Units (320.8 kWh)', quantity: 1, unit_price: 950.00, total_price: 950.00 }
    ]
  },
  {
    id: 'sample-bp-jul-01',
    vendor_name: 'BP Express & Service Station',
    invoice_date: '2026-07-14',
    month_year: '2026-07',
    category: 'Transport',
    currency: 'ZAR',
    subtotal: 660.87,
    tax: 99.13,
    total_amount: 760.00,
    notes: 'Fuel refill (34.2 Litres)',
    created_at: '2026-07-14T16:20:00.000Z',
    line_items: [
      { description: 'Unleaded 95 Petrol (34.2L @ R22.22/L)', quantity: 34.2, unit_price: 22.22, total_price: 760.00 }
    ]
  },
  // --- June 2026 Receipts ---
  {
    id: 'sample-pnp-jun-01',
    vendor_name: 'Pick n Pay - Waterfront',
    invoice_date: '2026-06-20',
    month_year: '2026-06',
    category: 'Food & Groceries',
    currency: 'ZAR',
    subtotal: 621.74,
    tax: 93.26,
    total_amount: 715.00,
    notes: 'Monthly staples and dairy',
    created_at: '2026-06-20T10:15:00.000Z',
    line_items: [
      { description: 'Clover Full Cream Fresh Milk 2L', quantity: 2, unit_price: 34.99, total_price: 69.98 },
      { description: 'Albany Superior White Sliced Bread 700g', quantity: 2, unit_price: 17.99, total_price: 35.98 },
      { description: 'Free Range Large Eggs 18pk', quantity: 1, unit_price: 61.99, total_price: 61.99 },
      { description: 'Skinless Chicken Breast Fillets 1kg', quantity: 1, unit_price: 89.99, total_price: 89.99 },
      { description: 'Tastic Parboiled Rice 2kg', quantity: 1, unit_price: 49.99, total_price: 49.99 },
      { description: 'All Gold Tomato Sauce 700ml', quantity: 1, unit_price: 38.99, total_price: 38.99 },
      { description: 'Baby Soft Toilet Tissue 18pk', quantity: 1, unit_price: 144.99, total_price: 144.99 },
      { description: 'Stork Country Spread 1kg', quantity: 1, unit_price: 54.99, total_price: 54.99 },
      { description: 'Fresh Apples 1.5kg', quantity: 1, unit_price: 29.99, total_price: 29.99 },
      { description: 'Weet-Bix Cereal 900g', quantity: 1, unit_price: 62.00, total_price: 62.00 },
      { description: 'Carrier Bags', quantity: 2, unit_price: 0.55, total_price: 1.10 }
    ]
  },
  {
    id: 'sample-eskom-jun-01',
    vendor_name: 'Eskom Prepaid Electricity',
    invoice_date: '2026-06-03',
    month_year: '2026-06',
    category: 'Electricity & Utilities',
    currency: 'ZAR',
    subtotal: 782.61,
    tax: 117.39,
    total_amount: 900.00,
    notes: 'Winter electricity units',
    created_at: '2026-06-03T08:30:00.000Z',
    line_items: [
      { description: 'Prepaid Electricity Units (304.0 kWh)', quantity: 1, unit_price: 900.00, total_price: 900.00 }
    ]
  },
  {
    id: 'sample-dischem-jun-01',
    vendor_name: 'Dis-Chem Pharmacy',
    invoice_date: '2026-06-12',
    month_year: '2026-06',
    category: 'Other',
    currency: 'ZAR',
    subtotal: 304.35,
    tax: 45.65,
    total_amount: 350.00,
    notes: 'Winter vitamins and healthcare essentials',
    created_at: '2026-06-12T14:10:00.000Z',
    line_items: [
      { description: 'Vitamin C 1000mg Effervescent 30pk', quantity: 2, unit_price: 89.95, total_price: 179.90 },
      { description: 'Hand Sanitizer & Antiseptic Wipes', quantity: 2, unit_price: 35.00, total_price: 70.00 },
      { description: 'Panado Paracetamol 500mg 24pk', quantity: 2, unit_price: 50.05, total_price: 100.10 }
    ]
  },
  // --- May 2026 Receipts ---
  {
    id: 'sample-woolies-may-01',
    vendor_name: 'Woolworths Food',
    invoice_date: '2026-05-18',
    month_year: '2026-05',
    category: 'Food & Groceries',
    currency: 'ZAR',
    subtotal: 486.96,
    tax: 73.04,
    total_amount: 560.00,
    notes: 'Organic groceries and artisan bakery',
    created_at: '2026-05-18T12:00:00.000Z',
    line_items: [
      { description: 'Organic Baby Spinach 200g', quantity: 2, unit_price: 28.99, total_price: 57.98 },
      { description: 'Free Range Chicken Whole 1.4kg', quantity: 1, unit_price: 119.99, total_price: 119.99 },
      { description: 'Artisan Sourdough Loaf', quantity: 1, unit_price: 36.99, total_price: 36.99 },
      { description: 'Ayrshire Fresh Milk 2L', quantity: 2, unit_price: 37.99, total_price: 75.98 },
      { description: 'Parmesan Wedge 200g', quantity: 1, unit_price: 89.99, total_price: 89.99 },
      { description: 'Fresh Strawberries 400g', quantity: 2, unit_price: 44.99, total_price: 89.98 },
      { description: 'Italian Pasta Sauce 500g', quantity: 2, unit_price: 39.54, total_price: 79.09 },
      { description: 'Woolies Shopping Bag', quantity: 1, unit_price: 10.00, total_price: 10.00 }
    ]
  },
  {
    id: 'sample-eskom-may-01',
    vendor_name: 'Eskom Prepaid Electricity',
    invoice_date: '2026-05-02',
    month_year: '2026-05',
    category: 'Electricity & Utilities',
    currency: 'ZAR',
    subtotal: 652.17,
    tax: 97.83,
    total_amount: 750.00,
    notes: 'Electricity token top-up',
    created_at: '2026-05-02T09:00:00.000Z',
    line_items: [
      { description: 'Domestic Electricity Units (253.3 kWh)', quantity: 1, unit_price: 750.00, total_price: 750.00 }
    ]
  },
  {
    id: 'sample-engen-may-01',
    vendor_name: 'Engen QuickShop & Fuel',
    invoice_date: '2026-05-14',
    month_year: '2026-05',
    category: 'Transport',
    currency: 'ZAR',
    subtotal: 565.22,
    tax: 84.78,
    total_amount: 650.00,
    notes: 'Fuel refill (29.5 Litres)',
    created_at: '2026-05-14T15:45:00.000Z',
    line_items: [
      { description: 'Unleaded 95 Petrol (29.5L @ R22.03/L)', quantity: 29.5, unit_price: 22.03, total_price: 650.00 }
    ]
  },
  // --- April 2026 Receipts ---
  {
    id: 'sample-pnp-apr-01',
    vendor_name: 'Pick n Pay - Waterfront',
    invoice_date: '2026-04-20',
    month_year: '2026-04',
    category: 'Food & Groceries',
    currency: 'ZAR',
    subtotal: 513.04,
    tax: 76.96,
    total_amount: 590.00,
    notes: 'Pantry restocking',
    created_at: '2026-04-20T11:20:00.000Z',
    line_items: [
      { description: 'Clover Full Cream Fresh Milk 2L', quantity: 2, unit_price: 34.99, total_price: 69.98 },
      { description: 'Albany Superior White Sliced Bread 700g', quantity: 1, unit_price: 17.99, total_price: 17.99 },
      { description: 'Free Range Large Eggs 18pk', quantity: 1, unit_price: 59.99, total_price: 59.99 },
      { description: 'Ground Mince Beef 1kg', quantity: 1, unit_price: 99.99, total_price: 99.99 },
      { description: 'Potatoes 2kg Bag', quantity: 1, unit_price: 36.99, total_price: 36.99 },
      { description: 'Sunlight Liquid Soap 750ml', quantity: 1, unit_price: 39.99, total_price: 39.99 },
      { description: 'Nescafe Classic 200g', quantity: 1, unit_price: 109.99, total_price: 109.99 },
      { description: 'Kelloggs Corn Flakes 1kg', quantity: 1, unit_price: 74.99, total_price: 74.99 },
      { description: 'Eco Carrier Bags', quantity: 2, unit_price: 0.50, total_price: 1.00 }
    ]
  },
  {
    id: 'sample-eskom-apr-01',
    vendor_name: 'Eskom Prepaid Electricity',
    invoice_date: '2026-04-05',
    month_year: '2026-04',
    category: 'Electricity & Utilities',
    currency: 'ZAR',
    subtotal: 608.70,
    tax: 91.30,
    total_amount: 700.00,
    notes: 'Prepaid electricity meter refill',
    created_at: '2026-04-05T09:15:00.000Z',
    line_items: [
      { description: 'Prepaid Electricity Units (236.4 kWh)', quantity: 1, unit_price: 700.00, total_price: 700.00 }
    ]
  },
  {
    id: 'sample-total-apr-01',
    vendor_name: 'TotalEnergies Service Station',
    invoice_date: '2026-04-12',
    month_year: '2026-04',
    category: 'Transport',
    currency: 'ZAR',
    subtotal: 517.39,
    tax: 77.61,
    total_amount: 595.00,
    notes: 'Fuel refill (27.2 Litres)',
    created_at: '2026-04-12T17:30:00.000Z',
    line_items: [
      { description: 'Unleaded 95 Petrol (27.2L @ R21.87/L)', quantity: 27.2, unit_price: 21.87, total_price: 595.00 }
    ]
  }
];

