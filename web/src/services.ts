import { io, Socket } from 'socket.io-client'
import axios from 'axios'
import { UserInfo } from './models/user'
import { FetchParams, FetchParamsNorcv, FlaskResponse, flaskSuccess, makeFlaskResponse, RecvParams, recvSuccess, stringifyError } from './models/network'
import { VersionResponse } from './models/version';

let socket: Socket | null = null;
let urlPrefix = '';
const clientId = crypto.randomUUID();
sessionStorage.setItem("clientId", clientId);


class DeferredTask<T = RecvParams<string>> {
    private static pending = new Map<string, Map<string, DeferredTask<any>>>();
    private static handlersInstalled = new Set<string>();

    reqName: string;
    responseId: string;
    private _resolve: (value: T) => void;
    private _reject: (reason?: unknown) => void;
    expires: number;
    timeoutId: number | null = null;
    respMsg: string;

    constructor(reqName: string, responseId: string, resolve: (value: T) => void, reject: (reason?: unknown) => void, expires: number) {
        this.reqName = reqName;
        this.responseId = responseId;
        this._resolve = resolve;
        this._reject = reject;
        this.expires = expires;
        this.respMsg = `${this.reqName}_response`;

        const pending = (DeferredTask<T>).pending
        let reqMap = pending.get(reqName)
        if (reqMap === undefined) {
            reqMap = new Map();
            pending.set(reqName, reqMap);
        }
        reqMap.set(responseId, this);
        if (!(DeferredTask<T>).handlersInstalled.has(reqName)) {
            (DeferredTask<T>).handlersInstalled.add(reqName);
            (DeferredTask<T>).installReqHandler(getSocket(), reqName);
        }
        this.setResponseTimeout()
    }

    delete() {
        const reqMap = DeferredTask.pending.get(this.reqName);
        if (reqMap !== undefined) {
            reqMap.delete(this.responseId)
        }
    }

    reject(reason?: unknown) { this.delete(); this._reject(reason); }
    resolve(value: T) { this.delete(); this._resolve(value); }

    setResponseTimeout() {
        const timeout = this.expires - Date.now();
        const timeoutId = timeout > 0 ? window.setTimeout(() => {
            this.reject(new Error(`Timeout: Did not receive ${this.respMsg} event`))
        }, timeout) : null;
        if (this.timeoutId)
            window.clearTimeout(this.timeoutId);
        return this.timeoutId = timeoutId;
    }

    static installReqHandler(sock: Socket<any, any>, reqName: string) {
        const reqMap = DeferredTask.pending.get(reqName);
        if (reqMap === undefined)
            return;
        const respMsg = `${reqName}_response`;
        sock.on(respMsg, (res: RecvParams<unknown>) => {
            if (typeof res.reqId !== "string")
                throw new Error(`No request ID in the response: ${JSON.stringify(res)}`);
            const task = reqMap.get(res.reqId)
            if (task === undefined) {
                console.log(`No task with request ID: ${res.reqId}`)
                return
            }
            if (task.expires < Date.now()) {
                const err = { code: 998, msg: `Timeout: response ID ${res.reqId} received after the deadline` };
                task.reject({ exc: new Error(err.msg), err })
                task.delete()
                return
            }
            if (task.timeoutId)
                clearTimeout(task.timeoutId)
            if (res.status === "error") {
                const { error, ...rest } = res;
                task.resolve({ error: typeof error === 'string' ? { code: 999, msg: error } : error, ...rest })
            } else
                task.resolve(res)
            task.delete();
        });
    }
}

