# Bash startup tools lib. Requires bash >= 4.2
# 1. create an executable 'env.sh' bash script with:
#
# #!/bin/bash
#
# . tools.sh
#
# setup_env() {    # set up the environment there
#   ok "Entering virtual environment" source .venv/bin/activate
#   ...
# }
#
# :command() {     # a command starts with :, or with :: if the command doesn't require setup_env
#   : "This is help text for the command"
#   ...
# }
#
# go "$@"
#
# 2. usage:
# . ./env.sh                     - set up, update and enter the virtual environment
# ./env.sh                       - set up and update the venv
# ./env.sh <command> [args...]   - as above, then run one of the commands defined as :command() or ::command()
#                                  function below. If both are defined, the last one overwrites.
# ./env.sh -h | --help           - show available operations

# ANSI colors
_load_colors() {
    local _colors=(gry red grn yel blu mag cya wht gry_ red_ grn_ yel_ blu_ mag_ cya_ wht_ Gry Red Grn Yel Blu Mag Cya Wht Gry Red_ Grn_ Yel_ Blu_ Mag_ Cya_ Wht_)
    local _esc=$'\e'
    _rst="$_esc[0;0m"
    for i in {30..37}; do
        seq="[0;${i}m";     declare -g "_${_colors[$[$i-30+16]]}"="$_esc$seq"    # base color ($_red)
        seq="[0;2;${i}m";   declare -g "_${_colors[$[$i-30]]}"="$_esc$seq"       # dimmed ($_red_)
        seq="[0;1;${i}m";   declare -g "_${_colors[$[$i-30+24]]}"="$_esc$seq"    # bold ($_Red)
        seq="[0;1;2;${i}m"; declare -g "_${_colors[$[$i-30+8]]}"="$_esc$seq"     # bold dimmed ($_Red_)
    done
}

_load_colors

# run a command and report the result in nice colors
ok() {
    printf "%-60s \e7" "$1..."; shift
    if "$@"; then
        echo $'\e8'"$_Wht[$_Grn ok $_Wht]$_rst"
    else
        ret=$?
        echo $'\e8'"$_Wht[$_Red fail $_Wht]$_rst"
        return $ret
    fi
}

_get_operations() {
    unset _ops _help _env; declare -ga _ops; declare -gA _help _env; _set_hlp() { hlp="$@"; }
    while read -r name cmd args; do
        local hlp= useenv=1
        [[ $cmd = : ]] && eval "_set_hlp $args"
        [[ $name = :* ]] && name=${name#:} && useenv=
        _ops+=("$name")
        _help[$name]=${useenv:+[venv] }$hlp
        _env[$name]=${useenv:-0}
    done < <(declare -f | sed -rn '/^:([^(]+)[(][)]\s*/{h;n;n;x;G;s//\1/;p}')
}

usage() {
    [[ $1 = -h || $1 = --help ]] || echo "${_Red}Unknown operation: $_Cya$1$_rst"
    echo "${_Wht}Usage:$_rst $0 [operation]"
    echo "Available operations:"
    declare -p _ops >/dev/null 2>&1 || _get_operations
    for idx in "${!_ops[@]}"; do
        name=${_ops[$idx]}
        printf " * $_Cya%-20s$_rst %s\n" "$name" "${_help[$name]}"
    done
    return 1
}

# empty setup, to be overridden
setup_env() { :; }

# empty prepare, to be overridden
prepare_run() { :; }

go() {
    local op=$1
    [[ $op ]] || { setup_env; return; }
    _get_operations
    if [[ $op && ${_env[$op]} ]]; then
        [[ ${_env[$op]} = 1 ]] && { setup_env || return; } || set -- ":$@"
        ok "Operation: $_Cya$op$_rst" ":$@"
    else
        usage "$op"
    fi
}

:exec() {
    : "Run a cmd or enter a shell inside venv"
    [[ $1 ]] || set -- bash
    "$@"
}
