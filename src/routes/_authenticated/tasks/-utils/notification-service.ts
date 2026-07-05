import type { Task, TaskList } from '#/stores/tasks-store'

interface NotificationShownRecord {
  [taskId: string]: string // ISO date when notification was last shown
}

const NOTIFICATION_SHOWN_KEY = 'task-notifications-shown'
const NOTIFICATION_WINDOW_HOURS = 24 // check tasks due within 24 hours

export function getShownNotifications(): NotificationShownRecord {
  try {
    const stored = localStorage.getItem(NOTIFICATION_SHOWN_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

export function markNotificationShown(taskId: string): void {
  const shown = getShownNotifications()
  shown[taskId] = new Date().toISOString().split('T')[0] // Store as date only
  localStorage.setItem(NOTIFICATION_SHOWN_KEY, JSON.stringify(shown))
}

export function shouldFireNotification(
  task: Task,
  notificationsEnabled: boolean,
  quietHoursStart: number,
  quietHoursEnd: number,
): boolean {
  // Check if notifications are enabled
  if (!notificationsEnabled) return false

  // Check if task has a deadline
  if (!task.deadline) return false

  // Check if already shown today
  const shown = getShownNotifications()
  const today = new Date().toISOString().split('T')[0]
  if (shown[task.id] === today) return false

  // Check if task is completed
  if (task.completed) return false

  // Check if deadline is within notification window
  const deadline = new Date(task.deadline)
  const now = new Date()
  const timeUntilDeadline = deadline.getTime() - now.getTime()
  const hoursUntilDeadline = timeUntilDeadline / (1000 * 60 * 60)

  // Only notify if deadline is within 24 hours and hasn't passed
  if (hoursUntilDeadline < 0 || hoursUntilDeadline > NOTIFICATION_WINDOW_HOURS)
    return false

  // Check quiet hours
  const currentHour = now.getHours()
  const isInQuietHours =
    quietHoursStart < quietHoursEnd
      ? currentHour >= quietHoursStart || currentHour < quietHoursEnd
      : currentHour >= quietHoursStart || currentHour < quietHoursEnd

  if (isInQuietHours) return false

  return true
}

export async function fireNotification(
  task: Task,
  listName: string,
): Promise<void> {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const options: NotificationOptions = {
    body: `${task.title} (in ${listName})`,
    icon: '/favicon.ico',
    tag: `task-${task.id}`, // Prevents duplicate notifications
    requireInteraction: false,
  }

  // Once a service worker controls the page, some browsers (e.g. Chrome on
  // Android) disallow `new Notification()` and require going through the
  // registration instead.
  const registration =
    'serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistration()
      : undefined
  if (registration) {
    await registration.showNotification('Task Due Soon', options)
  } else {
    new Notification('Task Due Soon', options)
  }

  markNotificationShown(task.id)
}

export function requestNotificationPermission(): void {
  if (!('Notification' in window)) return

  if (Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

export function checkAndFireNotifications(
  tasks: Task[],
  lists: TaskList[],
  notificationsEnabled: boolean,
  quietHoursStart: number,
  quietHoursEnd: number,
): void {
  const listMap = new Map(lists.map((l) => [l.id, l.name]))

  tasks.forEach((task) => {
    if (
      shouldFireNotification(
        task,
        notificationsEnabled,
        quietHoursStart,
        quietHoursEnd,
      )
    ) {
      const listName = listMap.get(task.listId) || 'Unknown List'
      void fireNotification(task, listName)
    }
  })
}
