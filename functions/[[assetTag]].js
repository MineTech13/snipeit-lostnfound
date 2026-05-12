import { parseContactConfig } from '../src/utils.js';
import { getAssetByTag, getUserById, getCompanyById } from '../src/snipeit.js';
import { getSearchPageHtml, getAssetPageHtml } from '../src/templates.js';

export async function onRequestGet(context) {
    const assetTag = context.params.assetTag;
    const env = context.env;
    const requestUrl = new URL(context.request.url);
    const hostUrl = env.BASE_URL ? env.BASE_URL.replace(/\/$/, '') : requestUrl.origin;
    
    const showLabelUI = requestUrl.searchParams.has('label');

    if (!assetTag || assetTag.length === 0 || assetTag[0] === "") {
        return new Response(getSearchPageHtml(false), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    }

    if (!env.SNIPEIT_URL || !env.SNIPEIT_TOKEN) {
        return new Response('Configuration Error: Missing environment variables.', { status: 500 });
    }

    try {
        const targetTag = Array.isArray(assetTag) ? assetTag[0] : assetTag;

        const assetResponse = await getAssetByTag(env, targetTag);

        if (!assetResponse.ok) {
            if (assetResponse.status === 404) {
                return new Response(getSearchPageHtml(true), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
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
            const userData = await getUserById(env, data.assigned_to.id);
            if (userData) {
                const userName = userData.name || data.assigned_to.name;
                assignedToDisplay = userData.website 
                    ? `<a href="${userData.website}" target="_blank" rel="noopener noreferrer" class="user-link">${userName}</a>`
                    : userName;
                if (userData.phone) assignedToDisplay += ` (<a href="tel:${userData.phone}" class="user-phone">${userData.phone}</a>)`;
            } else {
                assignedToDisplay = data.assigned_to.name;
            }
        } else if (data.assigned_to) {
            assignedToDisplay = data.assigned_to.name;
        }

        let supportEmail = null, supportPhone = null, companyNotes = '';
        if (data.company?.id) {
            const cData = await getCompanyById(env, data.company.id);
            if (cData) {
                supportEmail = cData.email; 
                supportPhone = cData.phone; 
                companyNotes = cData.notes || '';
            }
        }

        const assetConfig = parseContactConfig(assetNotes);
        const companyConfig = parseContactConfig(companyNotes);
        let showContact = assetConfig.hide ? false : (assetConfig.show || assetConfig.customText ? true : (companyConfig.hide ? false : (companyConfig.show || companyConfig.customText ? true : isLost)));
        let customContactText = assetConfig.customText || companyConfig.customText;

        const html = getAssetPageHtml({
            targetTag,
            assetName,
            manufacturer,
            modelName,
            rawModelNumber,
            serial,
            company,
            location,
            statusLabel,
            statusMeta,
            isLost,
            assignedToDisplay,
            showContact,
            customContactText,
            supportEmail,
            supportPhone,
            showLabelUI,
            hostUrl
        });

        return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    } catch (e) {
        return new Response('Internal Error', { status: 500 });
    }
}