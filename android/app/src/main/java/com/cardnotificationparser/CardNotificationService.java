package com.cardnotificationparser;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

/**
 * Listens to all device notifications and forwards card-related ones
 * to the React Native layer via DeviceEventEmitter.
 */
public class CardNotificationService extends NotificationListenerService {

    static final String EVENT_NOTIFICATION = "onNotificationReceived";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        Bundle extras = sbn.getNotification().extras;
        if (extras == null) return;

        CharSequence titleSeq = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textSeq = extras.getCharSequence(Notification.EXTRA_TEXT);

        String title = titleSeq != null ? titleSeq.toString() : "";
        String text = textSeq != null ? textSeq.toString() : "";

        if (title.isEmpty() && text.isEmpty()) return;

        emitEvent(sbn.getPackageName(), title, text, sbn.getPostTime());
    }

    private void emitEvent(String packageName, String title, String text, long postTime) {
        ReactContext context = NotificationListenerModule.getReactContext();
        if (context == null || !context.hasActiveCatalystInstance()) return;

        WritableMap params = Arguments.createMap();
        params.putString("packageName", packageName);
        params.putString("title", title);
        params.putString("text", text);
        params.putDouble("postTime", (double) postTime);

        context
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(EVENT_NOTIFICATION, params);
    }
}
