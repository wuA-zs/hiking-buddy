package expo.modules.amaplocation

import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AmapLocationModule : Module() {
    private val TAG = "ExpoAmapLocation"

    override fun definition() = ModuleDefinition {
        Name("ExpoAmapLocation")

        AsyncFunction("getCurrentPosition") { promise: Promise ->
            val context = appContext.reactContext
                ?: run {
                    promise.reject("NO_CONTEXT", "React context not available", null)
                    return@AsyncFunction
                }

            val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager

            val gpsEnabled = try { locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) } catch (_: Exception) { false }
            val networkEnabled = try { locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) } catch (_: Exception) { false }

            Log.d(TAG, "GPS enabled=$gpsEnabled, Network enabled=$networkEnabled")

            // Get last known location for quick response
            val lastLocation = getLastKnownLocation(locationManager)
            Log.d(TAG, "Last known location: ${lastLocation?.latitude},${lastLocation?.longitude} age=${lastLocation?.let { System.currentTimeMillis() - it.time }}ms")

            // If last location is recent (<30s), use it directly
            if (lastLocation != null && (System.currentTimeMillis() - lastLocation.time) < 30_000) {
                promise.resolve(locationToMap(lastLocation))
                return@AsyncFunction
            }

            // Build provider list: GPS first for accuracy
            val providers = mutableListOf<String>()
            if (gpsEnabled) providers.add(LocationManager.GPS_PROVIDER)
            if (networkEnabled) providers.add(LocationManager.NETWORK_PROVIDER)

            if (providers.isEmpty()) {
                if (lastLocation != null) {
                    promise.resolve(locationToMap(lastLocation))
                } else {
                    promise.reject("NO_PROVIDER", "请开启设备定位服务（GPS）", null)
                }
                return@AsyncFunction
            }

            var resolved = false
            val listener = object : LocationListener {
                override fun onLocationChanged(location: Location) {
                    synchronized(this) {
                        if (resolved) return
                        resolved = true
                    }
                    for (p in providers) {
                        try { locationManager.removeUpdates(this) } catch (_: Exception) {}
                    }
                    promise.resolve(locationToMap(location))
                }
                override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                override fun onProviderEnabled(provider: String) {}
                override fun onProviderDisabled(provider: String) {}
            }

            // Request location from all available providers
            for (provider in providers) {
                try {
                    locationManager.requestLocationUpdates(provider, 0L, 0f, listener, Looper.getMainLooper())
                    Log.d(TAG, "Requested updates from $provider")
                } catch (e: SecurityException) {
                    Log.w(TAG, "No permission for $provider: ${e.message}")
                }
            }

            // Timeout: fall back to last known or reject
            Handler(Looper.getMainLooper()).postDelayed({
                synchronized(listener) {
                    if (resolved) return@postDelayed
                    resolved = true
                }
                for (p in providers) {
                    try { locationManager.removeUpdates(listener) } catch (_: Exception) {}
                }
                if (lastLocation != null) {
                    promise.resolve(locationToMap(lastLocation))
                } else {
                    Log.w(TAG, "Location timeout — no providers responded within 15s")
                    promise.reject("TIMEOUT", "定位超时，请确保在开阔地带并开启GPS", null)
                }
            }, 15_000)
        }
    }

    private fun getLastKnownLocation(locationManager: LocationManager): Location? {
        var best: Location? = null
        for (provider in locationManager.allProviders) {
            try {
                val loc = locationManager.getLastKnownLocation(provider) ?: continue
                if (best == null || loc.accuracy < best.accuracy) {
                    best = loc
                }
            } catch (_: SecurityException) {
                continue
            }
        }
        return best
    }

    private fun locationToMap(location: Location): Map<String, Any?> {
        return mapOf(
            "latitude" to location.latitude,
            "longitude" to location.longitude,
            "altitude" to location.altitude,
            "accuracy" to location.accuracy.toDouble(),
            "speed" to location.speed.toDouble(),
            "heading" to location.bearing.toDouble(),
            "timestamp" to location.time
        )
    }
}
