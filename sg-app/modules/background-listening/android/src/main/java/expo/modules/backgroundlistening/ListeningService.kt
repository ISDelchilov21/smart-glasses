package expo.modules.backgroundlistening

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat

class ListeningService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val text = intent?.getStringExtra(EXTRA_TEXT) ?: DEFAULT_TEXT
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else 0
    try {
      ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(this, text), type)
    } catch (error: Exception) {
      stopSelf()
    }
    return START_NOT_STICKY
  }

  companion object {
    const val EXTRA_TEXT = "text"
    private const val DEFAULT_TEXT = "Listening for \"Hey Jarvis\""
    private const val CHANNEL_ID = "jarvis-listening"
    private const val NOTIFICATION_ID = 7001

    fun showText(context: Context, text: String) {
      try {
        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, buildNotification(context, text))
      } catch (error: SecurityException) {
        return
      }
    }

    private fun buildNotification(context: Context, text: String): Notification {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val channel = NotificationChannel(CHANNEL_ID, "Jarvis listening", NotificationManager.IMPORTANCE_LOW)
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
      }
      val openApp = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()
      val tapAction = PendingIntent.getActivity(
        context, 0, openApp, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )
      return NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(context.applicationInfo.icon)
        .setContentTitle("Jarvis")
        .setContentText(text)
        .setStyle(NotificationCompat.BigTextStyle().bigText(text))
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setContentIntent(tapAction)
        .build()
    }
  }
}
