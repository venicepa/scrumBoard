package com.example.scrumboard.repository;

import com.example.scrumboard.domain.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long> {
    List<Ticket> findByParentIsNull();

    @Query("SELECT DISTINCT t.tag FROM Ticket t WHERE t.tag IS NOT NULL AND t.tag != ''")
    List<String> findAllUniqueTags();

    @Query("SELECT DISTINCT t.assignee FROM Ticket t WHERE t.assignee IS NOT NULL AND t.assignee != ''")
    List<String> findAllUniqueAssignees();
}
