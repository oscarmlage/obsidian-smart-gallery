.PHONY: build dev clean docker-build docker-dev help

IMAGE_NAME := obsidian-smart-gallery-builder
CONTAINER_NAME := obsidian-smart-gallery-temp

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

docker-build: ## Build the plugin using Docker
	docker build -t $(IMAGE_NAME) .
	docker rm -f $(CONTAINER_NAME) 2>/dev/null || true
	docker run --name $(CONTAINER_NAME) $(IMAGE_NAME) npm run build
	docker cp $(CONTAINER_NAME):/app/main.js ./main.js
	docker rm $(CONTAINER_NAME)
	@echo "Build complete: main.js created"

docker-lint: ## Run linting using Docker
	docker build -t $(IMAGE_NAME) .
	docker run --rm $(IMAGE_NAME) npm run lint

docker-shell: ## Open a shell in the Docker container
	docker build -t $(IMAGE_NAME) .
	docker run --rm -it $(IMAGE_NAME) bash

build: ## Build the plugin (requires local Node.js)
	npm run build

dev: ## Start development mode (requires local Node.js)
	npm run dev

lint: ## Run linting (requires local Node.js)
	npm run lint

clean: ## Clean build artifacts
	rm -f main.js main.js.map
	rm -rf node_modules

install: ## Install dependencies (requires local Node.js)
	npm ci
