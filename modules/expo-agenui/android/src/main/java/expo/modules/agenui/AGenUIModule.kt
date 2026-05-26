package expo.modules.agenui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AGenUIModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ExpoAGenUI")

        Events("onAction", "onError")

        Function("copyToClipboard") { text: String ->
            val context = appContext.reactContext ?: appContext.currentActivity
            val clipboard = context?.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            clipboard?.setPrimaryClip(ClipData.newPlainText("Hiking Buddy message", text))
            clipboard != null
        }

        View(AGenUIView::class) {
            Prop("payload") { view: AGenUIView, payload: String ->
                view.setPayload(payload)
            }

            Prop("colorScheme") { view: AGenUIView, colorScheme: String? ->
                view.setColorScheme(colorScheme ?: "light")
            }

            OnViewDidUpdateProps { view ->
                view.setModule(this@AGenUIModule)
            }

            OnViewDestroys { view ->
                view.destroy()
            }
        }
    }
}
