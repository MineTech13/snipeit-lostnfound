function parseContactConfig(notes) {
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
                return new Response('Device not found', { status: 404 });
            }
            throw new Error(`API Error: ${assetResponse.status}`);
        }

        const data = await assetResponse.json();
        
        const assetName = data.name || 'No name assigned';
        const manufacturer = data.manufacturer && data.manufacturer.name ? data.manufacturer.name : 'Unknown Manufacturer';
        const modelName = data.model && data.model.name ? data.model.name : 'Unknown model';
        const rawModelNumber = data.model_number || (data.model && data.model.model_number) || null;
        const modelNumberDisplay = rawModelNumber ? ` [${rawModelNumber}]` : '';
        const fullModelDisplay = modelName + modelNumberDisplay;

        const statusLabel = data.status_label && data.status_label.name ? data.status_label.name : 'Unknown';
        const statusMeta = data.status_label && data.status_label.status_meta ? data.status_label.status_meta : '';
        const company = data.company && data.company.name ? data.company.name : 'No organization assigned';
        const location = data.location && data.location.name ? data.location.name : null;
        const serial = data.serial || 'No serial number';
        const assetNotes = data.notes || '';
        
        const isLost = statusLabel.toLowerCase().includes('lost');

        // Fetch user details if assigned to a person
        let assignedToDisplay = null;
        if (data.assigned_to && data.assigned_to.type === 'user') {
            const userResponse = await fetch(`${env.SNIPEIT_URL}/api/v1/users/${data.assigned_to.id}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${env.SNIPEIT_TOKEN}`, 'Accept': 'application/json' }
            });
            
            if (userResponse.ok) {
                const userData = await userResponse.json();
                const userName = userData.name || data.assigned_to.name;
                const userWebsite = userData.website;
                const userPhone = userData.phone;

                if (userWebsite) {
                    assignedToDisplay = `<a href="${userWebsite}" target="_blank" rel="noopener noreferrer" class="user-link">${userName}</a>`;
                } else {
                    assignedToDisplay = userName;
                }

                if (userPhone) {
                    assignedToDisplay += ` (<a href="tel:${userPhone}" class="user-phone">${userPhone}</a>)`;
                }
            } else {
                assignedToDisplay = data.assigned_to.name;
            }
        } else if (data.assigned_to) {
            assignedToDisplay = data.assigned_to.name;
        }

        // Fetch company details
        let supportEmail = null, supportPhone = null, companyNotes = '';
        if (data.company && data.company.id) {
            const companyResp = await fetch(`${env.SNIPEIT_URL}/api/v1/companies/${data.company.id}`, {
                method: 'GET', headers: { 'Authorization': `Bearer ${env.SNIPEIT_TOKEN}`, 'Accept': 'application/json' }
            });
            if (companyResp.ok) {
                const cData = await companyResp.json();
                supportEmail = cData.email; supportPhone = cData.phone; companyNotes = cData.notes || '';
            }
        }

        const assetConfig = parseContactConfig(assetNotes);
        const companyConfig = parseContactConfig(companyNotes);
        let showContact = assetConfig.hide ? false : (assetConfig.show || assetConfig.customText ? true : (companyConfig.hide ? false : (companyConfig.show || companyConfig.customText ? true : isLost)));
        let customContactText = assetConfig.customText || companyConfig.customText;

        let contactHtml = '';
        if (showContact) {
            if (customContactText) {
                contactHtml = `<div class="contact-section"><h2>Contact Information</h2><p>${customContactText}</p></div>`;
            } else if (supportEmail || supportPhone) {
                contactHtml = `<div class="contact-section"><h2>Contact Owner</h2><p>Please contact us:</p>${supportEmail ? `<p><strong>Email:</strong> <a href="mailto:${supportEmail}">${supportEmail}</a></p>` : ''}${supportPhone ? `<p><strong>Phone:</strong> <a href="tel:${supportPhone}">${supportPhone}</a></p>` : ''}</div>`;
            }
        }

        let bannerHtml = isLost ? `<div class="status-banner lost-banner"><strong>⚠️ ATTENTION:</strong> This device has been reported as LOST.</div>` : '';

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Asset Info: ${targetTag}</title>
            <style>
                :root { 
                    --primary: #0056b3; --bg: #f4f7f6; --card: #fff; --text: #333; --muted: #666; --border: #e1e4e8;
                    --lost-bg: #fee2e2; --lost-text: #b91c1c;
                    --deployable: #10b981; --deployed: #3b82f6; --pending: #f59e0b; --undeployable: #ef4444; --archived: #6b7280;
                }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: -apple-system, system-ui, sans-serif; background: var(--bg); color: var(--text); padding: 1rem; display: flex; justify-content: center; }
                .container { width: 100%; max-width: 600px; margin-top: 2rem; }
                .card { background: var(--card); border-radius: 12px; box-shadow: 0 8px 16px rgba(0,0,0,0.05); overflow: hidden; }
                .card-header { background: var(--primary); color: white; padding: 1.5rem; text-align: center; }
                .status-banner { text-align: center; padding: 1rem; border-bottom: 2px solid; font-weight: 500; }
                .lost-banner { background: var(--lost-bg); color: var(--lost-text); border-color: #ef4444; }
                .card-body { padding: 1.5rem; }
                .data-grid { display: grid; gap: 1rem; }
                .data-row { border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; }
                .data-row:last-child { border-bottom: none; }
                .label { display: block; font-size: 0.85rem; color: var(--muted); text-transform: uppercase; margin-bottom: 0.25rem; }
                .value { font-size: 1.1rem; font-weight: 500; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
                .badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 99px; color: white; text-transform: uppercase; }
                .meta-deployable { background: var(--deployable); }
                .meta-deployed { background: var(--deployed); }
                .meta-pending { background: var(--pending); }
                .meta-undeployable { background: var(--undeployable); }
                .meta-archived { background: var(--archived); }
                .contact-section { margin-top: 2rem; padding-top: 1.5rem; border-top: 2px dashed var(--border); text-align: center; }
                .contact-section h2 { color: var(--primary); font-size: 1.2rem; margin-bottom: 0.5rem; }
                .user-link { color: var(--primary); text-decoration: none; border-bottom: 1px solid transparent; }
                .user-link:hover { border-bottom-color: var(--primary); }
                .user-phone { color: var(--text); text-decoration: none; font-size: 0.95rem; font-weight: normal; }
                @media (min-width: 600px) { .data-row { display: grid; grid-template-columns: 150px 1fr; align-items: center; } }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <div class="card-header"><h1>Device Information</h1><p>Tag: ${targetTag}</p></div>
                    ${bannerHtml}
                    <div class="card-body">
                        <div class="data-grid">
                            <div class="data-row"><span class="label">Name</span><span class="value">${assetName}</span></div>
                            <div class="data-row"><span class="label">Manufacturer</span><span class="value">${manufacturer}</span></div>
                            <div class="data-row"><span class="label">Model</span><span class="value">${fullModelDisplay}</span></div>
                            <div class="data-row"><span class="label">Serial</span><span class="value">${serial}</span></div>
                            <div class="data-row"><span class="label">Status</span><span class="value">${statusLabel} <span class="badge meta-${statusMeta}">${statusMeta}</span></span></div>
                            <div class="data-row"><span class="label">Owner</span><span class="value">${company}</span></div>
                            ${assignedToDisplay ? `<div class="data-row"><span class="label">Assigned To</span><span class="value">${assignedToDisplay}</span></div>` : ''}
                            ${location ? `<div class="data-row"><span class="label">Location</span><span class="value">${location}</span></div>` : ''}
                        </div>
                        ${contactHtml}
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;

        return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    } catch (e) {
        return new Response('Internal Error', { status: 500 });
    }
}