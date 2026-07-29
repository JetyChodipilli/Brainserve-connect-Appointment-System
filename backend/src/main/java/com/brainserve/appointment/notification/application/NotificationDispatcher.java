package com.brainserve.appointment.notification.application;

import com.brainserve.appointment.notification.domain.OutboxMessage;
import com.brainserve.appointment.notification.infrastructure.OutboxRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class NotificationDispatcher {
    private final OutboxRepository outbox;
    private final JavaMailSender mail;
    private final ObjectMapper mapper;
    private final String from;
    public NotificationDispatcher(OutboxRepository outbox, JavaMailSender mail, ObjectMapper mapper,
                                  @Value("${brainserve.notification.from}") String from) {
        this.outbox = outbox; this.mail = mail; this.mapper = mapper; this.from = from;
    }

    @Scheduled(fixedDelayString = "${brainserve.notification.poll-ms}")
    @Transactional
    public void dispatch() {
        List<OutboxMessage> messages = outbox.lockReady(OutboxMessage.Status.PENDING, Instant.now(), PageRequest.of(0, 25));
        for (OutboxMessage message : messages) {
            message.markProcessing();
            try {
                Map<String, String> payload = mapper.readValue(message.getPayloadJson(), new TypeReference<>() {});
                SimpleMailMessage email = new SimpleMailMessage();
                email.setFrom(from); email.setTo(message.getDestination());
                applyTemplate(email, message.getTemplate(), payload);
                mail.send(email);
                message.markSent();
            } catch (MailException | com.fasterxml.jackson.core.JsonProcessingException | IllegalArgumentException ex) {
                message.retry(ex.getClass().getSimpleName());
            }
        }
    }

    private void applyTemplate(SimpleMailMessage email, String template, Map<String, String> payload) {
        String reference = payload.getOrDefault("reference", "your request");
        switch (template) {
            case "APPOINTMENT_OTP" -> {
                email.setSubject("Verify your BrainServe Connect appointment");
                email.setText("Your BrainServe Connect appointment reference is " + reference +
                        ". Verification code: " + payload.get("otp") + ". It expires in 10 minutes.");
            }
            case "APPOINTMENT_CANCELLATION_OTP" -> {
                email.setSubject("Confirm cancellation of your BrainServe Connect appointment");
                email.setText("Appointment " + reference + " can be cancelled with code "
                        + payload.get("otp") + ". It expires in 10 minutes. "
                        + "Ignore this message if you did not request cancellation.");
            }
            case "HR_VISIT_APPROVAL_REQUIRED" -> {
                email.setSubject("BrainServe Connect visit awaiting HR approval");
                email.setText("Visit " + reference + " is waiting in the HR approval queue. Sign in to review it.");
            }
            case "MANAGER_VISIT_APPROVAL_REQUIRED" -> {
                email.setSubject("BrainServe Connect CEO visit awaiting Manager approval");
                email.setText("Visit " + reference
                        + " was verified by Reception and is waiting in your department Manager queue.");
            }
            case "CEO_VISIT_APPROVAL_REQUIRED" -> {
                email.setSubject("BrainServe Connect CEO visit awaiting approval");
                email.setText("Visit " + reference
                        + " was reviewed by the assigned department Manager and is now waiting for the CEO's final decision.");
            }
            case "TEAM_LEAD_VISIT_APPROVAL_REQUIRED" -> {
                email.setSubject("BrainServe Connect visit awaiting Team Lead approval");
                email.setText("Visit " + reference + " was reviewed by HR and is waiting for your department decision. "
                        + "Sign in to approve or reject it.");
            }
            default -> throw new IllegalArgumentException("Unsupported notification template: " + template);
        }
    }
}
