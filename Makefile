.PHONY: db/reset
db/reset:
	npx prisma migrate reset

.PHONY: db/migrate
db/migrate:
	npx prisma migrate dev

.PHONY: run/prisma
run/prisma:
	npx prisma studio