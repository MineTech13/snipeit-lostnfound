export async function getAssetByTag(env, tag) {
    return await fetch(`${env.SNIPEIT_URL}/api/v1/hardware/bytag/${tag}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${env.SNIPEIT_TOKEN}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    });
}

export async function getUserById(env, id) {
    const response = await fetch(`${env.SNIPEIT_URL}/api/v1/users/${id}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${env.SNIPEIT_TOKEN}`, 'Accept': 'application/json' }
    });
    if (response.ok) {
        return await response.json();
    }
    return null;
}

export async function getCompanyById(env, id) {
    const response = await fetch(`${env.SNIPEIT_URL}/api/v1/companies/${id}`, {
        method: 'GET', 
        headers: { 'Authorization': `Bearer ${env.SNIPEIT_TOKEN}`, 'Accept': 'application/json' }
    });
    if (response.ok) {
        return await response.json();
    }
    return null;
}