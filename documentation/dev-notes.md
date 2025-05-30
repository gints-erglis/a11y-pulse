### After Prisma scheme update

Local env

```bash
docker compose exec app npx prisma migrate dev --name update_schema
```

Stage or Prod

```bash
docker compose exec app npx prisma migrate deploy
```
