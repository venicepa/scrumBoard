package com.example.scrumboard.domain;

import lombok.Data;
import javax.persistence.*;
import java.util.ArrayList;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDateTime;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Data
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    // Status: TODO, IN_PROGRESS, DONE
    private String status;

    private Integer position;

    private String assignee;

    // The person who created this ticket
    private String creator;

    // Auto-generated ID (e.g., SCRUM-1)
    private String ticketIdentifier;

    private String tag;

    private LocalDateTime expiredDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    @JsonIgnore
    private Ticket parent;

    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Ticket> subTickets = new ArrayList<>();

    // We need to manage bidirectional relation manually for subTickets
    public void setSubTickets(List<Ticket> subTickets) {
        this.subTickets.clear();
        if (subTickets != null) {
            this.subTickets.addAll(subTickets);
            this.subTickets.forEach(st -> st.setParent(this));
        }
    }
}
