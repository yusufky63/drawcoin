import { NextRequest, NextResponse } from 'next/server';

/**
 * Types for Farcaster webhook events
 */
type NotificationDetails = {
  url: string;
  token: string;
};

type WebhookEvent = {
  event: 'frame_added' | 'frame_removed' | 'notifications_enabled' | 'notifications_disabled';
  notificationDetails?: NotificationDetails;
};

/**
 * Handles webhook events from Farcaster clients for Mini App 
 * This endpoint receives events like frame_added, frame_removed, notifications_enabled, and notifications_disabled
 */
export async function POST(req: NextRequest) {
  try {
    // Request gövdesini parse et
    const body = await req.json() as WebhookEvent;
    console.log('Webhook event received:', body);

    // Process events based on type
    switch (body.event) {
      case 'frame_added':
        // When a user adds your Mini App to their client
        console.log('Frame added event received with notification token:', body.notificationDetails?.token);
        // TODO: Save token to database for sending notifications later
        break;
      
      case 'frame_removed':
        // When a user removes your Mini App
        console.log('Frame removed event received');
        // TODO: Remove or disable notification token from database
        break;
      
      case 'notifications_enabled':
        // When a user enables notifications for your Mini App
        console.log('Notifications enabled event received with token:', body.notificationDetails?.token);
        // TODO: Update database to mark notifications as enabled for this user
        break;
      
      case 'notifications_disabled':
        // When a user disables notifications for your Mini App
        console.log('Notifications disabled event received');
        // TODO: Update database to mark notifications as disabled for this user
        break;
      
      default:
        console.warn('Unknown webhook event type:', body.event);
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in webhook endpoint:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// HEAD request handling for webhook validation
export async function HEAD() {
  return new Response(null, {
    status: 200,
  });
}

/**
 * Example function to send a notification to a user (for reference)
 * This would be called from another endpoint when you want to notify a user
 */
async function sendNotification(url: string, token: string, message: string) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notificationId: `notification-${Date.now()}`,
        title: 'DrawCoin Update',
        body: message,
        targetUrl: 'https://drawcoin.vercel.app',
        tokens: [token],
      }),
    });

    const data = await response.json();
    console.log('Notification sent, response:', data);
    return data;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}
