package io.github.lynceus.pipeline.service;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class GithubCacheService {

    private static final long TTL_SECONDS = 60;
    private static final int MAX_ENTRIES = 100;
    // Skip caching responses larger than 512 KB to avoid OOM
    private static final int MAX_BODY_BYTES = 512 * 1024;

    private record Entry(String body, int status, Instant expiresAt) {}

    private final Map<String, Entry> cache = new LinkedHashMap<>(MAX_ENTRIES, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Entry> eldest) {
            return size() > MAX_ENTRIES;
        }
    };

    public record CachedResponse(String body, int status) {}

    public synchronized CachedResponse get(String key) {
        Entry entry = cache.get(key);
        if (entry == null || Instant.now().isAfter(entry.expiresAt())) {
            cache.remove(key);
            return null;
        }
        return new CachedResponse(entry.body(), entry.status());
    }

    public synchronized void put(String key, String body, int status) {
        if (body != null && body.length() > MAX_BODY_BYTES) {
            return;
        }
        cache.put(key, new Entry(body, status, Instant.now().plusSeconds(TTL_SECONDS)));
    }
}
