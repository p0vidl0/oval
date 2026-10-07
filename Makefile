# Thin facade over `pnpm run task` (Node stack).
COMPOSE_PROJECT_NAME ?= oval-dev

.PHONY: help render-env infra-up infra-down dev-up dev-down dev-restart dev db-migrate validate validate-full test-all test-manual test-integration e2e-up e2e-down test-e2e

help:
	@pnpm run task -- help

render-env:
	@pnpm run task -- render-env $(COMPOSE_PROJECT_NAME)

infra-up:
	@pnpm run task -- infra-up $(COMPOSE_PROJECT_NAME)

infra-down:
	@pnpm run task -- infra-down $(COMPOSE_PROJECT_NAME)

dev-up:
	@pnpm run task -- dev-up

dev-down:
	@pnpm run task -- dev-down

dev-restart:
	@pnpm run task -- dev-restart

dev:
	@pnpm run task -- dev

db-migrate:
	@pnpm run task -- db-migrate $(COMPOSE_PROJECT_NAME)

validate:
	@pnpm run task -- validate

validate-full:
	@pnpm run task -- validate-full

test-all:
	@pnpm run task -- test-all

test-manual:
	@pnpm run task -- test-manual

test-integration:
	@pnpm run task -- test-integration

e2e-up:
	@pnpm run task -- e2e-up

e2e-down:
	@pnpm run task -- e2e-down

test-e2e:
	@pnpm run task -- test-e2e
