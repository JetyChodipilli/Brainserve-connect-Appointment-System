package com.brainserve.appointment.notification.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
@EnableKafka
public class InternalNotificationKafkaConfiguration {
    @Bean
    NewTopic internalCallTopic(@Value("${brainserve.notification.internal-call-topic}") String topicName) {
        return TopicBuilder.name(topicName).partitions(3).replicas(1).build();
    }
}
