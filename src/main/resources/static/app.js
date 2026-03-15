const API_URL = '/api/tickets';

const board = document.querySelector('.board');
const modal = document.getElementById('ticket-modal');
const form = document.getElementById('ticket-form');
let draggedTicket = null;
let currentSubtasks = [];
let allTicketsCache = [];
let activeTagFilters = new Set();
let activeAssigneeFilters = new Set();
let searchQuery = '';
 // Local state for edit modal

function setTodayDate() {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${mm}/${dd}`;
    const display = document.getElementById('today-date-display');
    if (display) display.textContent = dateStr;
}

// Initialization
async function init() {
    setupEventListeners();
    setTodayDate();
    await fetchTickets();

    // Check URL parameters for deep linking
    const pathname = window.location.pathname;

    if (pathname.startsWith('/ticket/')) {
        document.body.classList.add('standalone-ticket');
    }

    if (pathname === '/ticket/new') {
        openModal();
    } else if (pathname.startsWith('/ticket/')) {
        const ticketId = pathname.split('/').pop();
        if (ticketId && ticketId !== 'new') {
            // Fetch the specific ticket
            try {
                const res = await fetch(`${API_URL}/${ticketId}`);
                if (res.ok) {
                    const specificTicket = await res.json();
                    openModal(specificTicket);
                }
            } catch (err) {
                console.error("Error opening linked ticket", err);
            }
        }
    }
}

function setupEventListeners() {
    document.getElementById('add-ticket-btn').addEventListener('click', openModal);
    
    // Title search event
    const searchInput = document.getElementById('title-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            
            // Trigger shake animation
            searchInput.classList.remove('shake');
            void searchInput.offsetWidth; // Force reflow
            searchInput.classList.add('shake');
            
            applyFiltersAndRender();
        });
    }

    document.querySelectorAll('.close-btn').forEach(btn => btn.addEventListener('click', closeModal));
    form.addEventListener('submit', handleFormSubmit);

    // Close modal on Escape key (Highly robust version)
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            const m = document.getElementById('ticket-modal');
            if (m && !m.classList.contains('hidden')) {
                closeModal();
                e.preventDefault();
            }
        }
    }, true);

    // Prevent form submit on Enter in subtask input
    const subtaskInput = document.getElementById('new-subtask-title');
    subtaskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('add-subtask-btn').click();
        }
    });

    // Subtasks addition
    document.getElementById('add-subtask-btn').addEventListener('click', () => {
        const titleInput = document.getElementById('new-subtask-title');
        const title = titleInput.value.trim();
        if (title) {
            // Note: because sub-tickets are now full Tickets, they need a status
            currentSubtasks.push({ title, status: 'TODO' });
            titleInput.value = '';
            renderModalSubtasks();
        }
    });

    // Delete ticket button
    document.getElementById('delete-ticket-btn').addEventListener('click', () => {
        const id = document.getElementById('ticket-id').value;
        if (id) {
            window.deleteTicket(id);
        }
    });

    // Drag and Drop
    const columns = document.querySelectorAll('.ticket-list');
    columns.forEach(col => {
        col.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(col, e.clientY);
            if (afterElement == null) {
                if (draggedTicket) col.appendChild(draggedTicket);
            } else {
                if (draggedTicket) col.insertBefore(draggedTicket, afterElement);
            }
        });

        col.addEventListener('drop', async e => {
            e.preventDefault();
            if (!draggedTicket) return;
            const status = col.parentElement.dataset.status;
            const id = draggedTicket.dataset.id;

            // Recompute positions
            const ticketsInCol = [...col.querySelectorAll('.ticket')];
            const position = ticketsInCol.findIndex(t => t === draggedTicket);

            await updateTicketStatus(id, status, position);
            updateCounters();
        });
    });
}

// API Calls
async function fetchTickets() {
    try {
        const response = await fetch(API_URL);
        const tickets = await response.json();
        allTicketsCache = tickets;
        updateFilterBar();
        applyFiltersAndRender();
    } catch (error) {
        console.error('Error fetching tickets:', error);
    }
}

function applyFiltersAndRender() {
    let filtered = allTicketsCache;

    // 1. Filter by Search Query
    if (searchQuery) {
        filtered = filtered.filter(t => {
            const titleStr = (t.title || '').toLowerCase();
            const idStr = t.ticketIdentifier ? String(t.ticketIdentifier).toLowerCase() : (t.id !== undefined ? String(t.id).toLowerCase() : '');
            return titleStr.includes(searchQuery) || idStr.includes(searchQuery);
        });
    }

    // 2. Filter by Tags
    if (activeTagFilters.size > 0) {
        filtered = filtered.filter(ticket => {
            const rawTag = ticket.tag || '';
            if (!rawTag) return false;
            const ticketTags = rawTag.split(',').map(t => t.trim().toLowerCase());
            return ticketTags.some(t => {
                // Check if any active tag (also lowered) matches
                for (let activeTag of activeTagFilters) {
                    if (activeTag.toLowerCase() === t) return true;
                }
                return false;
            });
        });
    }

    // 3. Filter by Assignees
    if (activeAssigneeFilters.size > 0) {
        filtered = filtered.filter(ticket => {
            return activeAssigneeFilters.has(ticket.assignee);
        });
    }

    renderTickets(filtered);
    renderTimeline(filtered);
}

async function updateFilterBar() {
    try {
        const tagsRes = await fetch(`${API_URL}/tags`);
        const tags = await tagsRes.json();
        
        // Compute unique assignees from the existing ticket cache
        const assigneesSet = new Set();
        allTicketsCache.forEach(t => {
            if (t.assignee && t.assignee.trim()) {
                assigneesSet.add(t.assignee.trim());
            }
            // Also check sub-tickets
            if (t.subTickets) {
                t.subTickets.forEach(st => {
                    if (st.assignee && st.assignee.trim()) {
                        assigneesSet.add(st.assignee.trim());
                    }
                });
            }
        });
        
        const assignees = Array.from(assigneesSet).sort();
        renderFilterBar(tags, assignees);
    } catch (err) {
        console.error("Error updating filter bar", err);
    }
}

function renderFilterBar(tags, assignees) {
    const bar = document.getElementById('filter-bar');
    if (!bar) return;
    
    bar.innerHTML = '';
    
    if (tags.length === 0 && assignees.length === 0) {
        bar.style.display = 'none';
        return;
    }
    bar.style.display = 'flex';

    // Tags
    tags.forEach(tag => {
        const chip = document.createElement('div');
        chip.className = `filter-chip tag-chip ${activeTagFilters.has(tag) ? 'active' : ''}`;
        chip.innerHTML = `<i class="fa-solid fa-tag"></i> ${tag}`;
        chip.onclick = () => {
            if (activeTagFilters.has(tag)) {
                activeTagFilters.delete(tag);
            } else {
                activeTagFilters.add(tag);
            }
            renderFilterBar(tags, assignees);
            applyFiltersAndRender();
        };
        bar.appendChild(chip);
    });

    if (tags.length > 0 && assignees.length > 0) {
        const sep = document.createElement('div');
        sep.className = 'filter-separator';
        bar.appendChild(sep);
    }

    // Assignees
    assignees.forEach(user => {
        const chip = document.createElement('div');
        chip.className = `filter-chip assignee-chip ${activeAssigneeFilters.has(user) ? 'active' : ''}`;
        chip.innerHTML = `<i class="fa-solid fa-user"></i> ${user}`;
        chip.onclick = () => {
            if (activeAssigneeFilters.has(user)) {
                activeAssigneeFilters.delete(user);
            } else {
                activeAssigneeFilters.add(user);
            }
            renderFilterBar(tags, assignees);
            applyFiltersAndRender();
        };
        bar.appendChild(chip);
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();

    // Auto-save any typed subtask before submitting
    const titleInput = document.getElementById('new-subtask-title');
    const newSubTitle = titleInput.value.trim();
    if (newSubTitle) {
        currentSubtasks.push({ title: newSubTitle, status: 'TODO' });
        titleInput.value = '';
    }

    const id = document.getElementById('ticket-id').value;
    const title = document.getElementById('ticket-title').value;
    const description = document.getElementById('ticket-desc').value;
    const assignee = document.getElementById('ticket-assignee').value;
    const creator = document.getElementById('ticket-creator').value;

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    const payload = {
        title,
        description,
        assignee,
        creator,
        tag: document.getElementById('ticket-tag').value,
        status: document.getElementById('ticket-status').value,
        expiredDate: document.getElementById('ticket-expired-date').value || null,
        subTickets: currentSubtasks
    };

    if (!id) {
        payload.status = 'TODO';
    }

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Server responded with ${res.status}: ${errorText}`);
        }

        closeModal();
    } catch (err) {
        console.error("Error saving ticket", err);
        alert("儲存失敗: " + err.message);
        return; // Don't redirect or reload if failed
    }

    // Check if opened in a dedicated tab (deep linked)
    if (window.location.pathname.startsWith('/ticket/')) {
        // It's a popup tab. We can close it or let it redirect to the main board.
        window.location.href = '/';
    } else {
        await fetchTickets();
    }
}

