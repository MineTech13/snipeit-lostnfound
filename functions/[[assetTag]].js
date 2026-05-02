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

function getSearchPageHtml() {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Asset Lookup</title>
        <script src="https://unpkg.com/html5-qrcode"></script>
        <style>
            :root { --primary: #0056b3; --bg: #f4f7f6; --card: #fff; --text: #333; }
            body { font-family: -apple-system, system-ui, sans-serif; background: var(--bg); color: var(--text); display: flex; justify-content: center; padding: 2rem 1rem; }
            .container { width: 100%; max-width: 500px; text-align: center; }
            .card { background: var(--card); border-radius: 12px; box-shadow: 0 8px 16px rgba(0,0,0,0.05); padding: 2rem; }
            h1 { margin-bottom: 1.5rem; color: var(--primary); }
            .search-box { display: flex; gap: 8px; margin-bottom: 2rem; }
            input { flex: 1; padding: 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 1rem; }
            button { background: var(--primary); color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; }
            #reader { width: 100%; border-radius: 12px; overflow: hidden; margin-top: 1rem; border: 1px solid #eee; }
            .hint { font-size: 0.9rem; color: #666; margin-top: 1rem; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <h1>Asset Lookup</h1>
                <form onsubmit="event.preventDefault(); window.location.href='/' + document.getElementById('tagInput').value;">
                    <div class="search-box">
                        <input type="text" id="tagInput" placeholder="Enter Asset Tag (e.g. 12345)" required>
                        <button type="submit">Go</button>
                    </div>
                </form>
                <hr style="border:0; border-top:1px solid #eee; margin: 2rem 0;">
                <h3>Scan QR / DataMatrix</h3>
                <div id="reader"></div>
                <p class="hint">Please grant camera access to scan codes.</p>
            </div>
        </div>
        <script>
            function onScanSuccess(decodedText) {
                let tag = decodedText;
                if (tag.includes('/')) {
                    tag = tag.split('/').pop();
                }
                html5QrcodeScanner.clear();
                window.location.href = "/" + tag;
            }

            let html5QrcodeScanner = new Html5QrcodeScanner(
                "reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
            html5QrcodeScanner.render(onScanSuccess);
        </script>
    </body>
    </html>
    `;
}

export async function onRequestGet(context) {
    const assetTag = context.params.assetTag;
    const env = context.env;
    const requestUrl = new URL(context.request.url);
    const hostUrl = requestUrl.origin;

    if (!assetTag || assetTag.length === 0 || assetTag[0] === "") {
        return new Response(getSearchPageHtml(), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    }

    if (!env.SNIPEIT_URL || !env.SNIPEIT_TOKEN) {
        return new Response('Configuration Error: Missing environment variables.', { status: 500 });
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
                return new Response(getSearchPageHtml().replace('placeholder="', 'placeholder="Tag not found, try again: '), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
            }
            throw new Error(`API Error: ${assetResponse.status}`);
        }

        const data = await assetResponse.json();
        
        const assetName = data.name || null;
        const manufacturer = data.manufacturer?.name || null;
        const modelName = data.model?.name || null;
        const rawModelNumber = data.model_number || data.model?.model_number || null;
        const serial = data.serial || null;
        const company = data.company?.name || null;
        const location = data.location?.name || null;
        const statusLabel = data.status_label?.name || null;
        const statusMeta = data.status_label?.status_meta || '';
        const assetNotes = data.notes || '';
        const assetId = data.id;
        
        const isLost = statusLabel?.toLowerCase().includes('lost');

        let assignedToDisplay = null;
        if (data.assigned_to && data.assigned_to.type === 'user') {
            const userResponse = await fetch(`${env.SNIPEIT_URL}/api/v1/users/${data.assigned_to.id}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${env.SNIPEIT_TOKEN}`, 'Accept': 'application/json' }
            });
            if (userResponse.ok) {
                const userData = await userResponse.json();
                const userName = userData.name || data.assigned_to.name;
                assignedToDisplay = userData.website 
                    ? `<a href="${userData.website}" target="_blank" rel="noopener noreferrer" class="user-link">${userName}</a>`
                    : userName;
                if (userData.phone) assignedToDisplay += ` (<a href="tel:${userData.phone}" class="user-phone">${userData.phone}</a>)`;
            }
        } else if (data.assigned_to) {
            assignedToDisplay = data.assigned_to.name;
        }

        let supportEmail = null, supportPhone = null, companyNotes = '';
        if (data.company?.id) {
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

        const rows = [
            { label: 'Name', value: assetName },
            { label: 'Manufacturer', value: manufacturer },
            { label: 'Model', value: modelName ? `${modelName}${rawModelNumber ? ` [${rawModelNumber}]` : ''}` : null },
            { label: 'Serial', value: serial },
            { label: 'Status', value: statusLabel ? `${statusLabel} <span class="badge meta-${statusMeta}">${statusMeta}</span>` : null },
            { label: 'Owner', value: company },
            { label: 'Assigned To', value: assignedToDisplay },
            { label: 'Location', value: location }
        ];

        const rowsHtml = rows
            .filter(row => row.value)
            .map(row => `<div class="data-row"><span class="label">${row.label}</span><span class="value">${row.value}</span></div>`)
            .join('');

        let contactHtml = '';
        if (showContact) {
            if (customContactText) {
                contactHtml = `<div class="contact-section"><h2>Contact Information</h2><p>${customContactText}</p></div>`;
            } else if (supportEmail || supportPhone) {
                contactHtml = `<div class="contact-section"><h2>Contact Owner</h2><p>Please contact us:</p>${supportEmail ? `<p><strong>Email:</strong> <a href="mailto:${supportEmail}">${supportEmail}</a></p>` : ''}${supportPhone ? `<p><strong>Phone:</strong> <a href="tel:${supportPhone}">${supportPhone}</a></p>` : ''}</div>`;
            }
        }

        let bannerHtml = isLost ? `<div class="status-banner lost-banner"><strong>⚠️ ATTENTION:</strong> This device has been reported as LOST.</div>` : '';

        const snipeItAssetUrl = `${env.SNIPEIT_URL}/hardware/${assetId}`;
        const dataMatrixUrl = `https://bwipjs-api.metafloor.com/?bcid=datamatrix&text=${encodeURIComponent(snipeItAssetUrl)}`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(hostUrl + '/' + targetTag)}`;

        let manufacturerModelStr = '';
        if (manufacturer && modelName) { manufacturerModelStr = `${manufacturer} | ${modelName}`; } 
        else if (manufacturer) { manufacturerModelStr = manufacturer; } 
        else if (modelName) { manufacturerModelStr = modelName; }

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Asset Info: ${targetTag}</title>
            
            <!-- Lade html2canvas um das Label als Bild zu rendern -->
            <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
            
            <!-- Dynamischer Import von thermoprint als ES Module Fallback -->
            <script type="module">
                import * as tp from 'https://esm.sh/gh/tomladder/thermoprint@main/packages/core';
                window.ThermoPrint = tp;
            </script>

            <style>
                :root { 
                    --primary: #0056b3; --bg: #f4f7f6; --card: #fff; --text: #333; --muted: #666; --border: #e1e4e8;
                    --lost-bg: #fee2e2; --lost-text: #b91c1c;
                    --deployable: #10b981; --deployed: #3b82f6; --pending: #f59e0b; --undeployable: #ef4444; --archived: #6b7280;
                }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: -apple-system, system-ui, sans-serif; background: var(--bg); color: var(--text); padding: 1rem; display: flex; flex-direction: column; align-items: center; }
                
                .screen-only { display: block; width: 100%; max-width: 600px; margin-top: 2rem; }
                .card { background: var(--card); border-radius: 12px; box-shadow: 0 8px 16px rgba(0,0,0,0.05); overflow: hidden; }
                .card-header { background: var(--primary); color: white; padding: 1.5rem; text-align: center; position: relative; }
                
                .print-actions { position: absolute; top: 1.5rem; right: 1.5rem; display: flex; gap: 8px; }
                .print-btn { background: rgba(255,255,255,0.2); border: 1px solid white; color: white; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
                .print-btn:hover { background: rgba(255,255,255,0.3); }
                .bt-btn { background: #10b981; border: 1px solid white; color: white; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
                .bt-btn:hover { background: #059669; }
                .bt-btn:disabled { background: #ccc; cursor: not-allowed; }

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
                
                .actions { text-align: center; margin-top: 2rem; width: 100%; max-width: 600px; display: flex; justify-content: space-between; }
                .btn-secondary { background: none; border: 1px solid var(--primary); color: var(--primary); padding: 8px 16px; border-radius: 8px; cursor: pointer; text-decoration: none; }

                .print-only { display: none; }

                @media (min-width: 600px) { .data-row { display: grid; grid-template-columns: 150px 1fr; align-items: center; } }
                
                .label-template { 
                    display: flex; 
                    flex-direction: row; 
                    align-items: center; 
                    justify-content: space-between;
                    width: 89mm; 
                    height: 36mm; 
                    padding: 3mm;
                    box-sizing: border-box;
                    font-family: -apple-system, sans-serif;
                    color: black;
                    background: white;
                }
                .print-left { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 20mm; }
                .print-left img { width: 18mm; height: 18mm; object-fit: contain; }
                .print-tag { font-size: 8pt; font-weight: bold; margin-top: 2px; text-align: center; }
                .print-center { flex-grow: 1; padding: 0 4mm; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; }
                .print-text-line { font-size: 8pt; margin: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40mm; }
                .print-right { width: 22mm; height: 22mm; flex-shrink: 0; }
                .print-right img { width: 100%; height: 100%; object-fit: contain; }

                @media print {
                    @page { size: 89mm 36mm; margin: 0; }
                    body { background: white; padding: 0; margin: 0; }
                    .screen-only, .actions { display: none !important; }
                    .print-only { display: flex; page-break-after: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="screen-only">
                <div class="card">
                    <div class="card-header">
                        <h1>Device Information</h1>
                        <p>Tag: ${targetTag}</p>
                        <div class="print-actions">
                            <button class="bt-btn" id="btPrintBtn">Bluetooth Print</button>
                            <button class="print-btn" onclick="window.print()">PDF Print</button>
                        </div>
                    </div>
                    ${bannerHtml}
                    <div class="card-body">
                        <div class="data-grid">${rowsHtml}</div>
                        ${contactHtml}
                    </div>
                </div>
            </div>

            <div class="actions screen-only">
                <a href="/" class="btn-secondary">Search Another Asset</a>
            </div>

            <div class="print-only label-template" id="labelNode">
                <div class="print-left">
                    <img src="${dataMatrixUrl}" alt="DataMatrix Snipe-IT" crossorigin="anonymous" />
                    <div class="print-tag">${targetTag}</div>
                </div>
                <div class="print-center">
                    <div class="print-text-line">Property of ${company || 'Organization'}</div>
                    ${serial ? `<div class="print-text-line">${serial}</div>` : ''}
                    ${manufacturerModelStr ? `<div class="print-text-line">${manufacturerModelStr}</div>` : ''}
                </div>
                <div class="print-right">
                    <img src="${qrCodeUrl}" alt="QR Code Lost & Found" crossorigin="anonymous" />
                </div>
            </div>

            <script>
                document.getElementById('btPrintBtn').addEventListener('click', async () => {
                    const btn = document.getElementById('btPrintBtn');
                    
                    if (!window.ThermoPrint) {
                        alert('Die Drucker-Bibliothek wird noch geladen. Bitte warte einen Moment.');
                        return;
                    }

                    if (!navigator.bluetooth) {
                        alert('Web Bluetooth wird von diesem Browser nicht unterstützt.');
                        return;
                    }

                    try {
                        btn.disabled = true;
                        btn.innerText = 'Verbinde...';
                        
                        const device = await navigator.bluetooth.requestDevice({
                            filters: [{ namePrefix: 'P12' }, { namePrefix: 'Marklife' }],
                            optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
                        });
                        
                        console.log('Bluetooth-Gerät ausgewählt:', device.name);
                        btn.innerText = 'Rendere Label...';

                        const labelNode = document.getElementById('labelNode');
                        labelNode.style.display = 'flex';
                        
                        const canvas = await html2canvas(labelNode, { 
                            scale: 2, 
                            useCORS: true 
                        });
                        
                        labelNode.style.display = 'none';
                        const ctx = canvas.getContext('2d');
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                        btn.innerText = 'Drucke...';
                        
                        // Nutzung des importierten window.ThermoPrint Objekts
                        const transport = new window.ThermoPrint.WebBluetoothTransport(device);
                        await transport.connect();
                        
                        const printer = new window.ThermoPrint.Printer(transport, window.ThermoPrint.Profiles.p12);
                        await printer.printImage(imageData);
                        
                        btn.innerText = 'Erfolgreich!';
                        setTimeout(() => {
                            btn.innerText = 'Bluetooth Print';
                            btn.disabled = false;
                        }, 3000);

                    } catch (error) {
                        console.error('Bluetooth/Print-Fehler:', error);
                        alert('Fehler beim Drucken: ' + error.message);
                        btn.innerText = 'Bluetooth Print';
                        btn.disabled = false;
                    }
                });
            </script>
        </body>
        </html>
        `;

        return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    } catch (e) {
        return new Response('Internal Error', { status: 500 });
    }
}