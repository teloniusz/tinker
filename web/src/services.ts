import { io, Socket } from 'socket.io-client'
import axios from 'axios'
import { UserInfo } from './models/user'
import { FetchParams, FetchParamsNorcv, FlaskResponse, is_success, make_resp, RecvParams, SendData } from './models/network'

let socket: Socket | null = null;
let urlPrefix = '';

export const getSocket = (uri?: string) => {
  if (!socket) {
    urlPrefix = !uri || uri === '/' ?
        '' :
        uri.endsWith('/') ?
            uri.slice(0, -1) :
            uri;
    socket = io({ path: urlPrefix + '/socket.io', transports: ['websocket'] });
  }
  return socket
}

export const getPrefix = () => urlPrefix;

export const socketConnected = () => !!socket?.connected

const reconnect = () => {
    if (socket) {
        socket.disconnect();
        socket.connect();
    }
}

const req = async <T = string>(
    uri: string, method: 'post' | 'get' | 'put' | 'delete', { opname, config }: FetchParams, data?: object
): Promise<T> => {
    const errmsg = opname ? `${opname} (${method.toUpperCase()} ${uri})` : `HTTP ${method} to ${uri}`
    const response = await axios[method]<T>(urlPrefix + uri, data, config).catch((error) => {
        const msg = error instanceof Error ? error.message : `${error}`
        console.log(`Error in ${errmsg}: ${msg}`, error)
        return error.response;
    });
    return response && response.data;
}

const fetch = async <T = string>(uri: string, params: FetchParams, data?: object) =>
    req<T>(uri, data !== undefined ? 'post': 'get', params, data)

const httpPut = async (uri: string, data: object) =>
    req<null>(uri, 'put', {}, data)

const httpDelete = async (uri: string) =>
    req<null>(uri, 'delete', {})

async function sendrcv(msg: string, { timeout, response, norcv }: FetchParamsNorcv, ...data: SendData[]): Promise<RecvParams<number>>;
async function sendrcv<T = string>(msg: string, { timeout, response, norcv }: FetchParams, ...data: SendData[]): Promise<RecvParams<T>>;
async function sendrcv<T = string>(msg: string, { timeout, response, norcv }: FetchParams | FetchParamsNorcv, ...data: SendData[]) {
    const socket = getSocket();
    const respmsg = response || `${msg}_response`
    return new Promise((resolve, reject) => {
        const start = Date.now()
        const timeoutId = norcv && !timeout ? null : setTimeout(() => {
            reject(new Error(`Timeout: Did not receive ${respmsg} event`))
        }, timeout || 15000);
        if (!norcv) {
            socket.once(respmsg, (res: RecvParams<T>) => {
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                }
                if (!Array.isArray(res) || res.length !== 2) {
                    reject(new Error(`Invalid response format for ${respmsg}: ${JSON.stringify(res)}`))
                    return
                }
                resolve(res)
            })
        }
        socket.emit(msg, ...data, () => {
            if (norcv) {
                if (timeoutId !== null)
                    clearTimeout(timeoutId);
                resolve([ 'success', Date.now() - start ] as RecvParams<number>);
            }
        });
    });
}
const send = (msg: string, ...data: SendData[]) => sendrcv(msg, { norcv: true } as FetchParamsNorcv, ...data);

const unwrapSocketResponse = <T>(resp: RecvParams<any>): T => {
    const [status, payload] = resp as any;
    if (status === 'error') {
        const msg = typeof payload === 'string' ? payload : JSON.stringify(payload);
        throw new Error(msg || 'Socket error');
    }
    if (payload && typeof payload === 'object' && 'meta' in payload && 'response' in payload) {
        return payload.response as T;
    }
    return payload as T;
};

export const getVersion = async <T>() => sendrcv<T>('hello', {}, { data: `now is: ${new Date().toLocaleString()}` });

export const getUserInfo = async () => sendrcv<{ user: UserInfo }>('userinfo', {})

export const logIn = async (user: string, password: string) => {
    const [res, msg] = await fetch<RecvParams<string>>('/api/base/login', {}, { user, password });
    if (res === 'success')
        reconnect();
    return [res, msg];
}

export const logOut = async () => {
    await fetch<RecvParams<string>>('/api/base/logout', {});
    reconnect();
}

export const register = async (data: { username: string, email: string, password: string, token: string }) => {
    const res = await fetch<FlaskResponse>('/api/base/cregister', {});

    if (is_success(res)) {
        return (await fetch<FlaskResponse>('/api/base/cregister', { config: { headers: {'X-CSRFToken': res.response.csrf_token}}}, {
            csrf_token: res.response.csrf_token, ...data
        }));
    }
    return res;
}