async function updateTicketStatus(id, status, position) {
    await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, position })
    });
}

// Timeline logic
function renderTimeline(tickets) {
    const timelineFlags = document.getElementById('timeline-flags');
    if (!timelineFlags) return;
    timelineFlags.innerHTML = '';

    const today = new Date();
    // Range: 30 days before, 30 days after (total 60 days)
    const rangeDays = 60;
    const rangeMs = rangeDays * 24 * 60 * 60 * 1000;
    const halfRangeMs = rangeMs / 2;

    const ticketsWithExpiry = tickets.filter(t => t.expiredDate);

    ticketsWithExpiry.forEach(t => {
        const expiryDate = new Date(t.expiredDate);
        const diffMs = expiryDate - today;

        // Only show if within range
        if (Math.abs(diffMs) <= halfRangeMs) {
            const leftPercent = 50 + (diffMs / halfRangeMs) * 50;

            const flag = document.createElement('div');
            flag.className = 'timeline-flag';
            flag.style.left = `${leftPercent}%`;
            flag.innerHTML = `
                <div class="timeline-tooltip">
                    <strong>${t.ticketIdentifier || ('Ticket ' + t.id)}</strong><br>
                    ${t.title}
                </div>
                <i class="fa-solid fa-flag"></i>
            `;
            
            flag.onclick = () => openModal(t);
            timelineFlags.appendChild(flag);
        }
    });
}