export const getSocket = (uri?: string) => {
  if (!socket) {
    urlPrefix = !uri || uri === '/' ?
        '' :
        uri.endsWith('/') ?
            uri.slice(0, -1) :
            uri;
    socket = io({ path: urlPrefix + '/socket.io', transports: ['websocket'], query: { clientId } });
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

/*
sendrcv returns a Promise that resolves to:
- a RecvParams<T> object if norcv is false, that is:
  * { reqId: string, status?: "success", data: T } if success
  * { reqId: string, status: "error", error: string | { msg: string, code: string | number } }
- a RecvParams<number> object if norcv is true, containing the round-trip time in milliseconds
*/
async function sendrcv(msg: string, { timeout, norcv }: FetchParamsNorcv, data: any): Promise<RecvParams<number>>;
async function sendrcv<T = string>(msg: string, { timeout, norcv }: FetchParams, data: any): Promise<RecvParams<T>>;
async function sendrcv<T = string>(msg: string, { timeout, norcv }: FetchParams): Promise<RecvParams<T>>;
async function sendrcv<T = string>(msg: string): Promise<RecvParams<T>>;
async function sendrcv(msg: string, { timeout, norcv }: FetchParams | FetchParamsNorcv = {}, data: any = null) {
    const socket = getSocket();
    return new Promise((resolve, reject) => {
        const start = Date.now()
        const reqId = data?.reqId || crypto.randomUUID();
        if (!norcv)
            new DeferredTask(msg, reqId, resolve, reject, start + (timeout || 15000));
        socket.emit(msg, { reqId, data }, () => {
            if (norcv)
                resolve({ data: Date.now() - start } as RecvParams<number>);
        });
    }).catch((err) => ({ reqId: data?.reqId, status: 'error', error: { code: 995, msg: `${err?.message || err}` } }));
}

const send = (msg: string, data: any) => sendrcv(msg, { norcv: true } as FetchParamsNorcv, data);

export const getVersion = async () => sendrcv<VersionResponse>('hello', {}, `now is: ${new Date().toLocaleString()}`);

export const getUserInfo = async () => sendrcv<{ user: UserInfo }>('userinfo')

export const logIn = async (user: string, password: string) => {
    const res = await fetch<RecvParams<string>>('/api/base/login', {}, { user, password });
    if (recvSuccess(res))
        reconnect();
    return res;
}

export const logOut = async () => {
    await fetch<RecvParams<string>>('/api/base/logout', {});
    reconnect();
}

const fetchFlaskCSRF = async (uri: string, data?: object) => {
    const res = await fetch<FlaskResponse>(uri, {});
    if (flaskSuccess(res)) {
        return (await fetch<FlaskResponse>(uri, { config: { headers: {'X-CSRFToken': res.response.csrf_token}}}, {
            csrf_token: res.response.csrf_token, ...data
        }));
    }
    return res;
}

export const register = async (data: { username: string, email: string, password: string, token: string }) => fetchFlaskCSRF('/api/base/cregister', data);

export const sendReset = async (data: { email: string, token: string }) => fetchFlaskCSRF('/api/base/csendreset', data);

export const checkReset = async (token: string) => fetch<FlaskResponse>(`/api/base/creset/${token}`, {});

export const reset = async (
    { key, ...data }: { password: string, password_confirm: string, key: string, token: string }
) => fetchFlaskCSRF(`/api/base/creset/${key}`, data);

export const updateUser = async (
    data: { first_name: string, last_name: string, password: string | null, email: string, token: string }
) => makeFlaskResponse(await sendrcv<FlaskResponse>('update_profile', {}, data))

export const getDatasets = async () => {
    const res = await fetch<{ datasets: any[] }>('/api/datasets/list', {});
    return (res && res.datasets) ? res.datasets : [];
};

const decodeBase64 = (b64: string) => {
    const bytes = Uint8Array.from(atob(b64), char => char.charCodeAt(0))
    return new Blob([bytes], { type: 'application/octet-stream' })
}

export const downloadDataset = async (id: number) => {
    const resp = await sendrcv<FlaskResponse>('get_orig_dataset', {}, [id]);
    if (!recvSuccess(resp))
        throw new Error(`Error downloading dataset: ${stringifyError(resp.error)}`)
    if (!flaskSuccess(resp.data))
        throw new Error(`Error downloading dataset: ${Object.values(resp.data.response.field_errors).join('\n')}`)
    const dataset = resp.data.response.dataset
    if (!dataset?.data)
        throw new Error('Invalid dataset response');
    const blob = decodeBase64(dataset.data);
    return { blob, filename: dataset.name || dataset.label || `dataset-${id}` };
};

export const preprocessDataset = async (id: number) => {
    const resp = await sendrcv<{ id: number; status: string; message?: string }>('preprocess', { timeout: 600000 }, [id])
    if (!recvSuccess(resp))
        throw new Error(stringifyError(resp.error));
    return resp.data
};

export const downloadProcessedData = async (id: number) => {
    const resp = await sendrcv<FlaskResponse>('get_processed_dataset', { timeout: 600000 }, [id])
    if (!recvSuccess(resp))
        throw new Error(`Error downloading processed data: ${stringifyError(resp.error)}`)
    if (!flaskSuccess(resp.data))
        throw new Error(`Error downloading dataset: ${Object.values(resp.data.response.field_errors).join('\n')}`)
    const processed = resp.data.response.processed
    if (!processed?.data)
        throw new Error('Invalid processed dataset response');
    const blob = decodeBase64(processed.data)
    return { blob, filename: processed.name || `processed_dataset-${id}` };
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
                return makeFlaskResponse({ status: 'error', error: 'Upload failed: unexpected response from server' }, { field: 'name' })
            }
        }
        return response;
    } catch (err: any) {
        return makeFlaskResponse({ status: 'error', error: `Upload failed: exception: ${err}` }, { field: 'name' })
    }
}

export const updateDataset = async (id: number, label: string | null, datafileLabels: Record<number | string, string>) => {
    const resp = makeFlaskResponse(await sendrcv<FlaskResponse>('update_dataset', {}, { id, label, datafile_labels: datafileLabels }))
    if (!flaskSuccess(resp))
        throw new Error(`Update failed: ${Object.values(resp.response.field_errors)}`)
    if (resp.response?.status !== 'ok')
        throw new Error(`Update failed: ${resp.response?.error}`)
    return resp.response
};

export const resetProcessing = async(id: number) => {
    const resp = makeFlaskResponse(await sendrcv<FlaskResponse>('reset_processing', {}, { id }))
    if (!flaskSuccess(resp))
        throw new Error(`Reset failed: ${Object.values(resp.response.field_errors)}`)
    if (resp.response?.status !== 'ok')
        throw new Error(`Reset failed: ${resp.response?.error}`)
    return resp.response
}