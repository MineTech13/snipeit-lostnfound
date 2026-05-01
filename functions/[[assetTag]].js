function parseContactConfig(notes) {
    if (!notes) return { hide: false, show: false, customText: null };
    
    const lowerNotes = notes.toLowerCase();
    const hide = lowerNotes.includes('hidecontact');
    const show = lowerNotes.includes('showcontact');
    
    let customText = null;
    // Sucht nach "customcontact:" und extrahiert den restlichen Text der Zeile
    const match = notes.match(/customcontact:\s*(.+)/i);
    if (match && match[1]) {
        customText = match[1].trim();
    }
    
    return { hide, show, customText };
}

export async function onRequestGet(context) {
    const assetTag = context.params.assetTag;
    const env = context.env;

    if (!env.SNIPEIT_URL || !env.SNIPEIT_TOKEN) {
        return new Response('Configuration Error: Missing environment variables.', { status: 500 });
    }

    if (!assetTag || assetTag.length === 0) {
         return new Response('Please provide an asset tag in the URL.', { status: 400 });
    }

    try {
        const targetTag = Array.isArray(assetTag) ? assetTag[0] : assetTag;

        const assetResponse = await fetch(`${env.SNIPEIT_URL}/api/v1/hardware/bytag/${targetTag}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${env.SNIPEIT_TOKEN}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!assetResponse.ok) {
            if (assetResponse.status === 404) {
                return new Response(`
                    <!DOCTYPE html>
                    <html lang="en">
                    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Not Found</title><style>body { font-family: sans-serif; text-align: center; padding: 2rem; }</style></head>
                    <body><h1>Device not found</h1><p>The asset tag ${targetTag} is unknown in the system.</p></body>
                    </html>
                `, { status: 404, headers: { 'Content-Type': 'text/html' } });
            }
            throw new Error(`API Error: ${assetResponse.status}`);
        }

        const data = await assetResponse.json();
        
        const assetName = data.name || 'No name assigned';
        const modelName = data.model && data.model.name ? data.model.name : 'Unknown model';
        const status = data.status_label && data.status_label.name ? data.status_label.name : 'Unknown';
        const company = data.company && data.company.name ? data.company.name : 'No organization assigned';
        const assignedTo = data.assigned_to && data.assigned_to.name ? data.assigned_to.name : null;
        const location = data.location && data.location.name ? data.location.name : 'Unknown location';
        const serial = data.serial || 'No serial number';
        const assetNotes = data.notes || '';
        
        const isLost = status.toLowerCase().includes('lost');

        let supportEmail = null;
        let supportPhone = null;
        let companyNotes = '';

        if (data.company && data.company.id) {
            const companyResponse = await fetch(`${env.SNIPEIT_URL}/api/v1/companies/${data.company.id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${env.SNIPEIT_TOKEN}`,
                    'Accept': 'application/json'
                }
            });

            if (companyResponse.ok) {
                const companyData = await companyResponse.json();
                supportEmail = companyData.email || null;
                supportPhone = companyData.phone || null;
                companyNotes = companyData.notes || '';
            }
        }

        // Priorisierte Auswertung der Notizen
        const assetConfig = parseContactConfig(assetNotes);
        const companyConfig = parseContactConfig(companyNotes);

        let showContact = false;
        let customContactText = null;

        if (assetConfig.hide) {
            showContact = false;
        } else if (assetConfig.show || assetConfig.customText) {
            showContact = true;
            customContactText = assetConfig.customText;
        } else if (companyConfig.hide) {
            showContact = false;
        } else if (companyConfig.show || companyConfig.customText) {
            showContact = true;
            customContactText = companyConfig.customText;
        } else {
            showContact = isLost;
        }

        let assignedToHtml = '';
        if (assignedTo) {
            assignedToHtml = `<div class="data-row"><span class="label">Assigned To</span><span class="value">${assignedTo}</span></div>`;
        }

        let contactHtml = '';
        if (showContact) {
            if (customContactText) {
                // Anzeige des benutzerdefinierten Textes
                contactHtml = `
                <div class="contact-section">
                    <h2>Contact Information</h2>
                    <p>${customContactText}</p>
                </div>`;
            } else if (supportEmail || supportPhone) {
                // Fallback auf die Standard-Kontaktdaten der Organisation
                let emailHtml = supportEmail ? `<p><strong>Email:</strong> <a href="mailto:${supportEmail}">${supportEmail}</a></p>` : '';
                let phoneHtml = supportPhone ? `<p><strong>Phone:</strong> <a href="tel:${supportPhone}">${supportPhone}</a></p>` : '';
                contactHtml = `
                <div class="contact-section">
                    <h2>Contact Owner</h2>
                    <p>If you found this device, please contact the organization:</p>
                    ${emailHtml}
                    ${phoneHtml}
                </div>`;
            }
        }

        let lostBannerHtml = '';
        if (isLost) {
            lostBannerHtml = `<div class="lost-banner"><strong>⚠️ ATTENTION:</strong> This device has been reported as LOST.</div>`;
        }

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Lost and Found: ${targetTag}</title>
            <style>
                :root { --primary-color: #0056b3; --bg-color: #f4f7f6; --card-bg: #ffffff; --text-main: #333333; --text-muted: #666666; --border-color: #e1e4e8; --danger-bg: #fee2e2; --danger-text: #b91c1c; --danger-border: #ef4444; }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: var(--bg-color); color: var(--text-main); line-height: 1.6; display: flex; justify-content: center; padding: 1rem; }
                .container { width: 100%; max-width: 600px; margin-top: 2rem; }
                .card { background: var(--card-bg); border-radius: 12px; box-shadow: 0 8px 16px rgba(0,0,0,0.05); overflow: hidden; }
                .card-header { background-color: var(--primary-color); color: white; padding: 1.5rem; text-align: center; }
                .card-header h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
                .card-header p { font-size: 0.9rem; opacity: 0.9; }
                .lost-banner { background-color: var(--danger-bg); color: var(--danger-text); text-align: center; padding: 1rem; border-bottom: 2px solid var(--danger-border); }
                .card-body { padding: 1.5rem; }
                .data-grid { display: grid; gap: 1rem; }
                .data-row { border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; }
                .data-row:last-child { border-bottom: none; padding-bottom: 0; }
                .label { display: block; font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
                .value { font-size: 1.1rem; font-weight: 500; word-break: break-word; }
                .contact-section { margin-top: 2rem; padding-top: 1.5rem; border-top: 2px dashed var(--border-color); text-align: center; }
                .contact-section h2 { font-size: 1.2rem; margin-bottom: 0.5rem; color: var(--primary-color); }
                .contact-section a { color: var(--primary-color); text-decoration: none; font-weight: 500; }
                .contact-section a:hover { text-decoration: underline; }
                @media (min-width: 600px) { .data-row { display: grid; grid-template-columns: 150px 1fr; align-items: center; } .label { margin-bottom: 0; } }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <div class="card-header">
                        <h1>Device Information</h1>
                        <p>Asset Tag: ${targetTag}</p>
                    </div>
                    ${lostBannerHtml}
                    <div class="card-body">
                        <div class="data-grid">
                            <div class="data-row"><span class="label">Name</span><span class="value">${assetName}</span></div>
                            <div class="data-row"><span class="label">Model</span><span class="value">${modelName}</span></div>
                            <div class="data-row"><span class="label">Serial Number</span><span class="value">${serial}</span></div>
                            <div class="data-row"><span class="label">Status</span><span class="value">${status}</span></div>
                            <div class="data-row"><span class="label">Owner</span><span class="value">${company}</span></div>
                            ${assignedToHtml}
                            <div class="data-row"><span class="label">Location</span><span class="value">${location}</span></div>
                        </div>
                        ${contactHtml}
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;

        return new Response(html, {
            headers: { 'Content-Type': 'text/html;charset=UTF-8' }
        });

    } catch (error) {
        console.error('Error fetching data:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}