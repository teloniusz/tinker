#!/usr/bin/env python3

import os
import socket
import time
import subprocess
import threading
import typing as t
if t.TYPE_CHECKING:
    import argparse

import runlib


APPNAME = 'MasserFront'
runlib.init()


def cmd_run(args: 'argparse.Namespace'):
    def wait_until_open(host: str, port: int, msg: str, tries: int, sleep: int):
        for _ in range(tries):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                if sock.connect_ex((host, port)) == 0:
                    time.sleep(sleep)   # to workaround react-scripts clearing screen
                    print(msg)
                    return
            time.sleep(1)
        raise TimeoutError(f'Socket not opened in {tries} seconds')

    thrs: t.Optional[t.List[threading.Thread]] = None
    host = args.host or 'localhost'
    public_port = args.port or (4000 if args.full or args.nginx else 5000)
    public_url = f'http://{host}:{public_port}/'
    if args.full or args.nginx:
        thrs = [
            threading.Thread(
                target=subprocess.run,
                args=(['/usr/sbin/nginx', '-p', os.environ['ROOTDIR'], '-c', 'nginx.conf', '-g', 'daemon off;'],)
            ),
            threading.Thread(
                target=wait_until_open,
                args=(
                    host,
                    3000 if args.full else 4000,
                    f'*** Upstream started. Use \x1b[31;1m{public_url}\x1b[0;0m to connect via forward proxy ***',
                    50,
                    5 if args.full else 1
                )
            ),
            *(
                (threading.Thread(
                    target=subprocess.run,
                    args=(['npm', 'start'],),
                    kwargs={
                        'cwd': os.environ['ROOTDIR'] + '/web',
                        'env': {
                            **os.environ,
                            'PUBLIC_URL': public_url,
                            'BROWSER': 'none'
                        }
                    }
                ),) if args.full else ()
            )
        ]
        for thr in thrs:
            thr.start()
    try:
        if not args.nginx:
            from app import app

            app.sio.run(app, args.host, args.port, debug=args.debug)
    finally:
        for thr in thrs or ():
            thr.join()


def setup_parser(parser: 'argparse.ArgumentParser'):
    parser.add_argument('--host', help='Server host')
    parser.add_argument('-p', '--port', help='Server port number')
    parser.add_argument('-d', '--debug', action='store_true', default=False, help='Debug mode')
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--full', action='store_true', help='Start in parallel npm and nginx')
    group.add_argument('--nginx', action='store_true', help='Run nginx only')
    parser.set_defaults(call=cmd_run)


if __name__ == '__main__':
    main_parser, subparsers = runlib.get_parser()
    setup_parser(subparsers.add_parser('wsrun', help='Run dev server with websocket (SoketIO) support'))
    runlib.main(main_parser)
