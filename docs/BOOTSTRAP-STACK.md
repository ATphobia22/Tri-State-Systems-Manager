# TSM Bootstrap Stack

Honest foundation that starts locally. **Not** complete HEC-RAS / MODFLOW / PDAL / OpenMI / Unreal.

```bash
cp .env.bootstrap.example .env
docker compose -f docker-compose.bootstrap.yml up -d
export DATABASE_URL=postgres://tsm:tsm@127.0.0.1:5433/tsm
npx tsx services/migration-runner/src/index.ts
```

Ports: PostGIS **5433**, Redis **6379**, Martin **3001**.
Canonical app: `tsm-console/docker-compose.yml`.
