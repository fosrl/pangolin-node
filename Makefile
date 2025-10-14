.PHONY: build build-release test clean

major_tag := $(shell echo $(tag) | cut -d. -f1)
minor_tag := $(shell echo $(tag) | cut -d. -f1,2)
build-release:
	@if [ -z "$(tag)" ]; then \
		echo "Error: tag is required. Usage: make build-release tag=<tag>"; \
		exit 1; \
	fi
	docker buildx build \
		--platform linux/arm64,linux/amd64 \
		--tag fosrl/pangolin-node:latest \
		--tag fosrl/pangolin-node:$(major_tag) \
		--tag fosrl/pangolin-node:$(minor_tag) \
		--tag fosrl/pangolin-node:$(tag) \
		--push .

build:
	docker build -t pangolin-node .

test:
	docker run -it -p 3001:3001 -p 3002:3002 -v ./config:/app/config fosrl/pangolin-node:latest

clean:
	docker rmi pangolin-node