export const sendReset = async (data: { email: string, token: string }) => {
    const res = await fetch<FlaskResponse>('/api/base/csendreset', {});
    if (is_success(res)) {
        return (await fetch<FlaskResponse>('/api/base/csendreset', { config: { headers: {'X-CSRFToken': res.response.csrf_token}}}, {
            csrf_token: res.response.csrf_token, ...data
        }));
    }
    return res;
}

export const checkReset = async (token: string) => {
    return await fetch<FlaskResponse>(`/api/base/creset/${token}`, {});
}

export const reset = async (data: { password: string, password_confirm: string, key: string, token: string }) => {
    const { key, ...rest } = data;
    const res = await fetch<FlaskResponse>(`/api/base/creset/${key}`, {});
    if (is_success(res)) {
        return (await fetch<FlaskResponse>(`/api/base/creset/${key}`, { config: { headers: {'X-CSRFToken': res.response.csrf_token}}}, {
            csrf_token: res.response.csrf_token, ...rest
        }));
    }
    return res;
}

export const updateUser = async (
    data: { first_name: string, last_name: string, password: string | null, email: string, token: string }
) => {
    return make_resp(
        await sendrcv<FlaskResponse>('update_profile', {}, data.first_name, data.last_name, data.password, data.email, data.token)
    )
}

// Data sets stubs
export const getDatasets = async () => {
    // Call the Flask REST endpoint to list datasets
    const res = await fetch<{ datasets: any[] }>('/api/datasets/list', {});
    return (res && res.datasets) ? res.datasets : [];
};

export const downloadDataset = async (id: number) => {
    // Use the socket.io endpoint to request the original dataset (returns base64)
    const resp = await sendrcv<any>('get_orig_dataset', {}, id) as RecvParams<any>;
    const payload = unwrapSocketResponse<{ dataset: any }>(resp);
    if (!payload || !payload.dataset || !payload.dataset.data) {
        throw new Error('Invalid dataset response');
    }
    const b64 = payload.dataset.data as string;
    // decode base64 to binary
    const binaryString = atob(b64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    return { blob, filename: payload.dataset.name || payload.dataset.label || `dataset-${id}` };
};

export const preprocessDataset = async (id: number) => {
    const resp = await sendrcv<any>('preprocess', { timeout: 600000 }, id) as RecvParams<any>;
    const payload = unwrapSocketResponse<{ id: number; status: string; message?: string }>(resp);
    if (!payload || payload.status !== 'ok') {
        throw new Error(payload?.message || 'Preprocess failed');
    }
    return payload;
};

export const downloadProcessedData = async (id: number) => {
    const resp = await sendrcv<any>('get_processed_dataset', { timeout: 600000 }, id) as RecvParams<any>;
    const payload = unwrapSocketResponse<{ processed: { id: number; name: string; data: string } }>(resp);
    if (!payload || !payload.processed || !payload.processed.data) {
        throw new Error('Invalid processed dataset response');
    }
    const b64 = payload.processed.data as string;
    const binaryString = atob(b64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    return { blob, filename: payload.processed.name || `processed_dataset-${id}` };
};

export const removeDataset = async (id: number) => {
    // Backend expects a GET to /api/datasets/remove/<id>
    const res = await fetch(`/api/datasets/remove/${id}`, {});
    return res;
};

export const uploadDataset = async (file: File, label: string, common = false) => {
    const fd = new FormData();
    fd.append('label', label);
    fd.append('dataset', file, file.name);
    const uri = common ? '/api/datasets/create/common' : '/api/datasets/create';
    try {
        // Use the custom fetch helper for POST with FormData
        const response = await fetch(uri, {}, fd);
        if (typeof response === 'string') {
            // Try to parse as JSON, otherwise wrap as error object
            try {
                return JSON.parse(response);
            } catch {
                return {
                    meta: { code: 500 },
                    response: { field_errors: { name: ['Upload failed: Unexpected response from server'] } }
                };
            }
        }
        return response;
    } catch (err: any) {
        throw { code: 500, message: err.message || 'Upload failed' };
    }
}

export const updateDataset = async (id: number, label: string | null, datafileLabels: Record<number | string, string>) => {
    const resp = await sendrcv<any>('update_dataset', {}, id, label, datafileLabels) as RecvParams<any>;
    const payload = unwrapSocketResponse<any>(resp);
    if (!payload || payload.status !== 'ok') {
        throw new Error('Update failed');
    }
    return payload;
};

export const resetProcessing = async(id: number) => {
    const resp = await sendrcv<any>('reset_processing', {}) as RecvParams<any>;
    const payload = unwrapSocketResponse<any>(resp);
    if (!payload || payload.status !== 'ok') {
        throw new Error('Update failed');
    }
    return payload;
}