// Global scope for onclick
window.deleteTicket = async function (id) {
    if (confirm('Are you sure you want to delete this ticket?')) {
        try {
            const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
            if (res.ok) {
                closeModal();
                await fetchTickets();
            } else {
                alert("刪除失敗");
            }
        } catch (err) {
            console.error("Delete error", err);
            alert("刪除出錯");
        }
    }
}

// Rendering
function renderTickets(tickets) {
    console.log("Rendering tickets length:", tickets.length);
    if (!Array.isArray(tickets)) {
        console.error("Tickets is not an array:", tickets);
        return;
    }

    document.querySelectorAll('.ticket-list').forEach(list => list.innerHTML = '');

    tickets.sort((a, b) => (a.position || 0) - (b.position || 0));

    tickets.forEach(ticket => {
        const el = document.createElement('div');
        el.className = 'ticket';
        el.draggable = true;
        el.dataset.id = ticket.id;

        const creatorName = ticket.creator || 'Unassigned';
        
        let tagsHtml = '';
        if (ticket.tag) {
            tagsHtml = `<div class="ticket-tags">` + 
                ticket.tag.split(',')
                    .map(t => t.trim())
                    .filter(t => t)
                    .map(t => `<div class="ticket-tag">${t}</div>`)
                    .join('') + 
                `</div>`;
        }
        
        let metaHtml = '';
        if (ticket.ticketIdentifier) {
            metaHtml = `<div style="position: absolute; top: 1.25rem; right: 1.25rem; font-size: 0.65rem; font-weight: 800; color: #94a3b8; background: #f8fafc; padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid #e2e8f0;">${ticket.ticketIdentifier}</div>`;
        }

        let subtasksHtml = '';
        if (ticket.subTickets && ticket.subTickets.length > 0) {
            subtasksHtml = `<div class="ticket-subtasks-summary">` +
                ticket.subTickets.map(st => `
                    <div class="ticket-subtask-item">
                        <i class="fa-solid fa-turn-up fa-rotate-90"></i>
                        <span>${st.title}</span>
                    </div>
                `).join('') +
                `</div>`;
        }

        el.innerHTML = `
            ${metaHtml}
            ${tagsHtml}
            <div class="ticket-title">${ticket.title}</div>
            ${subtasksHtml}
            <div class="ticket-footer">
                <div class="ticket-creator"><i class="fa-solid fa-user"></i> ${creatorName}</div>
            </div>
        `;

        el.addEventListener('dragstart', () => {
            draggedTicket = el;
            setTimeout(() => el.classList.add('dragging'), 0);
        });

        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            draggedTicket = null;
        });

        el.addEventListener('dblclick', () => {
            openModal(ticket);
        });

        // Use status ID exactly as it is from backend
        const statusId = ticket.status || 'TODO';
        const targetColumn = document.querySelector(`#${statusId} .ticket-list`);
        if (targetColumn) {
            targetColumn.appendChild(el);
        } else {
            const fallbackColumn = document.querySelector(`#TODO .ticket-list`);
            if (fallbackColumn) fallbackColumn.appendChild(el);
        }
    });

    updateCounters();
}

