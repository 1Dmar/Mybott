package com.promcbot.plugin.telemetry;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

final class TelemetrySpoolTest {
    @Test
    void persistsAndRecoversEventsWithTypedData() throws Exception {
        Path directory = Files.createTempDirectory("promcbot-spool");
        Path file = directory.resolve("telemetry.spool");
        TelemetrySpool spool = new TelemetrySpool(file.toFile(), 64 * 1024L);
        Map<String, Object> data = new HashMap<String, Object>();
        data.put("onlinePlayers", 7);
        data.put("healthy", true);
        data.put("label", "a\tb\n c");
        TelemetryEvent original = new TelemetryEvent("event-1", "player_count", Instant.parse("2026-08-28T00:00:00Z"), "server", "instance", data);

        spool.append(original);
        List<TelemetryEvent> recovered = new TelemetrySpool(file.toFile(), 64 * 1024L).load(10);

        assertEquals(1, recovered.size());
        TelemetryEvent actual = recovered.get(0);
        assertEquals(original.eventId(), actual.eventId());
        assertEquals(original.type(), actual.type());
        assertEquals(original.occurredAt(), actual.occurredAt());
        assertEquals("7", String.valueOf(actual.data().get("onlinePlayers")));
        assertEquals(true, actual.data().get("healthy"));
        assertEquals("a\tb\n c", actual.data().get("label"));
    }

    @Test
    void acknowledgementRemovesOnlyConfirmedEvents() throws Exception {
        Path file = Files.createTempFile("promcbot-spool", ".ndjson");
        TelemetrySpool spool = new TelemetrySpool(file.toFile(), 64 * 1024L);
        TelemetryEvent first = event("first");
        TelemetryEvent second = event("second");
        spool.append(first);
        spool.append(second);

        HashSet<String> acknowledged = new HashSet<String>();
        acknowledged.add(first.eventId());
        spool.acknowledge(acknowledged);

        assertEquals(1, spool.pendingCount());
        assertEquals("second", spool.load(10).get(0).eventId());
        assertFalse(Files.exists(file) && Files.size(file) == 0);
    }

    @Test
    void rejectsRecordsBeyondSpoolLimit() throws Exception {
        Path file = Files.createTempFile("promcbot-spool", ".ndjson");
        TelemetrySpool spool = new TelemetrySpool(file.toFile(), 64 * 1024L);
        String large = new String(new char[70_000]).replace('\0', 'x');
        assertThrows(java.io.IOException.class, () -> spool.append(event(large)));
    }

    @Test
    void malformedRecordIsNotDeliveredOrSilentlyAcknowledged() throws Exception {
        Path file = Files.createTempFile("promcbot-spool", ".ndjson");
        Files.write(file, "not-a-record\n".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        TelemetrySpool spool = new TelemetrySpool(file.toFile(), 64 * 1024L);

        assertTrue(spool.load(10).isEmpty());
        assertEquals(1, spool.pendingCount());
    }

    private static TelemetryEvent event(String id) {
        return new TelemetryEvent(id, "heartbeat", Instant.parse("2026-08-28T00:00:00Z"), "server", "instance", null);
    }
}
