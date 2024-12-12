import { AxiosRequestConfig } from "axios";


export type FetchParams = {
    opname?: string;
    timeout?: number;
    response?: string;
    norcv?: false;
    config?: AxiosRequestConfig;
}

export type FetchParamsNorcv = FetchParams & {
    norcv: true;
}

export type RecvParams<T = string> = [status: 'error', msg: string] | [status: 'success', msg: T];

export type SendData = string | number | boolean | object | null;

type RespOK = { csrf_token?: string }
type RespError = {
    errors?: string[]
    field_errors: Record<string, string[]>
}

export type FlaskResponse =
    | { meta: { code: 200 }, response: RespOK }
    | { meta: { code: number }, response: RespError }

export const is_success = (res: FlaskResponse): res is { meta: { code: 200 }, response: RespOK } => res.meta?.code === 200;

export const make_resp = ([status, res]: RecvParams<FlaskResponse>): FlaskResponse =>
    status === 'success' ? res : { meta: { code: 400 }, response: { field_errors: { _: [res] } } };
