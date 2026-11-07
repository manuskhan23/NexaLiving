import { Booking } from '../models/Booking';
import { NOTIFICATION_TYPES } from '../constants/notificationTypes';
import { sendToUser } from '../services/notification.service';
export async function runBookingReminders() {
  const soon = new Date(Date.now() + 24 * 3600 * 1000);
  const bookings = await Booking.find({ status: 'approved', startAt: { $gt: new Date(), $lte: soon } }).lean();
  for (const b of bookings as any[]) {
    await sendToUser(String(b.requester), {
      type: NOTIFICATION_TYPES.BOOKING_REMINDER, title: 'Upcoming booking tomorrow',
      body: b.spaceName + ' at ' + new Date(b.startAt).toISOString(), data: { screen: 'BookingDetail', params: { id: String(b._id) } },
    }).catch(() => {});
  }
}
