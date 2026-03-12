import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { SupabaseService } from './src/modules/database/supabase.service';
import { v4 as uuid } from 'uuid';
import * as dayjs from 'dayjs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const supabase = app.get(SupabaseService).getClient(true);

  console.log('Inserting test booking in the past...');
  
  // 1. Get a court
  const { data: courts } = await supabase.from('courts').select('id').limit(1);
  const courtId = courts[0].id;

  // 2. Get a time slot in the past (e.g. 06:00)
  const { data: slots } = await supabase.from('time_slots').select('id').eq('label', '06:00').single();
  const timeSlotId = slots.id;

  // 3. Create a customer or use existing
  const customerId = uuid();
  await supabase.from('customers').insert({
    id: customerId,
    name: 'Past Test User',
    phone: '0901234567',
  });

  // 4. Create booking
  const bookingId = uuid();
  const today = dayjs().format('YYYY-MM-DD');
  
  await supabase.from('bookings').insert({
    id: bookingId,
    customer_id: customerId,
    court_id: courtId,
    date: today,
    start_time: '06:00',
    end_time: '06:30',
    total_amount: 150000,
    paid_amount: 150000,
    court_fee: 150000,
    service_fee: 0,
    payment_mode: 'cash',
    payment_status: 'paid',
    status: 'confirmed',
    booking_code: 'TEST-PAST',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  // 5. Create override
  await supabase.from('court_slot_overrides').insert({
    court_id: courtId,
    date: today,
    time_slot_id: timeSlotId,
    status: 'booked',
    booking_id: bookingId
  });

  console.log('✅ Created test booking in the past for 06:00 today.');
  await app.close();
}

bootstrap();
