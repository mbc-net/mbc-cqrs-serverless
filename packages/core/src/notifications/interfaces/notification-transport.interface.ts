import { INotification } from '../../interfaces'

export const NOTIFICATION_TRANSPORT = 'NOTIFICATION_TRANSPORT'

export interface INotificationTransport {
  sendMessage(notification: INotification): Promise<void>
}

export type NotificationTransportMap = Map<string, INotificationTransport>
