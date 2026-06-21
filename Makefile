.DEFAULT_GOAL := help
.PHONY: help apk apk-clean start typecheck lint format format-write test check db-generate

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

apk: ## Build a signed offline APK in Docker → ./build-output/trackit.apk
	docker compose run --rm --build apk-builder

apk-clean: ## Remove built APK artifacts and the builder image
	rm -rf build-output
	-docker image rm trackit-apk-builder

start: ## Start the Expo dev server
	pnpm start

typecheck: ## Type-check (tsc --noEmit, must pass with zero `any`)
	pnpm typecheck

lint: ## Run eslint
	pnpm lint

format: ## Check formatting (prettier)
	pnpm format

format-write: ## Apply formatting (prettier --write)
	pnpm format:write

test: ## Run the test suite (vitest)
	pnpm test

check: typecheck lint format test ## Run typecheck + lint + format + test

db-generate: ## Regenerate Drizzle migrations after schema changes
	pnpm db:generate
