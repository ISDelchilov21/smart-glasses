package expo.modules.backgroundlistening

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BackgroundListeningModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BackgroundListening")

    Function("start") { text: String ->
      val intent = Intent(context, ListeningService::class.java).putExtra(ListeningService.EXTRA_TEXT, text)
      ContextCompat.startForegroundService(context, intent)
    }

    Function("update") { text: String ->
      ListeningService.showText(context, text)
    }

    Function("stop") {
      context.stopService(Intent(context, ListeningService::class.java))
    }
  }
}
