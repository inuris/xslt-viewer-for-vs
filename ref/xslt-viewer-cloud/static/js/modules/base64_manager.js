
let base64Cache = {};
let nextId = 1;

export function clearBase64Cache() {
    base64Cache = {};
    nextId = 1;
}

export function detachBase64(content) {
    // Regex to match data URI scheme for images
    // Matches: data:image/png;base64,.....
    // We need to be careful not to match inside the placeholder itself if we run this multiple times
    const regex = /data:image\/(?:png|jpg|jpeg|gif|svg\+xml|webp);base64,[A-Za-z0-9+/=]+/g;
    
    return content.replace(regex, (match) => {
        const id = `__BASE64_IMAGE_${nextId++}__`;
        base64Cache[id] = match;
        return id;
    });
}

export function attachBase64(content) {
    // Replace all placeholders with their original content
    return content.replace(/__BASE64_IMAGE_(\d+)__/g, (match) => {
        return base64Cache[match] || match;
    });
}

export function getBase64Map() {
    return base64Cache;
}
