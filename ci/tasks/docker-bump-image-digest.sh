#!/bin/bash

#! Auto synced from Shared CI Resources repository
#! Don't change this file, instead change it in github.com/blinkbitcoin/concourse-shared

set -eu

export digest=$(cat ./edge-image/digest)
export ref=$(cat ./repo/.git/short_ref)
export app_version=$(cat version/version)

pushd charts-repo

yq -i e ".${PREFIX:+$PREFIX.}image.digest = strenv(digest)" ./charts/${CHARTS_SUBDIR}/values.yaml

if [ -z "${PREFIX:-}" ]; then
  # if prefix is not set, that metadata usually doesn't make sense. The CHARTS_SUBDIR might not be the repo at the same time
  sed -i "s|\(digest: \"${digest}\"\).*$|\1 # METADATA:: repository=https://github.com/GaloyMoney/${CHARTS_SUBDIR};commit_ref=${ref};app=${CHARTS_SUBDIR};|g" "./charts/${CHARTS_SUBDIR}/values.yaml"
  # So this is probably some subchart (e.g. galoy-nostr in galoy-pay) so bumping app_version doesn't make sense either
  yq -i e '.appVersion = strenv(app_version)' ./charts/${CHARTS_SUBDIR}/Chart.yaml
fi

if [[ -z $(git config --global user.email) ]]; then
  git config --global user.email "202112752+blinkbitcoinbot@users.noreply.github.com"
fi
if [[ -z $(git config --global user.name) ]]; then
  git config --global user.name "CI blinkbitcoinbot"
fi

(
  cd $(git rev-parse --show-toplevel)
  git merge --no-edit ${BRANCH}
  git add -A
  git status
  git commit -m "chore(${CHARTS_SUBDIR}): bump ${CHARTS_SUBDIR} image to '${digest}'"
)
