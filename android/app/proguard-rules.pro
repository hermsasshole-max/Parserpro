# ==============================================================================
# R8 / ProGuard Rules for ParserPro (com.receiptscannerpro.app)
# Configured for Google Play Console DEX Code Optimization & Crash Deobfuscation
# ==============================================================================

# Preserve line numbers and source file attribute so Google Play Console can
# accurately deobfuscate stack traces using mapping.txt / embedded proguard.map
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Preserve annotations, generics signatures, and enclosing methods required by
# Capacitor runtime reflection, Kotlin metadata, and Gson serialization
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,Exceptions

# Keep app entry point Activity & package classes
-keep public class com.receiptscannerpro.app.** { *; }

# Keep WebView JavaScript bridge methods (@JavascriptInterface)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Capacitor core bridge & runtime-loaded plugin classes
# (PluginManager loads plugins dynamically via Class.forName from capacitor.plugins.json)
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep @com.getcapacitor.NativePlugin class * { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep public class * extends com.getcapacitor.BridgeActivity { *; }

# Keep Capacitor official plugins (@capacitor/camera, @capacitor/filesystem, @capacitor/share)
# and Ionic native camera/filesystem helper & model classes
-keep class com.capacitorjs.plugins.** { *; }
-keep class io.ionic.libs.** { *; }

# Keep Cordova compatibility plugin layer
-keep class org.apache.cordova.** { *; }
-keep public class * extends org.apache.cordova.CordovaPlugin { *; }

# Keep Gson reflection TypeTokens & @SerializedName fields (used by @capacitor/camera)
-keep class com.google.gson.reflect.TypeToken { *; }
-keep class * extends com.google.gson.reflect.TypeToken
-keepclassmembers,allowobfuscation class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Keep AndroidX Startup initializers declared in merged AndroidManifest.xml
-keep class * implements androidx.startup.Initializer {
    public <init>();
}
