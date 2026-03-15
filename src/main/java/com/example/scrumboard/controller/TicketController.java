package com.example.scrumboard.controller;

import com.example.scrumboard.domain.Ticket;
import com.example.scrumboard.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
@CrossOrigin(origins = "*") // Allow frontend to call APIs
public class TicketController {

    private final TicketRepository ticketRepository;

    @GetMapping
    public List<Ticket> getAllTickets() {
        return ticketRepository.findByParentIsNull();
    }

    @GetMapping("/tags")
    public List<String> getAllTags() {
        List<String> rawTags = ticketRepository.findAllUniqueTags();
        return rawTags.stream()
                .flatMap(s -> java.util.Arrays.stream(s.split(",")))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .sorted()
                .toList();
    }

    @GetMapping("/assignees")
    public List<String> getAllAssignees() {
        return ticketRepository.findAllUniqueAssignees().stream()
                .filter(s -> s != null && !s.isEmpty())
                .distinct()
                .sorted()
                .toList();
    }

    @GetMapping("/{id}")
    public Ticket getTicket(@PathVariable Long id) {
        return ticketRepository.findById(id).orElseThrow(() -> new RuntimeException("Ticket not found"));
    }

    @PostMapping
    public Ticket createTicket(@RequestBody Ticket ticket) {
        if (ticket.getStatus() == null) {
            ticket.setStatus("TODO");
        }

        Ticket saved = ticketRepository.save(ticket);

        // Auto-generate a ticket identifier like SCRUM-1
        if (saved.getTicketIdentifier() == null || saved.getTicketIdentifier().isEmpty()) {
            saved.setTicketIdentifier("SCRUM-" + saved.getId());
            saved = ticketRepository.save(saved);
        }

        return saved;
    }

    @PutMapping("/{id}")
    public Ticket updateTicket(@PathVariable Long id, @RequestBody Ticket ticketDetails) {
        Ticket ticket = ticketRepository.findById(id).orElseThrow(() -> new RuntimeException("Ticket not found"));
        if (ticketDetails.getTitle() != null)
            ticket.setTitle(ticketDetails.getTitle());
        if (ticketDetails.getDescription() != null)
            ticket.setDescription(ticketDetails.getDescription());
        if (ticketDetails.getStatus() != null)
            ticket.setStatus(ticketDetails.getStatus());
        if (ticketDetails.getPosition() != null)
            ticket.setPosition(ticketDetails.getPosition());
        if (ticketDetails.getAssignee() != null)
            ticket.setAssignee(ticketDetails.getAssignee());
        if (ticketDetails.getCreator() != null)
            ticket.setCreator(ticketDetails.getCreator());
        if (ticketDetails.getTag() != null)
            ticket.setTag(ticketDetails.getTag());
        if (ticketDetails.getExpiredDate() != null)
            ticket.setExpiredDate(ticketDetails.getExpiredDate());
        if (ticketDetails.getSubTickets() != null) {
            // Because they are full tickets now, we need to ensure they have default
            // properties
            ticketDetails.getSubTickets().forEach(st -> {
                if (st.getStatus() == null)
                    st.setStatus("TODO");
            });
            ticket.setSubTickets(ticketDetails.getSubTickets());
        }
        return ticketRepository.save(ticket);
    }

    @DeleteMapping("/{id}")
    public void deleteTicket(@PathVariable Long id) {
        ticketRepository.deleteById(id);
    }
}
