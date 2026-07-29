package com.brainserve.appointment;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModularityTest {
    @Test
    void moduleDependenciesRespectPublicInterfaces() {
        ApplicationModules.of(BrainServeAppointmentApplication.class).verify();
    }
}
