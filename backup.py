#!/usr/bin/env python3.8

import os
import subprocess

import yaml


def main():
    output = {}

    manifests_path = os.getenv("MANIFESTS_PATH") or os.path.expanduser(
        "~/audius-k8s-manifests"
    )

    for service in ["creator-node", "discovery-provider", "identity"]:
        config_map = os.path.join(manifests_path, f"audius/{service}/{service}-cm.yaml")

        proc = subprocess.run(
            f"git show HEAD:audius/{service}/{service}-cm.yaml",
            capture_output=True,
            shell=True,
            check=True,
            cwd=manifests_path,
        )

        org_config = {
            conf["metadata"]["name"]: conf["data"]
            for conf in yaml.safe_load_all(proc.stdout.decode("utf-8"))
        }
        usr_config = {
            conf["metadata"]["name"]: conf["data"]
            for conf in yaml.safe_load_all(open(config_map, "r"))
        }

        output[service] = {}
        for cm in usr_config:
            out_cm = cm[len(service) + 1 : -3]

            output[service][out_cm] = {}
            if cm not in org_config:
                output[service][out_cm] = usr_config[cm]
                continue

            for key in {*usr_config[cm].keys(), *org_config[cm].keys()}:
                if key in usr_config[cm] and key not in org_config[cm]:
                    output[service][out_cm][key] = usr_config[cm][key]
                elif key not in usr_config[cm] and key in org_config[cm]:
                    output[service][out_cm][key] = ""
                elif usr_config[cm][key] != org_config[cm][key]:
                    output[service][out_cm][key] = usr_config[cm][key]

    with open(os.path.join(manifests_path, "config.yaml"), "w") as stream:
        yaml.safe_dump(output, stream)


if __name__ == "__main__":
    main()
