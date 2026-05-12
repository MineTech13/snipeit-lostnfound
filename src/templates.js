export function getSearchPageHtml(notFound = false) {
    const placeholder = notFound ? 'Tag not found, try again: ' : 'Enter Asset Tag (e.g. 12345)';
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
                        <input type="text" id="tagInput" placeholder="${placeholder}" required>
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

export function getAssetPageHtml(data) {
    const rows = [
        { label: 'Name', value: data.assetName },
        { label: 'Manufacturer', value: data.manufacturer },
        { label: 'Model', value: data.modelName ? `${data.modelName}${data.rawModelNumber ? ` [${data.rawModelNumber}]` : ''}` : null },
        { label: 'Serial', value: data.serial },
        { label: 'Status', value: data.statusLabel ? `${data.statusLabel} <span class="badge meta-${data.statusMeta}">${data.statusMeta}</span>` : null },
        { label: 'Owner', value: data.company },
        { label: 'Assigned To', value: data.assignedToDisplay },
        { label: 'Location', value: data.location }
    ];

    const rowsHtml = rows
        .filter(row => row.value)
        .map(row => `<div class="data-row"><span class="label">${row.label}</span><span class="value">${row.value}</span></div>`)
        .join('');

    let contactHtml = '';
    if (data.showContact) {
        if (data.customContactText) {
            contactHtml = `<div class="contact-section">
                <h2>Contact Information</h2>
                <p class="contact-desc">${data.customContactText}</p>
            </div>`;
        } else if (data.supportEmail || data.supportPhone) {
            contactHtml = `<div class="contact-section">
                <h2>Contact Owner</h2>
                <p class="contact-desc">Please reach out to us for support or if you found this device.</p>
                <div class="contact-details">
                    ${data.supportEmail ? `<div class="contact-item"><span class="contact-label">Email</span> <a href="mailto:${data.supportEmail}">${data.supportEmail}</a></div>` : ''}
                    ${data.supportPhone ? `<div class="contact-item"><span class="contact-label">Phone</span> <a href="tel:${data.supportPhone}">${data.supportPhone}</a></div>` : ''}
                </div>
            </div>`;
        }
    }

    let bannerHtml = data.isLost ? `<div class="status-banner lost-banner"><strong>⚠️ ATTENTION:</strong> This device has been reported as LOST.</div>` : '';

    let manufacturerModelStr = '';
    if (data.manufacturer) {
        if (data.rawModelNumber) {
            manufacturerModelStr = `${data.manufacturer} | ${data.rawModelNumber}`;
        } else if (data.modelName) {
            manufacturerModelStr = `${data.manufacturer} | ${data.modelName}`;
        } else {
            manufacturerModelStr = data.manufacturer;
        }
    } else {
        if (data.rawModelNumber) {
            manufacturerModelStr = data.rawModelNumber;
        } else if (data.modelName) {
            manufacturerModelStr = data.modelName;
        }
    }

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Asset Info: ${data.targetTag}</title>
        
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
            
            .contact-section { 
                margin-top: 2rem; 
                padding: 1.5rem; 
                background: rgba(0, 86, 179, 0.04); 
                border: 1px solid rgba(0, 86, 179, 0.1); 
                border-radius: 10px; 
                text-align: center; 
            }
            .contact-section h2 { 
                color: var(--primary); 
                font-size: 1.1rem; 
                margin-bottom: 0.5rem; 
                text-transform: uppercase; 
                letter-spacing: 0.5px;
            }
            .contact-desc { 
                color: var(--muted); 
                font-size: 0.95rem; 
                margin-bottom: 1.25rem; 
                line-height: 1.4;
            }
            .contact-details { 
                display: flex; 
                flex-direction: column; 
                gap: 0.75rem; 
            }
            .contact-item {
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            .contact-label {
                font-size: 0.75rem;
                color: var(--muted);
                text-transform: uppercase;
                margin-bottom: 2px;
            }
            .contact-item a {
                color: var(--primary);
                font-weight: 600;
                font-size: 1.1rem;
                text-decoration: none;
            }
            .contact-item a:hover {
                text-decoration: underline;
            }

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
                    <p>Tag: ${data.targetTag}</p>
                </div>
                ${bannerHtml}
                <div class="card-body">
                    <div class="data-grid">${rowsHtml}</div>
                    ${contactHtml}
                </div>
            </div>

            <div class="preview-box ${data.showLabelUI ? 'active' : ''}">
                <h2>Live Label Preview (15mm)</h2>
                <canvas id="renderCanvas" width="720" height="180"></canvas>
            </div>
        </div>

        <div class="actions screen-only">
            <a href="#" onclick="event.preventDefault(); window.location.href='/' + window.location.search;" class="btn-secondary">Search Another Asset</a>
            <button class="bt-btn dl-button ${data.showLabelUI ? 'active' : ''}" onclick="downloadLabelPNG()">Download 15mm Label</button>
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

                drawBarcode('datamatrix', '${data.targetTag}', dmX, dmPaddingTop, dmSize, dmSize);
                
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.font = 'bold 24px Arial, sans-serif';
                ctx.fillText('${data.targetTag}', dmX + (dmSize / 2), dmSize + dmPaddingTop + 5, dmSize + 20);

                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle'; 
                
                const lines = [];
                const company = '${data.company || ''}'.trim();
                if (company) lines.push({ text: 'Property of ' + company, isBold: true });
                
                const assetName = '${data.assetName || ''}'.trim();
                if (assetName) lines.push({ text: assetName, isBold: false });
                
                const serial = '${data.serial || ''}'.trim();
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

                const lostAndFoundUrl = '${data.hostUrl}/${data.targetTag}';
                drawBarcode('qrcode', lostAndFoundUrl, qrX, qrY, qrSize, qrSize);
            }

            if (${data.showLabelUI}) {
                window.addEventListener('load', () => {
                    setTimeout(renderLabelToCanvas, 100);
                });
            }

            function downloadLabelPNG() {
                const canvas = document.getElementById('renderCanvas');
                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = 'AssetLabel_15mm_${data.targetTag}.png';
                link.href = dataUrl;
                link.click();
            }
        </script>
    </body>
    </html>
    `;
}