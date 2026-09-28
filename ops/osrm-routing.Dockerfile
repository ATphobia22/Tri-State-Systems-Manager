# Optional OSRM runtime. The .osrm dataset is supplied by deployment and is never
# downloaded implicitly because routing data must have explicit provenance.
FROM osrm/osrm-backend:v5.27.1
WORKDIR /data
ENTRYPOINT ["osrm-routed"]
CMD ["/data/region.osrm", "--algorithm", "MLD"]
