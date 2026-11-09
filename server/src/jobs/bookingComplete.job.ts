import { Booking } from '../models/Booking';
export async function runBookingComplete() {
  await Booking.updateMany({ status: 'approved', endAt: { $lt: new Date() } }, { $set: { status: 'completed' } });
}
