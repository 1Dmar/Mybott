package com.promcbot.plugin.telemetry;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;

final class TelemetrySpoolWriterTest {
    @Test
    void persistsAcceptedEventsOffTheProducerPath() throws Exception {
        Path file = Files.createTempFile("promcbot-writer", ".spool");
        TelemetrySpool spool = new TelemetrySpool(file.toFile(), 64 * 1024L);
        TelemetrySpoolWriter writer = new TelemetrySpoolWriter(spool, 10, "promcbot-test-writer");
        try {
            CompletableFuture<Void> persisted = writer.enqueue(event("one"));
            persisted.get(2, TimeUnit.SECONDS);
            assertEquals(1, spool.pendingCount());
            assertEquals("one", spool.load(10).get(0).eventId());
        } finally {
            writer.shutdown();
        }
    }

    @Test
    void coalescesConcurrentDuplicateEventIds() throws Exception {
        Path file = Files.createTempFile("promcbot-writer", ".spool");
        TelemetrySpoolWriter writer = new TelemetrySpoolWriter(new TelemetrySpool(file.toFile(), 64 * 1024L), 10);
        try {
            TelemetryEvent event = event("same");
            CompletableFuture<Void> first = writer.enqueue(event);
            CompletableFuture<Void> second = writer.enqueue(event);
            assertSame(first, second);
            first.get(2, TimeUnit.SECONDS);
            assertEquals(1, Files.readAllLines(file).size());
        } finally {
            writer.shutdown();
        }
    }

    @Test
    void shutdownDrainsAcceptedStagingQueue() throws Exception {
        Path file = Files.createTempFile("promcbot-writer", ".spool");
        TelemetrySpoolWriter writer = new TelemetrySpoolWriter(new TelemetrySpool(file.toFile(), 64 * 1024L), 10);
        try {
            for (int i = 0; i < 6; i++) writer.enqueue(event("event-" + i));
        } finally {
            writer.shutdown();
        }
        List<TelemetryEvent> events = new TelemetrySpool(file.toFile(), 64 * 1024L).load(10);
        assertEquals(6, events.size());
    }

    private static TelemetryEvent event(String id) {
        return new TelemetryEvent(id, "heartbeat", Instant.parse("2026-08-28T00:00:00Z"), "server", "instance", null);
    }
}
