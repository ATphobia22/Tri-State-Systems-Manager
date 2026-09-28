# Optional OSRM runtime. The .osrm dataset is supplied by deployment and is never
# downloaded implicitly because routing data must have explicit provenance.
FROM ghcr.io/project-osrm/osrm-backend:v5.27.1@sha256:b1ca5d72da456e82f81b8732a095c2357b00710099efa844040d1eb40b4b5386
WORKDIR /data
ENTRYPOINT ["osrm-routed"]
CMD ["/data/region.osrm", "--algorithm", "MLD"]
