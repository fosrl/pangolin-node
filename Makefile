.PHONY: build build-release test clean

major_tag := $(shell echo $(tag) | cut -d. -f1)
minor_tag := $(shell echo $(tag) | cut -d. -f1,2)
build-release:
	@if [ -z "$(tag)" ]; then \
		echo "Error: tag is required. Usage: make build-release tag=<tag>"; \
		exit 1; \
	fi
	docker buildx build \
		--build-arg DATABASE=sqlite \
		--platform linux/arm64,linux/amd64 \
		--tag fosrl/remote-node:latest \
		--tag fosrl/remote-node:$(major_tag) \
		--tag fosrl/remote-node:$(minor_tag) \
		--tag fosrl/remote-node:$(tag) \
		--push .

test:
	docker run -it -p 3001:3001 -p 3002:3002 -v ./config:/app/config fosrl/remote-node:latest

clean:
	docker rmi remote-node