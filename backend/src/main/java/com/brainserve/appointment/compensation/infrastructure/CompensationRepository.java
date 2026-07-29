package com.brainserve.appointment.compensation.infrastructure;

import com.brainserve.appointment.compensation.domain.CompensationPackage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CompensationRepository extends JpaRepository<CompensationPackage, UUID> {
    @Query("select c from CompensationPackage c where c.employeeId = :employeeId and c.effectiveFrom <= :today and (c.effectiveTo is null or c.effectiveTo >= :today) order by c.effectiveFrom desc")
    List<CompensationPackage> findCurrent(UUID employeeId, LocalDate today);
    List<CompensationPackage> findByEmployeeIdOrderByEffectiveFromDesc(UUID employeeId);
    @Query("select case when count(c)>0 then true else false end from CompensationPackage c where c.employeeId=:employeeId and (:toDate is null or c.effectiveFrom <= :toDate) and (c.effectiveTo is null or c.effectiveTo >= :fromDate)")
    boolean overlaps(UUID employeeId, LocalDate fromDate, LocalDate toDate);
}
