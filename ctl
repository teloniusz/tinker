#!/usr/bin/env python3

import os
import subprocess
import sys
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    import argparse

import runlib


APPNAME = 'tINKer'
runlib.init()


def cmd_run(args: 'argparse.Namespace'):
    if args.full:
        proc = subprocess.Popen(['npm', 'start'], cwd=os.environ['ROOTDIR'] + '/web', env={**os.environ, 'BROWSER': 'none'})
    else:
        proc = None
    try:
        subprocess.run(['gunicorn', '-b', '127.0.0.1:5000', '-w', '1', '-k', 'eventlet', '--reload', 'app:app'])
    except KeyboardInterrupt:
        sys.exit(0)
    finally:
        if proc:
            proc.terminate()


def setup_parser(parser: 'argparse.ArgumentParser'):
    parser.add_argument('--host', help='Server host')
    parser.add_argument('-p', '--port', help='Server port number')
    parser.add_argument('-d', '--debug', action='store_true', default=False, help='Debug mode')
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--full', action='store_true', help='Start npm in parallel')
    parser.set_defaults(call=cmd_run)


if __name__ == '__main__':
    main_parser, subparsers = runlib.get_parser()
    setup_parser(subparsers.add_parser('wsrun', help='Run dev server with websocket (SoketIO) support'))
    runlib.main(main_parser)
