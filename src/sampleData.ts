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
  }
];
