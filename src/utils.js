export function parseContactConfig(notes) {
    if (!notes) return { hide: false, show: false, customText: null };
    const lowerNotes = notes.toLowerCase();
    const hide = lowerNotes.includes('hidecontact');
    const show = lowerNotes.includes('showcontact');
    let customText = null;
    const match = notes.match(/customcontact:\s*(.+)/i);
    if (match && match[1]) {
        customText = match[1].trim();
    }
    return { hide, show, customText };
}