.DEFAULT_GOAL := help
.PHONY: help install dev build up down logs db-up migrate seed lint typecheck test format clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	pnpm install

dev: ## Run all apps in dev mode
	pnpm dev

build: ## Build everything
	pnpm build

up: ## Start the full stack (docker compose)
	docker compose up -d

down: ## Stop the stack
	docker compose down

logs: ## Tail stack logs
	docker compose logs -f

db-up: ## Start just Postgres
	docker compose up -d db

migrate: ## Run database migrations
	pnpm db:migrate

seed: ## Seed demo data
	pnpm db:seed

lint: ## Lint
	pnpm lint

typecheck: ## Typecheck
	pnpm typecheck

test: ## Run tests
	pnpm test

format: ## Format code
	pnpm format

clean: ## Remove build artifacts and node_modules
	pnpm clean
