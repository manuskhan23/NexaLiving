import { ItemRequest } from '../models/ItemRequest';
import { NOTIFICATION_TYPES } from '../constants/notificationTypes';
import { sendToUser } from '../services/notification.service';
export async function runOverdueItems() {
  const now = new Date();
  const reqs = await ItemRequest.find({ status: 'handed_over', endAt: { $lt: now }, overdueReminderSentAt: null }).lean();
  for (const r of reqs as any[]) {
    await sendToUser(String(r.requester), {
      type: NOTIFICATION_TYPES.ITEM_OVERDUE, title: 'Item overdue', body: 'Please return the borrowed item',
      data: { screen: 'ItemRequestDetail', params: { id: String(r._id) } },
    }).catch(() => {});
    await ItemRequest.updateOne({ _id: r._id }, { $set: { overdueReminderSentAt: now } });
  }
}
