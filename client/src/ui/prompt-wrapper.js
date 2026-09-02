// Fallback wrapper per ambienti in cui `prompt()` non è supportato (es. headless/test runners).
(function(){
    if (typeof window === 'undefined') return;
    try {
        const nativePrompt = window.prompt;
        if (typeof nativePrompt !== 'function') {
            window.prompt = function(_msg, def='') { return def; };
        } else {
            window.prompt = function(msg, def='') {
                try { return nativePrompt(msg, def); } catch (e) { return def; }
            };
        }
    } catch (e) {
        // In caso di errore di accesso a window, forniamo comunque una fallback.
        try { window.prompt = function(_msg, def='') { return def; }; } catch (_) {}
    }
})();
