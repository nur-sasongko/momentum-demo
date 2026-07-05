import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Label } from '#/components/ui/label'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { useTasksStore } from '#/stores/tasks-store'
import { Button } from '#/components/ui/button'

interface NotificationsSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationsSettings({
  open,
  onOpenChange,
}: NotificationsSettingsProps) {
  const notificationSettings = useTasksStore((s) => s.notificationSettings)
  const updateNotificationSettings = useTasksStore(
    (s) => s.updateNotificationSettings,
  )

  const hours = Array.from({ length: 24 }, (_, i) => i)

  const handleToggleEnabled = (enabled: boolean) => {
    updateNotificationSettings({ enabled })
  }

  const handleQuietHoursStartChange = (value: string) => {
    updateNotificationSettings({ quietHoursStart: parseInt(value) })
  }

  const handleQuietHoursEndChange = (value: string) => {
    updateNotificationSettings({ quietHoursEnd: parseInt(value) })
  }

  const formatHour = (hour: number) => {
    return new Date(0, 0, 0, hour).toLocaleString('en-US', {
      hour: 'numeric',
      hour12: true,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notification Settings</DialogTitle>
          <DialogDescription>
            Manage deadline notifications and quiet hours
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Enable/Disable Notifications */}
          <div className="flex items-center space-x-2 p-3 bg-zinc-100 dark:bg-zinc-900 rounded">
            <Checkbox
              id="notifications-enabled"
              checked={notificationSettings.enabled}
              onCheckedChange={handleToggleEnabled}
            />
            <Label
              htmlFor="notifications-enabled"
              className="cursor-pointer flex-1"
            >
              Enable deadline notifications
            </Label>
          </div>

          {/* Quiet Hours */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Quiet Hours</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              No notifications will be sent during quiet hours
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quiet-start">Start Time</Label>
                <Select
                  value={String(notificationSettings.quietHoursStart)}
                  onValueChange={handleQuietHoursStartChange}
                  disabled={!notificationSettings.enabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hours.map((hour) => (
                      <SelectItem key={hour} value={String(hour)}>
                        {formatHour(hour)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quiet-end">End Time</Label>
                <Select
                  value={String(notificationSettings.quietHoursEnd)}
                  onValueChange={handleQuietHoursEndChange}
                  disabled={!notificationSettings.enabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hours.map((hour) => (
                      <SelectItem key={hour} value={String(hour)}>
                        {formatHour(hour)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Quiet hours: {formatHour(notificationSettings.quietHoursStart)} -{' '}
              {formatHour(notificationSettings.quietHoursEnd)}
            </p>
          </div>

          {/* Info */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-100 rounded text-sm">
            <p>
              Notifications are checked every 5 minutes for tasks due within the
              next 24 hours.
            </p>
          </div>

          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
