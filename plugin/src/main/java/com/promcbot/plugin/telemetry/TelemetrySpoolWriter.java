package com.promcbot.plugin.telemetry;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * Non-blocking handoff from Bukkit callbacks to the durable spool.
 *
 * The staging queue is deliberately bounded: producers never wait for disk I/O.
 * A rejected handoff is reported to the caller and the normal in-memory queue
 * remains the current-run fallback. A successful handoff is tracked by event ID
 * so a flush cannot acknowledge a record before its append has completed.
 */
public final class TelemetrySpoolWriter {
    private static final int DEFAULT_CAPACITY = 5000;
    private final TelemetrySpool spool;
    private final LinkedBlockingQueue<WriteRequest> queue;
    private final ConcurrentMap<String, CompletableFuture<Void>> pending = new ConcurrentHashMap<String, CompletableFuture<Void>>();
    private final Thread worker;
    private volatile boolean accepting = true;

    public TelemetrySpoolWriter(TelemetrySpool spool, int capacity, String threadName) {
        if (spool == null) throw new IllegalArgumentException("spool is required");
        this.spool = spool;
        this.queue = new LinkedBlockingQueue<WriteRequest>(Math.max(10, capacity));
        this.worker = new Thread(this::runWorker, threadName == null || threadName.trim().isEmpty()
                ? "promcbot-telemetry-spool-writer" : threadName);
        this.worker.setDaemon(true);
        this.worker.start();
    }

    public TelemetrySpoolWriter(TelemetrySpool spool, int capacity) {
        this(spool, capacity, "promcbot-telemetry-spool-writer");
    }

    public TelemetrySpoolWriter(TelemetrySpool spool) {
        this(spool, DEFAULT_CAPACITY);
    }

    /**
     * Offers the event without waiting for disk or a full queue.
     * The returned future completes only after append+fsync has completed.
     */
    public CompletableFuture<Void> enqueue(TelemetryEvent event) {
        if (event == null) return CompletableFuture.completedFuture(null);
        if (!accepting) return failedFuture(new IOException("telemetry spool writer is shutting down"));

        CompletableFuture<Void> completion = new CompletableFuture<Void>();
        CompletableFuture<Void> existing = pending.putIfAbsent(event.eventId(), completion);
        if (existing != null) return existing;
        if (!queue.offer(new WriteRequest(event, completion))) {
            pending.remove(event.eventId(), completion);
            completion.completeExceptionally(new IOException("telemetry spool writer queue is full"));
        }
        return completion;
    }

    /** Waits for all accepted writes in this batch, without blocking the caller. */
    public CompletableFuture<Void> awaitPersisted(Collection<String> eventIds) {
        if (eventIds == null || eventIds.isEmpty()) return CompletableFuture.completedFuture(null);
        List<CompletableFuture<Void>> waits = new ArrayList<CompletableFuture<Void>>();
        for (String eventId : eventIds) {
            if (eventId == null) continue;
            CompletableFuture<Void> completion = pending.get(eventId);
            if (completion != null) waits.add(completion);
        }
        if (waits.isEmpty()) return CompletableFuture.completedFuture(null);
        return CompletableFuture.allOf(waits.toArray(new CompletableFuture<?>[waits.size()]));
    }

    public int stagedCount() {
        return queue.size();
    }

    /**
     * Stops accepting new records and drains all accepted records on the writer
     * thread. This method may wait for disk I/O and must never run on Bukkit's
     * primary thread.
     */
    public void shutdown() {
        accepting = false;
        try {
            worker.join(30_000L);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }
        if (worker.isAlive()) worker.interrupt();
    }

    /** Runs the potentially waiting shutdown away from the Bukkit primary thread. */
    public CompletableFuture<Void> shutdownAsync() {
        return CompletableFuture.runAsync(this::shutdown);
    }

    private void runWorker() {
        while (accepting || !queue.isEmpty()) {
            WriteRequest request = null;
            try {
                request = queue.poll(250L, TimeUnit.MILLISECONDS);
            } catch (InterruptedException interrupted) {
                if (!accepting && queue.isEmpty()) break;
                Thread.currentThread().interrupt();
            }
            if (request == null) continue;
            try {
                spool.append(request.event);
                request.completion.complete(null);
            } catch (Throwable error) {
                request.completion.completeExceptionally(error);
            } finally {
                pending.remove(request.event.eventId(), request.completion);
            }
        }
    }

    private static CompletableFuture<Void> failedFuture(Throwable error) {
        CompletableFuture<Void> future = new CompletableFuture<Void>();
        future.completeExceptionally(error);
        return future;
    }

    private static final class WriteRequest {
        private final TelemetryEvent event;
        private final CompletableFuture<Void> completion;

        private WriteRequest(TelemetryEvent event, CompletableFuture<Void> completion) {
            this.event = event;
            this.completion = completion;
        }
    }
}
