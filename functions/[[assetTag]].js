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
                <form onsubmit="event.preventDefault(); window.location.href='/' + document.getElementById('tagInput').value + window.location.search;">
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
                window.location.href = "/" + tag + window.location.search;
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
    const hostUrl = env.BASE_URL ? env.BASE_URL.replace(/\/$/, '') : requestUrl.origin;
    
    const showLabelUI = requestUrl.searchParams.has('label');

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

        let manufacturerModelStr = '';
        if (manufacturer && rawModelNumber) { manufacturerModelStr = `${manufacturer} | ${rawModelNumber}`; } 
        else if (manufacturer) { manufacturerModelStr = manufacturer; } 
        else if (rawModelNumber) { manufacturerModelStr = rawModelNumber; }

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Asset Info: ${targetTag}</title>
            
            <script src="https://cdnjs.cloudflare.com/ajax/libs/bwip-js/4.1.1/bwip-js-min.js"></script>

            <style>
                :root { 
                    --primary: #0056b3; --bg: #f4f7f6; --card: #fff; --text: #333; --muted: #666; --border: #e1e4e8;
                    --lost-bg: #fee2e2; --lost-text: #b91c1c;
                    --deployable: #10b981; --deployed: #3b82f6; --pending: #f59e0b; --undeployable: #ef4444; --archived: #6b7280;
                }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: -apple-system, system-ui, sans-serif; background: var(--bg); color: var(--text); padding: 1rem; display: flex; flex-direction: column; align-items: center; }
                
                .screen-only { display: block; width: 100%; max-width: 600px; margin-top: 2rem; }
                .card { background: var(--card); border-radius: 12px; box-shadow: 0 8px 16px rgba(0,0,0,0.05); overflow: hidden; margin-bottom: 2rem; }
                .card-header { background: var(--primary); color: white; padding: 1.5rem; text-align: center; position: relative; }
                
                .bt-btn { background: #10b981; border: 1px solid white; color: white; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-size: 0.95rem; font-weight: 500; text-decoration: none; }
                .bt-btn:hover { background: #059669; }

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
                
                .actions { text-align: center; margin-bottom: 2rem; width: 100%; max-width: 600px; display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; }
                .btn-secondary { background: none; border: 1px solid var(--primary); color: var(--primary); padding: 10px 16px; border-radius: 8px; cursor: pointer; text-decoration: none; font-size: 0.95rem; }

                .preview-box {
                    background: var(--card);
                    border-radius: 12px;
                    box-shadow: 0 8px 16px rgba(0,0,0,0.05);
                    padding: 1.5rem;
                    text-align: center;
                    width: 100%;
                    display: none; 
                }
                
                .preview-box.active { display: block; }
                .dl-button.active { display: inline-block; }
                .dl-button { display: none; }

                .preview-box h2 {
                    font-size: 1rem;
                    color: var(--muted);
                    text-transform: uppercase;
                    margin-bottom: 1rem;
                    letter-spacing: 1px;
                }
                canvas {
                    max-width: 100%;
                    height: auto;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    background: white; 
                }

                @media (min-width: 600px) { .data-row { display: grid; grid-template-columns: 150px 1fr; align-items: center; } }
            </style>
        </head>
        <body>
            <div class="screen-only">
                <div class="card">
                    <div class="card-header">
                        <h1>Device Information</h1>
                        <p>Tag: ${targetTag}</p>
                    </div>
                    ${bannerHtml}
                    <div class="card-body">
                        <div class="data-grid">${rowsHtml}</div>
                        ${contactHtml}
                    </div>
                </div>

                <div class="preview-box ${showLabelUI ? 'active' : ''}">
                    <h2>Live Label Preview (15mm)</h2>
                    <canvas id="renderCanvas" width="720" height="180"></canvas>
                </div>
            </div>

            <div class="actions screen-only">
                <a href="#" onclick="event.preventDefault(); window.location.href='/' + window.location.search;" class="btn-secondary">Search Another Asset</a>
                <button class="bt-btn dl-button ${showLabelUI ? 'active' : ''}" onclick="downloadLabelPNG()">Download 15mm Label</button>
            </div>

            <script>
                function renderLabelToCanvas() {
                    const canvas = document.getElementById('renderCanvas');
                    const ctx = canvas.getContext('2d');

                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = 'black';

                    const canvasWidth = 720; 
                    const canvasHeight = 180;
                    
                    const dmSize = 135; 
                    const dmPaddingTop = 5;
                    const dmX = 8; 
                    
                    const textX = dmX + dmSize + 5; 
                    const qrSize = 170;
                    const qrX = canvasWidth - qrSize - 5; 
                    const qrY = 5;
                    
                    const textWidth = qrX - textX - 10; 

                    const drawBarcode = (type, text, x, y, w, h) => {
                        const tempCanvas = document.createElement('canvas');
                        try {
                            bwipjs.toCanvas(tempCanvas, {
                                bcid: type,
                                text: text,
                                scale: 5,
                                includetext: false,
                                paddingwidth: 0,
                                paddingheight: 0
                            });
                            ctx.drawImage(tempCanvas, x, y, w, h);
                        } catch (e) {
                            console.error('Barcode Error:', e);
                        }
                    };

                    drawBarcode('datamatrix', '${targetTag}', dmX, dmPaddingTop, dmSize, dmSize);
                    
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.font = 'bold 24px Arial, sans-serif';
                    ctx.fillText('${targetTag}', dmX + (dmSize / 2), dmSize + dmPaddingTop + 5, dmSize + 20);

                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle'; 
                    
                    const lines = [];
                    const company = '${company || ''}'.trim();
                    if (company) lines.push({ text: 'Property of ' + company, isBold: true });
                    
                    const assetName = '${assetName || ''}'.trim();
                    if (assetName) lines.push({ text: assetName, isBold: false });
                    
                    const serial = '${serial || ''}'.trim();
                    if (serial) lines.push({ text: serial, isBold: false });
                    
                    const mfgModel = '${manufacturerModelStr}'.trim();
                    if (mfgModel) lines.push({ text: mfgModel, isBold: false });

                    const lineCount = lines.length;
                    if (lineCount > 0) {
                        const ySpacing = canvasHeight / lineCount; 
                        let fontSize = 44;
                        if (lineCount === 4) fontSize = 36;
                        if (lineCount === 2) fontSize = 52;
                        if (lineCount === 1) fontSize = 64;
                        
                        lines.forEach((line, index) => {
                            ctx.font = (line.isBold ? 'bold ' : '') + fontSize + 'px Arial, sans-serif';
                            const yPos = (ySpacing * index) + (ySpacing / 2);
                            ctx.fillText(line.text, textX, yPos, textWidth);
                        });
                    }

                    const lostAndFoundUrl = '${hostUrl}/${targetTag}';
                    drawBarcode('qrcode', lostAndFoundUrl, qrX, qrY, qrSize, qrSize);
                }

                if (${showLabelUI}) {
                    window.addEventListener('load', () => {
                        setTimeout(renderLabelToCanvas, 100);
                    });
                }

                function downloadLabelPNG() {
                    const canvas = document.getElementById('renderCanvas');
                    const dataUrl = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.download = 'AssetLabel_15mm_${targetTag}.png';
                    link.href = dataUrl;
                    link.click();
                }
            </script>
        </body>
        </html>
        `;

        return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    } catch (e) {
        return new Response('Internal Error', { status: 500 });
    }
}