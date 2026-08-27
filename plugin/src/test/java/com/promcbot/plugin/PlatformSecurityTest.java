package com.promcbot.plugin;

import com.promcbot.plugin.backend.HmacSigner;
import com.promcbot.plugin.telemetry.TelemetryEvent;
import com.promcbot.plugin.telemetry.TelemetryQueue;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class PlatformSecurityTest {
    @Test
    void hmacIsDeterministicAndConstantTimeComparisonRejectsWrongValue() {
        String signature = HmacSigner.sign("secret", "1700000000", "nonce", "{\"events\":[]}");
        assertEquals(signature, HmacSigner.sign("secret", "1700000000", "nonce", "{\"events\":[]}"));
        assertNotEquals(signature, HmacSigner.sign("wrong", "1700000000", "nonce", "{\"events\":[]}"));
        assertTrue(HmacSigner.constantTimeEquals(signature, signature));
        assertFalse(HmacSigner.constantTimeEquals(signature, "bad"));
    }

    @Test
    void queueIsBoundedAndReportsDroppedEvents() {
        TelemetryQueue queue = new TelemetryQueue(10);
        for (int i = 0; i < 12; i++) {
            Map<String, Object> data = new HashMap<String, Object>();
            data.put("i", i);
            queue.offer(new TelemetryEvent("test", Instant.now(), "server", "instance", data));
        }
        assertEquals(10, queue.size());
        assertEquals(2, queue.dropped());
        List<TelemetryEvent> drained = queue.drain(4);
        assertEquals(4, drained.size());
        assertEquals(6, queue.size());
    }
}
