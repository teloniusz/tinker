import { io, Socket } from 'socket.io-client'
import axios from 'axios'
import { UserInfo } from './models/user'
import { FetchParams, FetchParamsNorcv, FlaskResponse, is_success, make_resp, RecvParams, SendData } from './models/network'

let socket: Socket | null = null

export const getSocket = () => {
  if (!socket) {
    socket = io()
  }
  return socket
}

export const socketConnected = () => !!socket?.connected

const reconnect = () => {
    if (socket) {
        socket.disconnect();
        socket.connect();
    }
}


const fetch = async <T = string>(uri: string, { opname, config }: FetchParams, data?: object): Promise<T> => {
    const method = data !== undefined ? 'post': 'get';
    const errmsg = opname ? `${opname} (${method.toUpperCase()} ${uri})` : `HTTP ${method} to ${uri}`
    const response = await axios[method]<T>(uri, data, config).catch((error) => {
        const msg = error instanceof Error ? error.message : `${error}`
        console.log(`Error in ${errmsg}: ${msg}`, error)
        return error.response;
    });
    return response.data;
}

async function sendrcv(msg: string, { timeout, response, norcv }: FetchParamsNorcv, ...data: SendData[]): Promise<RecvParams<number>>;
async function sendrcv<T = string>(msg: string, { timeout, response, norcv }: FetchParams, ...data: SendData[]): Promise<RecvParams<T>>;
async function sendrcv<T = string>(msg: string, { timeout, response, norcv }: FetchParams | FetchParamsNorcv, ...data: SendData[]) {
    const socket = getSocket();
    const respmsg = response || `${msg}_response`
    return new Promise((resolve, reject) => {
        const start = Date.now()
        const timeoutId = norcv && !timeout ? null : setTimeout(() => {
            reject(`Timeout: Did not receive ${respmsg} event`)
        }, timeout || 15000);
        if (!norcv && timeoutId) {
            socket.once(respmsg, (res: RecvParams<T>) => {
                clearTimeout(timeoutId);
                try {
                    const [,] = res;
                    resolve(res)
                } catch (error) {
                    reject(`Couldn't unpack message: ${res}`)
                }
            })
        }
        socket.emit(msg, ...data, () => {
            if (norcv) {
                if (timeoutId !== null)
                    clearTimeout(timeoutId);
                resolve(Date.now() - start);
            }
        });
    });
}

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
