const threadSubscribers = new Map();

function getBucket(threadId) {
    const key = String(threadId);
    if (!threadSubscribers.has(key)) {
        threadSubscribers.set(key, new Set());
    }
    return threadSubscribers.get(key);
}

export function subscribeToSupportThread(threadId, res) {
    const bucket = getBucket(threadId);
    bucket.add(res);
}

export function unsubscribeFromSupportThread(threadId, res) {
    const key = String(threadId);
    const bucket = threadSubscribers.get(key);
    if (!bucket) return;
    bucket.delete(res);
    if (bucket.size === 0) {
        threadSubscribers.delete(key);
    }
}

export function publishSupportThreadEvent(threadId, payload) {
    const key = String(threadId);
    const bucket = threadSubscribers.get(key);
    if (!bucket || bucket.size === 0) return;

    const data = `event: support-message\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of bucket) {
        try {
            res.write(data);
        } catch (_) {
            bucket.delete(res);
        }
    }

    if (bucket.size === 0) {
        threadSubscribers.delete(key);
    }
}
