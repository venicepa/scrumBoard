const fs = require('fs');
const data = JSON.parse(fs.readFileSync('tickets.json', 'utf8'));
const searchQuery = 's'; // Simulate user typing 'S', but we lowercase it as done in app.js
let filtered = data;
if (searchQuery) {
    filtered = filtered.filter(t => {
        const titleStr = (t.title || '').toLowerCase();
        const idStr = t.ticketIdentifier ? String(t.ticketIdentifier).toLowerCase() : (t.id !== undefined ? String(t.id).toLowerCase() : '');
        console.log(`Checking Ticket ${t.id}: titleStr='${titleStr}', idStr='${idStr}', titleMatch=${titleStr.includes(searchQuery)}, idMatch=${idStr.includes(searchQuery)}`);
        return titleStr.includes(searchQuery) || idStr.includes(searchQuery);
    });
}
console.log(`Matched tickets count: ${filtered.length}`);
