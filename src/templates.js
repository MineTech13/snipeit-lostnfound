// src/templates.js

export function getSearchPageHtml() {
    return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Snipe-IT Lost & Found</title>
    <style>
        body { 
            font-family: system-ui, -apple-system, sans-serif; 
            background: #f4f4f5; 
            color: #333; 
            margin: 0; 
            padding: 20px; 
        }
        .container { 
            max-width: 1000px; 
            margin: 0 auto; 
            background: #fff; 
            padding: 20px; 
            border-radius: 8px; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
        }
        h1 { font-size: 1.5rem; margin-top: 0; }
        .hidden { display: none !important; }
        
        /* Editor Styles */
        #editor-container { 
            margin-top: 30px; 
            border-top: 2px solid #e4e4e7; 
            padding-top: 20px; 
            display: flex; 
            gap: 20px; 
            flex-wrap: wrap;
        }
        .panel { 
            background: #fff; 
            border: 1px solid #d4d4d8; 
            border-radius: 8px; 
            padding: 20px; 
            flex: 1; 
            min-width: 400px;
        }
        .field-item { 
            border: 1px solid #e4e4e7; 
            border-radius: 6px; 
            padding: 15px; 
            margin-bottom: 15px; 
            background: #fafafa; 
        }
        .field-row { 
            display: flex; 
            gap: 10px; 
            margin-bottom: 10px; 
            align-items: center; 
        }
        label { 
            font-size: 0.875rem; 
            font-weight: 600; 
            display: flex; 
            flex-direction: column; 
            width: 100%; 
        }
        input, select, button { 
            margin-top: 5px; 
            padding: 8px; 
            border: 1px solid #d4d4d8; 
            border-radius: 4px; 
            font-size: 0.875rem; 
        }
        button { 
            background: #2563eb; 
            color: #fff; 
            border: none; 
            cursor: pointer; 
            font-weight: 600; 
        }
        button:hover { background: #1d4ed8; }
        button.danger { background: #ef4444; margin-top: 10px; width: 100%; }
        button.danger:hover { background: #b91c1c; }
        textarea { 
            width: 100%; 
            height: 120px; 
            margin-top: 10px; 
            font-family: monospace; 
            padding: 10px; 
            box-sizing: border-box; 
        }
        .preview-canvas { 
            border: 2px dashed #a1a1aa; 
            width: 100%; 
            height: 400px; 
            position: relative; 
            background: #fff; 
            overflow: hidden; 
        }
        .preview-element { 
            position: absolute; 
            border: 1px solid #3b82f6; 
            background: rgba(59, 130, 246, 0.1); 
            padding: 4px 8px; 
            font-size: 0.75rem; 
            user-select: none; 
            white-space: nowrap; 
        }
        #open-editor-btn { 
            background: #10b981; 
            margin-bottom: 20px;
        }
        #open-editor-btn:hover { background: #059669; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Snipe-IT Lost & Found</h1>
        <p>Geben Sie einen Asset-Tag ein, um Informationen abzurufen.</p>
        
        <!-- Standard Homepage Inhalt hier -->
        <form id="asset-form" action="/" method="GET">
            <input type="text" name="tag" placeholder="Asset Tag (z.B. AST-001)" required>
            <button type="submit">Suchen</button>
        </form>

        <hr style="margin: 30px 0; border: 0; border-top: 1px solid #e4e4e7;">

        <!-- Versteckter Editor Button -->
        <button id="open-editor-btn" class="hidden">Label Layout Editor öffnen</button>
        
        <div id="editor-container" class="hidden">
            <div class="panel">
                <h2 style="margin-top: 0;">Layout Editor</h2>
                <div id="fields-container"></div>
                <button onclick="addField()">+ Neues Feld hinzufügen</button>
                
                <h3 style="margin-top: 20px; border-bottom: 1px solid #e4e4e7; padding-bottom: 5px;">Export</h3>
                <button onclick="exportBase64()">Als Base64 generieren</button>
                <textarea id="base64-output" placeholder="Base64 String für die ENV Variable (z.B. LABEL_LAYOUT_DEFAULT)..." readonly></textarea>
            </div>

            <div class="panel">
                <h2 style="margin-top: 0;">Vorschau</h2>
                <div class="preview-canvas" id="preview-canvas"></div>
            </div>
        </div>
    </div>

    <script>
        // Prüft, ob '?label' in der URL existiert
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('label')) {
            document.getElementById('open-editor-btn').classList.remove('hidden');
        }

        document.getElementById('open-editor-btn').addEventListener('click', function() {
            const editor = document.getElementById('editor-container');
            editor.classList.toggle('hidden');
            if (!editor.classList.contains('hidden') && layout.length === 0) {
                renderEditor();
            }
        });

        let layout = [];
        const snipeItFields = [
            'asset_tag', 'name', 'serial', 'model_number', 
            'category', 'manufacturer', 'status_label', 'custom_fields'
        ];

        function addField() {
            layout.push({ 
                id: Date.now(), 
                type: 'text', 
                snipeItField: 'asset_tag', 
                x: 20, 
                y: 20, 
                fontSize: 12, 
                conditionField: '', 
                conditionOperator: 'always', 
                conditionValue: '' 
            });
            renderEditor();
        }

        window.updateField = function(id, key, value) {
            const field = layout.find(f => f.id === id);
            if (field) { 
                field[key] = value; 
                renderEditor(); 
            }
        };

        window.removeField = function(id) {
            layout = layout.filter(f => f.id !== id);
            renderEditor();
        };

        window.renderEditor = function() {
            const container = document.getElementById('fields-container');
            container.innerHTML = '';
            
            layout.forEach(field => {
                const div = document.createElement('div');
                div.className = 'field-item';
                div.innerHTML = \`
                    <div class="field-row">
                        <label>Typ: 
                            <select onchange="updateField(\${field.id}, 'type', this.value)">
                                <option value="text" \${field.type === 'text' ? 'selected' : ''}>Text</option>
                                <option value="qrcode" \${field.type === 'qrcode' ? 'selected' : ''}>QR-Code</option>
                                <option value="barcode" \${field.type === 'barcode' ? 'selected' : ''}>Barcode 1D</option>
                            </select>
                        </label>
                        <label>Datenfeld: 
                            <select onchange="updateField(\${field.id}, 'snipeItField', this.value)">
                                \${snipeItFields.map(f => \`<option value="\${f}" \${field.snipeItField === f ? 'selected' : ''}>\${f}</option>\`).join('')}
                            </select>
                        </label>
                    </div>
                    <div class="field-row">
                        <label>X (px): <input type="number" value="\${field.x}" onchange="updateField(\${field.id}, 'x', parseInt(this.value))"></label>
                        <label>Y (px): <input type="number" value="\${field.y}" onchange="updateField(\${field.id}, 'y', parseInt(this.value))"></label>
                        <label>Größe: <input type="number" value="\${field.fontSize || 12}" onchange="updateField(\${field.id}, 'fontSize', parseInt(this.value))"></label>
                    </div>
                    <div class="field-row">
                        <label>Bedingung Feld: 
                            <select onchange="updateField(\${field.id}, 'conditionField', this.value)">
                                <option value="">Keine Prüfung</option>
                                \${snipeItFields.map(f => \`<option value="\${f}" \${field.conditionField === f ? 'selected' : ''}>\${f}</option>\`).join('')}
                            </select>
                        </label>
                        <label>Operator: 
                            <select onchange="updateField(\${field.id}, 'conditionOperator', this.value)">
                                <option value="always" \${field.conditionOperator === 'always' ? 'selected' : ''}>Immer</option>
                                <option value="not_empty" \${field.conditionOperator === 'not_empty' ? 'selected' : ''}>Nicht leer</option>
                                <option value="empty" \${field.conditionOperator === 'empty' ? 'selected' : ''}>Leer</option>
                                <option value="equals" \${field.conditionOperator === 'equals' ? 'selected' : ''}>Gleich</option>
                            </select>
                        </label>
                        <label>Wert: <input type="text" value="\${field.conditionValue}" onchange="updateField(\${field.id}, 'conditionValue', this.value)" \${field.conditionOperator !== 'equals' ? 'disabled' : ''}></label>
                    </div>
                    <button class="danger" onclick="removeField(\${field.id})">Entfernen</button>
                \`;
                container.appendChild(div);
            });
            renderPreview();
        };

        window.renderPreview = function() {
            const canvas = document.getElementById('preview-canvas');
            canvas.innerHTML = '';
            layout.forEach(field => {
                const el = document.createElement('div');
                el.className = 'preview-element';
                el.style.left = field.x + 'px';
                el.style.top = field.y + 'px';
                let cond = field.conditionField ? \`<br><i>(if \${field.conditionField})</i>\` : '';
                el.innerHTML = \`<b>[\${field.type.toUpperCase()}]</b> \${field.snipeItField}\${cond}\`;
                canvas.appendChild(el);
            });
        };

        window.exportBase64 = function() {
            const jsonString = JSON.stringify(layout);
            document.getElementById('base64-output').value = btoa(encodeURIComponent(jsonString));
        };
    </script>
</body>
</html>`;
}

export function getAssetPageHtml(assetData) {
    return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Asset Details</title>
    <style>
        body { font-family: system-ui, sans-serif; background: #f4f4f5; padding: 20px; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Asset: ${assetData.asset_tag || 'Unbekannt'}</h1>
        <p>Name: ${assetData.name || '-'}</p>
        <p>Status: ${assetData.status_label?.name || '-'}</p>
        <a href="/">Zurück</a>
    </div>
</body>
</html>`;
}

export function getErrorPageHtml(message) {
    return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fehler</title>
    <style>
        body { font-family: system-ui, sans-serif; background: #fef2f2; padding: 20px; color: #991b1b; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #f87171; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Ein Fehler ist aufgetreten</h1>
        <p>${message}</p>
        <a href="/">Zurück</a>
    </div>
</body>
</html>`;
}