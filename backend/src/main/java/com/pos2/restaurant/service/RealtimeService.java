package com.pos2.restaurant.service;

import com.pos2.restaurant.dto.RealtimeEvent;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class RealtimeService {

    private final SimpMessagingTemplate messagingTemplate;
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public RealtimeService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public SseEmitter connect() {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(error -> emitters.remove(emitter));
        sendToEmitter(emitter, RealtimeEvent.of("CONNECTED", "Realtime connected"));
        return emitter;
    }

    public void publishOrder(Object payload) {
        RealtimeEvent event = RealtimeEvent.of("ORDER_UPDATED", payload);
        messagingTemplate.convertAndSend("/topic/orders", event);
        broadcast(event);
    }

    public void publishBillRequest(Object payload) {
        RealtimeEvent event = RealtimeEvent.of("BILL_REQUEST_UPDATED", payload);
        messagingTemplate.convertAndSend("/topic/bill-requests", event);
        broadcast(event);
    }

    public void publishTable(Object payload) {
        RealtimeEvent event = RealtimeEvent.of("TABLE_UPDATED", payload);
        messagingTemplate.convertAndSend("/topic/tables", event);
        broadcast(event);
    }

    private void broadcast(RealtimeEvent event) {
        emitters.forEach(emitter -> sendToEmitter(emitter, event));
    }

    private void sendToEmitter(SseEmitter emitter, RealtimeEvent event) {
        try {
            emitter.send(SseEmitter.event().name(event.type()).data(event));
        } catch (IOException exception) {
            emitters.remove(emitter);
        }
    }
}
