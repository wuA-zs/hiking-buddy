package expo.modules.agenui

import android.app.Activity
import android.content.Context
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import com.amap.agenui.AGenUI
import com.amap.agenui.render.surface.ISurfaceManagerListener
import com.amap.agenui.render.surface.Surface
import com.amap.agenui.render.surface.SurfaceManager
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import org.json.JSONArray
import org.json.JSONObject

class AGenUIView(
    context: Context,
    appContext: AppContext
) : ExpoView(context, appContext) {
    private val container = FrameLayout(context)
    private var moduleRef: AGenUIModule? = null
    private var surfaceManager: SurfaceManager? = null
    private var listener: ISurfaceManagerListener? = null
    private var pendingPayload: String? = null
    private var pendingError: String? = null
    private var currentColorScheme = "light"
    private var initialized = false
    private var isRendering = false
    private var surfaceCreated = false
    private var lastPayload: String? = null
    private var pendingSurface: Surface? = null
    private val defaultCatalogId = "urn:a2ui:catalog:agenui_catalog"
    private val supportedIconNames = setOf(
        "accountCircle", "add", "arrowBack", "arrowForward", "attachFile", "calendarToday",
        "call", "camera", "check", "close", "delete", "download", "edit", "error", "event",
        "fastForward", "favorite", "favoriteOff", "folder", "help", "home", "info",
        "locationOn", "lock", "lockOpen", "mail", "menu", "moreHoriz", "moreVert",
        "notifications", "notificationsOff", "pause", "payment", "person", "phone", "photo",
        "play", "print", "refresh", "rewind", "search", "send", "settings", "share",
        "shoppingCart", "skipNext", "skipPrevious", "star", "starHalf", "starOff", "stop",
        "upload", "visibility", "visibilityOff", "volumeDown", "volumeMute", "volumeOff",
        "volumeUp", "warning"
    )
    private val iconAliases = mapOf(
        "directionsWalk" to "locationOn",
        "walk" to "locationOn",
        "walking" to "locationOn",
        "route" to "locationOn",
        "mapPin" to "locationOn"
    )

    init {
        addView(
            container,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        )
    }

    private fun updateDebug(msg: String) {
        Log.d("AGenUI", msg)
    }

    fun setModule(module: AGenUIModule) {
        moduleRef = module
        updateDebug("setModule | init=$initialized | pending=${pendingPayload != null}")
        // Flush any error that occurred before module was set
        pendingError?.let { msg ->
            pendingError = null
            emitError(msg)
        }
        ensureRuntime()
        if (pendingPayload != null && initialized && !isRendering) {
            val payload = pendingPayload!!
            pendingPayload = null
            renderPayload(payload)
        }
    }

    fun setPayload(payload: String) {
        updateDebug("setPayload | init=$initialized | len=${payload.length}")
        lastPayload = payload
        pendingPayload = payload
        ensureRuntime()
        if (initialized && !isRendering) {
            pendingPayload = null
            renderPayload(payload)
        }
    }

    fun setColorScheme(colorScheme: String) {
        currentColorScheme = if (colorScheme == "dark") "dark" else "light"
        if (initialized) {
            invokeAGenUI("setDayNightMode", arrayOf(String::class.java), arrayOf(currentColorScheme))
        }
    }

    private fun ensureRuntime() {
        if (initialized) return

        val activity = appContext.currentActivity ?: context as? Activity
        if (activity == null) {
            updateDebug("ensureRuntime FAIL: no activity")
            emitError("AGenUI requires an Android Activity context.")
            return
        }

        try {
            val aGenUI = AGenUI.getInstance()
            if (!aGenUI.isInitialized) {
                aGenUI.initialize(context.applicationContext)
            }
            aGenUI.setDayNightMode(currentColorScheme)

            val manager = SurfaceManager(activity)
            surfaceManager = manager

            listener = object : ISurfaceManagerListener {
                override fun onCreateSurface(surface: Surface) {
                    surfaceCreated = true
                    updateDebug("onCreateSurface | container=${surface.container != null} | viewH=$height")
                    // Delay addSurface until the view has been laid out by React Native.
                    // onCreateSurface fires before React Native's Yoga layout pass completes,
                    // so container height is 0 at this point.
                    post {
                        if (height > 0) {
                            addSurface(surface)
                        } else {
                            pendingSurface = surface
                            updateDebug("addSurface deferred | viewH=0, waiting for layout")
                        }
                    }
                }

                override fun onDeleteSurface(surface: Surface) {
                    container.removeAllViews()
                }

                override fun onReceiveActionEvent(event: String) {
                    emitAction(event)
                }
            }

            manager.addListener(listener)
            initialized = true
            updateDebug("ensureRuntime OK")
        } catch (error: Throwable) {
            updateDebug("ensureRuntime ERROR: ${error.message}")
            emitError("Failed to initialize AGenUI: ${error.message ?: error.javaClass.simpleName}")
        }
    }

    private fun renderPayload(payload: String) {
        val manager = surfaceManager ?: return
        try {
            isRendering = true
            val plan = normalizePayload(payload)

            updateDebug("render | chunks=${plan.streamChunks.size}")

            // Send all chunks in a single text stream so the SDK can process
            // createSurface → updateComponents → updateDataModel in sequence.
            manager.beginTextStream()
            for (chunk in plan.streamChunks) {
                Log.d("AGenUI", "chunk: ${chunk.take(120)}")
                manager.receiveTextChunk(chunk)
            }
            manager.endTextStream()

            updateDebug("render done | surfaceCreated=$surfaceCreated")
        } catch (error: Throwable) {
            updateDebug("render ERROR: ${error.message}")
            emitError("Failed to render AGenUI payload: ${error.message ?: error.javaClass.simpleName}")
        } finally {
            isRendering = false
        }
    }

    private data class RenderPlan(
        val streamChunks: List<String>,
    )

    private fun normalizePayload(payload: String): RenderPlan {
        val trimmed = payload.trim()
        if (trimmed.startsWith("[")) {
            val array = JSONArray(trimmed)
            val chunks = mutableListOf<String>()
            for (i in 0 until array.length()) {
                val item = array.opt(i)
                if (item is JSONObject) {
                    val itemPlan = normalizePayload(item.toString())
                    chunks += itemPlan.streamChunks
                }
            }
            return RenderPlan(chunks)
        }

        val parsed = JSONObject(trimmed)
        val chunks = mutableListOf<String>()

        parsed.optJSONObject("createSurface")?.let { createSurface ->
            if (!createSurface.has("catalogId")) {
                createSurface.put("catalogId", defaultCatalogId)
            }
            chunks += JSONObject()
                .put("version", parsed.optString("version", "v0.9"))
                .put("createSurface", createSurface)
                .toString()
        }

        parsed.optJSONObject("updateComponents")?.let { updateComponents ->
            val surfaceId = updateComponents.optString("surfaceId", "chat_card")
            val normalizedUpdateComponents = normalizeUpdateComponents(updateComponents, surfaceId)
            if (chunks.none { it.contains("\"createSurface\"") }) {
                chunks += buildCreateSurface(parsed.optString("version", "v0.9"), surfaceId)
            }
            chunks += JSONObject()
                .put("version", parsed.optString("version", "v0.9"))
                .put("updateComponents", normalizedUpdateComponents)
                .toString()
        }

        parsed.optJSONObject("updateDataModel")?.let { updateDataModel ->
            val surfaceId = updateDataModel.optString("surfaceId", "chat_card")
            if (chunks.none { it.contains("\"createSurface\"") }) {
                chunks += buildCreateSurface(parsed.optString("version", "v0.9"), surfaceId)
            }
            chunks += JSONObject()
                .put("version", parsed.optString("version", "v0.9"))
                .put("updateDataModel", updateDataModel)
                .toString()
        }

        parsed.optJSONObject("deleteSurface")?.let { deleteSurface ->
            chunks += JSONObject()
                .put("version", parsed.optString("version", "v0.9"))
                .put("deleteSurface", deleteSurface)
                .toString()
        }

        if (chunks.isEmpty()) {
            emitError("Unsupported AGenUI payload: expected createSurface, updateComponents, updateDataModel, or deleteSurface.")
        }

        return RenderPlan(chunks)
    }

    private fun normalizeUpdateComponents(updateComponents: JSONObject, surfaceId: String): JSONObject {
        val normalized = JSONObject(updateComponents.toString())
        if (!normalized.has("surfaceId")) {
            normalized.put("surfaceId", surfaceId)
        }
        // The Android SDK derives roots from the component tree. Keeping this
        // field can make some payloads parse as a surface with no rendered nodes.
        normalized.remove("rootComponentIds")

        if (!normalized.has("components")) {
            normalized.optJSONObject("root")?.let { root ->
                val components = JSONArray()
                flattenInlineComponent(root, "root", components)
                normalized.remove("root")
                normalized.put("components", components)
            }
        }

        val components = normalized.optJSONArray("components") ?: return normalized
        for (i in 0 until components.length()) {
            val component = components.optJSONObject(i) ?: continue
            sanitizeComponent(component, "component_$i", components)
        }

        return normalized
    }

    private fun flattenInlineComponent(component: JSONObject, fallbackId: String, components: JSONArray): String {
        val normalized = JSONObject(component.toString())
        val id = normalized.optString("id").takeIf { it.isNotBlank() } ?: fallbackId
        normalized.put("id", id)

        normalized.optJSONArray("children")?.let { children ->
            val childIds = JSONArray()
            for (i in 0 until children.length()) {
                when (val child = children.opt(i)) {
                    is JSONObject -> {
                        val childId = child.optString("id").takeIf { it.isNotBlank() } ?: "${id}_child_$i"
                        childIds.put(flattenInlineComponent(child, childId, components))
                    }
                    is String -> childIds.put(child)
                }
            }
            normalized.put("children", childIds)
        }

        sanitizeComponent(normalized, id, components)
        components.put(normalized)
        return id
    }

    private fun sanitizeComponent(component: JSONObject, fallbackId: String, components: JSONArray) {
        if (!component.has("id")) {
            component.put("id", fallbackId)
        }

        normalizeComponentShape(component)

        component.optJSONObject("style")?.let { style ->
            component.put("styles", style)
            component.remove("style")
        }

        normalizeStyles(component.optJSONObject("styles"))

        when (component.optString("component")) {
            "Card" -> normalizeSingleChildContainer(component, "${component.optString("id")}_content", components)
            "Button" -> normalizeButton(component, components)
            "Icon" -> normalizeIcon(component)
            "Text", "RichText" -> {
                if (!component.has("text")) {
                    component.optString("markdown").takeIf { it.isNotBlank() }?.let { component.put("text", it) }
                }
            }
            "Divider" -> {
                if (!component.has("axis")) component.put("axis", "horizontal")
            }
        }
    }

    private fun normalizeComponentShape(component: JSONObject) {
        if (!component.has("component")) {
            component.optString("type").takeIf { it.isNotBlank() }?.let { type ->
                component.put("component", normalizeComponentType(type))
                component.remove("type")
            }
        }

        val props = component.optJSONObject("props") ?: return
        val propKeys = props.keys().asSequence().toList()
        for (key in propKeys) {
            if (key == "style") {
                props.optJSONObject("style")?.let { style ->
                    val mergedStyles = component.optJSONObject("styles") ?: JSONObject().also { component.put("styles", it) }
                    mergeJsonObject(mergedStyles, style)
                }
                continue
            }

            if (!component.has(key)) {
                component.put(key, props.opt(key))
            }
        }
        component.remove("props")
    }

    private fun normalizeComponentType(type: String): String {
        return when (type) {
            "text" -> "Text"
            "richText" -> "RichText"
            "markdown" -> "Markdown"
            "row" -> "Row"
            "column" -> "Column"
            "card" -> "Card"
            "divider" -> "Divider"
            "icon" -> "Icon"
            "button" -> "Button"
            "image" -> "Image"
            else -> type
        }
    }

    private fun mergeJsonObject(target: JSONObject, source: JSONObject) {
        for (key in source.keys().asSequence().toList()) {
            target.put(key, source.opt(key))
        }
    }

    private fun normalizeSingleChildContainer(component: JSONObject, wrapperId: String, components: JSONArray) {
        if (component.has("child")) return
        val children = component.optJSONArray("children") ?: return

        if (children.length() == 1 && children.opt(0) is String) {
            component.put("child", children.optString(0))
        } else {
            val wrapperChildren = JSONArray()
            for (i in 0 until children.length()) {
                when (val child = children.opt(i)) {
                    is JSONObject -> {
                        val childId = child.optString("id").takeIf { it.isNotBlank() } ?: "${wrapperId}_child_$i"
                        wrapperChildren.put(flattenInlineComponent(child, childId, components))
                    }
                    is String -> wrapperChildren.put(child)
                }
            }
            components.put(JSONObject().put("id", wrapperId).put("component", "Column").put("children", wrapperChildren))
            component.put("child", wrapperId)
        }
        component.remove("children")
    }

    private fun normalizeButton(component: JSONObject, components: JSONArray) {
        val id = component.optString("id")
        if (!component.has("child")) {
            val label = component.optString("label")
            if (label.isNotBlank()) {
                val labelId = "${id}_label"
                components.put(JSONObject().put("id", labelId).put("component", "Text").put("text", label))
                component.put("child", labelId)
                component.remove("label")
            }
        }

        component.optJSONObject("action")?.optJSONObject("functionCall")?.let { functionCall ->
            if (!functionCall.has("call")) {
                functionCall.optString("name").takeIf { it.isNotBlank() }?.let {
                    functionCall.put("call", it)
                    functionCall.remove("name")
                }
            }
            if (!functionCall.has("args")) {
                functionCall.optJSONObject("params")?.let {
                    functionCall.put("args", it)
                    functionCall.remove("params")
                }
            }
        }
    }

    private fun normalizeIcon(component: JSONObject) {
        val rawName = component.optString("name")
        val normalizedName = iconAliases[rawName] ?: rawName
        if (normalizedName !in supportedIconNames) {
            component.put("name", "info")
        } else if (normalizedName != rawName) {
            component.put("name", normalizedName)
        }
    }

    private fun normalizeStyles(styles: JSONObject?) {
        if (styles == null) return

        val keys = styles.keys().asSequence().toList()
        for (key in keys) {
            val normalizedKey = camelToKebabStyleKey(key)
            if (normalizedKey != key) {
                val value = styles.opt(key)
                styles.remove(key)
                styles.put(normalizedKey, value)
            }
        }

        for (key in styles.keys().asSequence().toList()) {
            val value = styles.opt(key)
            if (value is Number && (key.endsWith("size") || key.startsWith("margin") || key.startsWith("padding") || key == "gap")) {
                styles.put(key, "${value}px")
            } else if (value is JSONObject && key == "padding") {
                val top = value.opt("top")
                val right = value.opt("right")
                val bottom = value.opt("bottom")
                val left = value.opt("left")
                if (top != null || right != null || bottom != null || left != null) {
                    styles.put("padding", "${toPx(top ?: 0)} ${toPx(right ?: 0)} ${toPx(bottom ?: 0)} ${toPx(left ?: 0)}")
                }
            }
        }
    }

    private fun toPx(value: Any?): String {
        return when (value) {
            is Number -> "${value}px"
            is String -> value
            else -> "0px"
        }
    }

    private fun camelToKebabStyleKey(key: String): String {
        return when (key) {
            "backgroundColor" -> "background-color"
            "borderRadius" -> "border-radius"
            "fontSize" -> "font-size"
            "fontWeight" -> "font-weight"
            "textAlign" -> "text-align"
            "lineClamp" -> "line-clamp"
            "flexWrap" -> "flex-wrap"
            else -> key
        }
    }

    private fun buildCreateSurface(version: String, surfaceId: String): String {
        return JSONObject()
            .put("version", version)
            .put(
                "createSurface",
                JSONObject()
                    .put("surfaceId", surfaceId)
                    .put("catalogId", defaultCatalogId)
            )
            .toString()
    }

    private fun addSurface(surface: Surface) {
        try {
            val surfaceContainer = surface.container as? View
            if (surfaceContainer != null) {
                updateDebug("addSurface OK | ${surfaceContainer.javaClass.simpleName} | containerH=${container.height}")
                (surfaceContainer.parent as? ViewGroup)?.removeView(surfaceContainer)
                container.removeAllViews()
                container.addView(
                    surfaceContainer,
                    FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                    )
                )
                layoutSurfaceContainer(surfaceContainer)
                surfaceContainer.requestLayout()
                container.requestLayout()
                requestLayout()

                // Diagnostic: log SDK surface container state after layout
                postDelayed({
                    val sc = surfaceContainer
                    if (sc is ViewGroup) {
                        updateDebug("DIAG | surfaceContainer children=${sc.childCount} w=${sc.width} h=${sc.height}")
                        for (i in 0 until sc.childCount) {
                            val child = sc.getChildAt(i)
                            updateDebug("DIAG | child[$i] ${child.javaClass.simpleName} w=${child.width} h=${child.height}")
                            if (child is ViewGroup) {
                                for (j in 0 until child.childCount) {
                                    val gc = child.getChildAt(j)
                                    updateDebug("DIAG |   grandchild[$j] ${gc.javaClass.simpleName} w=${gc.width} h=${gc.height}")
                                }
                            }
                        }
                    } else {
                        updateDebug("DIAG | surfaceContainer NOT ViewGroup: ${sc.javaClass.simpleName} w=${sc.width} h=${sc.height}")
                    }
                }, 1000)
            } else {
                val containerType = surface.container?.javaClass?.simpleName ?: "null"
                updateDebug("addSurface SKIP | container type=$containerType")
            }
        } catch (error: Throwable) {
            updateDebug("addSurface ERROR: ${error.message}")
            emitError("Failed to attach AGenUI surface: ${error.message ?: error.javaClass.simpleName}")
        }
    }

    private fun invokeAGenUI(methodName: String, parameterTypes: Array<Class<*>>, args: Array<Any>) {
        try {
            if (methodName == "setDayNightMode") {
                AGenUI.getInstance().setDayNightMode(args.firstOrNull()?.toString() ?: "light")
            }
        } catch (_: Throwable) {
        }
    }

    private fun emitAction(rawEvent: String) {
        val module = moduleRef ?: return
        val event = Bundle().apply {
            putString("rawEvent", rawEvent)
            try {
                val parsed = JSONObject(rawEvent)
                putString("surfaceId", parsed.optString("surfaceId"))
                putString("componentId", parsed.optString("componentId"))
            } catch (_: Throwable) {
            }
        }
        module.appContext.eventEmitter(module)?.emit(id, "onAction", event)
    }

    private fun emitError(message: String, missingNativeSdk: Boolean = false) {
        val module = moduleRef
        if (module != null) {
            val event = Bundle().apply {
                putString("message", message)
                putBoolean("missingNativeSdk", missingNativeSdk)
            }
            module.appContext.eventEmitter(module)?.emit(id, "onError", event)
        } else {
            // Module not set yet — cache error so it can be emitted once setModule is called
            pendingError = message
        }
    }

    fun destroy() {
        try {
            val manager = surfaceManager
            if (manager != null) {
                listener?.let { manager.removeListener(it) }
                manager.destroy()
            }
        } catch (_: Throwable) {
        } finally {
            container.removeAllViews()
            listener = null
            surfaceManager = null
            initialized = false
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        val payload = lastPayload
        if (payload != null && !initialized) {
            updateDebug("onAttachedToWindow | re-rendering lastPayload")
            pendingPayload = payload
            ensureRuntime()
            if (initialized && !isRendering) {
                pendingPayload = null
                renderPayload(payload)
            }
        }
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        container.layout(0, 0, right - left, bottom - top)
        for (i in 0 until container.childCount) {
            layoutSurfaceContainer(container.getChildAt(i))
        }
        // Flush pending surface now that we have a real size
        pendingSurface?.let { surface ->
            pendingSurface = null
            updateDebug("onLayout | flushing pending surface | viewH=$height")
            addSurface(surface)
        }
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)
        val measuredWidth = measuredWidth
        val measuredHeight = measuredHeight
        if (measuredWidth > 0 && measuredHeight > 0) {
            val exactWidth = MeasureSpec.makeMeasureSpec(measuredWidth, MeasureSpec.EXACTLY)
            val exactHeight = MeasureSpec.makeMeasureSpec(measuredHeight, MeasureSpec.EXACTLY)
            container.measure(exactWidth, exactHeight)
        }
    }

    private fun layoutSurfaceContainer(surfaceContainer: View) {
        val availableWidth = container.width.takeIf { it > 0 } ?: width
        val availableHeight = container.height.takeIf { it > 0 } ?: height
        if (availableWidth <= 0 || availableHeight <= 0) {
            updateDebug("layoutSurfaceContainer deferred | w=$availableWidth h=$availableHeight")
            return
        }

        val exactWidth = MeasureSpec.makeMeasureSpec(availableWidth, MeasureSpec.EXACTLY)
        val exactHeight = MeasureSpec.makeMeasureSpec(availableHeight, MeasureSpec.EXACTLY)
        surfaceContainer.measure(exactWidth, exactHeight)
        surfaceContainer.layout(0, 0, availableWidth, availableHeight)
        updateDebug("layoutSurfaceContainer OK | w=$availableWidth h=$availableHeight")
    }

    override fun onDetachedFromWindow() {
        destroy()
        super.onDetachedFromWindow()
    }
}
