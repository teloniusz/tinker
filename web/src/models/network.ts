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

type ErrType = string | { code: string | number, msg: string, field_data?: { errors: string[], field_errors: { [key: string]: string } } }

export const stringifyError = (err: ErrType) => typeof err === 'string' ? err : err.msg;

export type RecvParams<T = string> =
    { reqId?: string, status: 'error', error: ErrType } |
    { reqId: string, status?: 'success', data: T };

export function recvSuccess<T>(
    response: RecvParams<T>
): response is Extract<RecvParams<T>, { status?: 'success' }> {
    return response.status !== 'error';
}

type RespOK = { csrf_token?: string } & { [key: string]: any }
type RespError = {
    errors?: string[]
    field_errors: Record<string, string[]>
}

type ErrorCode = 400 | 401 | 403 | 404 | 405 | 408 | 409 | 410 | 412 | 413 | 415 | 422 | 429 | 500 | 502 | 503 | 504;

export type FlaskResponse =
    | { meta: { code: 200 }, response: RespOK }
    | { meta: { code: ErrorCode }, response: RespError }

export const flaskSuccess = (res: FlaskResponse): res is { meta: { code: 200 }, response: RespOK } => res.meta?.code === 200;

export const makeFlaskResponse = (res: RecvParams<FlaskResponse>, { code, field }: { code?: ErrorCode, field?: string } = {}): FlaskResponse =>
    recvSuccess(res) ? res.data : { meta: { code: code || 400 }, response: { field_errors: { [field || '_']: [stringifyError(res.error)] } } };
