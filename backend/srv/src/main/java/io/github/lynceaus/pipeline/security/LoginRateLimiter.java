package io.github.lynceaus.pipeline.security;

import org.springframework.stereotype.Component;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class LoginRateLimiter {

    private static final int MAX_FAILURES = 10;
    private static final long WINDOW_MS = 5 * 60 * 1000L;
    private static final long BLOCK_MS = 15 * 60 * 1000L;

    private static class Entry {
        int failures;
        long windowStart = System.currentTimeMillis();
        long blockedUntil;
    }

    private final Map<String, Entry> entries = new ConcurrentHashMap<>();

    public boolean isBlocked(String ip) {
        Entry e = entries.get(ip);
        if (e == null) return false;
        return e.blockedUntil > 0 && System.currentTimeMillis() < e.blockedUntil;
    }

    public void recordFailure(String ip) {
        entries.compute(ip, (k, e) -> {
            if (e == null) e = new Entry();
            long now = System.currentTimeMillis();
            if (now - e.windowStart > WINDOW_MS) {
                e.failures = 0;
                e.windowStart = now;
                e.blockedUntil = 0;
            }
            e.failures++;
            if (e.failures >= MAX_FAILURES) {
                e.blockedUntil = now + BLOCK_MS;
            }
            return e;
        });
    }

    public void recordSuccess(String ip) {
        entries.remove(ip);
    }
}
