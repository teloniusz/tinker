# vim:ft=bash

docker_dir=${docker_dir:-docker}
export USERID=${USERID:-$(id -u)} GROUPID=${GROUPID:-$(id -g)}

::compose() {
    : "Wrapper for docker compose"
    echo
    local re=' up '
    if [[ " $@ " =~ $re ]]; then
        setup_env && prepare_run
    fi
    docker compose -f "$docker_dir/compose.yml" "$@"
}

::compose_dev() {
    : "Wrapper for the dev compose"
    ::compose -f "$docker_dir/compose.dev.yml" "$@"
}

::cstart() {
    : "Start docker compose suite"
    ::compose up -d "$@"
}

::crun() {
    : "Run docker compose suite (start & show live logs)"
    ::cstart && {
        ::compose logs --follow --tail=200 || true
    }
}

::cstop() {
    : "Stop docker compose suite"
    ::compose down "$@"
}

::build() {
    : "Build docker compose suite"

    ::compose build --build-arg "USERID=$USERID" "$@"
}

::rebuild() {
    : "Remove the cache and build the compose suite"

    docker builder prune && ::build "$@"
}
