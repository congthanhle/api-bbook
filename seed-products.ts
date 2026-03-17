import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { SupabaseService } from './src/database/supabase.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const supabase = app.get(SupabaseService).getClient(true);

  console.log('Inserting test products...');

  const products = [
    {
      name: 'Yonex Astrox 88D Pro',
      category: 'equipment_rental',
      price: 15.00,
      cost_price: 5.00,
      stock_qty: null,
      sku: 'RENT-YNX-88D',
      description: 'Premium badminton racket rental per session',
      is_active: true,
      image_url: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&q=80&w=200&h=200'
    },
    {
      name: 'Starter Racket',
      category: 'equipment_rental',
      price: 5.00,
      cost_price: 1.00,
      stock_qty: null,
      sku: 'RENT-START',
      description: 'Basic racket for beginners',
      is_active: true,
    },
    {
      name: 'Pocari Sweat 500ml',
      category: 'beverage',
      price: 3.50,
      cost_price: 1.50,
      stock_qty: 120,
      sku: 'BEV-POC-500',
      description: 'Isotonic drink for hydration',
      is_active: true,
      image_url: 'https://images.unsplash.com/photo-1550505096-3e0e71ab0148?auto=format&fit=crop&q=80&w=200&h=200'
    },
    {
      name: 'Mineral Water 600ml',
      category: 'beverage',
      price: 1.50,
      cost_price: 0.50,
      stock_qty: 250,
      sku: 'BEV-H2O-600',
      description: 'Chilled mineral water',
      is_active: true
    },
    {
      name: 'Energy Bar (Chocolate)',
      category: 'snack',
      price: 2.00,
      cost_price: 0.80,
      stock_qty: 50,
      sku: 'SNK-BAR-CHOC',
      description: 'Quick energy boost',
      is_active: true,
      image_url: 'https://images.unsplash.com/photo-1622350792070-07bf6baef1c1?auto=format&fit=crop&q=80&w=200&h=200'
    },
    {
      name: 'Yonex Aerosensa 20 (Tube of 12)',
      category: 'shuttle_cock',
      price: 26.00,
      cost_price: 18.00,
      stock_qty: 4, // low stock test
      sku: 'SHUT-YNX-AS20',
      description: 'Feather shuttlecocks for professional play',
      is_active: true,
      image_url: 'https://images.unsplash.com/photo-1610486663276-8ccfae7e6f66?auto=format&fit=crop&q=80&w=200&h=200'
    },
    {
      name: 'Standard Nylon Shuttles (Tube of 6)',
      category: 'shuttle_cock',
      price: 12.00,
      cost_price: 6.00,
      stock_qty: 40,
      sku: 'SHUT-NYL-06',
      description: 'Durable nylon shuttles for practice',
      is_active: true
    },
    {
      name: '1-on-1 Coaching Session (1hr)',
      category: 'coaching',
      price: 50.00,
      cost_price: 0,
      stock_qty: null,
      sku: 'COACH-1ON1-1HR',
      description: 'Personalized training with a certified coach',
      is_active: true,
    },
    {
      name: 'Group Clinic (2hr)',
      category: 'coaching',
      price: 30.00,
      cost_price: 0,
      stock_qty: null,
      sku: 'COACH-GRP-2HR',
      description: 'Group training session focusing on fundamentals',
      is_active: true
    },
    {
      name: 'Grip Tape (Overgrip)',
      category: 'other',
      price: 5.00,
      cost_price: 1.50,
      stock_qty: 3, // low stock test
      sku: 'OTH-GRIP-01',
      description: 'Comfortable overgrip for rackets (assorted colors)',
      is_active: true
    },
    {
      name: 'Towel (Rental)',
      category: 'other',
      price: 2.00,
      cost_price: 0.50,
      stock_qty: 25,
      sku: 'OTH-TOWL-RNT',
      description: 'Clean gym cloth towel rental',
      is_active: true
    }
  ];

  for (const product of products) {
    const { error } = await supabase.from('products').insert(product);
    if (error) {
      console.error(`Error inserting ${product.name}:`, error.message);
    } else {
      console.log(`✅ Inserted ${product.name}`);
    }
  }

  console.log('Finished inserting products.');
  await app.close();
}

bootstrap();
