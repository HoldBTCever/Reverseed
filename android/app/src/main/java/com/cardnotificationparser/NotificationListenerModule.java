package com.cardnotificationparser;

import android.content.ComponentName;
import android.content.Context;
import android.provider.Settings;
import android.text.TextUtils;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

import java.lang.ref.WeakReference;

public class NotificationListenerModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "NotificationListenerModule";
    private static WeakReference<ReactContext> sReactContext;

    public NotificationListenerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        sReactContext = new WeakReference<>(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    /**
     * Called by CardNotificationService to forward events to JS.
     */
    @Nullable
    static ReactContext getReactContext() {
        return sReactContext != null ? sReactContext.get() : null;
    }

    /**
     * Checks whether the user has granted notification listener access.
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    public boolean isNotificationListenerEnabled() {
        Context context = getReactApplicationContext();
        String flat = Settings.Secure.getString(
            context.getContentResolver(),
            "enabled_notification_listeners"
        );
        if (TextUtils.isEmpty(flat)) return false;

        ComponentName cn = new ComponentName(context, CardNotificationService.class);
        for (String s : flat.split(":")) {
            if (cn.flattenToString().equals(s.trim())) {
                return true;
            }
        }
        return false;
    }

    @ReactMethod
    public void requestNotificationListenerPermission(Promise promise) {
        try {
            android.content.Intent intent = new android.content.Intent(
                Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS
            );
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    // Required for DeviceEventEmitter listeners to work in new arch
    @ReactMethod
    public void addListener(String eventName) {}

    @ReactMethod
    public void removeListeners(Integer count) {}
}
