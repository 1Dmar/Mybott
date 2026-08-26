package com.promcbot.plugin.telemetry;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;

/** Bounded in-memory queue; it never blocks the Minecraft server thread. */
public final class TelemetryQueue {
    private final ConcurrentLinkedQueue<TelemetryEvent> events = new ConcurrentLinkedQueue<>();
    private final int maxSize;
    private long dropped;

    public TelemetryQueue(int maxSize) {
        if (maxSize < 10) throw new IllegalArgumentException("maxSize must be at least 10");
        this.maxSize = maxSize;
    }

    public synchronized boolean offer(TelemetryEvent event) {
        if (events.size() >= maxSize) {
            events.poll();
            dropped++;
        }
        return events.offer(event);
    }

    public synchronized void requeue(List<TelemetryEvent> pending) {
        if (pending == null) return;
        for (int i = pending.size() - 1; i >= 0; i--) {
            if (events.size() >= maxSize) {
                events.poll();
                dropped++;
            }
            events.add(pending.get(i));
        }
    }

    public synchronized List<TelemetryEvent> drain(int maxBatch) {
        int limit = Math.max(1, Math.min(maxBatch, maxSize));
        List<TelemetryEvent> result = new ArrayList<>(limit);
        while (result.size() < limit) {
            TelemetryEvent event = events.poll();
            if (event == null) break;
            result.add(event);
        }
        return result;
    }

    public int size() { return events.size(); }
    public synchronized long dropped() { return dropped; }
}
