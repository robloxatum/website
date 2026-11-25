"use server";

import { getUser } from "@/lib/auth";
import { getDeviceSettings, removeDevice, saveDevice, updateDeviceSettings, type DeviceSettings } from "@/lib/push/devices";

// This device's notification settings (components/push/NotificationSettings).
// Signed-in members only; RLS keeps each member to their own devices.

const signedOut = { error: "Sign in again to change notifications." };

export async function turnOnNotifications(subscription: unknown, settings: DeviceSettings): Promise<{ error?: string }> {
  if (!(await getUser())) return signedOut;
  return saveDevice(subscription, { eventReminders: !!settings.eventReminders, gameLinks: !!settings.gameLinks });
}

export async function readNotificationSettings(endpoint: string): Promise<DeviceSettings | null> {
  if (!(await getUser())) return null;
  return getDeviceSettings(endpoint);
}

export async function changeNotificationSettings(endpoint: string, settings: DeviceSettings): Promise<{ error?: string }> {
  if (!(await getUser())) return signedOut;
  return updateDeviceSettings(endpoint, settings);
}

export async function turnOffNotifications(endpoint: string): Promise<void> {
  if (!(await getUser())) return;
  await removeDevice(endpoint);
}