function updateCounters() {
    document.querySelectorAll('.column').forEach(col => {
        const count = col.querySelectorAll('.ticket').length;
        col.querySelector('.column-header span').textContent = count;
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.ticket:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Modal Logic
function openModal(ticket = null) {
    // Check if event passed instead of ticket
    if (ticket && ticket.type === 'click') ticket = null;

    document.getElementById('ticket-id').value = ticket?.id || '';
    document.getElementById('ticket-id-display').textContent = ticket?.ticketIdentifier ? `${ticket.ticketIdentifier}` : '';
    document.getElementById('ticket-identifier').value = ticket?.ticketIdentifier || 'Auto-generated on save';
    document.getElementById('ticket-title').value = ticket?.title || '';
    document.getElementById('ticket-desc').value = ticket?.description || '';
    document.getElementById('ticket-creator').value = ticket?.creator || '';
    document.getElementById('ticket-assignee').value = ticket?.assignee || '';
    document.getElementById('ticket-tag').value = ticket?.tag || '';
    document.getElementById('ticket-status').value = ticket?.status || 'TODO';
    
    // Format LocalDateTime for datetime-local input (YYYY-MM-DDTHH:mm)
    let expiredVal = '';
    if (ticket?.expiredDate) {
        const d = new Date(ticket.expiredDate);
        expiredVal = d.toISOString().slice(0, 16);
    }
    document.getElementById('ticket-expired-date').value = expiredVal;
    
    // Fetch and render tag pool
    fetchTagPool();
    
    // Show creation and update dates in new text elements
    const createdAtDisplay = document.getElementById('ticket-created-at-display');
    const updatedAtDisplay = document.getElementById('ticket-updated-at-display');
    
    createdAtDisplay.textContent = ticket?.createdAt ? formatDate(ticket.createdAt) : 'Auto-generated on save';
    updatedAtDisplay.textContent = ticket?.updatedAt ? formatDate(ticket.updatedAt) : 'N/A';

    document.getElementById('modal-title').textContent = ticket?.id ? `Edit Ticket ${ticket?.ticketIdentifier}` : 'Add New Ticket';

    // Show/Hide Delete button based on whether it's an existing ticket
    const deleteBtn = document.getElementById('delete-ticket-btn');
    if (ticket?.id) {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }

    currentSubtasks = ticket?.subTickets ? [...ticket.subTickets] : [];
    renderModalSubtasks();

    modal.classList.remove('hidden');
    
    // Improved focus management: Focus the title input when modal opens
    setTimeout(() => {
        document.getElementById('ticket-title').focus();
    }, 50);
}

function renderModalSubtasks() {
    const list = document.getElementById('subtask-list');
    list.innerHTML = '';
    currentSubtasks.forEach((st, index) => {
        const item = document.createElement('div');
        const stStatus = st.status || 'TODO';
        item.className = `subtask-item ${stStatus}`;

        item.innerHTML = `
            <div class="subtask-info">
                <span class="subtask-title" onclick="openSubTicket(${index})">${st.title}</span>
                <div class="subtask-status-badge status-${stStatus.toLowerCase()}">${stStatus}</div>
                <div class="subtask-meta">
                    ${st.assignee ? `<span><i class="fa-solid fa-user"></i> ${st.assignee}</span>` : ''}
                    ${st.createdAt ? `<span>| <i class="fa-regular fa-calendar"></i> ${formatDate(st.createdAt)}</span>` : ''}
                </div>
            </div>
            <div class="subtask-actions">
                ${stStatus !== 'DONE' ? `<button type="button" class="btn-open" onclick="toggleSubtask(${index})" title="Mark Done"><i class="fa-solid fa-check"></i></button>` : `<button type="button" class="btn-open" onclick="toggleSubtask(${index})" title="Mark To Do"><i class="fa-solid fa-arrow-rotate-left"></i></button>`}
                ${st.id ? `<button type="button" class="btn-open" onclick="window.open('/ticket/${st.id}', '_blank')" title="Open in new window"><i class="fa-solid fa-external-link"></i></button>` : ''}
                <button type="button" class="btn-delete" onclick="removeSubtask(${index})" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        list.appendChild(item);
    });
}

async function fetchTagPool() {
    try {
        const res = await fetch(`${API_URL}/tags`);
        const tags = await res.json();
        renderTagPool(tags);
    } catch (err) {
        console.error("Error fetching tag pool", err);
    }
}

function renderTagPool(tags) {
    const pool = document.getElementById('tag-pool');
    if (!pool) return;
    pool.innerHTML = '';
    tags.forEach(tag => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.textContent = tag;
        chip.onclick = () => {
            const input = document.getElementById('ticket-tag');
            const currentVal = input.value.trim();
            if (!currentVal) {
                input.value = tag;
            } else {
                const existingTags = currentVal.split(',').map(t => t.trim());
                if (!existingTags.includes(tag)) {
                    input.value = currentVal + ', ' + tag;
                }
            }
        };
        pool.appendChild(chip);
    });
}

window.toggleSubtask = function (index) {
    currentSubtasks[index].status = currentSubtasks[index].status === 'DONE' ? 'TODO' : 'DONE';
    renderModalSubtasks();
}

window.openSubTicket = function (index) {
    if (currentSubtasks[index].id) {
        window.open('/ticket/' + currentSubtasks[index].id, '_blank');
    } else {
        alert("Please save the ticket first to generate a link for this new sub-ticket.");
    }
}

window.removeSubtask = function (index) {
    currentSubtasks.splice(index, 1);
    renderModalSubtasks();
}

function closeModal() {
    modal.classList.add('hidden');
    form.reset();
    currentSubtasks = [];
    document.getElementById('new-subtask-title').value = '';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        // Handle ISO string and fractional seconds
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleString('zh-TW', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false
        });
    } catch (e) {
        return dateStr;
    }
}

init();
